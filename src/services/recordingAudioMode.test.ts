import { describe, expect, test } from 'vitest';

import {
  getActiveRecordingAudioMode,
  getIdleRecordingAudioMode,
} from './recordingAudioMode';

describe('recording audio mode helpers', () => {
  test('returns the active recording audio mode', () => {
    expect(getActiveRecordingAudioMode()).toEqual({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      allowsRecording: true,
      shouldPlayInBackground: true,
      allowsBackgroundRecording: true,
      shouldRouteThroughEarpiece: false,
    });
  });

  test('returns the idle recording audio mode', () => {
    expect(getIdleRecordingAudioMode()).toEqual({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      allowsRecording: false,
      shouldPlayInBackground: false,
      allowsBackgroundRecording: false,
      shouldRouteThroughEarpiece: false,
    });
  });
});
