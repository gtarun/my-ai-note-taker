import type { AudioMode } from 'expo-audio';

const ACTIVE_RECORDING_AUDIO_MODE: AudioMode = {
  playsInSilentMode: true,
  interruptionMode: 'duckOthers',
  allowsRecording: true,
  shouldPlayInBackground: true,
  allowsBackgroundRecording: true,
  shouldRouteThroughEarpiece: false,
};

const IDLE_RECORDING_AUDIO_MODE: AudioMode = {
  playsInSilentMode: true,
  interruptionMode: 'duckOthers',
  allowsRecording: false,
  shouldPlayInBackground: false,
  allowsBackgroundRecording: false,
  shouldRouteThroughEarpiece: false,
};

export function getActiveRecordingAudioMode(): AudioMode {
  return ACTIVE_RECORDING_AUDIO_MODE;
}

export function getIdleRecordingAudioMode(): AudioMode {
  return IDLE_RECORDING_AUDIO_MODE;
}
