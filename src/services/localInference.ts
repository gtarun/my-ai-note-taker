import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import { ExtractionLayerField, LocalDeviceSupport, SummaryPayload } from '../types';

const LOCAL_TRANSCRIPT_WINDOW = 8000;
const LOCAL_TRANSCRIPT_OVERLAP = 500;
export const IOS_LOCAL_TRANSCRIPTION_MODEL_ID = 'whisper-base';
export const IOS_LOCAL_TRANSCRIPTION_MODEL_ERROR =
  'Only whisper-base is supported for local transcription on iOS in this phase.';
export const IOS_LOCAL_TRANSCRIPTION_PLACEHOLDER_ERROR =
  'Local transcription returned placeholder text instead of spoken words. Try recording again, import a clearer M4A, WAV, or MP3 file, or switch transcription back to a cloud provider for this meeting.';
export const IOS_LOCAL_SUMMARY_UNAVAILABLE_ERROR =
  'Local summary and structured analysis are not available on iOS in this build. Keep transcription local, then choose a cloud provider for Summary and analysis in Settings.';
export const IOS_LOCAL_SUMMARY_FALLBACK_REQUIRED_ERROR =
  'Local summary and structured analysis are not available on iOS in this build, and no cloud summary provider is configured. Keep transcription local, then add a cloud provider like OpenAI for Summary and analysis in Settings.';

type LocalNativeModule = {
  getDeviceSupport?: () => Promise<Partial<LocalDeviceSupport>>;
  transcribe?: (params: { audioUri: string; modelId: string }) => Promise<string>;
  summarize?: (params: { prompt: string; modelId: string }) => Promise<string>;
};

const nativeModule =
  Platform.OS === 'web' ? null : requireOptionalNativeModule<LocalNativeModule>('MuFathomLocalAI');

export async function getLocalDeviceSupport(): Promise<LocalDeviceSupport> {
  if (Platform.OS === 'web') {
    return {
      platform: 'web',
      localProcessingAvailable: false,
      supportsSummary: false,
      supportsTranscription: false,
      requiresCustomBuild: false,
      reason: 'Local model runtime is mobile-only.',
    };
  }

  if (!nativeModule?.getDeviceSupport) {
    return {
      platform: Platform.OS === 'android' ? 'android' : 'ios',
      localProcessingAvailable: false,
      supportsSummary: false,
      supportsTranscription: false,
      requiresCustomBuild: true,
      reason: 'This build does not include the native local AI runtime yet. Use a custom dev build or release build with the module linked.',
    };
  }

  try {
    const support = await nativeModule.getDeviceSupport();
    return {
      platform: Platform.OS === 'android' ? 'android' : 'ios',
      localProcessingAvailable: Boolean(support.localProcessingAvailable),
      supportsSummary: Boolean(support.supportsSummary),
      supportsTranscription: Boolean(support.supportsTranscription),
      requiresCustomBuild: Boolean(support.requiresCustomBuild),
      reason: support.reason ?? null,
    };
  } catch (error) {
    return {
      platform: Platform.OS === 'android' ? 'android' : 'ios',
      localProcessingAvailable: false,
      supportsSummary: false,
      supportsTranscription: false,
      requiresCustomBuild: true,
      reason: error instanceof Error ? error.message : 'Unable to check local runtime support.',
    };
  }
}

export async function transcribeLocalAudio(params: { audioUri: string; modelId: string }) {
  const module = await requireLocalRuntime('transcription');

  if (!params.modelId.trim()) {
    throw new Error('Pick an installed local transcription model in Settings first.');
  }

  if (Platform.OS === 'ios' && params.modelId.trim() !== IOS_LOCAL_TRANSCRIPTION_MODEL_ID) {
    throw new Error(IOS_LOCAL_TRANSCRIPTION_MODEL_ERROR);
  }

  let transcript: string | undefined;
  try {
    transcript = await module.transcribe?.(params);
  } catch (error) {
    throw new Error(normalizeLocalTranscriptionError(error));
  }

  if (!transcript?.trim()) {
    throw new Error('Local transcription returned no text.');
  }

  const trimmedTranscript = transcript.trim();
  validateLocalTranscript(trimmedTranscript);
  return trimmedTranscript;
}

