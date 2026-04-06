import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { getDatabase } from '../db';
import {
  InstalledModelRow,
  LocalDeviceSupport,
  LocalModelKind,
  LocalModelPlatform,
  LocalModelStatus,
  ModelCatalogItem,
} from '../types';
import { Sha256 } from '../utils/sha256';

const MODEL_DIR = `${FileSystem.documentDirectory}models`;
const SHA256_CHUNK_BYTES = 256 * 1024;

const BUILT_IN_MODEL_CATALOG: ModelCatalogItem[] = [
  {
    id: 'whisper-base',
    kind: 'transcription',
    engine: 'whisper.cpp',
    displayName: 'Whisper Base',
    version: 'starter',
    downloadUrl: '',
    sha256: '',
    sizeBytes: 152 * 1024 * 1024,
    platforms: ['ios', 'android'],
    minFreeSpaceBytes: 1 * 1024 * 1024 * 1024,
    recommended: true,
    experimental: false,
    description: 'Balanced local speech-to-text model for both platforms.',
  },
  {
    id: 'whisper-small',
    kind: 'transcription',
    engine: 'whisper.cpp',
    displayName: 'Whisper Small',
    version: 'starter',
    downloadUrl: '',
    sha256: '',
    sizeBytes: 488 * 1024 * 1024,
    platforms: ['ios', 'android'],
    minFreeSpaceBytes: 2 * 1024 * 1024 * 1024,
    recommended: false,
    experimental: false,
    description: 'Higher accuracy local speech-to-text model with a larger footprint.',
  },
  {
    id: 'gemma-family-ios-default',
    kind: 'summary',
    engine: 'mediapipe-llm',
    displayName: 'Gemma-family iPhone default',
    version: 'starter',
    downloadUrl: '',
    sha256: '',
    sizeBytes: 1_700 * 1024 * 1024,
    platforms: ['ios'],
    minFreeSpaceBytes: 6 * 1024 * 1024 * 1024,
    recommended: true,
    experimental: false,
    description: 'Starter Gemma-family summary model shape for iPhone-compatible MediaPipe bundles.',
  },
  {
    id: 'gemma-family-android-default',
    kind: 'summary',
    engine: 'litert-lm',
    displayName: 'Gemma-family Android default',
    version: 'starter',
    downloadUrl: '',
    sha256: '',
    sizeBytes: 1_800 * 1024 * 1024,
    platforms: ['android'],
    minFreeSpaceBytes: 6 * 1024 * 1024 * 1024,
    recommended: true,
    experimental: false,
    description: 'Starter Gemma-family summary model shape for Android local LLM runtimes.',
  },
  {
    id: 'gemma-family-cross-platform-small',
    kind: 'summary',
    engine: 'mediapipe-llm',
    displayName: 'Gemma-family cross-platform small',
    version: 'starter',
    downloadUrl: '',
    sha256: '',
    sizeBytes: 1_300 * 1024 * 1024,
    platforms: ['ios', 'android'],
    minFreeSpaceBytes: 5 * 1024 * 1024 * 1024,
    recommended: false,
    experimental: true,
    description: 'Experimental small summary model slot for future catalog entries.',
  },
];

type InstalledModelRowRecord = {
  id: string;
  kind: LocalModelKind;
  engine: InstalledModelRow['engine'];
  display_name: string;
  version: string;
  platforms_json: string;
  file_uri: string | null;
  size_bytes: number;
  sha256: string;
  status: LocalModelStatus;
  installed_at: string | null;
  download_url: string;
  recommended: number;
  experimental: number;
  error_message: string | null;
};

export async function ensureModelDirectory() {
  const info = await FileSystem.getInfoAsync(MODEL_DIR);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
  }
}

export async function getInstalledModels(): Promise<InstalledModelRow[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<InstalledModelRowRecord>(
    'SELECT * FROM installed_models ORDER BY display_name ASC'
  );
  return rows.map(mapInstalledModelRow);
}

export async function getInstalledModel(id: string): Promise<InstalledModelRow | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<InstalledModelRowRecord>(
    'SELECT * FROM installed_models WHERE id = ?',
    id
  );
  return row ? mapInstalledModelRow(row) : null;
}

export async function getModelCatalog(modelCatalogUrl?: string): Promise<ModelCatalogItem[]> {
  const catalogUrl = modelCatalogUrl?.trim();

  if (!catalogUrl) {
    return BUILT_IN_MODEL_CATALOG;
  }

  const response = await fetch(catalogUrl);

  if (!response.ok) {
    throw new Error(`Model catalog request failed (${response.status}).`);
  }

  const payload = (await response.json()) as { models?: unknown[] };
  const items = Array.isArray(payload.models)
    ? payload.models
        .map(normalizeCatalogItem)
        .filter((item): item is ModelCatalogItem => Boolean(item))
    : [];

  return items.length ? items : BUILT_IN_MODEL_CATALOG;
}

