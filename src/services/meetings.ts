import * as FileSystem from 'expo-file-system/legacy';
import { DocumentPickerAsset } from 'expo-document-picker';

import { getDatabase, mapMeetingRow } from '../db';
import { SummaryPayload, type MeetingExtractionStatus, type MeetingRow } from '../types';
import { getAudioDirectory } from './bootstrap';
import { extractStructuredData, summarizeTranscript, transcribeAudio } from './ai';
import { getExtractionLayer } from './extractionLayers';
import { appendExtractionLayerRow } from './googleSheets';
import { getInstalledModel } from './localModels';
import { isProviderConfigured } from './providers';
import { getAppSettings } from './settings';

type RecordingInput = {
  uri: string;
  title: string;
  durationMs: number;
};

const AUDIO_READABILITY_ATTEMPTS = 3;
const AUDIO_READABILITY_RETRY_MS = 150;

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

export async function createMeetingFromRecording(input: RecordingInput): Promise<{ id: string; audioUri: string }> {
  const extension = getExtensionFromPath(input.uri) || '.m4a';
  const audioUri = await copyAudioIntoAppStorage(input.uri, extension);
  const id = await insertMeeting({
    title: input.title,
    audioUri,
    durationMs: input.durationMs,
    sourceType: 'recording',
  });
  return { id, audioUri };
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

export async function processMeeting(id: string, options: { layerId?: string | null } = {}) {
  const meeting = await getMeeting(id);

  if (!meeting) {
    throw new Error('Meeting not found.');
  }

  const settings = await getAppSettings();
  const transcriptionProvider = settings.providers[settings.selectedTranscriptionProvider];
  const summaryProvider = settings.providers[settings.selectedSummaryProvider];
  const layer = options.layerId ? await getExtractionLayer(options.layerId) : null;

  if (!isProviderConfigured(settings.selectedTranscriptionProvider, transcriptionProvider, 'transcription')) {
    throw new Error('Configure the selected transcription provider in Settings first.');
  }

  if (!isProviderConfigured(settings.selectedSummaryProvider, summaryProvider, 'summary')) {
    throw new Error('Configure the selected summary provider in Settings first.');
  }

  if (settings.selectedTranscriptionProvider === 'local') {
    const installedModel = await getInstalledModel(transcriptionProvider.transcriptionModel);
    if (!installedModel || installedModel.status !== 'installed') {
      throw new Error('Download and install the selected local transcription model first.');
    }
  }

  if (options.layerId && !layer) {
    throw new Error('Selected extraction layer no longer exists.');
  }

  try {
    await ensureAudioFileReadable(meeting.audioUri);
    await clearMeetingProcessingArtifacts(id);
    await updateMeetingStatus(
      id,
      settings.selectedTranscriptionProvider === 'local' ? 'transcribing_local' : 'transcribing',
      null
    );
    const transcriptText = await transcribeAudio({
      providerId: settings.selectedTranscriptionProvider,
      provider: transcriptionProvider,
      audioUri: meeting.audioUri,
    });

    await updateTranscript(id, transcriptText);
    await updateMeetingStatus(
      id,
      settings.selectedSummaryProvider === 'local' ? 'summarizing_local' : 'summarizing',
      null
    );

    const summary = await summarizeTranscript({
      providerId: settings.selectedSummaryProvider,
      provider: summaryProvider,
      transcriptText,
    });

    await saveSummary(id, summary);
    await updateMeetingStatus(id, 'ready', null);

    if (layer) {
      await saveMeetingExtractionResult(id, {
        layerId: layer.id,
        layerName: layer.name,
        fields: layer.fields,
        values: Object.fromEntries(layer.fields.map((field) => [field.id, ''])),
        extractionStatus: 'extracting',
        extractionErrorMessage: null,
        syncStatus: 'not_synced',
        syncErrorMessage: null,
        syncedAt: null,
        syncedRowId: null,
      });

      try {
        const extractedValues = await extractStructuredData({
          providerId: settings.selectedSummaryProvider,
          provider: summaryProvider,
          transcriptText,
          fields: layer.fields,
        });

        await saveMeetingExtractionResult(id, {
          layerId: layer.id,
          layerName: layer.name,
          fields: layer.fields,
          values: extractedValues,
          extractionStatus: 'ready',
          extractionErrorMessage: null,
          syncStatus: 'not_synced',
          syncErrorMessage: null,
          syncedAt: null,
          syncedRowId: null,
        });
      } catch (error) {
        await saveMeetingExtractionResult(id, {
          layerId: layer.id,
          layerName: layer.name,
          fields: layer.fields,
          values: Object.fromEntries(layer.fields.map((field) => [field.id, ''])),
          extractionStatus: 'failed',
          extractionErrorMessage: error instanceof Error ? error.message : 'Extraction failed.',
          syncStatus: 'not_synced',
          syncErrorMessage: null,
          syncedAt: null,
          syncedRowId: null,
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown processing error.';
    await updateMeetingStatus(id, 'failed', message);
    throw error;
  }
}

export async function saveMeetingExtractionValues(id: string, values: Record<string, string>) {
  const meeting = await getMeeting(id);

  if (!meeting?.extractionResult) {
    throw new Error('No extracted data is available for this meeting yet.');
  }

  const nextValues = Object.fromEntries(
    meeting.extractionResult.fields.map((field) => [field.id, values[field.id]?.trim() ?? ''])
  );

  const db = getDatabase();
  await db.runAsync(
    'UPDATE meetings SET extraction_values_json = ?, extraction_sync_status = ?, extraction_sync_error_message = ?, updated_at = ? WHERE id = ?',
    JSON.stringify(nextValues),
    'not_synced',
    null,
    new Date().toISOString(),
    id
  );
}

export async function syncMeetingExtractionResult(id: string) {
  const meeting = await getMeeting(id);

  if (!meeting?.extractionResult) {
    throw new Error('No extracted data is available for this meeting yet.');
  }

  const layer = await getExtractionLayer(meeting.extractionResult.layerId);

  if (!layer) {
    throw new Error('The selected extraction layer no longer exists.');
  }

  await updateMeetingExtractionSync(id, {
    syncStatus: 'syncing',
    syncErrorMessage: null,
    syncedAt: null,
    syncedRowId: null,
  });

  try {
    const result = await appendExtractionLayerRow({
      layer,
      values: meeting.extractionResult.values,
    });

    await updateMeetingExtractionSync(id, {
      syncStatus: 'synced',
      syncErrorMessage: null,
      syncedAt: new Date().toISOString(),
      syncedRowId: result.rowRange,
    });
  } catch (error) {
    await updateMeetingExtractionSync(id, {
      syncStatus: 'sync_failed',
      syncErrorMessage: error instanceof Error ? error.message : 'Unable to sync this row.',
      syncedAt: null,
      syncedRowId: null,
    });

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

async function clearMeetingProcessingArtifacts(id: string) {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE meetings SET transcript_text = NULL, summary_json = NULL, summary_short = NULL, error_message = NULL, updated_at = ? WHERE id = ?',
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

async function saveMeetingExtractionResult(
  id: string,
  input: {
    layerId: string;
    layerName: string;
    fields: Array<{ id: string; title: string; description: string }>;
    values: Record<string, string>;
    extractionStatus: MeetingExtractionStatus;
    extractionErrorMessage: string | null;
    syncStatus: 'not_synced' | 'syncing' | 'synced' | 'sync_failed';
    syncErrorMessage: string | null;
    syncedAt: string | null;
    syncedRowId: string | null;
  }
) {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE meetings
     SET selected_layer_id = ?, extraction_layer_name = ?, extraction_fields_json = ?, extraction_values_json = ?,
         extraction_status = ?, extraction_error_message = ?, extraction_sync_status = ?,
         extraction_sync_error_message = ?, updated_at = ?
     WHERE id = ?`,
    input.layerId,
    input.layerName,
    JSON.stringify(input.fields),
    JSON.stringify(input.values),
    input.extractionStatus,
    input.extractionErrorMessage,
    input.syncStatus,
    input.syncErrorMessage,
    new Date().toISOString(),
    id
  );
}

async function updateMeetingExtractionSync(
  id: string,
  input: {
    syncStatus: 'syncing' | 'synced' | 'sync_failed';
    syncErrorMessage: string | null;
    syncedAt: string | null;
    syncedRowId: string | null;
  }
) {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE meetings SET extraction_sync_status = ?, extraction_sync_error_message = ?, extraction_synced_at = ?, extraction_synced_row_id = ?, updated_at = ? WHERE id = ?',
    input.syncStatus,
    input.syncErrorMessage,
    input.syncedAt,
    input.syncedRowId,
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

async function ensureAudioFileReadable(audioUri: string) {
  for (let attempt = 1; attempt <= AUDIO_READABILITY_ATTEMPTS; attempt += 1) {
    try {
      const info = (await FileSystem.getInfoAsync(audioUri)) as Awaited<
        ReturnType<typeof FileSystem.getInfoAsync>
      > & {
        size?: number;
      };

      if (!info.exists) {
        throw new Error('The saved recording file was not found.');
      }

      if (typeof info.size === 'number' && info.size <= 0) {
        throw new Error('The saved recording file is still empty.');
      }

      await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
        position: 0,
        length: 64,
      });

      return;
    } catch (error) {
      if (attempt === AUDIO_READABILITY_ATTEMPTS) {
        throw new Error(
          'This recording is saved in the app, but the audio file is not readable yet. Please try again in a moment.'
        );
      }

      await wait(AUDIO_READABILITY_RETRY_MS);
    }
  }
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

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
