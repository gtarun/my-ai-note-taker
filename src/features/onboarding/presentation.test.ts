import { describe, expect, test } from 'vitest';

import { getOnboardingFeatureCard, getOnboardingProgressPercent } from './presentation';

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
  });

  test('builds a stable progress percentage', () => {
    expect(getOnboardingProgressPercent(0, 4)).toBe(25);
    expect(getOnboardingProgressPercent(1, 4)).toBe(50);
    expect(getOnboardingProgressPercent(3, 4)).toBe(100);
  });
});
