import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { getDatabase } from '../db';
import { AppSettings, ProviderConfig, ProviderId } from '../types';
import { getAuthSession } from './account';
import { fetchCloudUserDataSnapshot, mapBootstrapSnapshotToAppSettings, saveCloudSettings } from './cloudUserData';
import { APPLE_SPEECH_MODEL_ID, getLocalDeviceSupport } from './localInference';
import {
  defaultProviderConfigs,
  isProviderConfigured,
  normalizeProviderConfig,
  providerDefinitions,
  providerMap,
} from './providers';
import { getHasSeenOnboarding } from './onboarding';

const LEGACY_SETTINGS_V3_STORAGE_KEY = 'app_settings_v3';
const LEGACY_SETTINGS_V2_STORAGE_KEY = 'app_settings_v2';

type AppPreferencesRow = {
  selected_transcription_provider: ProviderId;
  selected_summary_provider: ProviderId;
  delete_uploaded_audio: number;
  model_catalog_url?: string | null;
  transcription_locale?: AppSettings['transcriptionLocale'] | null;
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

type LegacyStoredSettingsV2 = Omit<AppSettings, 'providers' | 'modelCatalogUrl'> & {
  providers: Record<ProviderId, Omit<ProviderConfig, 'apiKey'>>;
};

function getDefaultSettings(): AppSettings {
  return {
    /*
     * iOS ships Apple Speech: no key, no download, no account. Defaulting to it
     * means a fresh install can record and transcribe before the user has
     * configured anything, which is also the privacy-preserving route.
     *
     * This used to happen by accident — sanitizeAppSettings rerouted the
     * 'openai' default to the first configured provider, and on iOS that is
     * Local. That coercion had to go because it made every other provider
     * unselectable, so the default now states the intent directly.
     *
     * Everywhere else local transcription needs a model downloaded first, so
     * there is no zero-setup route and a cloud provider is the honest start.
     * Summary stays on a cloud provider on every platform: this build has no
     * local summary runtime, which onboarding explains before asking for a key.
     */
    selectedTranscriptionProvider: Platform.OS === 'ios' ? 'local' : 'openai',
    selectedSummaryProvider: 'openai',
    providers: structuredClone(defaultProviderConfigs),
    transcriptionLocale: 'en-US',
    deleteUploadedAudio: false,
    modelCatalogUrl: '',
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  const cached = await normalizeAppSettingsForCurrentDevice(await getLocalAppSettings());

  try {
    const session = await getAuthSession();

    if (!session) {
      return cached;
    }

    const snapshot = await fetchCloudUserDataSnapshot();
    const next = await normalizeAppSettingsForCurrentDevice(mapBootstrapSnapshotToAppSettings(snapshot));
    await saveAppSettingsToLocalCache(next, {
      hasSeenOnboarding: snapshot.preferences.hasSeenOnboarding,
    });
    return next;
  } catch {
    return cached;
  }
}

export async function saveAppSettings(settings: AppSettings) {
  const sanitized = await normalizeAppSettingsForCurrentDevice(settings);
  const hasSeenOnboarding = await getHasSeenOnboarding();
  await saveAppSettingsToLocalCache(sanitized);

  const session = await getAuthSession();

  if (!session) {
    return;
  }

  await saveCloudSettings({
    selectedTranscriptionProvider: sanitized.selectedTranscriptionProvider,
    selectedSummaryProvider: sanitized.selectedSummaryProvider,
    deleteUploadedAudio: sanitized.deleteUploadedAudio,
    modelCatalogUrl: sanitized.modelCatalogUrl,
    hasSeenOnboarding,
    providers: sanitized.providers,
  });
}

export async function applyOfflineSetupAutoConfig(params: {
  bundleId: string;
  modelIds: string[];
  preferredTranscriptionModelId: string | null;
  preferredSummaryModelId: string | null;
}) {
  const settings = await getAppSettings();

  // Apple Speech is filled in as the iOS default by `normalizeAppSettings…`,
  // so an empty value isn't the only "no real choice yet" signal we have to
  // honor here. If the user just finished the offline-setup flow and asked for
  // a specific whisper model, that's an explicit upgrade — override the default.
  const hasPickedTranscriptionModel =
    Boolean(settings.providers.local.transcriptionModel) &&
    settings.providers.local.transcriptionModel !== APPLE_SPEECH_MODEL_ID;

  if (!hasPickedTranscriptionModel && params.preferredTranscriptionModelId) {
    settings.providers.local.transcriptionModel = params.preferredTranscriptionModelId;
  }

  if (!settings.providers.local.summaryModel && params.preferredSummaryModelId) {
    settings.providers.local.summaryModel = params.preferredSummaryModelId;
  }

  if (settings.selectedTranscriptionProvider === 'openai' && params.preferredTranscriptionModelId) {
    settings.selectedTranscriptionProvider = 'local';
  }

  if (settings.selectedSummaryProvider === 'openai' && params.preferredSummaryModelId) {
    settings.selectedSummaryProvider = 'local';
  }

  const sanitized = await normalizeAppSettingsForCurrentDevice(settings);
  const hasSeenOnboarding = await getHasSeenOnboarding();
  await saveAppSettingsToLocalCache(sanitized);

  try {
    const session = await getAuthSession();

    if (!session) {
      return;
    }

    await saveCloudSettings({
      selectedTranscriptionProvider: sanitized.selectedTranscriptionProvider,
      selectedSummaryProvider: sanitized.selectedSummaryProvider,
      deleteUploadedAudio: sanitized.deleteUploadedAudio,
      modelCatalogUrl: sanitized.modelCatalogUrl,
      hasSeenOnboarding,
      providers: sanitized.providers,
    });
  } catch {
    return;
  }
}

export function sanitizeAppSettings(settings: AppSettings): AppSettings {
  const providers = Object.fromEntries(
    providerDefinitions.map((definition) => [
      definition.id,
      normalizeProviderConfig(definition.id, settings.providers[definition.id]),
    ])
  ) as Record<ProviderId, ProviderConfig>;

  return {
    selectedTranscriptionProvider: resolveSelectedProvider(
      settings.selectedTranscriptionProvider,
      'transcription'
    ),
    selectedSummaryProvider: resolveSelectedProvider(settings.selectedSummaryProvider, 'summary'),
    providers,
    transcriptionLocale: settings.transcriptionLocale ?? 'en-US',
    deleteUploadedAudio: settings.deleteUploadedAudio,
    modelCatalogUrl: settings.modelCatalogUrl.trim(),
  };
}

async function normalizeAppSettingsForCurrentDevice(settings: AppSettings): Promise<AppSettings> {
  const sanitized = sanitizeAppSettings(settings);

  if (
    sanitized.selectedTranscriptionProvider !== 'local' &&
    sanitized.selectedSummaryProvider !== 'local'
  ) {
    return defaultLocalTranscriptionModelForDevice(sanitized);
  }

  const support = await getLocalDeviceSupport();

  if (support.platform === 'web') {
    return sanitized;
  }

  let next = { ...sanitized };

  if (next.selectedTranscriptionProvider === 'local' && !support.supportsTranscription) {
    next.selectedTranscriptionProvider = getFallbackCloudProviderId(next, 'transcription');
  }

  if (next.selectedSummaryProvider === 'local' && !support.supportsSummary) {
    next.selectedSummaryProvider = getFallbackCloudProviderId(next, 'summary');
  }

  next = defaultLocalTranscriptionModelForDevice(next);

  return next;
}

/**
 * On iOS, fall back to Apple's built-in SFSpeechRecognizer when the user hasn't
 * picked a local transcription model. It needs no download, runs on the Neural
 * Engine, and respects the privacy guarantee — making it the right default for
 * fresh installs and for users who deleted their downloaded whisper model.
 */
function defaultLocalTranscriptionModelForDevice(settings: AppSettings): AppSettings {
  if (Platform.OS !== 'ios') {
    return settings;
  }
  if (settings.providers.local.transcriptionModel.trim()) {
    return settings;
  }
  return {
    ...settings,
    providers: {
      ...settings.providers,
      local: {
        ...settings.providers.local,
        transcriptionModel: APPLE_SPEECH_MODEL_ID,
      },
    },
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

/**
 * Repair an incoherent provider selection — and nothing else.
 *
 * "Can this provider do the job" and "does the user have credentials for it"
 * are different questions, and only the first one belongs here. This used to
 * reroute any unconfigured provider to the first configured one, which read as
 * defensive but deadlocked the settings screen: it re-sanitizes the in-progress
 * form on every render, so choosing OpenAI snapped back to Local before the
 * user could reach the "Add API key" button that renders only for the selected
 * provider. On a fresh iOS install that is every user, because Apple Speech
 * needs no download and therefore makes Local configured from first launch.
 *
 * Letting an unconfigured selection stand costs nothing: processMeeting checks
 * isProviderConfigured before it does any work and fails with a message that
 * points back here.
 */
function resolveSelectedProvider(providerId: ProviderId, mode: 'transcription' | 'summary') {
  const definition = providerMap[providerId];

  if (
    (mode === 'transcription' && definition?.supportsTranscription) ||
    (mode === 'summary' && definition?.supportsSummary)
  ) {
    return providerId;
  }

  // The provider has no endpoint for this job at all, so this is not something
  // the user can fix by adding a key. Fall back to one that does.
  const fallback = providerDefinitions.find((candidate) =>
    mode === 'transcription' ? candidate.supportsTranscription : candidate.supportsSummary
  );

  return fallback?.id ?? 'openai';
}

function getFallbackCloudProviderId(settings: AppSettings, mode: 'transcription' | 'summary'): ProviderId {
  const configured = providerDefinitions
    .filter((definition) => definition.id !== 'local')
    .filter((definition) => {
      if (mode === 'transcription' && !definition.supportsTranscription) {
        return false;
      }

      if (mode === 'summary' && !definition.supportsSummary) {
        return false;
      }

      return isProviderConfigured(definition.id, settings.providers[definition.id], mode);
    })
    .map((definition) => definition.id);

  return configured[0] ?? 'openai';
}

async function readLegacySettings(defaultSettings: AppSettings) {
  const legacySettings = (await readLegacyStoredSettingsV3()) ?? (await readLegacyStoredSettingsV2());
  const legacyProviders = { ...defaultSettings.providers };
  let hasLegacyValue = Boolean(legacySettings);

  for (const definition of providerDefinitions) {
    const apiKey = definition.id === 'local' ? '' : ((await readLegacyProviderKey(definition.id)) ?? '');
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
    transcriptionLocale:
      (legacySettings as { transcriptionLocale?: AppSettings['transcriptionLocale'] } | null)?.transcriptionLocale ??
      defaultSettings.transcriptionLocale,
    deleteUploadedAudio: legacySettings?.deleteUploadedAudio ?? defaultSettings.deleteUploadedAudio,
    modelCatalogUrl: legacySettings?.modelCatalogUrl?.trim?.() ?? defaultSettings.modelCatalogUrl,
  };
}

export async function saveAppSettingsToLocalCache(
  settings: AppSettings,
  options?: { hasSeenOnboarding?: boolean }
) {
  const db = getDatabase();

  await db.runAsync(
    `UPDATE app_preferences SET
      selected_transcription_provider = ?,
      selected_summary_provider = ?,
      delete_uploaded_audio = ?,
      model_catalog_url = ?,
      transcription_locale = ?
    WHERE id = 1`,
    settings.selectedTranscriptionProvider,
    settings.selectedSummaryProvider,
    settings.deleteUploadedAudio ? 1 : 0,
    settings.modelCatalogUrl,
    settings.transcriptionLocale
  );

  if (options?.hasSeenOnboarding != null) {
    await db.runAsync(
      'UPDATE app_preferences SET has_seen_onboarding = ? WHERE id = 1',
      options.hasSeenOnboarding ? 1 : 0
    );
  }

  for (const definition of providerDefinitions) {
    const provider = settings.providers[definition.id];
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

async function getLocalAppSettings(): Promise<AppSettings> {
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
      await saveAppSettingsToLocalCache(sanitized);
      return sanitized;
    }
  }

  const providers = buildProvidersFromRows(defaultSettings.providers, storedProviders);

  return sanitizeAppSettings({
    selectedTranscriptionProvider:
      storedPreferences?.selected_transcription_provider ?? defaultSettings.selectedTranscriptionProvider,
    selectedSummaryProvider: storedPreferences?.selected_summary_provider ?? defaultSettings.selectedSummaryProvider,
    providers,
    transcriptionLocale: storedPreferences?.transcription_locale ?? defaultSettings.transcriptionLocale,
    deleteUploadedAudio:
      storedPreferences?.delete_uploaded_audio != null
        ? Boolean(storedPreferences.delete_uploaded_audio)
        : defaultSettings.deleteUploadedAudio,
    modelCatalogUrl: storedPreferences?.model_catalog_url?.trim?.() ?? defaultSettings.modelCatalogUrl,
  });
}

async function readLegacyStoredSettingsV3(): Promise<LegacyStoredSettings | null> {
  const raw = await readLegacyStorageValue(LEGACY_SETTINGS_V3_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as LegacyStoredSettings;
  } catch {
    return null;
  }
}

async function readLegacyStoredSettingsV2(): Promise<LegacyStoredSettings | null> {
  const raw = await readLegacyStorageValue(LEGACY_SETTINGS_V2_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const legacy = JSON.parse(raw) as LegacyStoredSettingsV2;
    return {
      ...legacy,
      modelCatalogUrl: '',
    };
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
