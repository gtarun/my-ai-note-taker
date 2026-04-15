import { describe, expect, test, vi } from 'vitest';

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

const appPreferencesState = {
  id: 1,
  selected_transcription_provider: 'openai',
  selected_summary_provider: 'openai',
  delete_uploaded_audio: 0,
  model_catalog_url: '',
  has_seen_onboarding: 0,
};

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
        return [];
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
    }),
  }),
}));

import { saveAppSettings, sanitizeAppSettings } from './settings';
import { getHasSeenOnboarding, markOnboardingSeen } from './onboarding';
import { defaultProviderConfigs } from './providers';
import type { AppSettings } from '../types';

describe('settings persistence', () => {
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
});
