import { getDatabase } from '../db';
import type { ModelCatalogItem, OfflineSetupBundleId, OfflineSetupSession } from '../types';
import { isSupportedIosTranscriptionModel } from './localModels';
import { applyOfflineSetupAutoConfig } from './settings';

const DEFAULT_SESSION: OfflineSetupSession = {
  bundleId: '',
  bundleLabel: '',
  modelIds: [],
  status: 'idle',
  bytesDownloaded: 0,
  totalBytes: 0,
  progress: 0,
  estimatedSecondsRemaining: null,
  networkPolicy: 'wifi_or_cellular',
  lastError: null,
  startedAt: null,
  updatedAt: null,
  autoConfiguredAt: null,
  isDismissed: false,
};

const OFFLINE_SETUP_STATUSES: OfflineSetupSession['status'][] = [
  'idle',
  'preparing',
  'downloading',
  'paused_offline',
  'paused_user',
  'failed',
  'ready',
];

export type OfflineSetupBundle = {
  id: OfflineSetupBundleId;
  label: string;
  modelIds: string[];
  totalBytes: number;
  estimatedSeconds: number;
  isRecommended: boolean;
  description: string;
};

const IN_APP_DOWNLOADABLE_MODEL = (item: ModelCatalogItem) =>
  !item.requiresExternalSetup && item.downloadUrl.trim().length > 0;