export function getCatalogItemsForDevice(
  catalog: ModelCatalogItem[],
  support?: LocalDeviceSupport | null
) {
  const platform = getCurrentModelPlatform(support);

  return catalog.filter((item) => item.platforms.includes(platform));
}

export async function downloadModel(
  catalogItem: ModelCatalogItem,
  options?: { onProgress?: (progress: number) => void }
) {
  if (!catalogItem.downloadUrl.trim()) {
    throw new Error('This catalog entry has no download URL yet. Point the app at a hosted model catalog first.');
  }

  if (!catalogItem.platforms.includes(getCurrentModelPlatform())) {
    throw new Error('This model is not available for the current device platform.');
  }

  const freeSpace = await FileSystem.getFreeDiskStorageAsync();

  if (freeSpace < catalogItem.minFreeSpaceBytes) {
    throw new Error('Not enough free space available for this model download.');
  }

  await ensureModelDirectory();

  const targetUri = buildModelFileUri(catalogItem);
  const downloadingRow = buildInstalledRow(catalogItem, {
    fileUri: targetUri,
    status: 'downloading',
    installedAt: null,
    errorMessage: null,
  });
  await upsertInstalledModel(downloadingRow);

  const downloadResumable = FileSystem.createDownloadResumable(
    catalogItem.downloadUrl,
    targetUri,
    undefined,
    (progress) => {
      if (!progress.totalBytesExpectedToWrite || progress.totalBytesExpectedToWrite <= 0) {
        return;
      }

      options?.onProgress?.(progress.totalBytesWritten / progress.totalBytesExpectedToWrite);
    }
  );

  try {
    const result = await downloadResumable.downloadAsync();

    if (!result?.uri) {
      throw new Error('Model download did not return a file path.');
    }

    const info = await FileSystem.getInfoAsync(result.uri);

    if (!info.exists) {
      throw new Error('Downloaded model file was not found on disk.');
    }

    if (catalogItem.sizeBytes > 0 && info.size && Math.abs(info.size - catalogItem.sizeBytes) > 2048) {
      throw new Error('Downloaded model size does not match the catalog entry.');
    }

    if (catalogItem.sha256.trim()) {
      const digest = await computeFileSha256(result.uri);
      if (digest !== catalogItem.sha256.trim().toLowerCase()) {
        throw new Error('Downloaded model checksum did not match the catalog entry.');
      }
    }

    const installedRow = buildInstalledRow(catalogItem, {
      fileUri: result.uri,
      status: 'installed',
      installedAt: new Date().toISOString(),
      errorMessage: null,
    });
    await upsertInstalledModel(installedRow);
    options?.onProgress?.(1);
    return installedRow;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Model download failed.';
    await safeDeleteFile(targetUri);
    await upsertInstalledModel(
      buildInstalledRow(catalogItem, {
        fileUri: null,
        status: 'failed',
        installedAt: null,
        errorMessage: message,
      })
    );
    throw error;
  }
}

export async function deleteInstalledModel(id: string) {
  const existing = await getInstalledModel(id);

  if (existing?.fileUri) {
    await safeDeleteFile(existing.fileUri);
  }

  const db = getDatabase();
  await db.runAsync('DELETE FROM installed_models WHERE id = ?', id);
}

export function getInstalledModelsForKind(models: InstalledModelRow[], kind: LocalModelKind) {
  return models.filter((model) => model.kind === kind && model.status === 'installed');
}

function buildInstalledRow(
  catalogItem: ModelCatalogItem,
  overrides: {
    fileUri: string | null;
    status: LocalModelStatus;
    installedAt: string | null;
    errorMessage: string | null;
  }
): InstalledModelRow {
  return {
    id: catalogItem.id,
    kind: catalogItem.kind,
    engine: catalogItem.engine,
    displayName: catalogItem.displayName,
    version: catalogItem.version,
    platforms: catalogItem.platforms,
    fileUri: overrides.fileUri,
    sizeBytes: catalogItem.sizeBytes,
    sha256: catalogItem.sha256,
    status: overrides.status,
    installedAt: overrides.installedAt,
    downloadUrl: catalogItem.downloadUrl,
    recommended: catalogItem.recommended,
    experimental: catalogItem.experimental,
    errorMessage: overrides.errorMessage,
  };
}

