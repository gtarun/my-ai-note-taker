import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { getDatabase } from '../db';
import { AppSettings, ProviderConfig, ProviderId } from '../types';
import {
  defaultProviderConfigs,
  isProviderConfigured,
  normalizeProviderConfig,
  providerDefinitions,
  providerMap,
} from './providers';

const LEGACY_SETTINGS_STORAGE_KEY = 'app_settings_v2';

type AppPreferencesRow = {
  selected_transcription_provider: ProviderId;
  selected_summary_provider: ProviderId;
  delete_uploaded_audio: number;
};

type ProviderSettingsRow = {
  provider_id: ProviderId;
  api_key: string;
  base_url: string;
  transcription_model: string;
  summary_model: string;
};

type LegacyStoredSettings = Omit<AppSettings, 'providers'> & {
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
  const db = getDatabase();
  const [storedPreferences, storedProviders] = await Promise.all([
    db.getFirstAsync<AppPreferencesRow>('SELECT * FROM app_preferences WHERE id = 1'),
    db.getAllAsync<ProviderSettingsRow>('SELECT * FROM provider_settings'),
  ]);

  if (!storedProviders.length) {
    const migratedSettings = await readLegacySettings(defaultSettings);

    if (migratedSettings) {
      const sanitized = sanitizeAppSettings(migratedSettings);
      await saveAppSettings(sanitized);
      return sanitized;
    }
  }

  const providers = buildProvidersFromRows(defaultSettings.providers, storedProviders);

  return sanitizeAppSettings({
    selectedTranscriptionProvider:
      storedPreferences?.selected_transcription_provider ?? defaultSettings.selectedTranscriptionProvider,
    selectedSummaryProvider: storedPreferences?.selected_summary_provider ?? defaultSettings.selectedSummaryProvider,
    providers,
    deleteUploadedAudio:
      storedPreferences?.delete_uploaded_audio != null
        ? Boolean(storedPreferences.delete_uploaded_audio)
        : defaultSettings.deleteUploadedAudio,
  });
}

export async function saveAppSettings(settings: AppSettings) {
  const sanitized = sanitizeAppSettings(settings);
  const db = getDatabase();

  await db.runAsync(
    `INSERT OR REPLACE INTO app_preferences (
      id,
      selected_transcription_provider,
      selected_summary_provider,
      delete_uploaded_audio
    ) VALUES (1, ?, ?, ?)`,
    sanitized.selectedTranscriptionProvider,
    sanitized.selectedSummaryProvider,
    sanitized.deleteUploadedAudio ? 1 : 0
  );

  for (const definition of providerDefinitions) {
    const provider = sanitized.providers[definition.id];
    await db.runAsync(
      `INSERT OR REPLACE INTO provider_settings (
        provider_id,
        api_key,
        base_url,
        transcription_model,
        summary_model
      ) VALUES (?, ?, ?, ?, ?)`,
      definition.id,
      provider.apiKey,
      provider.baseUrl,
      provider.transcriptionModel,
      provider.summaryModel
    );
  }
}

export function sanitizeAppSettings(settings: AppSettings): AppSettings {
  const providers = Object.fromEntries(
    providerDefinitions.map((definition) => [
      definition.id,
      normalizeProviderConfig(definition.id, settings.providers[definition.id]),
    ])
  ) as Record<ProviderId, ProviderConfig>;

  const availableTranscriptionProviders = providerDefinitions
    .filter(
      (definition) =>
        definition.supportsTranscription && isProviderConfigured(definition.id, providers[definition.id])
    )
    .map((definition) => definition.id);

  const availableSummaryProviders = providerDefinitions
    .filter((definition) => definition.supportsSummary && isProviderConfigured(definition.id, providers[definition.id]))
    .map((definition) => definition.id);

  return {
    selectedTranscriptionProvider: resolveSelectedProvider(
      settings.selectedTranscriptionProvider,
      availableTranscriptionProviders,
      'transcription'
    ),
    selectedSummaryProvider: resolveSelectedProvider(
      settings.selectedSummaryProvider,
      availableSummaryProviders,
      'summary'
    ),
    providers,
    deleteUploadedAudio: settings.deleteUploadedAudio,
  };
}

