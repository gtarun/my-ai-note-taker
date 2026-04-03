import * as FileSystem from 'expo-file-system/legacy';
import { DocumentPickerAsset } from 'expo-document-picker';

import { getDatabase, mapMeetingRow } from '../db';
import { SummaryPayload, type MeetingRow } from '../types';
import { getAudioDirectory } from './bootstrap';
import { getAppSettings } from './settings';
import { summarizeTranscript, transcribeAudio } from './ai';

type RecordingInput = {
  uri: string;
  title: string;
  durationMs: number;
};

export async function listMeetings(): Promise<MeetingRow[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM meetings ORDER BY datetime(created_at) DESC'
  );
  return rows.map(mapMeetingRow);
}

export async function getMeeting(id: string): Promise<MeetingRow | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM meetings WHERE id = ?', id);
  return row ? mapMeetingRow(row) : null;
}

export async function createMeetingFromRecording(input: RecordingInput) {
  const extension = getExtensionFromPath(input.uri) || '.m4a';
  const audioUri = await copyAudioIntoAppStorage(input.uri, extension);
  return insertMeeting({
    title: input.title,
    audioUri,
    durationMs: input.durationMs,
    sourceType: 'recording',
  });
}

export async function createMeetingFromImport(asset: DocumentPickerAsset) {
  const extension = getExtensionFromPath(asset.name || asset.uri) || '.m4a';
  const audioUri = await copyAudioIntoAppStorage(asset.uri, extension);
  return insertMeeting({
    title: stripExtension(asset.name || 'Imported meeting'),
    audioUri,
    durationMs: 0,
    sourceType: 'import',
  });
}

export async function processMeeting(id: string) {
  const meeting = await getMeeting(id);

  if (!meeting) {
    throw new Error('Meeting not found.');
  }

  const settings = await getAppSettings();
  const transcriptionProvider = settings.providers[settings.selectedTranscriptionProvider];
  const summaryProvider = settings.providers[settings.selectedSummaryProvider];

  if (!transcriptionProvider.apiKey) {
    throw new Error('Add an API key for the selected transcription provider in Settings first.');
  }

  if (!summaryProvider.apiKey) {
    throw new Error('Add an API key for the selected summary provider in Settings first.');
  }

  try {
    await updateMeetingStatus(id, 'transcribing', null);
    const transcriptText = await transcribeAudio({
      providerId: settings.selectedTranscriptionProvider,
      provider: transcriptionProvider,
      audioUri: meeting.audioUri,
    });

    await updateTranscript(id, transcriptText);
    await updateMeetingStatus(id, 'summarizing', null);

    const summary = await summarizeTranscript({
      providerId: settings.selectedSummaryProvider,
      provider: summaryProvider,
      transcriptText,
    });

    await saveSummary(id, summary);
    await updateMeetingStatus(id, 'ready', null);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown processing error.';
    await updateMeetingStatus(id, 'failed', message);
    throw error;
  }
}

export async function renameMeeting(id: string, title: string) {
  const db = getDatabase();
  const cleanTitle = title.trim();

  if (!cleanTitle) {
    throw new Error('Title cannot be empty.');
  }

  await db.runAsync(
    'UPDATE meetings SET title = ?, updated_at = ? WHERE id = ?',
    cleanTitle,
    new Date().toISOString(),
    id
  );
}

export async function deleteMeeting(id: string) {
  const meeting = await getMeeting(id);

  if (!meeting) {
    return;
  }

  const db = getDatabase();

  try {
    const fileInfo = await FileSystem.getInfoAsync(meeting.audioUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(meeting.audioUri, { idempotent: true });
    }
  } catch {
    // If cleanup fails, still remove the meeting row so the user can move on.
  }

  await db.runAsync('DELETE FROM meetings WHERE id = ?', id);
}

async function insertMeeting(input: {
  title: string;
  audioUri: string;
  durationMs: number;
  sourceType: MeetingRow['sourceType'];
}) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = createId();

  await db.runAsync(
    `INSERT INTO meetings (
      id, title, created_at, updated_at, audio_uri, duration_ms, source_type, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.title.trim() || 'Untitled meeting',
    now,
    now,
    input.audioUri,
    Math.max(0, Math.round(input.durationMs)),
    input.sourceType,
    'local_only'
  );

  return id;
}

async function updateMeetingStatus(id: string, status: MeetingRow['status'], errorMessage: string | null) {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE meetings SET status = ?, error_message = ?, updated_at = ? WHERE id = ?',
    status,
    errorMessage,
    new Date().toISOString(),
    id
  );
}

async function updateTranscript(id: string, transcriptText: string) {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE meetings SET transcript_text = ?, updated_at = ? WHERE id = ?',
    transcriptText,
    new Date().toISOString(),
    id
  );
}

async function saveSummary(id: string, summary: SummaryPayload) {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE meetings SET summary_json = ?, summary_short = ?, updated_at = ? WHERE id = ?',
    JSON.stringify(summary),
    summary.summary,
    new Date().toISOString(),
    id
  );
}

async function copyAudioIntoAppStorage(sourceUri: string, extension: string) {
  const destination = `${getAudioDirectory()}/${createId()}${extension}`;
  await FileSystem.copyAsync({
    from: sourceUri,
    to: destination,
  });
  return destination;
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getExtensionFromPath(value: string) {
  const match = value.match(/\.[a-zA-Z0-9]+$/);
  return match?.[0];
}

function stripExtension(value: string) {
  return value.replace(/\.[a-zA-Z0-9]+$/, '');
}
