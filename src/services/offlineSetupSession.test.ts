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

const mockApplyOfflineSetupAutoConfig = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  getFreeDiskStorageAsync: vi.fn(async () => 10 * 1024 * 1024 * 1024),
  getInfoAsync: vi.fn(async () => ({ exists: false })),
  makeDirectoryAsync: vi.fn(async () => undefined),
  createDownloadResumable: vi.fn(),
  deleteAsync: vi.fn(async () => undefined),
}));

vi.mock('../utils/sha256', () => ({
  Sha256: {
    hash: vi.fn(),
  },
}));

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

vi.mock('./settings', () => ({
  applyOfflineSetupAutoConfig: mockApplyOfflineSetupAutoConfig,
}));

import {
  getOfflineSetupSession,
  markOfflineSetupFailed,
  markOfflineSetupPausedOffline,
  markOfflineSetupReady,
  resolveOfflineSetupBundles,
  saveOfflineSetupSession,
  startOfflineSetup,
} from './offlineSetupSession';

describe('offline setup session storage', () => {
  beforeEach(() => {
    Object.assign(sessionRowState, {
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
    });
  });

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

  test('normalizes unexpected persisted enum-like values to safe defaults', async () => {
    sessionRowState.status = 'not-a-real-status';
    sessionRowState.network_policy = 'unexpected-policy';

    await expect(getOfflineSetupSession()).resolves.toEqual({
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
    });
  });

  test('builds a starter bundle for iOS from the supported transcription model only', async () => {
    expect(
      resolveOfflineSetupBundles({
        platform: 'ios',
        catalog: [
          {
            id: 'whisper-base',
            kind: 'transcription',
            engine: 'whisper.cpp',
            displayName: 'Whisper Base',
            version: 'ggml',
            downloadUrl: 'https://example.com/whisper-base.bin',
            sha256: '',
            sizeBytes: 152,
            platforms: ['ios'],
            minFreeSpaceBytes: 1,
            recommended: true,
            experimental: false,
            description: 'base',
          },
        ],
      })
    ).toEqual([
      expect.objectContaining({
        id: 'starter',
        modelIds: ['whisper-base'],
        totalBytes: 152,
        isRecommended: true,
      }),
    ]);
  });

  test('builds explicit starter and full bundle ids while skipping non-downloadable android models', async () => {
    expect(
      resolveOfflineSetupBundles({
        platform: 'android',
        catalog: [
          {
            id: 'whisper-base',
            kind: 'transcription',
            engine: 'whisper.cpp',
            displayName: 'Whisper Base',
            version: 'ggml',
            downloadUrl: 'https://example.com/whisper-base.bin',
            sha256: '',
            sizeBytes: 152,
            platforms: ['android'],
            minFreeSpaceBytes: 1,
            recommended: true,
            experimental: false,
            description: 'base',
          },
          {
            id: 'whisper-small',
            kind: 'transcription',
            engine: 'whisper.cpp',
            displayName: 'Whisper Small',
            version: 'ggml',
            downloadUrl: 'https://example.com/whisper-small.bin',
            sha256: '',
            sizeBytes: 488,
            platforms: ['android'],
            minFreeSpaceBytes: 1,
            recommended: false,
            experimental: false,
            description: 'small',
          },
          {
            id: 'gemma-3n-e2b-preview',
            kind: 'summary',
            engine: 'mediapipe-llm',
            displayName: 'Gemma 3n E2B preview',
            version: '20250520',
            downloadUrl: '',
            sha256: '',
            sizeBytes: 3136226711,
            platforms: ['android'],
            minFreeSpaceBytes: 1,
            recommended: true,
            experimental: false,
            description: 'External setup only.',
            requiresExternalSetup: true,
          },
        ],
      })
    ).toEqual([
      expect.objectContaining({
        id: 'starter',
        modelIds: ['whisper-base'],
      }),
      expect.objectContaining({
        id: 'full',
        modelIds: ['whisper-base', 'whisper-small'],
      }),
    ]);
  });

  test('starts offline setup from the selected bundle', async () => {
    await startOfflineSetup({
      id: 'starter',
      label: 'Starter',
      modelIds: ['whisper-base'],
      totalBytes: 152,
      estimatedSeconds: 60,
      isRecommended: true,
      description: 'Fastest way to get to a first local result.',
    });

    expect(sessionRowState).toMatchObject({
      bundle_id: 'starter',
      bundle_label: 'Starter',
      model_ids_json: '["whisper-base"]',
      status: 'downloading',
      bytes_downloaded: 0,
      total_bytes: 152,
      progress: 0,
      estimated_seconds_remaining: 60,
      last_error: null,
      is_dismissed: 0,
    });
  });

  test('marks offline setup as paused when the device goes offline', async () => {
    await markOfflineSetupPausedOffline('Paused until Wi-Fi returns.');

    expect(sessionRowState).toMatchObject({
      status: 'paused_offline',
      last_error: 'Paused until Wi-Fi returns.',
    });
  });

  test('marks offline setup as failed without losing the current bundle context', async () => {
    sessionRowState.bundle_id = 'starter';
    sessionRowState.bundle_label = 'Starter';
    sessionRowState.model_ids_json = '["whisper-base"]';
    sessionRowState.total_bytes = 152;

    await markOfflineSetupFailed('Download checksum mismatch.');

    expect(sessionRowState).toMatchObject({
      bundle_id: 'starter',
      bundle_label: 'Starter',
      model_ids_json: '["whisper-base"]',
      total_bytes: 152,
      status: 'failed',
      last_error: 'Download checksum mismatch.',
    });
  });

  test('marks offline setup ready and auto-configures local transcription', async () => {
    sessionRowState.bundle_id = 'starter';
    sessionRowState.bundle_label = 'Starter';
    sessionRowState.model_ids_json = '["whisper-base"]';
    sessionRowState.total_bytes = 152;

    await markOfflineSetupReady({
      preferredTranscriptionModelId: 'whisper-base',
    });

    expect(mockApplyOfflineSetupAutoConfig).toHaveBeenCalledWith({
      bundleId: 'starter',
      modelIds: ['whisper-base'],
      preferredTranscriptionModelId: 'whisper-base',
    });
    expect(sessionRowState).toMatchObject({
      status: 'ready',
      bytes_downloaded: 152,
      total_bytes: 152,
      progress: 1,
      estimated_seconds_remaining: 0,
      last_error: null,
      auto_configured_at: expect.any(String),
    });
  });
});
