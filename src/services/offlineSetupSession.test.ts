import { describe, expect, test, vi } from 'vitest';

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
        sessionRowState.status = String(params[3]);
      }
    }),
  }),
}));

import { getOfflineSetupSession, saveOfflineSetupSession } from './offlineSetupSession';

describe('offline setup session storage', () => {
  test('hydrates the default idle session', async () => {
    await expect(getOfflineSetupSession()).resolves.toEqual(
      expect.objectContaining({
        bundleId: '',
        status: 'idle',
        progress: 0,
      }),
    );
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

    expect(sessionRowState.bundle_id).toBe('starter');
    expect(sessionRowState.status).toBe('preparing');
  });
});
