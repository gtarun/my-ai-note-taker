import { describe, expect, test } from 'vitest';

import {
  getButtonAccessibilityLabel,
  getButtonDisabled,
  getButtonIconName,
  getButtonLabel,
  getButtonVariant,
  getConsentBody,
  getConsentHeading,
  getHeroBody,
  getHeroEyebrow,
  getHeroHeadline,
  getNoticeBody,
  getNoticeTitle,
  getStatusLabel,
  getStatusTone,
  getTimerAccessibilityLabel,
  getTitlePlaceholder,
} from './presentation';
import type { RecordingPhase } from './presentation';

const phases: RecordingPhase[] = ['idle', 'recording', 'saving', 'error'];

// --- Smoke tests: every function returns a non-empty string (Req 7.3) ---

describe('smoke tests — every function returns a non-empty string', () => {
  test('getHeroEyebrow', () => {
    expect(getHeroEyebrow().length).toBeGreaterThan(0);
  });

  test('getHeroHeadline', () => {
    expect(getHeroHeadline().length).toBeGreaterThan(0);
  });

  test('getHeroBody', () => {
    expect(getHeroBody().length).toBeGreaterThan(0);
  });

  test('getTitlePlaceholder', () => {
    expect(getTitlePlaceholder().length).toBeGreaterThan(0);
  });

  test('getNoticeTitle', () => {
    expect(getNoticeTitle().length).toBeGreaterThan(0);
  });

  test('getNoticeBody', () => {
    expect(getNoticeBody().length).toBeGreaterThan(0);
  });

  test('getConsentHeading', () => {
    expect(getConsentHeading().length).toBeGreaterThan(0);
  });

  test('getConsentBody', () => {
    expect(getConsentBody().length).toBeGreaterThan(0);
  });

  test.each(phases)('getStatusLabel returns non-empty for "%s"', (phase) => {
    expect(getStatusLabel(phase).length).toBeGreaterThan(0);
  });

  test.each(phases)('getStatusTone returns non-empty for "%s"', (phase) => {
    expect(getStatusTone(phase).length).toBeGreaterThan(0);
  });

  test.each(phases)('getButtonLabel returns non-empty for "%s"', (phase) => {
    expect(getButtonLabel(phase).length).toBeGreaterThan(0);
  });

  test.each(phases)('getButtonVariant returns non-empty for "%s"', (phase) => {
    expect(getButtonVariant(phase).length).toBeGreaterThan(0);
  });

  test.each(phases)('getButtonIconName returns non-empty for "%s"', (phase) => {
    expect(getButtonIconName(phase).length).toBeGreaterThan(0);
  });

  test.each(phases)('getButtonAccessibilityLabel returns non-empty for "%s"', (phase) => {
    expect(getButtonAccessibilityLabel(phase).length).toBeGreaterThan(0);
  });
});

// --- Status indicator (Req 3.2–3.5) ---

describe('getStatusLabel', () => {
  test('returns correct labels per phase', () => {
    expect(getStatusLabel('idle')).toBe('Ready to record');
    expect(getStatusLabel('recording')).toBe('Recording in progress');
    expect(getStatusLabel('saving')).toBe('Saving…');
    expect(getStatusLabel('error')).toBe('Recording failed');
  });
});

describe('getStatusTone', () => {
  test('returns correct tones per phase', () => {
    expect(getStatusTone('idle')).toBe('secondary');
    expect(getStatusTone('recording')).toBe('danger');
    expect(getStatusTone('saving')).toBe('tertiary');
    expect(getStatusTone('error')).toBe('secondary');
  });
});

// --- Button functions (Req 4.2–4.6) ---

describe('getButtonLabel', () => {
  test('returns correct labels per phase', () => {
    expect(getButtonLabel('idle')).toBe('Start recording');
    expect(getButtonLabel('recording')).toBe('Stop and save');
    expect(getButtonLabel('saving')).toBe('Saving…');
    expect(getButtonLabel('error')).toBe('Start recording');
  });
});

describe('getButtonVariant', () => {
  test('returns correct variants per phase', () => {
    expect(getButtonVariant('idle')).toBe('primary');
    expect(getButtonVariant('recording')).toBe('danger');
    expect(getButtonVariant('saving')).toBe('primary');
    expect(getButtonVariant('error')).toBe('primary');
  });
});

describe('getButtonDisabled', () => {
  test('only saving phase is disabled', () => {
    expect(getButtonDisabled('idle')).toBe(false);
    expect(getButtonDisabled('recording')).toBe(false);
    expect(getButtonDisabled('saving')).toBe(true);
    expect(getButtonDisabled('error')).toBe(false);
  });
});

describe('getButtonIconName', () => {
  test('returns microphone for idle/saving/error and stop-circle for recording', () => {
    expect(getButtonIconName('idle')).toBe('microphone-outline');
    expect(getButtonIconName('recording')).toBe('stop-circle-outline');
    expect(getButtonIconName('saving')).toBe('microphone-outline');
    expect(getButtonIconName('error')).toBe('microphone-outline');
  });
});

// --- Notice banner (Req 5.4) ---

describe('getNoticeBody', () => {
  test('does not contain "force-quit"', () => {
    expect(getNoticeBody().toLowerCase()).not.toContain('force-quit');
  });
});

// --- Hero body (Req 1.4) ---

describe('getHeroBody', () => {
  test('contains at most two sentences', () => {
    const body = getHeroBody();
    // Count sentence-ending punctuation (. ! ?)
    const sentences = body.match(/[.!?]+/g) ?? [];
    expect(sentences.length).toBeLessThanOrEqual(2);
  });
});

// --- Timer accessibility label (Req 9.2) ---

describe('getTimerAccessibilityLabel', () => {
  test('0ms → "0 seconds"', () => {
    expect(getTimerAccessibilityLabel(0)).toBe('0 seconds');
  });

  test('1000ms → "1 second"', () => {
    expect(getTimerAccessibilityLabel(1000)).toBe('1 second');
  });

  test('61000ms → "1 minute 1 second"', () => {
    expect(getTimerAccessibilityLabel(61000)).toBe('1 minute 1 second');
  });

  test('3661000ms → "1 hour 1 minute 1 second"', () => {
    expect(getTimerAccessibilityLabel(3661000)).toBe('1 hour 1 minute 1 second');
  });
});

// --- Button accessibility label (Req 9.1) ---

describe('getButtonAccessibilityLabel', () => {
  test('returns descriptive labels for all phases', () => {
    expect(getButtonAccessibilityLabel('idle')).toBe('Start recording');
    expect(getButtonAccessibilityLabel('recording')).toBe('Stop and save recording');
    expect(getButtonAccessibilityLabel('saving')).toBe('Saving recording');
    expect(getButtonAccessibilityLabel('error')).toBe('Start recording');
  });
});
