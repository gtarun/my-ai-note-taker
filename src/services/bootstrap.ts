import * as FileSystem from 'expo-file-system/legacy';

import { initializeDatabase } from '../db';

const AUDIO_DIR = `${FileSystem.documentDirectory}audio`;

export async function bootstrapApp() {
  await initializeDatabase();
  const info = await FileSystem.getInfoAsync(AUDIO_DIR);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
  }
}

export function getAudioDirectory() {
  return AUDIO_DIR;
}
