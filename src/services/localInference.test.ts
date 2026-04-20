import { afterEach, describe, expect, test, vi } from 'vitest';

import type { ModelCatalogItem } from '../types';

afterEach(() => {
  vi.resetModules();
  vi.unmock('react-native');
  vi.unmock('expo-modules-core');
  vi.unmock('expo-file-system/legacy');
  vi.unmock('../db');
  vi.unmock('../utils/sha256');
});

async function importLocalInferenceTestModule({
  platform,
  nativeModule,
}: {
  platform: 'ios' | 'android' | 'web';
  nativeModule: unknown;
}) {
  vi.doMock('react-native', () => ({
    Platform: {
      OS: platform,
    },
  }));

  vi.doMock('expo-modules-core', () => ({
    requireOptionalNativeModule: vi.fn(() => nativeModule),
  }));

  return import('./localInference');
}

async function importLocalModelsTestModule(platform: 'ios' | 'android') {
  vi.doMock('react-native', () => ({
    Platform: {
      OS: platform,
    },
  }));

  vi.doMock('expo-file-system/legacy', () => ({
    documentDirectory: 'file:///documents/',
    getFreeDiskStorageAsync: vi.fn(async () => 10 * 1024 * 1024 * 1024),
    getInfoAsync: vi.fn(async () => ({ exists: false })),
    makeDirectoryAsync: vi.fn(async () => undefined),
    createDownloadResumable: vi.fn(),
    deleteAsync: vi.fn(async () => undefined),
  }));

  vi.doMock('../db', () => ({
    getDatabase: vi.fn(),
  }));

  vi.doMock('../utils/sha256', () => ({
    Sha256: {
      hash: vi.fn(),
    },
  }));

  return import('./localModels');
}

