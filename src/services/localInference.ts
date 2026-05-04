import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import {
  ExtractionLayerField,
  LocalDeviceSupport,
  LocalModelEngine,
  SummaryPayload,
  TranscriptionLocale,
} from '../types';

const LOCAL_TRANSCRIPT_WINDOW = 12000;
const LOCAL_TRANSCRIPT_OVERLAP = 400;
/** Catalog id for Apple's built-in SFSpeechRecognizer. Always-installed on
 *  iOS — no download, no file on disk. Routed natively via the bridge. Keep
 *  in sync with `APPLE_SPEECH_MODEL_ID` in `localModels.ts`. */
export const APPLE_SPEECH_MODEL_ID = 'apple-speech-recognizer';
/** Default iOS transcription model when nothing is selected or the existing
 *  selection isn't available. Apple Speech is always available on iOS 13+, so
 *  it makes the safest default. */
export const IOS_LOCAL_TRANSCRIPTION_MODEL_ID = APPLE_SPEECH_MODEL_ID;
/** Transcription engines the iOS native bridge knows how to dispatch to. Keep
 *  in sync with `IOS_SUPPORTED_TRANSCRIPTION_MODEL_IDS` in `localModels.ts`
 *  and the routing in `MuFathomLocalAIModule.swift`. */
export const IOS_LOCAL_TRANSCRIPTION_MODEL_IDS = new Set([
  APPLE_SPEECH_MODEL_ID,
  'whisper-base',
  'whisper-small',
]);
export const IOS_LOCAL_TRANSCRIPTION_MODEL_ERROR =
  'This local transcription model is not supported on iOS in this build. Install Whisper Base or Whisper Small from Local models.';
export const IOS_LOCAL_TRANSCRIPTION_PLACEHOLDER_ERROR =
  'Local transcription returned placeholder text instead of spoken words. Try recording again, import a clearer M4A, WAV, or MP3 file, or switch transcription back to a cloud provider for this meeting.';
export const IOS_LOCAL_SUMMARY_UNAVAILABLE_ERROR =
  'Local summary and structured analysis are not available on iOS in this build. Keep transcription local, then choose a cloud provider for Summary and analysis in Settings.';
export const IOS_LOCAL_SUMMARY_FALLBACK_REQUIRED_ERROR =
  'Local summary and structured analysis are not available on iOS in this build, and no cloud summary provider is configured. Keep transcription local, then add a cloud provider like OpenAI for Summary and analysis in Settings.';

type LiveTranscriptListener = (event: { transcript: string }) => void;
type Subscription = { remove: () => void };

type LocalNativeModule = {
  getDeviceSupport?: () => Promise<Partial<LocalDeviceSupport>>;
  transcribe?: (params: {
    audioUri: string;
    modelId: string;
    /** BCP-47 locale for Apple Speech (e.g., "en-US", "hi-IN"). */
    locale?: string;
    /** ISO 639-1 code for whisper.cpp (e.g., "en", "hi", "pa"). Empty
     *  string or undefined means "let whisper auto-detect language". */
    language?: string;
  }) => Promise<string>;
  summarize?: (params: { prompt: string; modelId: string; engine: string }) => Promise<string>;
  /** Streaming transcription — see `LiveTranscriptionSession.swift`. */
  startLiveTranscription?: (params: { locale?: string }) => Promise<void>;
  stopLiveTranscription?: () => Promise<string>;
  cancelLiveTranscription?: () => Promise<void>;
  addListener?: (eventName: string, listener: LiveTranscriptListener) => Subscription;
};

/**
 * Plan that the recording/processing layer follows for a given
 * (model, locale) combination. Engines that can't satisfy the user's locale
 * report `liveSupported: false` so the UI knows to skip the streaming card.
 */
export type TranscriptionPlan = {
  /** What we send to the native bridge as `modelId`. */
  modelId: string;
  /** BCP-47 locale used when the dispatched engine is Apple Speech.
   *  `null` means Apple Speech can't satisfy the requested locale. */
  appleSpeechLocale: string | null;
  /** Whisper language code (`en`, `hi`, `pa`, …) or null for auto-detect. */
  whisperLanguage: string | null;
  /** Whether live (streaming) partials are available for this plan. */
  liveSupported: boolean;
};

