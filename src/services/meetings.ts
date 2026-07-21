import * as FileSystem from 'expo-file-system/legacy';
import { DocumentPickerAsset } from 'expo-document-picker';

import { getDatabase, mapMeetingRow } from '../db';
import { splitTranscriptIntoChunks } from '../features/meetings/englishRendering';
import {
  SummaryPayload,
  type MeetingExtractionStatus,
  type MeetingRow,
  type ProviderConfig,
  type ProviderId,
} from '../types';
import { getAudioDirectory } from './bootstrap';
import {
  extractStructuredData,
  summarizeAndExtractTranscript,
  summarizeTranscript,
  transcribeAudio,
  translateTranscriptToEnglish,
} from './ai';
import { addAppLog, runLoggedStep } from './appLogs';
import { getExtractionLayer } from './extractionLayers';
import { appendExtractionLayerRow } from './googleSheets';
import { getInstalledModel, getInstalledModels } from './localModels';
import {
  IOS_LOCAL_SUMMARY_FALLBACK_REQUIRED_ERROR,
  IOS_LOCAL_SUMMARY_UNAVAILABLE_ERROR,
  getLocalDeviceSupport,
  isLocalCombinedAnalysisRetryable,
  resolveTranscriptionPlan,
} from './localInference';
import { isProviderConfigured, providerDefinitions } from './providers';
import { getAppSettings } from './settings';

type RecordingInput = {
  uri: string;
  title: string;
  durationMs: number;
  /** Transcript captured live during recording. When set, processMeeting
   *  skips the transcription stage and goes straight to summary. */
  preTranscribedText?: string | null;
};

/**
 * Progress events fired by `processMeeting` so the UI can render a live status
 * card while processing runs. `state: 'started'` and `state: 'finished'` always
 * come in pairs for each phase that actually executes.
 *
 * `transcription:finished` carries an optional `qualityWarning` when the
 * produced transcript looks suspiciously short for the audio length — this
 * commonly happens on iOS when whisper rejects most segments due to noise or
 * config issues, and we want the user to see that fast.
 */
export type ProcessMeetingProgressEvent =
  | { phase: 'preparing' }
  | { phase: 'transcription'; state: 'started'; providerId: ProviderId; modelId: string }
  | {
      phase: 'transcription';
      state: 'finished';
      durationMs: number;
      transcriptLength: number;
      qualityWarning: string | null;
    }
  | {
      phase: 'summary';
      state: 'started';
      providerId: ProviderId;
      modelId: string;
      combined: boolean;
    }
  | { phase: 'summary'; state: 'finished'; durationMs: number; combined: boolean }
  | { phase: 'english'; state: 'started'; chunkCount: number }
  | { phase: 'english'; state: 'finished' }
  | { phase: 'extraction'; state: 'started'; fieldCount: number }
  | { phase: 'extraction'; state: 'finished' }
  | { phase: 'complete' };

export type ProcessMeetingOptions = {
  layerId?: string | null;
  onProgress?: (event: ProcessMeetingProgressEvent) => void;
};

/** Min characters per second of audio before we flag the transcript as short. */
const TRANSCRIPT_QUALITY_MIN_CHARS_PER_SECOND = 4;
/** Min audio duration before applying the quality heuristic — short clips are noisy. */
const TRANSCRIPT_QUALITY_MIN_AUDIO_MS = 8000;

function buildTranscriptQualityWarning(
  transcriptLength: number,
  audioDurationMs: number
): string | null {
  if (audioDurationMs < TRANSCRIPT_QUALITY_MIN_AUDIO_MS) {
    return null;
  }

  const audioSeconds = audioDurationMs / 1000;
  const charsPerSecond = transcriptLength / audioSeconds;

  if (charsPerSecond >= TRANSCRIPT_QUALITY_MIN_CHARS_PER_SECOND) {
    return null;
  }

  const seconds = Math.round(audioSeconds);
  return `Transcript looks unusually short (${transcriptLength} characters for ${seconds}s of audio). The recording may be quiet, contain mostly silence, or the local model may have rejected segments. Try a clearer recording or switch to a cloud transcription provider for this meeting.`;
}

