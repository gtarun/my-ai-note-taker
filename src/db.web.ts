import { MeetingRow, type OfflineSetupSession } from './types';

type SettingsRow = {
  id: number;
  openai_base_url: string;
  transcription_model: string;
  summary_model: string;
  delete_uploaded_audio: number;
};

type AppPreferencesRow = {
  id: number;
  selected_transcription_provider: string;
  selected_summary_provider: string;
  delete_uploaded_audio: number;
  model_catalog_url: string;
  has_seen_onboarding: number;
};

type OfflineSetupSessionRow = {
  id: number;
  bundle_id: string;
  bundle_label: string;
  model_ids_json: string;
  status: OfflineSetupSession['status'];
  bytes_downloaded: number;
  total_bytes: number;
  progress: number;
  estimated_seconds_remaining: number | null;
  network_policy: string;
  last_error: string | null;
  started_at: string | null;
  updated_at: string | null;
  auto_configured_at: string | null;
  is_dismissed: number;
};

type ProviderSettingsRow = {
  provider_id: string;
  api_key: string;
  base_url: string;
  transcription_model: string;
  summary_model: string;
};

type MeetingStorageRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  audio_uri: string;
  duration_ms: number;
  source_type: 'recording' | 'import';
  status: MeetingRow['status'];
  transcript_text: string | null;
  summary_json: string | null;
  summary_short: string | null;
  error_message: string | null;
  selected_layer_id: string | null;
  extraction_layer_name: string | null;
  extraction_fields_json: string | null;
  extraction_values_json: string | null;
  extraction_status: string | null;
  extraction_error_message: string | null;
  extraction_sync_status: string | null;
  extraction_sync_error_message: string | null;
  extraction_synced_at: string | null;
  extraction_synced_row_id: string | null;
};

type ExtractionLayerStorageRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  spreadsheet_id: string | null;
  spreadsheet_title: string | null;
  sheet_title: string | null;
};

type ExtractionLayerFieldStorageRow = {
  id: string;
  layer_id: string;
  field_id: string;
  title: string;
  description: string;
  position: number;
  created_at: string;
  updated_at: string;
};

type InstalledModelStorageRow = {
  id: string;
  kind: 'transcription' | 'summary';
  engine: string;
  display_name: string;
  version: string;
  platforms_json: string;
  file_uri: string | null;
  size_bytes: number;
  sha256: string;
  status: 'installed' | 'downloading' | 'failed';
  installed_at: string | null;
  download_url: string;
  recommended: number;
  experimental: number;
  error_message: string | null;
};

const STORAGE_KEY = 'mu-fathom-web-db';

type DatabaseShape = {
  meetings: MeetingStorageRow[];
  extractionLayers: ExtractionLayerStorageRow[];
  extractionLayerFields: ExtractionLayerFieldStorageRow[];
  settings: SettingsRow;
  appPreferences: AppPreferencesRow;
  offlineSetupSession: OfflineSetupSessionRow;
  providerSettings: ProviderSettingsRow[];
  installedModels: InstalledModelStorageRow[];
};

const defaultState: DatabaseShape = {
  meetings: [],
  extractionLayers: [],
  extractionLayerFields: [],
  settings: {
    id: 1,
    openai_base_url: 'https://api.openai.com/v1',
    transcription_model: 'gpt-4o-mini-transcribe',
    summary_model: 'gpt-4.1-mini',
    delete_uploaded_audio: 0,
  },
  appPreferences: {
    id: 1,
    selected_transcription_provider: 'openai',
    selected_summary_provider: 'openai',
    delete_uploaded_audio: 0,
    model_catalog_url: '',
    has_seen_onboarding: 0,
  },
  offlineSetupSession: {
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
  },
  providerSettings: [],
  installedModels: [],
};