function buildProvidersFromRows(
  defaultProviders: Record<ProviderId, ProviderConfig>,
  rows: ProviderSettingsRow[]
): Record<ProviderId, ProviderConfig> {
  const rowMap = Object.fromEntries(rows.map((row) => [row.provider_id, row])) as Partial<
    Record<ProviderId, ProviderSettingsRow>
  >;

  return Object.fromEntries(
    providerDefinitions.map((definition) => {
      const stored = rowMap[definition.id];
      const mergedConfig = normalizeProviderConfig(definition.id, {
        ...defaultProviders[definition.id],
        apiKey: stored?.api_key ?? defaultProviders[definition.id].apiKey,
        baseUrl: stored?.base_url ?? defaultProviders[definition.id].baseUrl,
        transcriptionModel:
          stored?.transcription_model ?? defaultProviders[definition.id].transcriptionModel,
        summaryModel: stored?.summary_model ?? defaultProviders[definition.id].summaryModel,
      });

      return [definition.id, mergedConfig];
    })
  ) as Record<ProviderId, ProviderConfig>;
}

function resolveSelectedProvider(
  providerId: ProviderId,
  configuredProviderIds: ProviderId[],
  mode: 'transcription' | 'summary'
) {
  if (configuredProviderIds.includes(providerId)) {
    return providerId;
  }

  const fallback = configuredProviderIds[0];

  if (fallback) {
    return fallback;
  }

  const defaultProviderId = mode === 'transcription' ? 'openai' : 'openai';

  if (
    (mode === 'transcription' && providerMap[providerId]?.supportsTranscription) ||
    (mode === 'summary' && providerMap[providerId]?.supportsSummary)
  ) {
    return providerId;
  }

  return defaultProviderId;
}

async function readLegacySettings(defaultSettings: AppSettings) {
  const legacySettings = await readLegacyStoredSettings();
  const legacyProviders = { ...defaultSettings.providers };
  let hasLegacyValue = Boolean(legacySettings);

  for (const definition of providerDefinitions) {
    const apiKey = (await readLegacyProviderKey(definition.id)) ?? '';
    const storedProvider = legacySettings?.providers?.[definition.id];

    if (apiKey || storedProvider) {
      hasLegacyValue = true;
    }

    legacyProviders[definition.id] = normalizeProviderConfig(definition.id, {
      ...legacyProviders[definition.id],
      ...(storedProvider ?? {}),
      apiKey,
    });
  }

  if (!hasLegacyValue) {
    return null;
  }

  return {
    selectedTranscriptionProvider:
      legacySettings?.selectedTranscriptionProvider ?? defaultSettings.selectedTranscriptionProvider,
    selectedSummaryProvider: legacySettings?.selectedSummaryProvider ?? defaultSettings.selectedSummaryProvider,
    providers: legacyProviders,
    deleteUploadedAudio: legacySettings?.deleteUploadedAudio ?? defaultSettings.deleteUploadedAudio,
  };
}

async function readLegacyStoredSettings(): Promise<LegacyStoredSettings | null> {
  const raw = await readLegacyStorageValue(LEGACY_SETTINGS_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as LegacyStoredSettings;
  } catch {
    return null;
  }
}

async function readLegacyProviderKey(providerId: ProviderId) {
  return readLegacyStorageValue(getLegacyProviderKeyStorageKey(providerId));
}

function getLegacyProviderKeyStorageKey(providerId: ProviderId) {
  return `provider_api_key_${providerId}`;
}

async function readLegacyStorageValue(key: string) {
  if (Platform.OS === 'web') {
    return window.localStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}