async function upsertInstalledModel(model: InstalledModelRow) {
  const db = getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO installed_models (
      id,
      kind,
      engine,
      display_name,
      version,
      platforms_json,
      file_uri,
      size_bytes,
      sha256,
      status,
      installed_at,
      download_url,
      recommended,
      experimental,
      error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    model.id,
    model.kind,
    model.engine,
    model.displayName,
    model.version,
    JSON.stringify(model.platforms),
    model.fileUri,
    model.sizeBytes,
    model.sha256,
    model.status,
    model.installedAt,
    model.downloadUrl,
    model.recommended ? 1 : 0,
    model.experimental ? 1 : 0,
    model.errorMessage
  );
}

function mapInstalledModelRow(row: InstalledModelRowRecord): InstalledModelRow {
  return {
    id: row.id,
    kind: row.kind,
    engine: row.engine,
    displayName: row.display_name,
    version: row.version,
    platforms: parsePlatforms(row.platforms_json),
    fileUri: row.file_uri,
    sizeBytes: Number(row.size_bytes ?? 0),
    sha256: row.sha256,
    status: row.status,
    installedAt: row.installed_at,
    downloadUrl: row.download_url,
    recommended: Boolean(row.recommended),
    experimental: Boolean(row.experimental),
    errorMessage: row.error_message,
  };
}

function parsePlatforms(value: string) {
  try {
    const parsed = JSON.parse(value) as LocalModelPlatform[];
    return parsed.filter((platform) => platform === 'ios' || platform === 'android');
  } catch {
    return getCurrentModelPlatform() === 'ios'
      ? (['ios'] as LocalModelPlatform[])
      : (['android'] as LocalModelPlatform[]);
  }
}

function normalizeCatalogItem(input: unknown): ModelCatalogItem | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const record = input as Record<string, unknown>;
  const kind = record.kind === 'summary' ? 'summary' : record.kind === 'transcription' ? 'transcription' : null;
  const engine =
    record.engine === 'mediapipe-llm' || record.engine === 'litert-lm' || record.engine === 'whisper.cpp'
      ? record.engine
      : null;
  const platforms = Array.isArray(record.platforms)
    ? record.platforms.filter((value): value is LocalModelPlatform => value === 'ios' || value === 'android')
    : [];

  if (!record.id || !kind || !engine || !platforms.length) {
    return null;
  }

  return {
    id: String(record.id),
    kind,
    engine,
    displayName: String(record.displayName ?? record.id),
    version: String(record.version ?? 'custom'),
    downloadUrl: String(record.downloadUrl ?? ''),
    sha256: String(record.sha256 ?? '').toLowerCase(),
    sizeBytes: Number(record.sizeBytes ?? 0),
    platforms,
    minFreeSpaceBytes: Number(record.minFreeSpaceBytes ?? 0),
    recommended: Boolean(record.recommended),
    experimental: Boolean(record.experimental),
    description: String(record.description ?? ''),
  };
}

function buildModelFileUri(catalogItem: ModelCatalogItem) {
  const extension = inferFileExtension(catalogItem.downloadUrl, catalogItem.engine);
  return `${MODEL_DIR}/${catalogItem.id}${extension}`;
}

function inferFileExtension(downloadUrl: string, engine: ModelCatalogItem['engine']) {
  const urlPath = downloadUrl.split('?')[0] ?? '';
  const match = urlPath.match(/\.[a-zA-Z0-9]+$/);

  if (match?.[0]) {
    return match[0];
  }

  if (engine === 'whisper.cpp') {
    return '.bin';
  }

  if (engine === 'litert-lm') {
    return '.litertlm';
  }

  return '.task';
}

function getCurrentModelPlatform(support?: LocalDeviceSupport | null): LocalModelPlatform {
  if (support?.platform === 'android') {
    return 'android';
  }

  return Platform.OS === 'android' ? 'android' : 'ios';
}

async function computeFileSha256(uri: string) {
  const fileInfo = await FileSystem.getInfoAsync(uri);

  if (!fileInfo.exists || !fileInfo.size) {
    throw new Error('Downloaded file is missing or empty.');
  }

  const hasher = new Sha256();
  let position = 0;

  while (position < fileInfo.size) {
    const base64Chunk = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position,
      length: Math.min(SHA256_CHUNK_BYTES, fileInfo.size - position),
    });

    hasher.update(Uint8Array.from(Buffer.from(base64Chunk, 'base64')));
    position += Math.min(SHA256_CHUNK_BYTES, fileInfo.size - position);
  }

  return hasher.digestHex().toLowerCase();
}

async function safeDeleteFile(uri: string) {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Ignore cleanup failure and let the model row tell the user what happened.
  }
}