function readState(): DatabaseShape {
  if (typeof window === 'undefined') {
    return structuredClone(defaultState);
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return structuredClone(defaultState);
  }

  try {
    const state = JSON.parse(raw) as Partial<DatabaseShape>;

    return {
      ...structuredClone(defaultState),
      ...state,
      appPreferences: {
        ...structuredClone(defaultState.appPreferences),
        ...state.appPreferences,
        model_catalog_url: state.appPreferences?.model_catalog_url ?? defaultState.appPreferences.model_catalog_url,
        has_seen_onboarding: state.appPreferences?.has_seen_onboarding ?? defaultState.appPreferences.has_seen_onboarding,
      },
      offlineSetupSession: {
        ...structuredClone(defaultState.offlineSetupSession),
        ...state.offlineSetupSession,
      },
      settings: {
        ...structuredClone(defaultState.settings),
        ...state.settings,
      },
      providerSettings: state.providerSettings ?? [],
      installedModels: state.installedModels ?? [],
      meetings: state.meetings ?? [],
      extractionLayers: state.extractionLayers ?? [],
      extractionLayerFields: state.extractionLayerFields ?? [],
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function writeState(state: DatabaseShape) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const db = {
  async execAsync(_source: string) {
    const state = readState();

    if (!state.settings) {
      state.settings = structuredClone(defaultState.settings);
    }

    if (!state.appPreferences) {
      state.appPreferences = structuredClone(defaultState.appPreferences);
    }

    if (!state.offlineSetupSession) {
      state.offlineSetupSession = structuredClone(defaultState.offlineSetupSession);
    }

    if (typeof state.appPreferences.model_catalog_url !== 'string') {
      state.appPreferences.model_catalog_url = '';
    }

    if (typeof state.appPreferences.has_seen_onboarding !== 'number') {
      state.appPreferences.has_seen_onboarding = 0;
    }

    if (!state.providerSettings) {
      state.providerSettings = [];
    }

    if (!state.installedModels) {
      state.installedModels = [];
    }

    if (!state.extractionLayers) {
      state.extractionLayers = [];
    }

    if (!state.extractionLayerFields) {
      state.extractionLayerFields = [];
    }

    writeState(state);
  },
  async getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null> {
    const state = readState();

    if (source.includes('FROM app_preferences')) {
      return state.appPreferences as T;
    }

    if (source.includes('FROM app_settings')) {
      return state.settings as T;
    }

    if (source.includes('FROM offline_setup_session')) {
      return state.offlineSetupSession as T;
    }

    if (source.includes('FROM meetings WHERE id = ?')) {
      const row = state.meetings.find((meeting) => meeting.id === params[0]);
      return (row ?? null) as T | null;
    }

    if (source.includes('FROM installed_models WHERE id = ?')) {
      const row = state.installedModels.find((model) => model.id === params[0]);
      return (row ?? null) as T | null;
    }

    if (source.includes('FROM extraction_layers WHERE id = ?')) {
      const row = state.extractionLayers.find((layer) => layer.id === params[0]);
      return (row ?? null) as T | null;
    }

    return null;
  },
  async getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]> {
    const state = readState();

    if (source.includes('FROM provider_settings')) {
      return [...state.providerSettings] as T[];
    }

    if (source.includes('FROM installed_models')) {
      return [...state.installedModels]
        .sort((a, b) => a.display_name.localeCompare(b.display_name))
        .map((row) => row as T);
    }

    if (source.includes('FROM meetings')) {
      return [...state.meetings]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((row) => row as T);
    }

    if (source.includes('FROM extraction_layers')) {
      return [...state.extractionLayers]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((row) => row as T);
    }

    if (source.includes('FROM extraction_layer_fields WHERE layer_id = ?')) {
      return [...state.extractionLayerFields]
        .filter((row) => row.layer_id === params[0])
        .sort((a, b) => a.position - b.position)
        .map((row) => {
          if (source.includes('SELECT field_id')) {
            return {
              field_id: row.field_id,
              title: row.title,
              description: row.description,
            } as T;
          }

          return row as T;
        });
    }

    return [];
  },
  async runAsync(source: string, ...params: unknown[]) {
    const state = readState();

    if (source.includes('INSERT INTO meetings')) {
      state.meetings.push({
        id: String(params[0]),
        title: String(params[1]),
        created_at: String(params[2]),
        updated_at: String(params[3]),
        audio_uri: String(params[4]),
        duration_ms: Number(params[5]),
        source_type: params[6] === 'import' ? 'import' : 'recording',
        status: (params[7] as MeetingRow['status']) ?? 'local_only',
        transcript_text: null,
        summary_json: null,
        summary_short: null,
        error_message: null,
        selected_layer_id: null,
        extraction_layer_name: null,
        extraction_fields_json: null,
        extraction_values_json: null,
        extraction_status: null,
        extraction_error_message: null,
        extraction_sync_status: null,
        extraction_sync_error_message: null,
        extraction_synced_at: null,
        extraction_synced_row_id: null,
      });
      writeState(state);
      return;
    }

    if (source.includes('UPDATE app_settings')) {
      state.settings = {
        id: 1,
        openai_base_url: String(params[0]),
        transcription_model: String(params[1]),
        summary_model: String(params[2]),
        delete_uploaded_audio: Number(params[3]),
      };
      writeState(state);
      return;
    }

    if (source.includes('INSERT OR REPLACE INTO app_preferences')) {
      state.appPreferences = {
        id: 1,
        selected_transcription_provider: String(params[0]),
        selected_summary_provider: String(params[1]),
        delete_uploaded_audio: Number(params[2]),
        model_catalog_url: params[3] ? String(params[3]) : '',
        has_seen_onboarding: 0,
      };
      writeState(state);
      return;
    }

    if (source.includes('UPDATE offline_setup_session SET')) {
      state.offlineSetupSession = {
        ...state.offlineSetupSession,
        bundle_id: String(params[0]),
        bundle_label: String(params[1]),
        model_ids_json: String(params[2]),
        status: params[3] as OfflineSetupSessionRow['status'],
        bytes_downloaded: Number(params[4] ?? 0),
        total_bytes: Number(params[5] ?? 0),
        progress: Number(params[6] ?? 0),
        estimated_seconds_remaining:
          params[7] == null ? null : Number(params[7]),
        network_policy: String(params[8]),
        last_error: params[9] ? String(params[9]) : null,
        started_at: params[10] ? String(params[10]) : null,
        updated_at: params[11] ? String(params[11]) : null,
        auto_configured_at: params[12] ? String(params[12]) : null,
        is_dismissed: Number(params[13] ?? 0),
      };
      writeState(state);
      return;
    }

    if (
      source.includes('UPDATE app_preferences SET') &&
      source.includes('selected_transcription_provider = ?')
    ) {
      state.appPreferences = {
        ...state.appPreferences,
        selected_transcription_provider: String(params[0]),
        selected_summary_provider: String(params[1]),
        delete_uploaded_audio: Number(params[2]),
        model_catalog_url: params[3] ? String(params[3]) : '',
      };
      writeState(state);
      return;
    }

    if (source.includes('UPDATE app_preferences SET has_seen_onboarding = ? WHERE id = 1')) {
      state.appPreferences = {
        ...state.appPreferences,
        has_seen_onboarding: Number(params[0]),
      };
      writeState(state);
      return;
    }

    if (source.includes('INSERT OR REPLACE INTO provider_settings')) {
      const row: ProviderSettingsRow = {
        provider_id: String(params[0]),
        api_key: String(params[1]),
        base_url: String(params[2]),
        transcription_model: String(params[3]),
        summary_model: String(params[4]),
      };
      const index = state.providerSettings.findIndex(
        (provider) => provider.provider_id === row.provider_id
      );

      if (index >= 0) {
        state.providerSettings[index] = row;
      } else {
        state.providerSettings.push(row);
      }

      writeState(state);
      return;
    }

    if (source.includes('INSERT OR REPLACE INTO installed_models')) {
      const row: InstalledModelStorageRow = {
        id: String(params[0]),
        kind: params[1] === 'summary' ? 'summary' : 'transcription',
        engine: String(params[2]),
        display_name: String(params[3]),
        version: String(params[4]),
        platforms_json: String(params[5]),
        file_uri: params[6] ? String(params[6]) : null,
        size_bytes: Number(params[7] ?? 0),
        sha256: String(params[8] ?? ''),
        status: params[9] === 'downloading' ? 'downloading' : params[9] === 'failed' ? 'failed' : 'installed',
        installed_at: params[10] ? String(params[10]) : null,
        download_url: String(params[11] ?? ''),
        recommended: Number(params[12] ?? 0),
        experimental: Number(params[13] ?? 0),
        error_message: params[14] ? String(params[14]) : null,
      };
      state.installedModels = state.installedModels.filter((model) => model.id !== row.id);
      state.installedModels.push(row);
      writeState(state);
      return;
    }

    if (source.includes('INSERT INTO extraction_layers')) {
      state.extractionLayers.push({
        id: String(params[0]),
        name: String(params[1]),
        created_at: String(params[2]),
        updated_at: String(params[3]),
        spreadsheet_id: params[4] ? String(params[4]) : null,
        spreadsheet_title: params[5] ? String(params[5]) : null,
        sheet_title: params[6] ? String(params[6]) : null,
      });
      writeState(state);
      return;
    }

    if (source.includes('UPDATE extraction_layers') && source.includes('SET name = ?')) {
      const row = state.extractionLayers.find((layer) => layer.id === params[5]);
      if (row) {
        row.name = String(params[0]);
        row.updated_at = String(params[1]);
        row.spreadsheet_id = params[2] ? String(params[2]) : null;
        row.spreadsheet_title = params[3] ? String(params[3]) : null;
        row.sheet_title = params[4] ? String(params[4]) : null;
        writeState(state);
      }
      return;
    }

    if (source.includes('DELETE FROM extraction_layer_fields WHERE layer_id = ?')) {
      state.extractionLayerFields = state.extractionLayerFields.filter((row) => row.layer_id !== params[0]);
      writeState(state);
      return;
    }

    if (source.includes('INSERT INTO extraction_layer_fields')) {
      state.extractionLayerFields.push({
        id: String(params[0]),
        layer_id: String(params[1]),
        field_id: String(params[2]),
        title: String(params[3]),
        description: String(params[4]),
        position: Number(params[5]),
        created_at: String(params[6]),
        updated_at: String(params[7]),
      });
      writeState(state);
      return;
    }

    if (source.includes('DELETE FROM extraction_layers WHERE id = ?')) {
      state.extractionLayers = state.extractionLayers.filter((row) => row.id !== params[0]);
      writeState(state);
      return;
    }

    if (source.includes('DELETE FROM installed_models WHERE id = ?')) {
      state.installedModels = state.installedModels.filter((row) => row.id !== params[0]);
      writeState(state);
      return;
    }

    if (source.includes('UPDATE meetings SET title = ?, updated_at = ?')) {
      const meeting = state.meetings.find((row) => row.id === params[2]);
      if (meeting) {
        meeting.title = String(params[0]);
        meeting.updated_at = String(params[1]);
        writeState(state);
      }
      return;
    }

    if (source.includes('SET status = ?, error_message = ?, updated_at = ?')) {
      const meeting = state.meetings.find((row) => row.id === params[3]);
      if (meeting) {
        meeting.status = params[0] as MeetingRow['status'];
        meeting.error_message = params[1] ? String(params[1]) : null;
        meeting.updated_at = String(params[2]);
        writeState(state);
      }
      return;
    }

    if (source.includes('SET transcript_text = ?, updated_at = ?')) {
      const meeting = state.meetings.find((row) => row.id === params[2]);
      if (meeting) {
        meeting.transcript_text = String(params[0]);
        meeting.updated_at = String(params[1]);
        writeState(state);
      }
      return;
    }

    if (
      source.includes(
        'SET transcript_text = NULL, summary_json = NULL, summary_short = NULL, error_message = NULL, updated_at = ?'
      )
    ) {
      const meeting = state.meetings.find((row) => row.id === params[1]);
      if (meeting) {
        meeting.transcript_text = null;
        meeting.summary_json = null;
        meeting.summary_short = null;
        meeting.error_message = null;
        meeting.selected_layer_id = null;
        meeting.extraction_layer_name = null;
        meeting.extraction_fields_json = null;
        meeting.extraction_values_json = null;
        meeting.extraction_status = null;
        meeting.extraction_error_message = null;
        meeting.extraction_sync_status = null;
        meeting.extraction_sync_error_message = null;
        meeting.extraction_synced_at = null;
        meeting.extraction_synced_row_id = null;
        meeting.updated_at = String(params[0]);
        writeState(state);
      }
      return;
    }

    if (source.includes('SET summary_json = ?, summary_short = ?, updated_at = ?')) {
      const meeting = state.meetings.find((row) => row.id === params[3]);
      if (meeting) {
        meeting.summary_json = String(params[0]);
        meeting.summary_short = String(params[1]);
        meeting.updated_at = String(params[2]);
        writeState(state);
      }
      return;
    }

    if (source.includes('selected_layer_id = ?') && source.includes('extraction_layer_name = ?')) {
      const meeting = state.meetings.find((row) => row.id === params[9]);
      if (meeting) {
        meeting.selected_layer_id = params[0] ? String(params[0]) : null;
        meeting.extraction_layer_name = params[1] ? String(params[1]) : null;
        meeting.extraction_fields_json = params[2] ? String(params[2]) : null;
        meeting.extraction_values_json = params[3] ? String(params[3]) : null;
        meeting.extraction_status = params[4] ? String(params[4]) : null;
        meeting.extraction_error_message = params[5] ? String(params[5]) : null;
        meeting.extraction_sync_status = params[6] ? String(params[6]) : null;
        meeting.extraction_sync_error_message = params[7] ? String(params[7]) : null;
        meeting.updated_at = String(params[8]);
        writeState(state);
      }
      return;
    }

    if (source.includes('extraction_values_json = ?') && source.includes('extraction_sync_status = ?')) {
      const meeting = state.meetings.find((row) => row.id === params[4]);
      if (meeting) {
        meeting.extraction_values_json = String(params[0]);
        meeting.extraction_sync_status = String(params[1]);
        meeting.extraction_sync_error_message = params[2] ? String(params[2]) : null;
        meeting.updated_at = String(params[3]);
        writeState(state);
      }
      return;
    }

    if (source.includes('extraction_sync_status = ?') && source.includes('extraction_sync_error_message = ?')) {
      const meeting = state.meetings.find((row) => row.id === params[5]);
      if (meeting) {
        meeting.extraction_sync_status = String(params[0]);
        meeting.extraction_sync_error_message = params[1] ? String(params[1]) : null;
        meeting.extraction_synced_at = params[2] ? String(params[2]) : null;
        meeting.extraction_synced_row_id = params[3] ? String(params[3]) : null;
        meeting.updated_at = String(params[4]);
        writeState(state);
      }
      return;
    }

    if (source.includes('DELETE FROM meetings WHERE id = ?')) {
      state.meetings = state.meetings.filter((row) => row.id !== params[0]);
      writeState(state);
    }
  },
};

export async function initializeDatabase() {
  await db.execAsync('');
}

export function getDatabase() {
  return db;
}

export function mapMeetingRow(row: Record<string, unknown>): MeetingRow {
  const selectedLayerId = row.selected_layer_id ? String(row.selected_layer_id) : null;
  const extractionFields = parseJsonValue(row.extraction_fields_json);
  const extractionValues = parseJsonValue(row.extraction_values_json);

  return {
    id: String(row.id),
    title: String(row.title),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    audioUri: String(row.audio_uri),
    durationMs: Number(row.duration_ms ?? 0),
    sourceType: row.source_type === 'import' ? 'import' : 'recording',
    status: (row.status as MeetingRow['status']) ?? 'local_only',
    transcriptText: row.transcript_text ? String(row.transcript_text) : null,
    summaryJson: row.summary_json ? String(row.summary_json) : null,
    summaryShort: row.summary_short ? String(row.summary_short) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    extractionResult: selectedLayerId
      ? {
          layerId: selectedLayerId,
          layerName: row.extraction_layer_name ? String(row.extraction_layer_name) : '',
          fields: Array.isArray(extractionFields) ? extractionFields : [],
          values:
            extractionValues && typeof extractionValues === 'object' && !Array.isArray(extractionValues)
              ? (extractionValues as Record<string, string>)
              : {},
          extractionStatus:
            row.extraction_status === 'extracting' || row.extraction_status === 'failed'
              ? row.extraction_status
              : 'ready',
          extractionErrorMessage: row.extraction_error_message ? String(row.extraction_error_message) : null,
          syncStatus:
            row.extraction_sync_status === 'syncing' ||
            row.extraction_sync_status === 'synced' ||
            row.extraction_sync_status === 'sync_failed'
              ? row.extraction_sync_status
              : 'not_synced',
          syncErrorMessage: row.extraction_sync_error_message
            ? String(row.extraction_sync_error_message)
            : null,
          syncedAt: row.extraction_synced_at ? String(row.extraction_synced_at) : null,
          syncedRowId: row.extraction_synced_row_id ? String(row.extraction_synced_row_id) : null,
        }
      : null,
  };
}

function parseJsonValue(value: unknown) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