function parseModelIds(value: unknown) {
  if (typeof value !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function createDefaultSession(): OfflineSetupSession {
  return {
    ...DEFAULT_SESSION,
    modelIds: [...DEFAULT_SESSION.modelIds],
  };
}

function normalizeOfflineSetupStatus(value: unknown): OfflineSetupSession['status'] {
  return typeof value === 'string' && OFFLINE_SETUP_STATUSES.includes(value as OfflineSetupSession['status'])
    ? (value as OfflineSetupSession['status'])
    : 'idle';
}

function normalizeNetworkPolicy(_value: unknown): OfflineSetupSession['networkPolicy'] {
  // Only one policy is currently supported; any persisted value is normalized
  // to the single valid union member.
  return 'wifi_or_cellular';
}

function normalizeBundleId(value: unknown): OfflineSetupBundleId {
  return value === 'starter' || value === 'full' ? value : '';
}

function estimateBundleSeconds(totalBytes: number) {
  return Math.max(60, Math.round(totalBytes / (25 * 1024 * 1024)));
}

function clampProgress(progress: number) {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.max(0, Math.min(1, progress));
}

function buildBundle(
  id: OfflineSetupBundleId,
  label: OfflineSetupBundle['label'],
  modelItems: ModelCatalogItem[],
  isRecommended: boolean
): OfflineSetupBundle {
  const totalBytes = modelItems.reduce((sum, item) => sum + item.sizeBytes, 0);

  return {
    id,
    label,
    modelIds: modelItems.map((item) => item.id),
    totalBytes,
    estimatedSeconds: estimateBundleSeconds(totalBytes),
    isRecommended,
    description:
      label === 'Starter'
        ? 'Fastest way to get to a first local result.'
        : 'Larger offline bundle for broader local coverage.',
  };
}

export function resolveOfflineSetupBundles({
  platform,
  catalog,
}: {
  platform: 'ios' | 'android';
  catalog: ModelCatalogItem[];
}): OfflineSetupBundle[] {
  const visible = catalog.filter((item) => item.platforms.includes(platform) && IN_APP_DOWNLOADABLE_MODEL(item));
  const starterModels =
    platform === 'ios'
      ? visible.filter((item) => item.kind === 'transcription' && isSupportedIosTranscriptionModel(item.id))
      : visible.filter((item) => item.recommended);
  const fullModels =
    platform === 'android' ? visible.filter((item) => item.recommended || !item.experimental) : [];

  const bundles: OfflineSetupBundle[] = [];

  if (starterModels.length) {
    bundles.push(buildBundle('starter', 'Starter', starterModels, true));
  }

  if (fullModels.length > starterModels.length) {
    bundles.push(buildBundle('full', 'Full', fullModels, false));
  }

  return bundles;
}

export async function getOfflineSetupSession(): Promise<OfflineSetupSession> {
  const db = getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM offline_setup_session WHERE id = 1'
  );

  if (!row) {
    return createDefaultSession();
  }

  return {
    bundleId: normalizeBundleId(row.bundle_id),
    bundleLabel: String(row.bundle_label ?? ''),
    modelIds: parseModelIds(row.model_ids_json),
    status: normalizeOfflineSetupStatus(row.status),
    bytesDownloaded: Number(row.bytes_downloaded ?? 0),
    totalBytes: Number(row.total_bytes ?? 0),
    progress: Number(row.progress ?? 0),
    estimatedSecondsRemaining:
      row.estimated_seconds_remaining == null ? null : Number(row.estimated_seconds_remaining),
    networkPolicy: normalizeNetworkPolicy(row.network_policy),
    lastError: row.last_error ? String(row.last_error) : null,
    startedAt: row.started_at ? String(row.started_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
    autoConfiguredAt: row.auto_configured_at ? String(row.auto_configured_at) : null,
    isDismissed: Number(row.is_dismissed ?? 0) === 1,
  };
}

export async function saveOfflineSetupSession(session: OfflineSetupSession) {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE offline_setup_session SET
      bundle_id = ?,
      bundle_label = ?,
      model_ids_json = ?,
      status = ?,
      bytes_downloaded = ?,
      total_bytes = ?,
      progress = ?,
      estimated_seconds_remaining = ?,
      network_policy = ?,
      last_error = ?,
      started_at = ?,
      updated_at = ?,
      auto_configured_at = ?,
      is_dismissed = ?
    WHERE id = 1`,
    session.bundleId,
    session.bundleLabel,
    JSON.stringify(session.modelIds),
    session.status,
    session.bytesDownloaded,
    session.totalBytes,
    session.progress,
    session.estimatedSecondsRemaining,
    session.networkPolicy,
    session.lastError,
    session.startedAt,
    session.updatedAt,
    session.autoConfiguredAt,
    session.isDismissed ? 1 : 0
  );
}

export async function startOfflineSetup(bundle: OfflineSetupBundle) {
  const startedAt = new Date().toISOString();
  const current = await getOfflineSetupSession();

  await saveOfflineSetupSession({
    ...current,
    bundleId: bundle.id,
    bundleLabel: bundle.label,
    modelIds: bundle.modelIds,
    status: 'downloading',
    bytesDownloaded: 0,
    totalBytes: bundle.totalBytes,
    progress: 0,
    estimatedSecondsRemaining: bundle.estimatedSeconds,
    networkPolicy: current.networkPolicy,
    lastError: null,
    startedAt,
    updatedAt: startedAt,
    autoConfiguredAt: null,
    isDismissed: false,
  });
}

export async function updateOfflineSetupProgress(params: {
  bytesDownloaded: number;
  totalBytes: number;
  progress: number;
  estimatedSecondsRemaining?: number | null;
}) {
  const current = await getOfflineSetupSession();
  const now = new Date().toISOString();

  await saveOfflineSetupSession({
    ...current,
    status: 'downloading',
    bytesDownloaded: Math.max(0, Math.round(params.bytesDownloaded)),
    totalBytes: Math.max(0, Math.round(params.totalBytes)),
    progress: clampProgress(params.progress),
    estimatedSecondsRemaining: params.estimatedSecondsRemaining ?? current.estimatedSecondsRemaining,
    lastError: null,
    updatedAt: now,
  });
}

export async function markOfflineSetupPausedOffline(message: string) {
  const current = await getOfflineSetupSession();

  await saveOfflineSetupSession({
    ...current,
    status: 'paused_offline',
    lastError: message,
    updatedAt: new Date().toISOString(),
  });
}

export async function markOfflineSetupFailed(message: string) {
  const current = await getOfflineSetupSession();

  await saveOfflineSetupSession({
    ...current,
    status: 'failed',
    lastError: message,
    updatedAt: new Date().toISOString(),
  });
}

export async function markOfflineSetupReady(params: {
  preferredTranscriptionModelId: string | null;
  preferredSummaryModelId: string | null;
}) {
  const current = await getOfflineSetupSession();

  await applyOfflineSetupAutoConfig({
    bundleId: current.bundleId,
    modelIds: current.modelIds,
    preferredTranscriptionModelId: params.preferredTranscriptionModelId,
    preferredSummaryModelId: params.preferredSummaryModelId,
  });

  const now = new Date().toISOString();
  await saveOfflineSetupSession({
    ...current,
    status: 'ready',
    bytesDownloaded: current.totalBytes,
    progress: 1,
    estimatedSecondsRemaining: 0,
    lastError: null,
    autoConfiguredAt: now,
    updatedAt: now,
  });
}
