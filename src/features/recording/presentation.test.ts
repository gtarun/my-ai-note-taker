import { describe, expect, test } from 'vitest';

import {
  getRecordingNoticeBody,
  getRecordingStatusLabel,
  getRecordingSupportLabel,
} from './presentation';

describe('recording presentation', () => {
  test('returns the background recording notice and status copy', () => {
    expect(getRecordingNoticeBody()).toBe(
      'Recording keeps running while the app is in the background. If you force-quit the app, the session can be lost.',
    );
    expect(getRecordingStatusLabel(true)).toBe('Recording in progress');
    expect(getRecordingStatusLabel(false)).toBe('Ready to record');
    expect(getRecordingSupportLabel()).toBe('Phone mic, background recording enabled');
  });
});
