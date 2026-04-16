import type { AppSettings, CloudUserDataSnapshot, ExtractionLayer, ProviderConfig, ProviderId } from '../types';
import { getAuthSession, invokeAuthenticatedFunction } from './account';
import {
  defaultProviderConfigs,
  isProviderConfigured,
  normalizeProviderConfig,
  providerDefinitions,
  providerMap,
} from './providers';

export async function fetchCloudUserDataSnapshot() {
  return invokeAuthenticatedFunction<CloudUserDataSnapshot>('user-data-bootstrap', {});
}

export async function saveCloudSettings(params: {
  selectedTranscriptionProvider: ProviderId;
  selectedSummaryProvider: ProviderId;
  deleteUploadedAudio: boolean;
  modelCatalogUrl: string;
  hasSeenOnboarding: boolean;
  providers: Record<ProviderId, ProviderConfig>;
}) {
  const session = await getAuthSession();

  if (!session) {
    return;
  }

  await invokeAuthenticatedFunction('user-settings-sync', {
    preferences: {
      selectedTranscriptionProvider: params.selectedTranscriptionProvider,
      selectedSummaryProvider: params.selectedSummaryProvider,
      deleteUploadedAudio: params.deleteUploadedAudio,
      modelCatalogUrl: params.modelCatalogUrl,
      hasSeenOnboarding: params.hasSeenOnboarding,
    },
    providers: Object.entries(params.providers).map(([providerId, config]) => ({
      providerId,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      transcriptionModel: config.transcriptionModel,
      summaryModel: config.summaryModel,
    })),
  });
}

export async function saveCloudOnboardingState(hasSeenOnboarding: boolean) {
  const session = await getAuthSession();

  if (!session) {
    return;
  }

  await invokeAuthenticatedFunction('user-settings-sync', {
    preferences: {
      hasSeenOnboarding,
    },
  });
}

export function mapBootstrapSnapshotToAppSettings(snapshot: CloudUserDataSnapshot): AppSettings {
  const providers = buildProviderMapFromSnapshot(snapshot);
  const availableTranscriptionProviders = providerDefinitions
    .filter(
      (definition) =>
        definition.supportsTranscription &&
        isProviderConfigured(definition.id, providers[definition.id], 'transcription')
    )
    .map((definition) => definition.id);
  const availableSummaryProviders = providerDefinitions
    .filter(
      (definition) =>
        definition.supportsSummary && isProviderConfigured(definition.id, providers[definition.id], 'summary')
    )
    .map((definition) => definition.id);

  return {
    selectedTranscriptionProvider: resolveSelectedProvider(
      snapshot.preferences.selectedTranscriptionProvider,
      availableTranscriptionProviders,
      'transcription'
    ),
    selectedSummaryProvider: resolveSelectedProvider(
      snapshot.preferences.selectedSummaryProvider,
      availableSummaryProviders,
      'summary'
    ),
    deleteUploadedAudio: snapshot.preferences.deleteUploadedAudio,
    modelCatalogUrl: snapshot.preferences.modelCatalogUrl.trim(),
    providers,
  };
}

export function mapBootstrapSnapshotToLayers(snapshot: CloudUserDataSnapshot): ExtractionLayer[] {
  return snapshot.layers.map((layer) => ({
    ...layer,
    fields: layer.fields.map((field) => ({ ...field })),
  }));
}

function buildProviderMapFromSnapshot(snapshot: CloudUserDataSnapshot): Record<ProviderId, ProviderConfig> {
  const providers = Object.fromEntries(
    providerDefinitions.map((definition) => [
      definition.id,
      normalizeProviderConfig(definition.id, defaultProviderConfigs[definition.id]),
    ])
  ) as Record<ProviderId, ProviderConfig>;

  for (const row of snapshot.providers) {
    providers[row.providerId] = normalizeProviderConfig(row.providerId, {
      apiKey: row.apiKey,
      baseUrl: row.baseUrl,
      transcriptionModel: row.transcriptionModel,
      summaryModel: row.summaryModel,
    });
  }

  return providers;
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

  if (
    (mode === 'transcription' && providerMap[providerId]?.supportsTranscription) ||
    (mode === 'summary' && providerMap[providerId]?.supportsSummary)
  ) {
    return providerId;
  }

  return 'openai';
}
