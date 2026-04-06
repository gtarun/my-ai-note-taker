import { MeetingRow } from './types';

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
};

const STORAGE_KEY = 'mu-fathom-web-db';

type DatabaseShape = {
  meetings: MeetingStorageRow[];
  settings: SettingsRow;
  appPreferences: AppPreferencesRow;
  providerSettings: ProviderSettingsRow[];
};

const defaultState: DatabaseShape = {
  meetings: [],
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
  },
  providerSettings: [],
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
    return JSON.parse(raw) as DatabaseShape;
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
    if (!state.providerSettings) {
      state.providerSettings = [];
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

    if (source.includes('FROM meetings WHERE id = ?')) {
      const row = state.meetings.find((meeting) => meeting.id === params[0]);
      return (row ?? null) as T | null;
    }

    return null;
  },
  async getAllAsync<T>(source: string): Promise<T[]> {
    const state = readState();

    if (source.includes('FROM provider_settings')) {
      return [...state.providerSettings] as T[];
    }

    if (source.includes('FROM meetings')) {
      return [...state.meetings]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((row) => row as T);
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
  };
}