const AUDIO_READABILITY_ATTEMPTS = 3;
const AUDIO_READABILITY_RETRY_MS = 150;

export async function listMeetings(): Promise<MeetingRow[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM meetings ORDER BY datetime(created_at) DESC'
  );
  return Promise.all(rows.map((row) => repairMeetingAudioUri(mapMeetingRow(row))));
}

export async function getMeeting(id: string): Promise<MeetingRow | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM meetings WHERE id = ?', id);
  return row ? repairMeetingAudioUri(mapMeetingRow(row)) : null;
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
  const preTranscript = input.preTranscribedText?.trim();
  if (preTranscript) {
    // Persist the live transcript immediately so processMeeting can skip
    // straight to summary. The meeting status stays 'local_only' — the user
    // still has to tap Run, and we want them to get a summary, not just a
    // raw transcript.
    await updateTranscript(id, preTranscript);
  }
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

export async function processMeeting(id: string, options: ProcessMeetingOptions = {}) {
  const meeting = await getMeeting(id);

  if (!meeting) {
    throw new Error('Meeting not found.');
  }

  // Wrap onProgress so caller errors can't tear down processing.
  const emitProgress = (event: ProcessMeetingProgressEvent) => {
    if (!options.onProgress) return;
    try {
      options.onProgress(event);
    } catch {
      // Progress is observation-only; never abort processing on listener errors.
    }
  };

  emitProgress({ phase: 'preparing' });

  await addAppLog({
    scope: 'meeting.process',
    message: 'Processing requested',
    metadata: {
      meetingId: id,
      currentStatus: meeting.status,
      layerId: options.layerId ?? null,
      sourceType: meeting.sourceType,
      durationMs: meeting.durationMs,
    },
  });

  // Preflight failures happen before any state is mutated, so the meeting keeps
  // its current status rather than being marked failed — but they still need to
  // reach the log, otherwise a user reporting "nothing happens when I tap
  // Analyze" leaves no trace to debug.
  const failPreflight = async (message: string): Promise<never> => {
    await addAppLog({
      level: 'error',
      scope: 'meeting.process',
      message: 'Processing preflight failed',
      metadata: { meetingId: id, error: message },
    });
    throw new Error(message);
  };

  const settings = await getAppSettings();
  const transcriptionProvider = settings.providers[settings.selectedTranscriptionProvider];
  const { providerId: summaryProviderId, provider: summaryProvider } =
    await resolveSummaryProviderForCurrentDevice(settings);
  const layer = options.layerId ? await getExtractionLayer(options.layerId) : null;
  await addAppLog({
    scope: 'meeting.process',
    message: 'Resolved processing route',
    metadata: {
      meetingId: id,
      transcriptionProviderId: settings.selectedTranscriptionProvider,
      transcriptionModelId: transcriptionProvider.transcriptionModel,
      summaryProviderId,
      summaryModelId: summaryProvider.summaryModel,
      layerId: layer?.id ?? null,
      fieldCount: layer?.fields.length ?? 0,
    },
  });

  if (!isProviderConfigured(settings.selectedTranscriptionProvider, transcriptionProvider, 'transcription')) {
    await failPreflight('Configure the selected transcription provider in Settings first.');
  }

  if (!isProviderConfigured(summaryProviderId, summaryProvider, 'summary')) {
    await failPreflight('Configure the selected summary provider in Settings first.');
  }

  // For local transcription, factor in the user's preferred locale to choose
  // the right (model, engine, language) plan. May override the user's saved
  // local model when their locale demands a multilingual whisper variant.
  let resolvedTranscriptionModelId = transcriptionProvider.transcriptionModel;
  let resolvedAppleSpeechLocale: string | null = null;
  let resolvedWhisperLanguage: string | null = null;

  if (settings.selectedTranscriptionProvider === 'local') {
    const installed = await getInstalledModels();
    const plan = resolveTranscriptionPlan({
      selectedModelId: transcriptionProvider.transcriptionModel,
      locale: settings.transcriptionLocale,
      installedModelIds: installed.map((row) => row.id),
    });
    resolvedTranscriptionModelId = plan.modelId;
    resolvedAppleSpeechLocale = plan.appleSpeechLocale;
    resolvedWhisperLanguage = plan.whisperLanguage;

    const installedModel = await getInstalledModel(plan.modelId);
    if (!installedModel || installedModel.status !== 'installed') {
      // Tailor the error to the locale so the fix is obvious. For non-English
      // we recommend whisper-small specifically.
      const needsWhisperSmall =
        plan.modelId === 'whisper-small' && settings.transcriptionLocale !== 'en-US';
      if (needsWhisperSmall) {
        await failPreflight(
          `${settings.transcriptionLocale === 'auto' ? 'Mixed-language' : settings.transcriptionLocale} transcription needs Whisper Small. Download it from Local models, then try again.`
        );
      }
      await failPreflight('Download and install the selected local transcription model first.');
    }
  }

  if (summaryProviderId === 'local') {
    const installedModel = await getInstalledModel(summaryProvider.summaryModel);
    if (!installedModel || installedModel.status !== 'installed') {
      await failPreflight('Download and install the selected local summary model first.');
    }
  }

  if (options.layerId && !layer) {
    await failPreflight('Selected extraction layer no longer exists.');
  }

  try {
    await ensureAudioFileReadable(meeting.audioUri);

    // If the live recognizer captured a transcript during recording AND this
    // meeting hasn't been processed yet, reuse it instead of paying for a
    // post-stop transcription pass. Re-runs (status !== 'local_only') always
    // re-transcribe so the user can recover from a bad live capture.
    const hasUsableLiveTranscript =
      meeting.status === 'local_only' &&
      typeof meeting.transcriptText === 'string' &&
      meeting.transcriptText.trim().length > 0;

    let transcriptText: string;

    if (hasUsableLiveTranscript) {
      transcriptText = meeting.transcriptText!.trim();
      // Don't clear the transcript — we're about to summarize it.
      await updateMeetingStatus(
        id,
        summaryProviderId === 'local' ? 'summarizing_local' : 'summarizing',
        null
      );
      emitProgress({
        phase: 'transcription',
        state: 'started',
        providerId: 'local',
        modelId: 'apple-speech-recognizer',
      });
      emitProgress({
        phase: 'transcription',
        state: 'finished',
        durationMs: 0,
        transcriptLength: transcriptText.length,
        qualityWarning: buildTranscriptQualityWarning(transcriptText.length, meeting.durationMs),
      });
      await addAppLog({
        scope: 'meeting.transcription',
        message: 'Reused live transcript from recording',
        metadata: {
          meetingId: id,
          transcriptLength: transcriptText.length,
        },
      });
    } else {
      await updateMeetingStatus(
        id,
        settings.selectedTranscriptionProvider === 'local' ? 'transcribing_local' : 'transcribing',
        null
      );
      emitProgress({
        phase: 'transcription',
        state: 'started',
        providerId: settings.selectedTranscriptionProvider,
        modelId: resolvedTranscriptionModelId,
      });
      const transcriptionStartedAt = Date.now();
      transcriptText = await runLoggedStep(
        {
          scope: 'meeting.transcription',
          message: 'Transcription',
          metadata: {
            meetingId: id,
            providerId: settings.selectedTranscriptionProvider,
            modelId: resolvedTranscriptionModelId,
            transcriptionLocale: settings.transcriptionLocale,
          },
        },
        () =>
          transcribeAudio({
            providerId: settings.selectedTranscriptionProvider,
            // Override the saved model with the resolved one when the locale
            // demanded a multilingual whisper variant.
            provider: {
              ...transcriptionProvider,
              transcriptionModel: resolvedTranscriptionModelId,
            },
            audioUri: meeting.audioUri,
            appleSpeechLocale: resolvedAppleSpeechLocale,
            whisperLanguage: resolvedWhisperLanguage,
          })
      );

      const qualityWarning = buildTranscriptQualityWarning(transcriptText.length, meeting.durationMs);
      if (qualityWarning) {
        await addAppLog({
          level: 'warn',
          scope: 'meeting.transcription',
          message: 'Transcript looks short for audio length',
          metadata: {
            meetingId: id,
            transcriptLength: transcriptText.length,
            audioDurationMs: meeting.durationMs,
          },
        });
      }
      emitProgress({
        phase: 'transcription',
        state: 'finished',
        durationMs: Date.now() - transcriptionStartedAt,
        transcriptLength: transcriptText.length,
        qualityWarning,
      });

      await replaceTranscriptAndClearStaleSummary(id, transcriptText);
      await updateMeetingStatus(
        id,
        summaryProviderId === 'local' ? 'summarizing_local' : 'summarizing',
        null
      );
    }

    if (layer && summaryProviderId === 'local') {
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
        emitProgress({
          phase: 'summary',
          state: 'started',
          providerId: summaryProviderId,
          modelId: summaryProvider.summaryModel,
          combined: true,
        });
        const combinedStartedAt = Date.now();
        const { summary, extractedValues } = await runLoggedStep(
          {
            scope: 'meeting.local-analysis',
            message: 'Combined local summary and extraction',
            metadata: {
              meetingId: id,
              providerId: summaryProviderId,
              modelId: summaryProvider.summaryModel,
              transcriptLength: transcriptText.length,
              fieldCount: layer.fields.length,
            },
          },
          () =>
            summarizeAndExtractTranscript({
              providerId: summaryProviderId,
              provider: summaryProvider,
              transcriptText,
              fields: layer.fields,
            })
        );

        await saveSummary(id, summary);
        await updateMeetingStatus(id, 'ready', null);
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
        emitProgress({
          phase: 'summary',
          state: 'finished',
          durationMs: Date.now() - combinedStartedAt,
          combined: true,
        });
        await generateEnglishTranscript(
          id,
          transcriptText,
          summaryProviderId,
          summaryProvider,
          emitProgress
        );
        emitProgress({ phase: 'complete' });
        await addAppLog({
          scope: 'meeting.process',
          message: 'Processing finished',
          metadata: { meetingId: id, usedCombinedLocalAnalysis: true },
        });
        return;
      } catch (combinedError) {
        if (!isLocalCombinedAnalysisRetryable(combinedError)) {
          // Setup/runtime errors (missing model, runtime unavailable, audio
          // failure, etc.) will hit the same error in the two-pass flow. Rethrow
          // so the user sees the real failure once instead of waiting twice.
          throw combinedError;
        }
        await addAppLog({
          level: 'warn',
          scope: 'meeting.local-analysis',
          message: 'Combined local analysis fell back to two-pass flow',
          metadata: {
            meetingId: id,
            error: combinedError instanceof Error ? combinedError.message : String(combinedError),
          },
        });
        // Fall through to the older two-pass flow if the compact local prompt is not accepted.
      }
    }

    emitProgress({
      phase: 'summary',
      state: 'started',
      providerId: summaryProviderId,
      modelId: summaryProvider.summaryModel,
      combined: false,
    });
    const summaryStartedAt = Date.now();
    const summary = await runLoggedStep(
      {
        scope: 'meeting.summary',
        message: 'Summary',
        metadata: {
          meetingId: id,
          providerId: summaryProviderId,
          modelId: summaryProvider.summaryModel,
          transcriptLength: transcriptText.length,
        },
      },
      () =>
        summarizeTranscript({
          providerId: summaryProviderId,
          provider: summaryProvider,
          transcriptText,
        })
    );

    await saveSummary(id, summary);
    await updateMeetingStatus(id, 'ready', null);
    emitProgress({
      phase: 'summary',
      state: 'finished',
      durationMs: Date.now() - summaryStartedAt,
      combined: false,
    });

    await generateEnglishTranscript(id, transcriptText, summaryProviderId, summaryProvider, emitProgress);

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
        emitProgress({ phase: 'extraction', state: 'started', fieldCount: layer.fields.length });
        const extractedValues = await runLoggedStep(
          {
            scope: 'meeting.extraction',
            message: 'Structured extraction',
            metadata: {
              meetingId: id,
              providerId: summaryProviderId,
              modelId: summaryProvider.summaryModel,
              transcriptLength: transcriptText.length,
              fieldCount: layer.fields.length,
            },
          },
          () =>
            extractStructuredData({
              providerId: summaryProviderId,
              provider: summaryProvider,
              transcriptText,
              fields: layer.fields,
            })
        );

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
        emitProgress({ phase: 'extraction', state: 'finished' });
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
    emitProgress({ phase: 'complete' });
    await addAppLog({
      scope: 'meeting.process',
      message: 'Processing finished',
      metadata: { meetingId: id },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown processing error.';
    await addAppLog({
      level: 'error',
      scope: 'meeting.process',
      message: 'Processing failed',
      metadata: {
        meetingId: id,
        error: message,
      },
    });
    await updateMeetingStatus(id, 'failed', message);
    throw error;
  }
}

async function resolveSummaryProviderForCurrentDevice(settings: Awaited<ReturnType<typeof getAppSettings>>) {
  if (settings.selectedSummaryProvider !== 'local') {
    return {
      providerId: settings.selectedSummaryProvider,
      provider: settings.providers[settings.selectedSummaryProvider],
    };
  }

  const support = await getLocalDeviceSupport();
  if (support.platform !== 'ios' || support.supportsSummary) {
    return {
      providerId: settings.selectedSummaryProvider,
      provider: settings.providers[settings.selectedSummaryProvider],
    };
  }

  const fallbackProviderId = getConfiguredCloudProviderId(settings, 'summary');
  if (!fallbackProviderId) {
    throw new Error(IOS_LOCAL_SUMMARY_FALLBACK_REQUIRED_ERROR);
  }

  return {
    providerId: fallbackProviderId,
    provider: settings.providers[fallbackProviderId],
  };
}

function getConfiguredCloudProviderId(
  settings: Awaited<ReturnType<typeof getAppSettings>>,
  mode: 'transcription' | 'summary'
) {
  return (
    providerDefinitions
      .filter((definition) => definition.id !== 'local')
      .find((definition) => {
        if (mode === 'transcription' && !definition.supportsTranscription) {
          return false;
        }

        if (mode === 'summary' && !definition.supportsSummary) {
          return false;
        }

        return isProviderConfigured(definition.id, settings.providers[definition.id], mode);
      })?.id ?? null
  );
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

async function updateMeetingAudioUri(id: string, audioUri: string) {
  const db = getDatabase();
  await db.runAsync('UPDATE meetings SET audio_uri = ? WHERE id = ?', audioUri, id);
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

/**
 * Writes a freshly produced transcript and retires everything it invalidates in
 * one statement.
 *
 * Two things are going on here:
 *
 * 1. Re-runs used to null the transcript and summary *before* transcription
 *    started, so a failed retry left the user with nothing where they
 *    previously had working notes. The old result now survives until a new
 *    transcript actually replaces it.
 *
 * 2. The extraction columns are cleared too. The old native statement did not
 *    touch them (only the web shim did), so re-running a meeting without
 *    selecting a layer left the previous layer's extracted values on the row —
 *    values derived from a transcript that no longer exists, still showing a
 *    live "sync to Sheets" action. Extraction always runs after this point, so
 *    a run that does select a layer simply rewrites them.
 */
async function replaceTranscriptAndClearStaleSummary(id: string, transcriptText: string) {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE meetings SET
      transcript_text = ?,
      -- Derived from the transcript being replaced, so it is stale by
      -- definition. Leaving it would show an English tab describing a
      -- conversation the verbatim tab no longer contains.
      transcript_english = NULL,
      summary_json = NULL,
      summary_short = NULL,
      error_message = NULL,
      selected_layer_id = NULL,
      extraction_layer_name = NULL,
      extraction_fields_json = NULL,
      extraction_values_json = NULL,
      extraction_status = NULL,
      extraction_error_message = NULL,
      extraction_sync_status = NULL,
      extraction_sync_error_message = NULL,
      extraction_synced_at = NULL,
      extraction_synced_row_id = NULL,
      updated_at = ?
    WHERE id = ?`,
    transcriptText,
    new Date().toISOString(),
    id
  );
}

/**
 * Produce and store the clean English reading of the transcript.
 *
 * Deliberately swallows its own failure. By the time this runs the transcript
 * and summary are already saved and the meeting is 'ready' — the English
 * rendering is a second view of work that already succeeded, so a rate limit or
 * a dropped connection here must not turn a usable meeting into a failed one.
 * The error goes to the log and the section falls back to a single tab.
 *
 * Skipped for local providers: this build has no on-device summary runtime on
 * iOS, so there is nothing to translate with.
 */
async function generateEnglishTranscript(
  id: string,
  transcriptText: string,
  summaryProviderId: ProviderId,
  summaryProvider: ProviderConfig,
  emitProgress: (event: ProcessMeetingProgressEvent) => void
): Promise<void> {
  if (!shouldGenerateEnglishTranscript(summaryProviderId)) {
    return;
  }

  const chunkCount = splitTranscriptIntoChunks(transcriptText).length;

  if (chunkCount === 0) {
    return;
  }

  try {
    emitProgress({ phase: 'english', state: 'started', chunkCount });
    const english = await runLoggedStep(
      {
        scope: 'meeting.english',
        message: 'English transcript',
        metadata: {
          meetingId: id,
          providerId: summaryProviderId,
          modelId: summaryProvider.summaryModel,
          transcriptLength: transcriptText.length,
          chunkCount,
        },
      },
      () =>
        translateTranscriptToEnglish({
          providerId: summaryProviderId,
          provider: summaryProvider,
          transcriptText,
        })
    );

    if (english.trim()) {
      await saveEnglishTranscript(id, english.trim());
    }

    emitProgress({ phase: 'english', state: 'finished' });
  } catch (error) {
    await addAppLog({
      level: 'warn',
      scope: 'meeting.english',
      message: 'English transcript failed; keeping the verbatim transcript only',
      metadata: {
        meetingId: id,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    emitProgress({ phase: 'english', state: 'finished' });
  }
}

export function shouldGenerateEnglishTranscript(summaryProviderId: ProviderId): boolean {
  return summaryProviderId !== 'local';
}

async function saveEnglishTranscript(id: string, englishText: string) {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE meetings SET transcript_english = ?, updated_at = ? WHERE id = ?',
    englishText,
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

async function repairMeetingAudioUri(meeting: MeetingRow): Promise<MeetingRow> {
  const audioUri = await resolveAudioUriForCurrentInstall(meeting.audioUri);

  if (audioUri === meeting.audioUri) {
    return meeting;
  }

  await updateMeetingAudioUri(meeting.id, audioUri);
  return {
    ...meeting,
    audioUri,
  };
}

async function resolveAudioUriForCurrentInstall(audioUri: string) {
  if (!audioUri) {
    return audioUri;
  }

  const currentInfo = await getAudioInfo(audioUri);

  if (currentInfo.exists) {
    return audioUri;
  }

  const portableAudioUri = getCurrentInstallAudioUri(audioUri);

  if (!portableAudioUri || portableAudioUri === audioUri) {
    return audioUri;
  }

  const portableInfo = await getAudioInfo(portableAudioUri);
  return portableInfo.exists ? portableAudioUri : audioUri;
}

async function getAudioInfo(audioUri: string) {
  try {
    return await FileSystem.getInfoAsync(audioUri);
  } catch {
    return { exists: false };
  }
}

function getCurrentInstallAudioUri(audioUri: string) {
  const fileName = getStoredAudioFileName(audioUri);
  return fileName ? `${getAudioDirectory()}/${fileName}` : null;
}

function getStoredAudioFileName(audioUri: string) {
  const cleanUri = audioUri.split(/[?#]/)[0];
  const marker = '/audio/';
  const markerIndex = cleanUri.lastIndexOf(marker);

  if (markerIndex < 0) {
    return null;
  }

  const fileName = cleanUri.slice(markerIndex + marker.length);

  if (!fileName || fileName.includes('/')) {
    return null;
  }

  return fileName;
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
