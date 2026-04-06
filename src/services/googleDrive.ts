import * as FileSystem from 'expo-file-system/legacy';
import { FileSystemUploadType } from 'expo-file-system/legacy';

import { fetchGoogleDriveAccessToken, getAuthSession } from './account';

const APP_ROOT_SEGMENTS = ['mu-fathom', 'recordings'] as const;

function escapeDriveQueryName(name: string) {
  return name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function listChildFolder(accessToken: string, parentId: string, name: string): Promise<string | null> {
  const q = `name='${escapeDriveQueryName(name)}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=5`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const json = (await response.json()) as { files?: { id: string }[] };
  return json.files?.[0]?.id ?? null;
}

async function createChildFolder(accessToken: string, parentId: string, name: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const json = (await response.json()) as { id: string };
  return json.id;
}

async function ensureChildFolder(accessToken: string, parentId: string, name: string): Promise<string> {
  const existing = await listChildFolder(accessToken, parentId, name);
  if (existing) {
    return existing;
  }
  return createChildFolder(accessToken, parentId, name);
}

/** Ensures `{saveFolder}/mu-fathom/recordings/YYYY-MM` exists. */
export async function ensureRecordingDestinationFolder(accessToken: string, saveFolderId: string): Promise<string> {
  let parent = saveFolderId;
  for (const segment of APP_ROOT_SEGMENTS) {
    parent = await ensureChildFolder(accessToken, parent, segment);
  }
  const monthKey = new Date().toISOString().slice(0, 7);
  return ensureChildFolder(accessToken, parent, monthKey);
}

function sanitizeFileNameSegment(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .trim() || 'Recording';
}

function buildRecordingFileName(title: string, extension: string) {
  const day = new Date().toISOString().slice(0, 10);
  const safeTitle = sanitizeFileNameSegment(title);
  return `${day} – ${safeTitle}${extension}`;
}

async function startResumableDriveUpload(
  accessToken: string,
  parentFolderId: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        name: fileName,
        parents: [parentFolderId],
        mimeType,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const location = response.headers.get('Location');

  if (!location) {
    throw new Error('Drive upload did not return a session URL.');
  }

  return location;
}

function getExtensionFromPath(value: string) {
  const match = value.match(/\.[a-zA-Z0-9]+$/);
  return match?.[0] ?? '.m4a';
}

/**
 * Uploads a local recording into Drive under the user-chosen folder, organized as
 * `mu-fathom/recordings/YYYY-MM/YYYY-MM-DD – Title.ext`.
 */
export async function uploadRecordingToUserDrive(params: {
  accessToken: string;
  saveFolderId: string;
  localUri: string;
  title: string;
}): Promise<void> {
  const extension = getExtensionFromPath(params.localUri);
  const mime = extension.toLowerCase() === '.m4a' || extension.toLowerCase() === '.mp4' ? 'audio/mp4' : 'application/octet-stream';
  const destinationFolderId = await ensureRecordingDestinationFolder(params.accessToken, params.saveFolderId);
  const fileName = buildRecordingFileName(params.title, extension);
  const uploadUrl = await startResumableDriveUpload(params.accessToken, destinationFolderId, fileName, mime);

  const uploadResult = await FileSystem.uploadAsync(uploadUrl, params.localUri, {
    httpMethod: 'PUT',
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'Content-Type': mime,
    },
  });

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new Error(`Drive upload failed with status ${uploadResult.status}.`);
  }
}

export async function uploadMeetingRecordingIfConfigured(input: { title: string; localAudioUri: string }): Promise<
  'skipped' | 'uploaded' | 'failed'
> {
  try {
    const session = await getAuthSession();

    if (!session) {
      return 'skipped';
    }

    const { driveConnection } = session.user;

    if (driveConnection.status !== 'connected' || !driveConnection.saveFolderId) {
      return 'skipped';
    }

    const accessToken = await fetchGoogleDriveAccessToken();

    await uploadRecordingToUserDrive({
      accessToken,
      saveFolderId: driveConnection.saveFolderId,
      localUri: input.localAudioUri,
      title: input.title,
    });

    return 'uploaded';
  } catch {
    return 'failed';
  }
}