export async function summarizeLocalTranscript(params: {
  transcriptText: string;
  modelId: string;
}): Promise<SummaryPayload> {
  const module = await requireLocalRuntime('summary');

  if (!params.modelId.trim()) {
    throw new Error('Pick an installed local summary model in Settings first.');
  }

  const chunks = chunkTranscript(params.transcriptText, LOCAL_TRANSCRIPT_WINDOW, LOCAL_TRANSCRIPT_OVERLAP);

  if (chunks.length <= 1) {
    return runSummaryPass(module, buildFinalSummaryPrompt(params.transcriptText), params.modelId);
  }

  const partialSummaries: SummaryPayload[] = [];

  for (const chunk of chunks) {
    partialSummaries.push(await runSummaryPass(module, buildChunkSummaryPrompt(chunk), params.modelId));
  }

  const combinedPayload = partialSummaries
    .map((payload, index) =>
      [
        `Chunk ${index + 1}`,
        `Summary: ${payload.summary}`,
        `Action items: ${payload.actionItems.join(' | ') || 'None'}`,
        `Decisions: ${payload.decisions.join(' | ') || 'None'}`,
        `Follow-ups: ${payload.followUps.join(' | ') || 'None'}`,
      ].join('\n')
    )
    .join('\n\n');

  return runSummaryPass(module, buildCombineSummaryPrompt(combinedPayload), params.modelId);
}

export async function extractLocalStructuredData(params: {
  transcriptText: string;
  modelId: string;
  fields: ExtractionLayerField[];
}): Promise<Record<string, string>> {
  const module = await requireLocalRuntime('summary');

  if (!params.modelId.trim()) {
    throw new Error('Pick an installed local summary model in Settings first.');
  }

  if (!params.fields.length) {
    return {};
  }

  const rawValues = await runJsonObjectPass(
    module,
    buildLocalExtractionPrompt(params.transcriptText, params.fields),
    params.modelId,
    params.fields.map((field) => field.id)
  );

  return Object.fromEntries(
    params.fields.map((field) => [field.id, String(rawValues[field.id] ?? '').trim()])
  );
}

async function runSummaryPass(module: LocalNativeModule, prompt: string, modelId: string) {
  const raw = await module.summarize?.({ prompt, modelId });

  if (!raw?.trim()) {
    throw new Error('Local summary model returned no content.');
  }

  try {
    return parseSummaryPayload(raw);
  } catch {
    const repaired = await module.summarize?.({
      prompt: buildRepairPrompt(raw),
      modelId,
    });

    if (!repaired?.trim()) {
      throw new Error('Local summary parsing failed and repair returned no content.');
    }

    return parseSummaryPayload(repaired);
  }
}

async function runJsonObjectPass(
  module: LocalNativeModule,
  prompt: string,
  modelId: string,
  requiredKeys: string[]
) {
  const raw = await module.summarize?.({ prompt, modelId });

  if (!raw?.trim()) {
    throw new Error('Local summary model returned no analysis content.');
  }

  try {
    return parseJsonObject(raw);
  } catch {
    const repaired = await module.summarize?.({
      prompt: buildGenericRepairPrompt(raw, requiredKeys),
      modelId,
    });

    if (!repaired?.trim()) {
      throw new Error('Local analysis parsing failed and repair returned no content.');
    }

    return parseJsonObject(repaired);
  }
}

async function requireLocalRuntime(mode: 'transcription' | 'summary') {
  const support = await getLocalDeviceSupport();

  if (!nativeModule) {
    throw new Error(support.reason ?? 'Local runtime unavailable.');
  }

  if (mode === 'transcription' && !support.supportsTranscription) {
    throw new Error(getLocalRuntimeUnavailableMessage(mode, support));
  }

  if (mode === 'summary' && !support.supportsSummary) {
    throw new Error(getLocalRuntimeUnavailableMessage(mode, support));
  }

  return nativeModule;
}

function getLocalRuntimeUnavailableMessage(
  mode: 'transcription' | 'summary',
  support: LocalDeviceSupport
) {
  if (mode === 'summary' && Platform.OS === 'ios') {
    return IOS_LOCAL_SUMMARY_UNAVAILABLE_ERROR;
  }

  if (mode === 'transcription') {
    return support.reason ?? 'Local transcription is not available on this device.';
  }

  return support.reason ?? 'Local summary is not available on this device.';
}

function normalizeLocalTranscriptionError(error: unknown) {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Local transcription failed before any text was returned.';
  const causedBy = rawMessage.match(/Caused by:\s*([\s\S]+)$/i)?.[1];
  const detail = (causedBy ?? rawMessage)
    .replace(/^Error:\s*/i, '')
    .replace(/^Calling the 'transcribe' function has failed\.?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    /Foundation\._GenericObjCError/i.test(detail) ||
    /operation couldn't be completed/i.test(detail)
  ) {
    return [
      'Local transcription could not prepare this recording on iOS.',
      'Try recording again, import a standard M4A, WAV, or MP3 file, or switch transcription back to a cloud provider in Settings for this meeting.',
    ].join(' ');
  }

  return detail || 'Local transcription failed before any text was returned.';
}

