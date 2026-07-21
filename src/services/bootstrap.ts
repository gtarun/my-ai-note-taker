import * as FileSystem from 'expo-file-system/legacy';

import { initializeDatabase } from '../db';
import { reconcileInterruptedModelDownloads } from './localModels';
import { getAppSettings } from './settings';

const AUDIO_DIR = `${FileSystem.documentDirectory}audio`;
const MODEL_DIR = `${FileSystem.documentDirectory}models`;

export async function bootstrapApp() {
  await initializeDatabase();
  try {
    await getAppSettings();
  } catch {
    // Local-first boot should continue even if cloud sync is unavailable.
  }

  // Storage directories are required for recording, so a failure here is fatal
  // and should surface on the boot error screen.
  for (const directory of [AUDIO_DIR, MODEL_DIR]) {
    const info = await FileSystem.getInfoAsync(directory);

    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    }
  }

  try {
    await reconcileInterruptedModelDownloads();
  } catch {
    // Housekeeping only — never block boot on it.
  }
}

export function getAudioDirectory() {
  return AUDIO_DIR;
}
