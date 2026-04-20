import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
  mockGetAuthSession,
  mockFetchCloudUserDataSnapshot,
  mockSaveCloudSettings,
  mockSaveCloudOnboardingState,
  localStorageMock,
} = vi.hoisted(() => ({
  mockGetAuthSession: vi.fn(),
  mockFetchCloudUserDataSnapshot: vi.fn(),
  mockSaveCloudSettings: vi.fn(),
  mockSaveCloudOnboardingState: vi.fn(),
  localStorageMock: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'web',
  },
}));

vi.mock('expo-secure-store', () => ({
  default: {
    getItemAsync: vi.fn(),
    setItemAsync: vi.fn(),
    deleteItemAsync: vi.fn(),
  },
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.stubGlobal('window', {
  localStorage: localStorageMock,
});

const appPreferencesState = {
  id: 1,
  selected_transcription_provider: 'openai',
  selected_summary_provider: 'openai',
  delete_uploaded_audio: 0,
  model_catalog_url: '',
  has_seen_onboarding: 0,
};

const providerSettingsState = Object.fromEntries(
  Object.entries(defaultProviderConfigs).map(([providerId, config]) => [
    providerId,
    {
      provider_id: providerId,
      api_key: config.apiKey,
      base_url: config.baseUrl,
      transcription_model: config.transcriptionModel,
      summary_model: config.summaryModel,
    },
  ])
);

vi.mock('../db', () => ({
  getDatabase: () => ({
    getFirstAsync: vi.fn(async (source: string) => {
      if (source.includes('FROM app_preferences')) {
        return appPreferencesState;
      }

      return null;
    }),
    getAllAsync: vi.fn(async (source: string) => {
      if (source.includes('FROM provider_settings')) {
        return Object.values(providerSettingsState);
      }

      return [];
    }),
    runAsync: vi.fn(async (source: string, ...params: unknown[]) => {
      if (source.includes('UPDATE app_preferences SET has_seen_onboarding = ? WHERE id = 1')) {
        appPreferencesState.has_seen_onboarding = Number(params[0]);
        return;
      }

      if (source.includes('UPDATE app_preferences SET') && source.includes('selected_transcription_provider = ?')) {
        appPreferencesState.selected_transcription_provider = String(params[0]);
        appPreferencesState.selected_summary_provider = String(params[1]);
        appPreferencesState.delete_uploaded_audio = Number(params[2]);
        appPreferencesState.model_catalog_url = String(params[3] ?? '');
        return;
      }

      if (source.includes('INSERT OR REPLACE INTO app_preferences')) {
        appPreferencesState.selected_transcription_provider = String(params[0]);
        appPreferencesState.selected_summary_provider = String(params[1]);
        appPreferencesState.delete_uploaded_audio = Number(params[2]);
        appPreferencesState.model_catalog_url = String(params[3] ?? '');
        appPreferencesState.has_seen_onboarding = 0;
      }

      if (source.includes('INSERT OR REPLACE INTO provider_settings')) {
        const providerId = String(params[0]);
        providerSettingsState[providerId as keyof typeof providerSettingsState] = {
          provider_id: providerId,
          api_key: String(params[1] ?? ''),
          base_url: String(params[2] ?? ''),
          transcription_model: String(params[3] ?? ''),
          summary_model: String(params[4] ?? ''),
        };
      }
    }),
  }),
}));

vi.mock('./account', () => ({
  getAuthSession: mockGetAuthSession,
}));

vi.mock('./cloudUserData', async () => {
  const actual = await vi.importActual<typeof import('./cloudUserData')>('./cloudUserData');

  return {
    ...actual,
    fetchCloudUserDataSnapshot: mockFetchCloudUserDataSnapshot,
    saveCloudSettings: mockSaveCloudSettings,
    saveCloudOnboardingState: mockSaveCloudOnboardingState,
  };
});

import { applyOfflineSetupAutoConfig, getAppSettings, saveAppSettings, sanitizeAppSettings } from './settings';
import { getHasSeenOnboarding, markOnboardingSeen } from './onboarding';
import { defaultProviderConfigs } from './providers';
import type { AppSettings } from '../types';

describe('settings persistence', () => {
  beforeEach(() => {
    appPreferencesState.selected_transcription_provider = 'openai';
    appPreferencesState.selected_summary_provider = 'openai';
    appPreferencesState.delete_uploaded_audio = 0;
    appPreferencesState.model_catalog_url = '';
    appPreferencesState.has_seen_onboarding = 0;
    for (const [providerId, config] of Object.entries(defaultProviderConfigs)) {
      providerSettingsState[providerId as keyof typeof providerSettingsState] = {
        provider_id: providerId,
        api_key: config.apiKey,
        base_url: config.baseUrl,
        transcription_model: config.transcriptionModel,
        summary_model: config.summaryModel,
      };
    }
    mockGetAuthSession.mockReset();
    mockFetchCloudUserDataSnapshot.mockReset();
    mockSaveCloudSettings.mockReset();
    mockSaveCloudOnboardingState.mockReset();
    mockGetAuthSession.mockResolvedValue(null);
    localStorageMock.getItem.mockReturnValue(null);
  });

  test('preserves onboarding completion when saving app settings', async () => {
    const settings: AppSettings = {
      selectedTranscriptionProvider: 'openai',
      selectedSummaryProvider: 'openai',
      providers: structuredClone(defaultProviderConfigs),
      deleteUploadedAudio: false,
      modelCatalogUrl: 'https://catalog.example.com',
    };

    expect(await getHasSeenOnboarding()).toBe(false);

    await markOnboardingSeen();
    expect(await getHasSeenOnboarding()).toBe(true);

    await saveAppSettings(settings);

    expect(await getHasSeenOnboarding()).toBe(true);
    expect(mockSaveCloudOnboardingState).toHaveBeenCalledWith(true);
  });

  test('hydrates local settings from cloud when the user is signed in', async () => {
    mockGetAuthSession.mockResolvedValue({ accessToken: 'token', user: { id: 'user-1' } });
    mockFetchCloudUserDataSnapshot.mockResolvedValue({
      profile: { displayName: 'Tarun', avatarUrl: null, timezone: null },
      preferences: {
        selectedTranscriptionProvider: 'openai',
        selectedSummaryProvider: 'groq',
        deleteUploadedAudio: true,
        modelCatalogUrl: '',
        hasSeenOnboarding: true,
      },
      providers: [
        {
          providerId: 'groq',
          apiKey: 'groq-key',
          baseUrl: 'https://api.groq.com/openai/v1',
          transcriptionModel: 'whisper-large-v3',
          summaryModel: 'llama-3.3-70b',
        },
      ],
      integrations: [],
      layers: [],
    });

    await expect(getAppSettings()).resolves.toMatchObject({
      selectedSummaryProvider: 'groq',
      deleteUploadedAudio: true,
      providers: {
        groq: expect.objectContaining({ apiKey: 'groq-key' }),
      },
    });
    expect(await getHasSeenOnboarding()).toBe(true);
  });

  test('drops local summary as a selectable provider during sanitization', () => {
    const settings: AppSettings = {
      selectedTranscriptionProvider: 'local',
      selectedSummaryProvider: 'local',
      providers: structuredClone(defaultProviderConfigs),
      deleteUploadedAudio: false,
      modelCatalogUrl: '',
    };

    settings.providers.local.transcriptionModel = 'whisper-base';
    settings.providers.local.summaryModel = 'gemma-3n-e2b-preview';

    const sanitized = sanitizeAppSettings(settings);

    expect(sanitized.selectedTranscriptionProvider).toBe('local');
    expect(sanitized.selectedSummaryProvider).toBe('openai');
  });

  test('fills empty local transcription config after a ready session', async () => {
    await applyOfflineSetupAutoConfig({
      bundleId: 'starter',
      modelIds: ['whisper-base'],
      preferredTranscriptionModelId: 'whisper-base',
    });

    await expect(getAppSettings()).resolves.toMatchObject({
      selectedTranscriptionProvider: 'local',
      providers: {
        local: expect.objectContaining({
          transcriptionModel: 'whisper-base',
        }),
      },
    });
  });
});
