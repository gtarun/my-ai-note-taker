import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import type {
  OfflineSetupBundleId,
  OfflineSetupSession,
  OfflineSetupStatus,
} from '../types';

const sessionRowState = {
  id: 1,
  bundle_id: '',
  bundle_label: '',
  model_ids_json: '[]',
  status: 'idle',
  bytes_downloaded: 0,
  total_bytes: 0,
  progress: 0,
  estimated_seconds_remaining: null,
  network_policy: 'wifi_or_cellular',
  last_error: null,
  started_at: null,
  updated_at: null,
  auto_configured_at: null,
  is_dismissed: 0,
};

const defaultSession = {
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
} as const;

expectTypeOf<OfflineSetupStatus>().toEqualTypeOf<
  'idle' | 'preparing' | 'downloading' | 'paused_offline' | 'paused_user' | 'failed' | 'ready'
>();

expectTypeOf<OfflineSetupBundleId>().toEqualTypeOf<'starter' | 'full' | ''>();

expectTypeOf<OfflineSetupSession>().toEqualTypeOf<{
  bundleId: OfflineSetupBundleId;
  bundleLabel: string;
  modelIds: string[];
  status: OfflineSetupStatus;
  bytesDownloaded: number;
  totalBytes: number;
  progress: number;
  estimatedSecondsRemaining: number | null;
  networkPolicy: 'wifi_or_cellular';
  lastError: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  autoConfiguredAt: string | null;
  isDismissed: boolean;
}>();

vi.mock('../db', () => ({
  getDatabase: () => ({
    getFirstAsync: vi.fn(async (source: string) => {
      if (source.includes('FROM offline_setup_session')) {
        return sessionRowState;
      }

      return null;
    }),
    runAsync: vi.fn(async (source: string, ...params: unknown[]) => {
      if (source.includes('UPDATE offline_setup_session SET')) {
        sessionRowState.bundle_id = String(params[0]);
        sessionRowState.bundle_label = String(params[1]);
        sessionRowState.model_ids_json = String(params[2]);
        sessionRowState.status = String(params[3]);
        sessionRowState.bytes_downloaded = Number(params[4]);
        sessionRowState.total_bytes = Number(params[5]);
        sessionRowState.progress = Number(params[6]);
        sessionRowState.estimated_seconds_remaining = params[7] as number | null;
        sessionRowState.network_policy = String(params[8]);
        sessionRowState.last_error = params[9] as string | null;
        sessionRowState.started_at = params[10] as string | null;
        sessionRowState.updated_at = params[11] as string | null;
        sessionRowState.auto_configured_at = params[12] as string | null;
        sessionRowState.is_dismissed = Number(params[13]);
      }
    }),
  }),
}));

import { getOfflineSetupSession, saveOfflineSetupSession } from './offlineSetupSession';

describe('offline setup session storage', () => {
  test('hydrates the default idle session', async () => {
    await expect(getOfflineSetupSession()).resolves.toEqual(defaultSession);
  });

  test('persists session updates as a single app-wide record', async () => {
    await saveOfflineSetupSession({
      bundleId: 'starter',
      bundleLabel: 'Starter',
      modelIds: ['whisper-base'],
      status: 'preparing',
      bytesDownloaded: 0,
      totalBytes: 152 * 1024 * 1024,
      progress: 0,
      estimatedSecondsRemaining: null,
      networkPolicy: 'wifi_or_cellular',
      lastError: null,
      startedAt: '2026-04-20T10:00:00.000Z',
      updatedAt: '2026-04-20T10:00:00.000Z',
      autoConfiguredAt: null,
      isDismissed: false,
    });

    expect(sessionRowState).toEqual({
      id: 1,
      bundle_id: 'starter',
      bundle_label: 'Starter',
      model_ids_json: '["whisper-base"]',
      status: 'preparing',
      bytes_downloaded: 0,
      total_bytes: 152 * 1024 * 1024,
      progress: 0,
      estimated_seconds_remaining: null,
      network_policy: 'wifi_or_cellular',
      last_error: null,
      started_at: '2026-04-20T10:00:00.000Z',
      updated_at: '2026-04-20T10:00:00.000Z',
      auto_configured_at: null,
      is_dismissed: 0,
    });

    await expect(getOfflineSetupSession()).resolves.toEqual({
      bundleId: 'starter',
      bundleLabel: 'Starter',
      modelIds: ['whisper-base'],
      status: 'preparing',
      bytesDownloaded: 0,
      totalBytes: 152 * 1024 * 1024,
      progress: 0,
      estimatedSecondsRemaining: null,
      networkPolicy: 'wifi_or_cellular',
      lastError: null,
      startedAt: '2026-04-20T10:00:00.000Z',
      updatedAt: '2026-04-20T10:00:00.000Z',
      autoConfiguredAt: null,
      isDismissed: false,
    });
  });
});
