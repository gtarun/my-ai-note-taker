import { getDatabase } from '../db';
import type { OfflineSetupSession } from '../types';

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

export async function getOfflineSetupSession(): Promise<OfflineSetupSession> {
  const db = getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM offline_setup_session WHERE id = 1'
  );

  if (!row) {
    return DEFAULT_SESSION;
  }

  return {
    bundleId: String(row.bundle_id ?? ''),
    bundleLabel: String(row.bundle_label ?? ''),
    modelIds: parseModelIds(row.model_ids_json),
    status: (row.status as OfflineSetupSession['status']) ?? 'idle',
    bytesDownloaded: Number(row.bytes_downloaded ?? 0),
    totalBytes: Number(row.total_bytes ?? 0),
    progress: Number(row.progress ?? 0),
    estimatedSecondsRemaining:
      row.estimated_seconds_remaining == null ? null : Number(row.estimated_seconds_remaining),
    networkPolicy: 'wifi_or_cellular',
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