/** Apple Speech offline-supported locales we expose in Settings.
 *  iOS 17+ support is broader; this is the conservative intersection. */
const APPLE_SPEECH_OFFLINE_LOCALES = new Set<string>(['en-US', 'hi-IN']);

/** Map a TranscriptionLocale into a whisper language code. `null` = auto. */
function localeToWhisperLanguage(locale: TranscriptionLocale): string | null {
  switch (locale) {
    case 'auto':
      return null;
    case 'en-US':
      return 'en';
    case 'hi-IN':
      return 'hi';
    case 'pa-IN':
      return 'pa';
  }
}

/**
 * Resolve the best (model, engine, language) plan for the user's locale and
 * what's installed on the device. Two principles:
 *
 * 1. If the user picked Apple Speech AND their locale is offline-supported,
 *    keep Apple Speech (fastest, no download, no extra power draw).
 * 2. Otherwise, fall back to whisper-small with the right language code or
 *    auto-detect. Whisper-small is required for Punjabi and mixed-language;
 *    we surface a clear error in the caller when it's not installed.
 */
export function resolveTranscriptionPlan(input: {
  selectedModelId: string;
  locale: TranscriptionLocale;
  installedModelIds: string[];
}): TranscriptionPlan {
  const { selectedModelId, locale } = input;
  const installed = new Set(input.installedModelIds);

  const whisperLanguage = localeToWhisperLanguage(locale);

  // Apple Speech path — only when the model is apple-speech AND the locale
  // is in our offline-supported set.
  if (
    selectedModelId === APPLE_SPEECH_MODEL_ID &&
    locale !== 'auto' &&
    APPLE_SPEECH_OFFLINE_LOCALES.has(locale)
  ) {
    return {
      modelId: APPLE_SPEECH_MODEL_ID,
      appleSpeechLocale: locale,
      whisperLanguage: null,
      liveSupported: true,
    };
  }

  // Whisper paths. Prefer whisper-small for non-English; fall back to whatever
  // whisper variant is installed if the user explicitly picked one.
  const preferredWhisper =
    locale === 'en-US'
      ? selectedModelId.startsWith('whisper-')
        ? selectedModelId
        : installed.has('whisper-small')
          ? 'whisper-small'
          : 'whisper-base'
      : installed.has('whisper-small')
        ? 'whisper-small'
        : 'whisper-base';

  return {
    modelId: preferredWhisper,
    appleSpeechLocale: null,
    whisperLanguage,
    // Live partials only via Apple Speech today; whisper.cpp doesn't stream.
    liveSupported: false,
  };
}

async function resolveSummaryEngine(modelId: string): Promise<LocalModelEngine> {
  // Lazy import: localModels transitively loads expo-file-system which is not
  // always available in unit tests. Pull it in only when a real summarize call
  // happens (which only fires on-device).
  const { getInstalledModel } = await import('./localModels');
  const installed = await getInstalledModel(modelId);
  if (!installed) {
    throw new Error(`Local summary model "${modelId}" is not installed. Download it in Settings → Local models.`);
  }
  return installed.engine;
}

const nativeModule =
  Platform.OS === 'web' ? null : requireOptionalNativeModule<LocalNativeModule>('MuFathomLocalAI');

let deviceSupportPromise: Promise<LocalDeviceSupport> | null = null;

export function resetLocalDeviceSupportCache() {
  deviceSupportPromise = null;
}

export function getLocalDeviceSupport(): Promise<LocalDeviceSupport> {
  if (!deviceSupportPromise) {
    deviceSupportPromise = computeLocalDeviceSupport().catch((error) => {
      deviceSupportPromise = null;
      throw error;
    });
  }
  return deviceSupportPromise;
}

