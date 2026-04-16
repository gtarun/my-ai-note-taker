import type {
  CloudUserDataSnapshot,
  CloudUserIntegration,
  CloudUserProviderConfig,
  ExtractionLayer,
  ExtractionLayerField,
  ProviderId,
} from '../../../src/types.ts';

type AuthUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type ProfileRow = {
  display_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
};

type PreferencesRow = {
  selected_transcription_provider: ProviderId;
  selected_summary_provider: ProviderId;
  delete_uploaded_audio: boolean;
  model_catalog_url: string;
  has_seen_onboarding: boolean;
};

export type ProviderConfigRow = {
  provider_id: ProviderId;
  api_key: string;
  base_url: string;
  transcription_model: string;
  summary_model: string;
};

export type IntegrationRow = {
  provider: 'google';
  status: 'not_connected' | 'connected';
  account_email: string | null;
  granted_scopes: string[] | null;
  needs_reconnect: boolean;
  drive_save_folder_id: string | null;
  drive_save_folder_name: string | null;
  updated_at: string | null;
};

type LayerRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  spreadsheet_id: string | null;
  spreadsheet_title: string | null;
  sheet_title: string | null;
};

type LayerFieldRow = {
  layer_id: string;
  field_id: string;
  title: string;
  description: string;
  position: number;
};

export type BuildBootstrapPayloadInput = {
  authUser: AuthUserLike;
  profile: ProfileRow | null;
  preferences: PreferencesRow | null;
  providerConfigs: ProviderConfigRow[];
  integrations: IntegrationRow[];
  layers: LayerRow[];
  layerFields: LayerFieldRow[];
};

export function buildBootstrapPayload(input: BuildBootstrapPayloadInput): CloudUserDataSnapshot {
  const fallbackName = input.authUser.user_metadata?.name;
  const profile = input.profile ?? {
    display_name: typeof fallbackName === 'string' ? fallbackName : null,
    avatar_url: null,
    timezone: null,
  };

  return {
    profile: {
      displayName: cleanNullable(profile.display_name),
      avatarUrl: cleanNullable(profile.avatar_url),
      timezone: cleanNullable(profile.timezone),
    },
    preferences: {
      selectedTranscriptionProvider: input.preferences?.selected_transcription_provider ?? 'openai',
      selectedSummaryProvider: input.preferences?.selected_summary_provider ?? 'openai',
      deleteUploadedAudio: input.preferences?.delete_uploaded_audio ?? false,
      modelCatalogUrl: input.preferences?.model_catalog_url ?? '',
      hasSeenOnboarding: input.preferences?.has_seen_onboarding ?? false,
    },
    providers: input.providerConfigs.map(mapProviderConfig),
    integrations: input.integrations.map(mapIntegration),
    layers: hydrateLayers(input.layers, input.layerFields),
  };
}

function mapProviderConfig(row: ProviderConfigRow): CloudUserProviderConfig {
  return {
    providerId: row.provider_id,
    apiKey: row.api_key,
    baseUrl: row.base_url,
    transcriptionModel: row.transcription_model,
    summaryModel: row.summary_model,
  };
}

function mapIntegration(row: IntegrationRow): CloudUserIntegration {
  return {
    provider: row.provider,
    status: row.status === 'connected' ? 'connected' : 'not_connected',
    accountEmail: cleanNullable(row.account_email),
    grantedScopes: Array.isArray(row.granted_scopes) ? row.granted_scopes : [],
    connectedAt: cleanNullable(row.updated_at),
    needsReconnect: row.needs_reconnect === true,
    saveFolderId: cleanNullable(row.drive_save_folder_id),
    saveFolderName: cleanNullable(row.drive_save_folder_name),
  };
}

function hydrateLayers(rows: LayerRow[], fieldRows: LayerFieldRow[]): ExtractionLayer[] {
  const fieldsByLayer = new Map<string, ExtractionLayerField[]>();

  for (const row of [...fieldRows].sort((left, right) => left.position - right.position)) {
    const fields = fieldsByLayer.get(row.layer_id) ?? [];
    fields.push({
      id: row.field_id,
      title: row.title,
      description: row.description,
    });
    fieldsByLayer.set(row.layer_id, fields);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    spreadsheetId: cleanNullable(row.spreadsheet_id),
    spreadsheetTitle: cleanNullable(row.spreadsheet_title),
    sheetTitle: cleanNullable(row.sheet_title),
    fields: fieldsByLayer.get(row.id) ?? [],
  }));
}

function cleanNullable(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
