import * as SecureStore from 'expo-secure-store';

import { getDatabase } from '../db';
import { AppSettings } from '../types';

const OPENAI_KEY_SECRET = 'openai_api_key';

type SettingsRow = {
  openai_base_url: string;
  transcription_model: string;
  summary_model: string;
  delete_uploaded_audio: number;
};

export async function getAppSettings(): Promise<AppSettings> {
  const db = getDatabase();
  const row = await db.getFirstAsync<SettingsRow>('SELECT * FROM app_settings WHERE id = 1');
  const openAIApiKey = (await SecureStore.getItemAsync(OPENAI_KEY_SECRET)) ?? '';

  return {
    openAIApiKey,
    openAIBaseUrl: row?.openai_base_url ?? 'https://api.openai.com/v1',
    transcriptionModel: row?.transcription_model ?? 'gpt-4o-mini-transcribe',
    summaryModel: row?.summary_model ?? 'gpt-4.1-mini',
    deleteUploadedAudio: Boolean(row?.delete_uploaded_audio),
  };
}

export async function saveAppSettings(settings: AppSettings) {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE app_settings
     SET openai_base_url = ?, transcription_model = ?, summary_model = ?, delete_uploaded_audio = ?
     WHERE id = 1`,
    settings.openAIBaseUrl.trim() || 'https://api.openai.com/v1',
    settings.transcriptionModel.trim() || 'gpt-4o-mini-transcribe',
    settings.summaryModel.trim() || 'gpt-4.1-mini',
    settings.deleteUploadedAudio ? 1 : 0
  );

  await SecureStore.setItemAsync(OPENAI_KEY_SECRET, settings.openAIApiKey.trim());
}
