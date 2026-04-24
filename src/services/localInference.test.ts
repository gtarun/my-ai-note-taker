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

  test('uses the local summary model for structured analysis', async () => {
    const summarize = vi.fn(async () =>
      JSON.stringify({
        customer: 'Acme',
        risk: 'Timeline is blocked',
      })
    );
    const module = await importLocalInferenceTestModule({
      platform: 'android',
      nativeModule: {
        getDeviceSupport: vi.fn(async () => ({
          localProcessingAvailable: true,
          supportsSummary: true,
          supportsTranscription: true,
          requiresCustomBuild: true,
          reason: 'Android local summary is available in this build.',
        })),
        summarize,
      },
    });

    await expect(
      module.extractLocalStructuredData({
        transcriptText: 'Acme said the timeline is blocked.',
        modelId: 'gemma-3-1b-it-q4',
        fields: [
          { id: 'customer', title: 'Customer', description: 'Customer name' },
          { id: 'risk', title: 'Risk', description: 'Current risk' },
        ],
      })
    ).resolves.toEqual({
      customer: 'Acme',
      risk: 'Timeline is blocked',
    });
    expect(summarize).toHaveBeenCalledWith({
      modelId: 'gemma-3-1b-it-q4',
      prompt: expect.stringContaining('Return valid JSON only with these exact keys: customer, risk.'),
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

  test('keeps the built-in whisper-base size aligned with the hosted binary', async () => {
    const module = await importLocalModelsTestModule('ios');
    const catalog = await module.getModelCatalog();

    expect(catalog.find((item) => item.id === 'whisper-base')?.sizeBytes).toBe(147951465);
  });

  test('advertises iOS-compatible summary models from the built-in catalog', async () => {
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

    expect(iosItems.filter((item) => item.kind === 'summary').map((item) => item.id)).toEqual([
      'qwen2.5-1.5b-instruct-gguf-q4',
    ]);
  });

  test('keeps gated built-in Gemma summary models as external setup entries', async () => {
    const module = await importLocalModelsTestModule('ios');
    const catalog = await module.getModelCatalog();

    expect(catalog.find((item) => item.id === 'gemma-3-1b-it-q4')).toMatchObject({
      downloadUrl: '',
      requiresExternalSetup: true,
      sourceUrl: 'https://huggingface.co/litert-community/Gemma3-1B-IT',
    });
  });

  test('keeps the built-in Qwen summary size aligned with the hosted binary', async () => {
    const module = await importLocalModelsTestModule('ios');
    const catalog = await module.getModelCatalog();

    expect(catalog.find((item) => item.id === 'qwen2.5-1.5b-instruct-q8')?.sizeBytes).toBe(1597913616);
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

  test('keeps the iOS catalog aligned with the allowed transcription model set and summary entries', async () => {
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
        id: 'qwen2.5-1.5b-instruct-gguf-q4',
        kind: 'summary',
        engine: 'llama.cpp',
        displayName: 'Qwen 2.5 1.5B Instruct (GGUF q4)',
        version: 'custom',
        downloadUrl: '',
        sha256: '',
        sizeBytes: 1,
        platforms: ['ios'],
        minFreeSpaceBytes: 1,
        recommended: true,
        experimental: false,
        description: 'iOS-compatible GGUF summary model.',
      },
      {
        id: 'gemma-3-1b-it-q4',
        kind: 'summary',
        engine: 'mediapipe-llm',
        displayName: 'Gemma 3 1B IT q4',
        version: 'custom',
        downloadUrl: '',
        sha256: '',
        sizeBytes: 1,
        platforms: ['ios'],
        minFreeSpaceBytes: 1,
        recommended: true,
        experimental: false,
        description: 'MediaPipe summary model that should be hidden on iOS.',
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

    expect(iosItems.map((item) => item.id)).toEqual(['whisper-base', 'qwen2.5-1.5b-instruct-gguf-q4']);
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

  test('allows iOS summary model downloads when the catalog item supports iOS', async () => {
    const createDownloadResumable = vi.fn(() => ({
      downloadAsync: vi.fn(async () => ({ uri: 'file:///documents/models/qwen2.5-1.5b-instruct-gguf-q4.gguf' })),
    }));

    vi.doMock('react-native', () => ({
      Platform: {
        OS: 'ios',
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

    await expect(
      module.downloadModel({
        id: 'qwen2.5-1.5b-instruct-gguf-q4',
        kind: 'summary',
        engine: 'llama.cpp',
        displayName: 'Qwen 2.5 1.5B Instruct (GGUF q4)',
        version: 'custom',
        downloadUrl: 'https://example.com/qwen.gguf',
        sha256: '',
        sizeBytes: 1,
        platforms: ['ios'],
        minFreeSpaceBytes: 1,
        recommended: true,
        experimental: false,
        description: 'iOS-compatible GGUF summary model.',
      })
    ).resolves.toMatchObject({
      id: 'qwen2.5-1.5b-instruct-gguf-q4',
      status: 'installed',
    });
    expect(createDownloadResumable).toHaveBeenCalledTimes(1);
  });

  test('reports failed model download HTTP status before validating file size', async () => {
    const createDownloadResumable = vi.fn(() => ({
      downloadAsync: vi.fn(async () => ({ uri: 'file:///documents/models/gated.task', status: 401 })),
    }));

    vi.doMock('react-native', () => ({
      Platform: {
        OS: 'ios',
      },
    }));

    vi.doMock('expo-file-system/legacy', () => ({
      documentDirectory: 'file:///documents/',
      getFreeDiskStorageAsync: vi.fn(async () => 10 * 1024 * 1024 * 1024),
      getInfoAsync: vi.fn(async () => ({ exists: true, size: 137 })),
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

    await expect(
      module.downloadModel({
        id: 'qwen2.5-1.5b-instruct-gguf-q4',
        kind: 'summary',
        engine: 'llama.cpp',
        displayName: 'Gated Summary',
        version: 'custom',
        downloadUrl: 'https://example.com/gated.gguf',
        sha256: '',
        sizeBytes: 554661246,
        platforms: ['ios'],
        minFreeSpaceBytes: 1,
        recommended: true,
        experimental: false,
        description: 'Requires auth.',
      })
    ).rejects.toThrow('Model download request failed (401).');
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