describe('local inference bridge', () => {
  test('reports the missing native runtime as a custom-build requirement', async () => {
    const module = await importLocalInferenceTestModule({
      platform: 'android',
      nativeModule: null,
    });

    await expect(module.getLocalDeviceSupport()).resolves.toEqual({
      platform: 'android',
      localProcessingAvailable: false,
      supportsSummary: false,
      supportsTranscription: false,
      requiresCustomBuild: true,
      reason:
        'This build does not include the native local AI runtime yet. Use a custom dev build or release build with the module linked.',
    });
  });

  test('passes through Android runtime support when the native module is present', async () => {
    const module = await importLocalInferenceTestModule({
      platform: 'android',
      nativeModule: {
        getDeviceSupport: vi.fn(async () => ({
          localProcessingAvailable: true,
          supportsSummary: false,
          supportsTranscription: false,
          requiresCustomBuild: true,
          reason: 'Android local runtime boundary is installed, but inference engines are not wired yet.',
        })),
      },
    });

    await expect(module.getLocalDeviceSupport()).resolves.toEqual({
      platform: 'android',
      localProcessingAvailable: true,
      supportsSummary: false,
      supportsTranscription: false,
      requiresCustomBuild: true,
      reason: 'Android local runtime boundary is installed, but inference engines are not wired yet.',
    });
  });

  test('passes through iOS local transcription support when the native module is available', async () => {
    const module = await importLocalInferenceTestModule({
      platform: 'ios',
      nativeModule: {
        getDeviceSupport: vi.fn(async () => ({
          localProcessingAvailable: true,
          supportsSummary: false,
          supportsTranscription: true,
          requiresCustomBuild: true,
          reason: 'iOS local transcription is available in this build.',
        })),
      },
    });

    await expect(module.getLocalDeviceSupport()).resolves.toEqual({
      platform: 'ios',
      localProcessingAvailable: true,
      supportsSummary: false,
      supportsTranscription: true,
      requiresCustomBuild: true,
      reason: 'iOS local transcription is available in this build.',
    });
  });

  test('calls the native transcribe path when iOS local transcription support is available', async () => {
    const transcribe = vi.fn(async () => 'offline transcript');
    const module = await importLocalInferenceTestModule({
      platform: 'ios',
      nativeModule: {
        getDeviceSupport: vi.fn(async () => ({
          localProcessingAvailable: true,
          supportsSummary: false,
          supportsTranscription: true,
          requiresCustomBuild: true,
          reason: 'iOS local transcription is available in this build.',
        })),
        transcribe,
      },
    });

    await expect(
      module.transcribeLocalAudio({
        audioUri: 'file:///meeting.m4a',
        modelId: 'whisper-base',
      })
    ).resolves.toBe('offline transcript');
    expect(transcribe).toHaveBeenCalledWith({
      audioUri: 'file:///meeting.m4a',
      modelId: 'whisper-base',
    });
  });

  test('fails clearly when a non-whisper-base model is selected on iOS local transcription', async () => {
    const transcribe = vi.fn(async () => 'offline transcript');
    const module = await importLocalInferenceTestModule({
      platform: 'ios',
      nativeModule: {
        getDeviceSupport: vi.fn(async () => ({
          localProcessingAvailable: true,
          supportsSummary: false,
          supportsTranscription: true,
          requiresCustomBuild: true,
          reason: 'iOS local transcription is available in this build.',
        })),
        transcribe,
      },
    });

    await expect(
      module.transcribeLocalAudio({
        audioUri: 'file:///meeting.m4a',
        modelId: 'whisper-small',
      })
    ).rejects.toThrow('Only whisper-base is supported for local transcription on iOS in this phase.');
    expect(transcribe).not.toHaveBeenCalled();
  });

  test('does not advertise whisper-small as an iOS transcription option', async () => {
    const module = await importLocalModelsTestModule('ios');
    const catalog = await module.getModelCatalog();
    const iosItems = module.getCatalogItemsForDevice(catalog, {
      platform: 'ios',
      localProcessingAvailable: true,
      supportsSummary: false,
      supportsTranscription: true,
      requiresCustomBuild: true,
      reason: 'iOS local transcription is available in this build.',
    });

    expect(iosItems.some((item) => item.id === 'whisper-small')).toBe(false);
  });

  test('does not advertise summary models for iOS built-in catalog entries', async () => {
    const module = await importLocalModelsTestModule('ios');
    const catalog = await module.getModelCatalog();
    const iosItems = module.getCatalogItemsForDevice(catalog, {
      platform: 'ios',
      localProcessingAvailable: true,
      supportsSummary: false,
      supportsTranscription: true,
      requiresCustomBuild: true,
      reason: 'iOS local transcription is available in this build.',
    });

    expect(iosItems.some((item) => item.kind === 'summary')).toBe(false);
  });

  test('does not advertise unsupported iOS transcription models from a custom catalog', async () => {
    const module = await importLocalModelsTestModule('ios');
    const iosItems = module.getCatalogItemsForDevice(
      [
        {
          id: 'whisper-base',
          kind: 'transcription',
          engine: 'whisper.cpp',
          displayName: 'Whisper Base',
          version: 'custom',
          downloadUrl: 'https://example.com/whisper-base.bin',
          sha256: '',
          sizeBytes: 1,
          platforms: ['ios'],
          minFreeSpaceBytes: 1,
          recommended: true,
          experimental: false,
          description: 'Allowed on iOS.',
        },
        {
          id: 'whisper-small',
          kind: 'transcription',
          engine: 'whisper.cpp',
          displayName: 'Whisper Small',
          version: 'custom',
          downloadUrl: 'https://example.com/whisper-small.bin',
          sha256: '',
          sizeBytes: 1,
          platforms: ['ios'],
          minFreeSpaceBytes: 1,
          recommended: false,
          experimental: false,
          description: 'Should stay hidden on iOS in this phase.',
        },
      ],
      {
        platform: 'ios',
        localProcessingAvailable: true,
        supportsSummary: false,
        supportsTranscription: true,
        requiresCustomBuild: true,
        reason: 'iOS local transcription is available in this build.',
      }
    );

    expect(iosItems.map((item) => item.id)).toEqual(['whisper-base']);
  });

  test('keeps the iOS starter bundle aligned with the allowed transcription model set', async () => {
    const module = await importLocalModelsTestModule('ios');
    const catalog: ModelCatalogItem[] = [
      {
        id: 'whisper-base',
        kind: 'transcription',
        engine: 'whisper.cpp',
        displayName: 'Whisper Base',
        version: 'custom',
        downloadUrl: 'https://example.com/whisper-base.bin',
        sha256: '',
        sizeBytes: 1,
        platforms: ['ios'],
        minFreeSpaceBytes: 1,
        recommended: true,
        experimental: false,
        description: 'Allowed on iOS.',
      },
      {
        id: 'whisper-small',
        kind: 'transcription',
        engine: 'whisper.cpp',
        displayName: 'Whisper Small',
        version: 'custom',
        downloadUrl: 'https://example.com/whisper-small.bin',
        sha256: '',
        sizeBytes: 1,
        platforms: ['ios'],
        minFreeSpaceBytes: 1,
        recommended: false,
        experimental: false,
        description: 'Should stay hidden on iOS in this phase.',
      },
      {
        id: 'gemma-3n-e2b-preview',
        kind: 'summary',
        engine: 'mediapipe-llm',
        displayName: 'Gemma 3n E2B preview',
        version: 'custom',
        downloadUrl: '',
        sha256: '',
        sizeBytes: 1,
        platforms: ['ios'],
        minFreeSpaceBytes: 1,
        recommended: true,
        experimental: false,
        description: 'Not part of the transcription starter bundle.',
      },
    ];

    const iosItems = module.getCatalogItemsForDevice(catalog, {
      platform: 'ios',
      localProcessingAvailable: true,
      supportsSummary: false,
      supportsTranscription: true,
      requiresCustomBuild: true,
      reason: 'iOS local transcription is available in this build.',
    });

    expect(iosItems.map((item) => item.id)).toEqual(['whisper-base']);
  });

  test('rejects unsupported iOS transcription model downloads even if a custom catalog exposes them', async () => {
    const module = await importLocalModelsTestModule('ios');

    await expect(
      module.downloadModel({
        id: 'whisper-small',
        kind: 'transcription',
        engine: 'whisper.cpp',
        displayName: 'Whisper Small',
        version: 'custom',
        downloadUrl: 'https://example.com/whisper-small.bin',
        sha256: '',
        sizeBytes: 1,
        platforms: ['ios'],
        minFreeSpaceBytes: 1,
        recommended: false,
        experimental: false,
        description: 'Should stay blocked on iOS in this phase.',
      })
    ).rejects.toThrow('Only whisper-base is supported for local transcription on iOS in this phase.');
  });

  test('rejects duplicate downloads for the same paid local model while one is active', async () => {
    let resolveDownload: (value: { uri: string }) => void = () => undefined;
    const downloadPromise = new Promise<{ uri: string }>((resolve) => {
      resolveDownload = resolve;
    });
    const createDownloadResumable = vi.fn(() => ({
      downloadAsync: vi.fn(() => downloadPromise),
    }));

    vi.doMock('react-native', () => ({
      Platform: {
        OS: 'android',
      },
    }));

    vi.doMock('expo-file-system/legacy', () => ({
      documentDirectory: 'file:///documents/',
      getFreeDiskStorageAsync: vi.fn(async () => 10 * 1024 * 1024 * 1024),
      getInfoAsync: vi.fn(async () => ({ exists: true, size: 1 })),
      makeDirectoryAsync: vi.fn(async () => undefined),
      createDownloadResumable,
      deleteAsync: vi.fn(async () => undefined),
    }));

    vi.doMock('../db', () => ({
      getDatabase: () => ({
        runAsync: vi.fn(async () => undefined),
      }),
    }));

    vi.doMock('../utils/sha256', () => ({
      Sha256: {
        hash: vi.fn(),
      },
    }));

    const module = await import('./localModels');
    const item: ModelCatalogItem = {
      id: 'whisper-base',
      kind: 'transcription',
      engine: 'whisper.cpp',
      displayName: 'Whisper Base',
      version: 'ggml',
      downloadUrl: 'https://example.com/whisper-base.bin',
      sha256: '',
      sizeBytes: 1,
      platforms: ['android'],
      minFreeSpaceBytes: 1,
      recommended: true,
      experimental: false,
      description: 'Paid local model download.',
    };

    const firstDownload = module.downloadModel(item);
    await Promise.resolve();
    await Promise.resolve();

    await expect(module.downloadModel(item)).rejects.toThrow('Whisper Base is already downloading.');

    resolveDownload({ uri: 'file:///documents/models/whisper-base.bin' });
    await expect(firstDownload).resolves.toMatchObject({
      id: 'whisper-base',
      status: 'installed',
    });
    expect(createDownloadResumable).toHaveBeenCalledTimes(1);
  });
});
