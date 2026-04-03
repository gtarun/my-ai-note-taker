import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { AppSettings, ProviderConfig, ProviderId } from '../types';
import { defaultProviderConfigs, providerDefinitions, providerMap } from './providers';

const SETTINGS_STORAGE_KEY = 'app_settings_v2';

type StoredSettings = Omit<AppSettings, 'providers'> & {
  providers: Record<ProviderId, Omit<ProviderConfig, 'apiKey'>>;
};

function getDefaultSettings(): AppSettings {
  return {
    selectedTranscriptionProvider: 'openai',
    selectedSummaryProvider: 'openai',
    providers: structuredClone(defaultProviderConfigs),
    deleteUploadedAudio: false,
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  const defaultSettings = getDefaultSettings();
  const stored = await readStoredSettings();

  const providers = { ...defaultSettings.providers };

  for (const definition of providerDefinitions) {
    const storedProvider = stored?.providers?.[definition.id];
    providers[definition.id] = {
      ...providers[definition.id],
      ...(storedProvider ?? {}),
      apiKey: (await readProviderKey(definition.id)) ?? '',
    };
  }

  return {
    selectedTranscriptionProvider:
      stored?.selectedTranscriptionProvider && providerMap[stored.selectedTranscriptionProvider]?.supportsTranscription
        ? stored.selectedTranscriptionProvider
        : defaultSettings.selectedTranscriptionProvider,
    selectedSummaryProvider:
      stored?.selectedSummaryProvider && providerMap[stored.selectedSummaryProvider]?.supportsSummary
        ? stored.selectedSummaryProvider
        : defaultSettings.selectedSummaryProvider,
    providers,
    deleteUploadedAudio: stored?.deleteUploadedAudio ?? defaultSettings.deleteUploadedAudio,
  };
}

export async function saveAppSettings(settings: AppSettings) {
  const storedSettings: StoredSettings = {
    selectedTranscriptionProvider: settings.selectedTranscriptionProvider,
    selectedSummaryProvider: settings.selectedSummaryProvider,
    deleteUploadedAudio: settings.deleteUploadedAudio,
    providers: Object.fromEntries(
      providerDefinitions.map((definition) => [
        definition.id,
        {
          baseUrl: settings.providers[definition.id].baseUrl.trim(),
          transcriptionModel: settings.providers[definition.id].transcriptionModel.trim(),
          summaryModel: settings.providers[definition.id].summaryModel.trim(),
        },
      ])
    ) as StoredSettings['providers'],
  };

  await writeStorageValue(SETTINGS_STORAGE_KEY, JSON.stringify(storedSettings));

  await Promise.all(
    providerDefinitions.map((definition) =>
      writeProviderKey(definition.id, settings.providers[definition.id].apiKey.trim())
    )
  );
}

async function readStoredSettings(): Promise<StoredSettings | null> {
  const raw = await readStorageValue(SETTINGS_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredSettings;
  } catch {
    return null;
  }
}

async function readProviderKey(providerId: ProviderId) {
  return readStorageValue(getProviderKeyStorageKey(providerId));
}

async function writeProviderKey(providerId: ProviderId, value: string) {
  await writeStorageValue(getProviderKeyStorageKey(providerId), value);
}

function getProviderKeyStorageKey(providerId: ProviderId) {
  return `provider_api_key_${providerId}`;
}

async function readStorageValue(key: string) {
  if (Platform.OS === 'web') {
    return window.localStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

async function writeStorageValue(key: string, value: string) {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}