function validateLocalTranscript(transcript: string) {
  if (looksLikePagePlaceholderTranscript(transcript)) {
    throw new Error(IOS_LOCAL_TRANSCRIPTION_PLACEHOLDER_ERROR);
  }
}

function looksLikePagePlaceholderTranscript(transcript: string) {
  const compact = transcript
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!compact) {
    return false;
  }

  if (/^(?:page\s*\d+\s*){2,8}$/i.test(compact)) {
    return true;
  }

  const tokens = compact.split(' ');
  const pageTokenCount = tokens.filter((token) => token === 'page' || /^page\d+$/.test(token)).length;

  if (pageTokenCount < 2 || tokens.length > 10) {
    return false;
  }

  return tokens.every((token) => token === 'page' || /^page\d+$/.test(token) || /^\d+$/.test(token));
}

function chunkTranscript(text: string, windowSize: number, overlap: number) {
  const trimmed = text.trim();

  if (!trimmed) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < trimmed.length) {
    const end = Math.min(trimmed.length, start + windowSize);
    chunks.push(trimmed.slice(start, end));

    if (end >= trimmed.length) {
      break;
    }

    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

function buildChunkSummaryPrompt(chunk: string) {
  return [
    'You are summarizing one chunk of a meeting transcript for an offline mobile app.',
    'Return valid JSON only with keys: summary, actionItems, decisions, followUps.',
    'Do not invent facts. Keep it compact and concrete.',
    '',
    'Transcript chunk:',
    chunk,
  ].join('\n');
}

function buildCombineSummaryPrompt(chunkSummaries: string) {
  return [
    'You are combining chunk-level meeting notes into one final meeting summary.',
    'Return valid JSON only with keys: summary, actionItems, decisions, followUps.',
    'Deduplicate action items and decisions. Keep only facts grounded in the chunk summaries.',
    '',
    'Chunk summaries:',
    chunkSummaries,
  ].join('\n');
}

function buildFinalSummaryPrompt(transcriptText: string) {
  return [
    'You convert meeting transcripts into concise structured notes for a local-first mobile app.',
    'Return valid JSON only with keys: summary, actionItems, decisions, followUps.',
    'Do not invent facts.',
    '',
    'Transcript:',
    transcriptText,
  ].join('\n');
}

function buildLocalExtractionPrompt(transcriptText: string, fields: ExtractionLayerField[]) {
  const keys = fields.map((field) => field.id).join(', ');
  const fieldLines = fields.map((field) => `- ${field.id}: ${field.title}. ${field.description}`);

  return [
    'You extract structured meeting data from a transcript for an offline mobile app.',
    `Return valid JSON only with these exact keys: ${keys}.`,
    'Use an empty string when a value is missing. Do not invent facts.',
    '',
    'Fields:',
    ...fieldLines,
    '',
    'Transcript:',
    transcriptText,
  ].join('\n');
}

function buildRepairPrompt(rawJson: string) {
  return [
    'Repair the following into valid JSON only.',
    'Required keys: summary, actionItems, decisions, followUps.',
    'Do not add markdown fences or explanation.',
    '',
    rawJson,
  ].join('\n');
}

function buildGenericRepairPrompt(rawJson: string, requiredKeys: string[]) {
  return [
    'Repair the following into valid JSON only.',
    `Required keys: ${requiredKeys.join(', ')}.`,
    'Do not add markdown fences or explanation.',
    '',
    rawJson,
  ].join('\n');
}

function parseSummaryPayload(raw: string): SummaryPayload {
  const parsed = parseJsonObject(raw) as Partial<SummaryPayload>;

  return {
    summary: parsed.summary?.toString().trim() ?? '',
    actionItems: Array.isArray(parsed.actionItems)
      ? parsed.actionItems.map((item) => String(item).trim()).filter(Boolean)
      : [],
    decisions: Array.isArray(parsed.decisions)
      ? parsed.decisions.map((item) => String(item).trim()).filter(Boolean)
      : [],
    followUps: Array.isArray(parsed.followUps)
      ? parsed.followUps.map((item) => String(item).trim()).filter(Boolean)
      : [],
  };
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const json = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  const parsed = JSON.parse(json);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Local model returned non-object JSON.');
  }

  return parsed as Record<string, unknown>;
}
