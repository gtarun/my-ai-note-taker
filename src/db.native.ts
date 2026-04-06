import * as SQLite from 'expo-sqlite';

import { MeetingRow } from './types';

const db = SQLite.openDatabaseSync('mu-fathom.db');

export async function initializeDatabase() {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      audio_uri TEXT NOT NULL,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      source_type TEXT NOT NULL,
      status TEXT NOT NULL,
      transcript_text TEXT,
      summary_json TEXT,
      summary_short TEXT,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      openai_base_url TEXT NOT NULL,
      transcription_model TEXT NOT NULL,
      summary_model TEXT NOT NULL,
      delete_uploaded_audio INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_preferences (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      selected_transcription_provider TEXT NOT NULL,
      selected_summary_provider TEXT NOT NULL,
      delete_uploaded_audio INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS provider_settings (
      provider_id TEXT PRIMARY KEY NOT NULL,
      api_key TEXT NOT NULL DEFAULT '',
      base_url TEXT NOT NULL DEFAULT '',
      transcription_model TEXT NOT NULL DEFAULT '',
      summary_model TEXT NOT NULL DEFAULT ''
    );

    INSERT OR IGNORE INTO app_settings (
      id,
      openai_base_url,
      transcription_model,
      summary_model,
      delete_uploaded_audio
    ) VALUES (
      1,
      'https://api.openai.com/v1',
      'gpt-4o-mini-transcribe',
      'gpt-4.1-mini',
      0
    );

    INSERT OR IGNORE INTO app_preferences (
      id,
      selected_transcription_provider,
      selected_summary_provider,
      delete_uploaded_audio
    ) VALUES (
      1,
      'openai',
      'openai',
      0
    );
  `);
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
