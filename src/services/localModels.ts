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
import { fetchWithRetry } from './http';

const MODEL_DIR = `${FileSystem.documentDirectory}models`;
const HUGGING_FACE_BASE_URL = 'https://huggingface.co';
const activeModelDownloadIds = new Set<string>();
/** Catalog id for Apple's built-in SFSpeechRecognizer.
 *  Always-installed on iOS — no download flow, no disk file. Routed natively
 *  via `MuFathomLocalAIModule.transcribe` based on this id. */
export const APPLE_SPEECH_MODEL_ID = 'apple-speech-recognizer';

export const IOS_SUPPORTED_TRANSCRIPTION_MODEL_IDS = new Set([
  APPLE_SPEECH_MODEL_ID,
  'whisper-base',
  'whisper-small',
]);
export const IOS_SUPPORTED_SUMMARY_MODEL_IDS = new Set([
  'qwen2.5-1.5b-instruct-gguf-q4',
  'gemma-3-1b-it-q4',
  'qwen2.5-1.5b-instruct-q8',
]);

const BUILT_IN_MODEL_CATALOG: ModelCatalogItem[] = [
  {
    id: APPLE_SPEECH_MODEL_ID,
    kind: 'transcription',
    engine: 'apple-speech',
    displayName: 'Apple Speech (on-device)',
    version: 'system',
    downloadUrl: '', // Built into iOS — handled natively, no download.
    sourceUrl: 'https://developer.apple.com/documentation/speech',
    sourceLabel: 'About Apple Speech',
    sha256: '',
    sizeBytes: 0,
    platforms: ['ios'],
    minFreeSpaceBytes: 0,
    recommended: true,
    experimental: false,
    description:
      "Apple's built-in speech recognition. Runs on the Neural Engine, fully on-device, no model download. Recommended default for English meetings on iOS 17+.",
  },
  {
    id: 'whisper-base',
    kind: 'transcription',
    engine: 'whisper.cpp',
    displayName: 'Whisper Base',
    version: 'ggml',
    downloadUrl: buildHuggingFaceDownloadUrl('ggerganov/whisper.cpp', 'ggml-base.bin'),
    sourceUrl: buildHuggingFaceModelUrl('ggerganov/whisper.cpp'),
    sourceLabel: 'View whisper.cpp files',
    sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
    sizeBytes: 147951465,
    platforms: ['ios', 'android'],
    minFreeSpaceBytes: 1 * 1024 * 1024 * 1024,
    recommended: true,
    experimental: false,
    description: 'Balanced multilingual speech-to-text model from whisper.cpp.',
  },
  {
    id: 'whisper-small',
    kind: 'transcription',
    engine: 'whisper.cpp',
    displayName: 'Whisper Small',
    version: 'ggml',
    downloadUrl: buildHuggingFaceDownloadUrl('ggerganov/whisper.cpp', 'ggml-small.bin'),
    sourceUrl: buildHuggingFaceModelUrl('ggerganov/whisper.cpp'),
    sourceLabel: 'View whisper.cpp files',
    sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
    sizeBytes: 487601967,
    platforms: ['ios', 'android'],
    minFreeSpaceBytes: 2 * 1024 * 1024 * 1024,
    recommended: false,
    experimental: false,
    description:
      'Higher accuracy multilingual speech-to-text. ~5× larger than Whisper Base; recommended when Base produces short or hallucinated transcripts on quiet audio.',
  },
  {
    id: 'gemma-3n-e2b-preview',
    kind: 'summary',
    engine: 'mediapipe-llm',
    displayName: 'Gemma 3n E2B preview',
    version: '20250520',
    downloadUrl: '',
    sourceUrl: buildHuggingFaceModelUrl('google/gemma-3n-E2B-it-litert-preview'),
    sourceLabel: 'Open model page',
    requiresExternalSetup: true,
    sha256: '',
    sizeBytes: 3136226711,
    platforms: ['android'],
    minFreeSpaceBytes: 6 * 1024 * 1024 * 1024,
    recommended: true,
    experimental: false,
    description:
      'Official Gemma 3n preview from the Google AI Edge Gallery ecosystem. Listed here by default, but still needs external license/setup handling before in-app download can be automated.',
  },
  {
    id: 'gemma-3n-e4b-preview',
    kind: 'summary',
    engine: 'litert-lm',
    displayName: 'Gemma 3n E4B preview',
    version: '20250520',
    downloadUrl: '',
    sourceUrl: buildHuggingFaceModelUrl('google/gemma-3n-E4B-it-litert-preview'),
    sourceLabel: 'Open model page',
    requiresExternalSetup: true,
    sha256: '',
    sizeBytes: 4405655031,
    platforms: ['android'],
    minFreeSpaceBytes: 6 * 1024 * 1024 * 1024,
    recommended: false,
    experimental: false,
    description:
      'Larger official Gemma 3n preview model from the Google AI Edge Gallery ecosystem. Best treated as a bring-your-own or future authenticated download target.',
  },
  {
    id: 'gemma-3-1b-it-q4',
    kind: 'summary',
    engine: 'mediapipe-llm',
    displayName: 'Gemma 3 1B IT q4',
    version: '20250514',
    downloadUrl: '',
    sourceUrl: buildHuggingFaceModelUrl('litert-community/Gemma3-1B-IT'),
    sourceLabel: 'Open model page',
    requiresExternalSetup: true,
    sha256: '',
    sizeBytes: 554661246,
    platforms: ['ios', 'android'],
    minFreeSpaceBytes: 2 * 1024 * 1024 * 1024,
    recommended: true,
    experimental: false,
    description: 'Small Gemma text model packaged for LiteRT/MediaPipe-style on-device inference.',
  },
  {
    id: 'qwen2.5-1.5b-instruct-q8',
    kind: 'summary',
    engine: 'mediapipe-llm',
    displayName: 'Qwen 2.5 1.5B Instruct q8',
    version: '20250514',
    downloadUrl: buildHuggingFaceDownloadUrl(
      'litert-community/Qwen2.5-1.5B-Instruct',
      'Qwen2.5-1.5B-Instruct_multi-prefill-seq_q8_ekv1280.task'
    ),
    sourceUrl: buildHuggingFaceModelUrl('litert-community/Qwen2.5-1.5B-Instruct'),
    sourceLabel: 'Open model page',
    sha256: '',
    sizeBytes: 1597913616,
    platforms: ['ios', 'android'],
    minFreeSpaceBytes: 3 * 1024 * 1024 * 1024,
    recommended: false,
    experimental: false,
    description: 'Small instruction-tuned community model that is easier to ship than huge Gemma-family checkpoints.',
  },
  {
    id: 'qwen2.5-1.5b-instruct-gguf-q4',
    kind: 'summary',
    engine: 'llama.cpp',
    displayName: 'Qwen 2.5 1.5B Instruct (GGUF q4)',
    version: 'q4_k_m',
    downloadUrl: buildHuggingFaceDownloadUrl(
      'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
      'qwen2.5-1.5b-instruct-q4_k_m.gguf'
    ),
    sourceUrl: buildHuggingFaceModelUrl('Qwen/Qwen2.5-1.5B-Instruct-GGUF'),
    sourceLabel: 'Open model page',
    sha256: '',
    sizeBytes: 986049728,
    platforms: ['ios'],
    minFreeSpaceBytes: 2 * 1024 * 1024 * 1024,
    recommended: true,
    experimental: false,
    description: 'Quantized GGUF build of Qwen 2.5 1.5B Instruct for on-device summarization via llama.cpp (iOS).',
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

/**
 * Synthetic "always installed" row for Apple Speech on iOS. The OS provides the
 * recognizer; there's no file on disk and no download flow. We surface it as
 * an installed row so the rest of the app (Settings dropdown, processMeeting
 * install check) can treat it like any other transcription model.
 */
function buildAppleSpeechSyntheticRow(): InstalledModelRow {
  return {
    id: APPLE_SPEECH_MODEL_ID,
    kind: 'transcription',
    engine: 'apple-speech',
    displayName: 'Apple Speech (on-device)',
    version: 'system',
    platforms: ['ios'],
    fileUri: null,
    sizeBytes: 0,
    sha256: '',
    status: 'installed',
    installedAt: null,
    downloadUrl: '',
    recommended: true,
    experimental: false,
    errorMessage: null,
  };
}

function shouldExposeAppleSpeech() {
  return Platform.OS === 'ios';
}

export async function getInstalledModels(): Promise<InstalledModelRow[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<InstalledModelRowRecord>(
    'SELECT * FROM installed_models ORDER BY display_name ASC'
  );
  const dbRows = rows.map(mapInstalledModelRow);
  if (shouldExposeAppleSpeech() && !dbRows.some((row) => row.id === APPLE_SPEECH_MODEL_ID)) {
    return [buildAppleSpeechSyntheticRow(), ...dbRows];
  }
  return dbRows;
}

/**
 * Clears download rows orphaned by an app restart.
 *
 * `activeModelDownloadIds` lives in memory and the resumable-download handle is
 * never persisted, so no download can survive the JS context going away. A row
 * left at `status: 'downloading'` is therefore always stale — and because
 * nothing reconciled it at boot, the model would sit at "Downloading…" forever
 * with no way to retry.
 */
export async function reconcileInterruptedModelDownloads(): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE installed_models
     SET status = 'failed', error_message = ?
     WHERE status = 'downloading'`,
    'Download was interrupted. Tap to try again.'
  );
}

export async function getInstalledModel(id: string): Promise<InstalledModelRow | null> {
  if (id === APPLE_SPEECH_MODEL_ID && shouldExposeAppleSpeech()) {
    return buildAppleSpeechSyntheticRow();
  }
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

  // Short deadline: this is a small JSON file, and the built-in catalog is a
  // perfectly good fallback if the user's URL is unreachable.
  const response = await fetchWithRetry(catalogUrl, { timeoutMs: 15_000, attempts: 2 });

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

  return catalog.filter((item) => {
    if (platform === 'ios') {
      if (item.kind === 'transcription' && !IOS_SUPPORTED_TRANSCRIPTION_MODEL_IDS.has(item.id)) {
        return false;
      }
      if (item.kind === 'summary' && !IOS_SUPPORTED_SUMMARY_MODEL_IDS.has(item.id)) {
        return false;
      }
    }

    return item.platforms.includes(platform);
  });
}

export function isSupportedIosTranscriptionModel(modelId: string) {
  return IOS_SUPPORTED_TRANSCRIPTION_MODEL_IDS.has(modelId);
}

export function isSupportedIosSummaryModel(modelId: string) {
  return IOS_SUPPORTED_SUMMARY_MODEL_IDS.has(modelId);
}

/**
 * `onPhase` exists because checksum verification of a multi-hundred-megabyte
 * model takes real time in pure JS. Without it the UI sits at 100% looking
 * frozen for minutes after the download finishes.
 */
export type DownloadModelOptions = {
  onProgress?: (progress: number) => void;
  onPhase?: (phase: 'downloading' | 'verifying') => void;
};

export async function downloadModel(
  catalogItem: ModelCatalogItem,
  options?: DownloadModelOptions
) {
  if (activeModelDownloadIds.has(catalogItem.id)) {
    throw new Error(`${catalogItem.displayName} is already downloading.`);
  }

  activeModelDownloadIds.add(catalogItem.id);

  try {
    return await downloadModelOnce(catalogItem, options);
  } finally {
    activeModelDownloadIds.delete(catalogItem.id);
  }
}

async function downloadModelOnce(
  catalogItem: ModelCatalogItem,
  options?: DownloadModelOptions
) {
  // Apple Speech is provided by iOS; nothing to download. Just report
  // installed-and-ready so the UI completion path runs the same way.
  if (catalogItem.engine === 'apple-speech') {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Speech is only available on iOS.');
    }
    options?.onProgress?.(1);
    return buildAppleSpeechSyntheticRow();
  }

  if (!catalogItem.downloadUrl.trim()) {
    if (catalogItem.requiresExternalSetup) {
      throw new Error(
        'This model still needs an external download or license-acceptance step. Open the model source page instead.'
      );
    }

    throw new Error('This model is not directly downloadable in-app yet. Open the source page or add a custom catalog.');
  }

  if (!catalogItem.platforms.includes(getCurrentModelPlatform())) {
    throw new Error('This model is not available for the current device platform.');
  }

  if (getCurrentModelPlatform() === 'ios') {
    if (catalogItem.kind === 'transcription' && !IOS_SUPPORTED_TRANSCRIPTION_MODEL_IDS.has(catalogItem.id)) {
      const supportedList = Array.from(IOS_SUPPORTED_TRANSCRIPTION_MODEL_IDS).join(', ');
      throw new Error(`Only ${supportedList} are supported for local transcription on iOS in this phase.`);
    }
    if (catalogItem.kind === 'summary' && !IOS_SUPPORTED_SUMMARY_MODEL_IDS.has(catalogItem.id)) {
      throw new Error('Only GGUF/llama.cpp summary models are supported on iOS in this phase.');
    }
  }

  const freeSpace = await FileSystem.getFreeDiskStorageAsync();

  if (freeSpace < catalogItem.minFreeSpaceBytes) {
    throw new Error('Not enough free space available for this model download.');
  }

  // Check the catalog against the host before spending the user's bandwidth,
  // not after. A stale entry used to be discovered at the very end of a 488 MB
  // download; now it costs one small JSON request.
  options?.onPhase?.('verifying');
  const upstreamCheck = checkUpstreamMatchesCatalog(
    catalogItem,
    await fetchUpstreamArtifactMetadata(catalogItem.downloadUrl)
  );

  if (!upstreamCheck.ok) {
    throw new Error(upstreamCheck.reason);
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

  options?.onPhase?.('downloading');

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

    if (typeof result.status === 'number' && result.status >= 400) {
      throw new Error(`Model download request failed (${result.status}).`);
    }

    const info = await FileSystem.getInfoAsync(result.uri);

    if (!info.exists) {
      throw new Error('Downloaded model file was not found on disk.');
    }

    /*
     * Exact, not approximate. The old ±2048 tolerance existed to absorb the
     * checksum pass that followed it; with the digest verified upstream before
     * the download, a byte count that disagrees at all means the write was
     * truncated or interrupted, and a partial GGML file fails later in
     * whisper.cpp with a far less obvious error than this one.
     */
    if (catalogItem.sizeBytes > 0 && info.size !== catalogItem.sizeBytes) {
      throw new Error(
        'The download finished with the wrong number of bytes, so the file is incomplete. Check your connection and free space, then try again.'
      );
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
    record.engine === 'mediapipe-llm' ||
    record.engine === 'litert-lm' ||
    record.engine === 'whisper.cpp' ||
    record.engine === 'llama.cpp'
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
    sourceUrl: record.sourceUrl ? String(record.sourceUrl) : undefined,
    sourceLabel: record.sourceLabel ? String(record.sourceLabel) : undefined,
    requiresExternalSetup: Boolean(record.requiresExternalSetup),
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

function buildHuggingFaceModelUrl(modelId: string) {
  return `${HUGGING_FACE_BASE_URL}/${modelId}`;
}

function buildHuggingFaceDownloadUrl(modelId: string, fileName: string) {
  return `${buildHuggingFaceModelUrl(modelId)}/resolve/main/${fileName}?download=true`;
}

/**
 * Pull the sha256 and byte size Hugging Face publishes for a repo file.
 *
 * The same digest also rides on the `x-linked-etag` header of the download
 * URL's 302, but that hop is unreachable from React Native — its fetch is
 * backed by XHR, which follows redirects itself and never exposes the
 * intermediate response. The tree API is a plain JSON GET, so it works
 * everywhere and costs one small request.
 *
 * Returns null whenever the answer is anything other than a confident match:
 * a non-Hugging-Face host, a non-LFS file, a network failure. Callers treat
 * null as "unknown", never as "mismatch".
 */
export async function fetchUpstreamArtifactMetadata(
  downloadUrl: string
): Promise<{ sha256: string; sizeBytes: number } | null> {
  const match = downloadUrl.match(
    /^https:\/\/huggingface\.co\/([^/]+\/[^/]+)\/resolve\/([^/]+)\/(.+?)(?:\?|$)/
  );

  if (!match) {
    return null;
  }

  const [, repo, revision, filePath] = match;

  try {
    const response = await fetchWithRetry(
      `${HUGGING_FACE_BASE_URL}/api/models/${repo}/tree/${revision}`,
      { headers: { Accept: 'application/json' }, timeoutMs: 15_000, attempts: 2 }
    );

    if (!response.ok) {
      return null;
    }

    const entries = (await response.json()) as Array<{
      path?: string;
      size?: number;
      lfs?: { oid?: string; size?: number } | null;
    }>;

    const entry = Array.isArray(entries)
      ? entries.find((candidate) => candidate.path === decodeURIComponent(filePath))
      : undefined;
    const oid = entry?.lfs?.oid;
    const size = entry?.lfs?.size ?? entry?.size;

    if (typeof oid !== 'string' || !/^[0-9a-f]{64}$/.test(oid) || typeof size !== 'number') {
      return null;
    }

    return { sha256: oid, sizeBytes: size };
  } catch {
    return null;
  }
}

/**
 * Compare what the catalog promises against what the host is actually serving.
 *
 * This runs *before* the download rather than after, which is the whole point:
 * a catalog entry that has drifted from upstream is caught in a few hundred
 * milliseconds instead of after half a gigabyte has crossed the user's
 * connection.
 *
 * What it does not do is hash the bytes that landed on disk. Doing that would
 * need a native sha256-over-file primitive, and none of the installed Expo
 * modules expose one — the previous implementation hashed in pure JS at roughly
 * 9 MB/s under Node's JIT and considerably worse under Hermes, which turned
 * "verifying" into a five-minute freeze on Whisper Small. Truncated and
 * interrupted writes, the failure this realistically guards against, are caught
 * by the exact size check after the download instead.
 */
export function checkUpstreamMatchesCatalog(
  catalogItem: Pick<ModelCatalogItem, 'sha256' | 'sizeBytes'>,
  upstream: { sha256: string; sizeBytes: number } | null
): { ok: true } | { ok: false; reason: string } {
  const expectedSha = catalogItem.sha256.trim().toLowerCase();

  // Nothing to compare against: either the catalog omits a digest or the host
  // does not publish one. Silence here is not evidence of a problem.
  if (!upstream || !expectedSha) {
    return { ok: true };
  }

  if (upstream.sha256 !== expectedSha) {
    return {
      ok: false,
      reason:
        'The file on the download host no longer matches this catalog entry. Update the app or the model catalog before downloading.',
    };
  }

  if (catalogItem.sizeBytes > 0 && upstream.sizeBytes !== catalogItem.sizeBytes) {
    return {
      ok: false,
      reason:
        'The download host reports a different file size than this catalog entry. Update the app or the model catalog before downloading.',
    };
  }

  return { ok: true };
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

  if (engine === 'llama.cpp') {
    return '.gguf';
  }

  return '.task';
}

function getCurrentModelPlatform(support?: LocalDeviceSupport | null): LocalModelPlatform {
  if (support?.platform === 'android') {
    return 'android';
  }

  return Platform.OS === 'android' ? 'android' : 'ios';
}

async function safeDeleteFile(uri: string) {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Ignore cleanup failure and let the model row tell the user what happened.
  }
}
