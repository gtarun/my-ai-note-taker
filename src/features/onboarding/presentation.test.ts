import { describe, expect, test } from 'vitest';

import {
  getOfflineSetupStatusCopy,
  getOnboardingFeatureCard,
  getOnboardingProgressPercent,
} from './presentation';

describe('onboarding presentation', () => {
  test('maps each slide to a feature card', () => {
    expect(getOnboardingFeatureCard('welcome')).toEqual({
      icon: 'mic',
      title: 'Manual capture',
      body: 'Start with a recording or imported file. No bots and no stealth capture.',
      tone: 'secondary',
    });
    expect(getOnboardingFeatureCard('privacy')).toEqual({
      icon: 'shield',
      title: 'Consent and control',
      body: 'Audio stays local first and only leaves the device when you choose to process it.',
      tone: 'tertiary',
    });
    expect(getOnboardingFeatureCard('workflow')).toEqual({
      icon: 'layers',
      title: 'One clean flow',
      body: 'Capture audio, transcribe after the meeting, then review summary and action items.',
      tone: 'secondary',
    });
    expect(getOnboardingFeatureCard('setup')).toEqual({
      icon: 'download-cloud',
      title: 'Offline setup',
      body: 'We can prepare the local bundle now and keep progress visible from Meetings.',
      tone: 'secondary',
    });
  });

  test('returns setup-card copy for downloading and ready states', () => {
    expect(
      getOfflineSetupStatusCopy({
        status: 'downloading',
        bundleLabel: 'Starter',
        progressPercent: 42,
        estimatedMinutes: 6,
      })
    ).toEqual({
      title: 'Preparing offline mode',
      body: 'Starter is downloading now. About 6 min remaining.',
      progressLabel: '42%',
    });

    expect(
      getOfflineSetupStatusCopy({
        status: 'ready',
        bundleLabel: 'Starter',
        progressPercent: 100,
        estimatedMinutes: null,
      })
    ).toEqual({
      title: 'Offline mode is ready',
      body: 'Starter finished downloading and local setup has been applied.',
      progressLabel: 'Ready',
    });
  });

  test('builds a stable progress percentage', () => {
    expect(getOnboardingProgressPercent(0, 4)).toBe(25);
    expect(getOnboardingProgressPercent(1, 4)).toBe(50);
    expect(getOnboardingProgressPercent(3, 4)).toBe(100);
    expect(getOnboardingProgressPercent(-4, 4)).toBe(25);
    expect(getOnboardingProgressPercent(99, 4)).toBe(100);
    expect(getOnboardingProgressPercent(0, 0)).toBe(0);
  });
});