async function computeLocalDeviceSupport(): Promise<LocalDeviceSupport> {
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

export async function transcribeLocalAudio(params: {
  audioUri: string;
  modelId: string;
  /** BCP-47 locale for Apple Speech. */
  locale?: string;
  /** ISO 639-1 code for whisper.cpp (or null/undefined for auto-detect). */
  language?: string | null;
}) {
  const module = await requireLocalRuntime('transcription');

  const trimmedModelId = params.modelId.trim();
  if (!trimmedModelId) {
    throw new Error('Pick an installed local transcription model in Settings first.');
  }

  if (Platform.OS === 'ios' && !IOS_LOCAL_TRANSCRIPTION_MODEL_IDS.has(trimmedModelId)) {
    throw new Error(IOS_LOCAL_TRANSCRIPTION_MODEL_ERROR);
  }

  let transcript: string | undefined;
  try {
    transcript = await module.transcribe?.({
      audioUri: params.audioUri,
      modelId: trimmedModelId,
      locale: params.locale,
      // Empty string sentinel means "auto-detect"; whisper.cpp interprets
      // empty/null as enable-auto-detect.
      language: params.language ?? '',
    });
  } catch (error) {
    throw new Error(normalizeLocalTranscriptionError(error));
  }

  if (!transcript?.trim()) {
    throw new Error('Local transcription returned no text.');
  }

  const trimmedTranscript = transcript.trim();
  // Page-placeholder hallucinations are a whisper.cpp-specific failure mode
  // (the model spits out "page 1 page 2…" on quiet audio). Apple Speech
  // doesn't produce them, so skip the validation when we know it's the source.
  if (trimmedModelId !== APPLE_SPEECH_MODEL_ID) {
    validateLocalTranscript(trimmedTranscript);
  }
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

  const engine = await resolveSummaryEngine(params.modelId);
  return summarizeLocalTranscriptWithEngine(module, params.transcriptText, params.modelId, engine);
}

export async function summarizeAndExtractLocalTranscript(params: {
  transcriptText: string;
  modelId: string;
  fields: ExtractionLayerField[];
}): Promise<{ summary: SummaryPayload; extractedValues: Record<string, string> }> {
  const module = await requireLocalRuntime('summary');

  if (!params.modelId.trim()) {
    throw new Error('Pick an installed local summary model in Settings first.');
  }

  if (!params.fields.length) {
    return {
      summary: await summarizeLocalTranscript(params),
      extractedValues: {},
    };
  }

  const engine = await resolveSummaryEngine(params.modelId);
  const chunks = chunkTranscript(params.transcriptText, LOCAL_TRANSCRIPT_WINDOW, LOCAL_TRANSCRIPT_OVERLAP);

  if (chunks.length <= 1) {
    return runCombinedSummaryExtractionPass(
      module,
      buildCombinedLocalAnalysisPrompt(params.transcriptText, params.fields),
      params.modelId,
      engine,
      params.fields
    );
  }

  return {
    summary: await summarizeLocalTranscriptWithEngine(module, params.transcriptText, params.modelId, engine),
    extractedValues: await extractLocalStructuredDataWithEngine(
      module,
      params.transcriptText,
      params.modelId,
      engine,
      params.fields
    ),
  };
}

async function summarizeLocalTranscriptWithEngine(
  module: LocalNativeModule,
  transcriptText: string,
  modelId: string,
  engine: LocalModelEngine
) {
  const chunks = chunkTranscript(transcriptText, LOCAL_TRANSCRIPT_WINDOW, LOCAL_TRANSCRIPT_OVERLAP);

  if (chunks.length <= 1) {
    return runSummaryPass(module, buildFinalSummaryPrompt(transcriptText), modelId, engine);
  }

  const partialSummaries: SummaryPayload[] = [];

  for (const chunk of chunks) {
    partialSummaries.push(await runSummaryPass(module, buildChunkSummaryPrompt(chunk), modelId, engine));
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

  return runSummaryPass(module, buildCombineSummaryPrompt(combinedPayload), modelId, engine);
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

  const engine = await resolveSummaryEngine(params.modelId);
  return extractLocalStructuredDataWithEngine(
    module,
    params.transcriptText,
    params.modelId,
    engine,
    params.fields
  );
}

async function extractLocalStructuredDataWithEngine(
  module: LocalNativeModule,
  transcriptText: string,
  modelId: string,
  engine: LocalModelEngine,
  fields: ExtractionLayerField[]
) {
  const rawValues = await runJsonObjectPass(
    module,
    buildLocalExtractionPrompt(transcriptText, fields),
    modelId,
    engine,
    fields.map((field) => field.id)
  );

  return Object.fromEntries(
    fields.map((field) => [field.id, String(rawValues[field.id] ?? '').trim()])
  );
}

async function runSummaryPass(
  module: LocalNativeModule,
  prompt: string,
  modelId: string,
  engine: LocalModelEngine
) {
  const raw = await module.summarize?.({ prompt, modelId, engine });

  if (!raw?.trim()) {
    throw new Error('Local summary model returned no content.');
  }

  try {
    return parseSummaryPayload(raw);
  } catch {
    const repaired = await module.summarize?.({
      prompt: buildRepairPrompt(raw),
      modelId,
      engine,
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
  engine: LocalModelEngine,
  requiredKeys: string[]
) {
  const raw = await module.summarize?.({ prompt, modelId, engine });

  if (!raw?.trim()) {
    throw new Error('Local summary model returned no analysis content.');
  }

  try {
    return parseJsonObject(raw);
  } catch {
    const repaired = await module.summarize?.({
      prompt: buildGenericRepairPrompt(raw, requiredKeys),
      modelId,
      engine,
    });

    if (!repaired?.trim()) {
      throw new Error('Local analysis parsing failed and repair returned no content.');
    }

    return parseJsonObject(repaired);
  }
}

async function runCombinedSummaryExtractionPass(
  module: LocalNativeModule,
  prompt: string,
  modelId: string,
  engine: LocalModelEngine,
  fields: ExtractionLayerField[]
) {
  const requiredKeys = ['summary', 'actionItems', 'decisions', 'followUps', 'extracted'];
  const raw = await module.summarize?.({ prompt, modelId, engine });

  if (!raw?.trim()) {
    throw new Error('Local summary model returned no analysis content.');
  }

  try {
    return parseCombinedSummaryExtractionPayload(raw, fields);
  } catch {
    const repaired = await module.summarize?.({
      prompt: buildGenericRepairPrompt(raw, requiredKeys),
      modelId,
      engine,
    });

    if (!repaired?.trim()) {
      throw new Error('Local combined analysis parsing failed and repair returned no content.');
    }

    return parseCombinedSummaryExtractionPayload(repaired, fields);
  }
}

/**
 * Returns true when the combined-analysis pass failed because the model output
 * could not be parsed into the expected JSON shape. In that case the caller can
 * fall back to the older two-pass (summary, then extraction) flow with simpler
 * prompts. For setup/runtime errors (model not installed, runtime missing,
 * audio normalization failed, etc.) the fallback would just hit the same error
 * a second time, so callers should rethrow.
 */
export function isLocalCombinedAnalysisRetryable(error: unknown): boolean {
  if (error instanceof SyntaxError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message;
  return (
    /no analysis content/i.test(message) ||
    /parsing failed/i.test(message) ||
    /non-object JSON/i.test(message)
  );
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

function buildCombinedLocalAnalysisPrompt(transcriptText: string, fields: ExtractionLayerField[]) {
  const keys = fields.map((field) => field.id).join(', ');
  const fieldLines = fields.map((field) => `- ${field.id}: ${field.title}. ${field.description}`);

  return [
    'You summarize a meeting transcript and extract structured fields for an offline mobile app.',
    'Return valid JSON only with keys: summary, actionItems, decisions, followUps, extracted.',
    `The extracted object must contain exactly these keys: ${keys}.`,
    'Use empty strings for missing extracted values. Do not invent facts. Keep the summary compact.',
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

  return normalizeSummaryPayload(parsed);
}

function parseCombinedSummaryExtractionPayload(
  raw: string,
  fields: ExtractionLayerField[]
): { summary: SummaryPayload; extractedValues: Record<string, string> } {
  const parsed = parseJsonObject(raw) as Partial<SummaryPayload> & {
    extracted?: Record<string, unknown>;
  };
  const extracted = parsed.extracted && typeof parsed.extracted === 'object' ? parsed.extracted : {};

  return {
    summary: normalizeSummaryPayload(parsed),
    extractedValues: Object.fromEntries(
      fields.map((field) => [field.id, String(extracted[field.id] ?? '').trim()])
    ),
  };
}

function normalizeSummaryPayload(parsed: Partial<SummaryPayload>): SummaryPayload {
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
  const parsed = parseJsonWithRepairableFormatting(json);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Local model returned non-object JSON.');
  }

  return parsed as Record<string, unknown>;
}

function parseJsonWithRepairableFormatting(json: string) {
  try {
    return JSON.parse(json);
  } catch (error) {
    const withoutTrailingCommas = json.replace(/,\s*([}\]])/g, '$1');
    if (withoutTrailingCommas !== json) {
      return JSON.parse(withoutTrailingCommas);
    }

    throw error;
  }
}

// ─── Live (streaming) transcription ──────────────────────────────────────────

/**
 * Returns true when the platform's native bridge can stream live partials
 * during recording. Today: iOS only, and only when the bridge is linked into
 * this build. Web and Android (no MediaPipe streaming hook) return false; the
 * UI should fall back to post-stop transcription on those platforms.
 */
export function supportsLiveTranscription(): boolean {
  if (Platform.OS !== 'ios') return false;
  return Boolean(nativeModule?.startLiveTranscription);
}

/**
 * Start a live transcription session. The native side taps the mic in
 * parallel to whatever recorder is active, so it must be called near the
 * point where audio recording starts to capture as much of the meeting as
 * possible. Throws if a session is already running, if speech permission was
 * denied, or if the locale doesn't support on-device recognition.
 *
 * Best-effort feature: callers should swallow the error and fall back to
 * post-stop transcription rather than aborting the recording itself.
 */
export async function startLiveTranscription(params: { locale?: string } = {}): Promise<void> {
  if (!nativeModule?.startLiveTranscription) {
    throw new Error('Live transcription is not supported on this build.');
  }
  await nativeModule.startLiveTranscription({ locale: params.locale ?? 'en-US' });
}

/**
 * Tear down the streaming session and resolve with the final transcript. If
 * any audio is still buffered at the time of the call, the recognizer flushes
 * it before resolving; expect the call to take ≲1s on a typical meeting.
 */
export async function stopLiveTranscription(): Promise<string> {
  if (!nativeModule?.stopLiveTranscription) return '';
  try {
    return await nativeModule.stopLiveTranscription();
  } catch (error) {
    // Don't surface mid-stream errors as fatal — caller falls back to the
    // saved-file transcribe path. Just swallow and return empty.
    return '';
  }
}

/**
 * Discard any in-flight live transcription. Used when the user cancels a
 * recording before saving.
 */
export async function cancelLiveTranscription(): Promise<void> {
  if (!nativeModule?.cancelLiveTranscription) return;
  try {
    await nativeModule.cancelLiveTranscription();
  } catch {
    // Cancellation is best-effort; errors here aren't actionable.
  }
}

/**
 * Subscribe to live partial transcripts. Returns an unsubscribe function. The
 * handler may be called many times per second on long recordings — keep it
 * cheap (a single setState is fine).
 */
export function addLivePartialTranscriptListener(
  handler: (transcript: string) => void
): () => void {
  if (!nativeModule?.addListener) {
    return () => undefined;
  }
  const subscription = nativeModule.addListener('onLivePartialTranscript', (event) => {
    handler(typeof event?.transcript === 'string' ? event.transcript : '');
  });
  return () => {
    try {
      subscription.remove();
    } catch {
      // best-effort
    }
  };
}
