import { describe, expect, test } from 'vitest';

import {
  getNextOnboardingIndex,
  getOnboardingCompletionRoute,
  getOnboardingProgress,
  getPreviousOnboardingIndex,
  isLastOnboardingSlide,
  ONBOARDING_SLIDES,
  shouldPresentOnboarding,
} from './model';

describe('onboarding model', () => {
  test('exposes the onboarding slides and helpers', () => {
    expect(ONBOARDING_SLIDES.map((slide) => slide.id)).toEqual([
      'welcome',
      'workflow',
      'privacy',
      'setup',
    ]);
    expect(ONBOARDING_SLIDES[0].title).toBe('Record it. Upload it. Process it later.');
    expect(ONBOARDING_SLIDES[3].ctaLabel).toBe('Go to Settings');
    expect(ONBOARDING_SLIDES.every((slide) => slide.showSkip)).toBe(true);

    expect(getNextOnboardingIndex(0, 4)).toBe(1);
    expect(getNextOnboardingIndex(3, 4)).toBe(3);
    expect(getPreviousOnboardingIndex(1)).toBe(0);
    expect(getPreviousOnboardingIndex(0)).toBe(0);
    expect(isLastOnboardingSlide(3, 4)).toBe(true);
    expect(isLastOnboardingSlide(2, 4)).toBe(false);
    expect(getOnboardingProgress(1, 4)).toEqual([false, true, false, false]);
    expect(getOnboardingProgress(3, 4)).toEqual([false, false, false, true]);
    expect(getOnboardingCompletionRoute()).toBe('/settings');
  });

  test('only presents onboarding on non-onboarding routes before completion', () => {
    expect(
      shouldPresentOnboarding({ hasSeenOnboarding: false, pathname: '/' })
    ).toBe(true);
    expect(
      shouldPresentOnboarding({ hasSeenOnboarding: true, pathname: '/' })
    ).toBe(false);
    expect(
      shouldPresentOnboarding({ hasSeenOnboarding: false, pathname: '/onboarding' })
    ).toBe(false);
    expect(
      shouldPresentOnboarding({ hasSeenOnboarding: true, pathname: '/onboarding' })
    ).toBe(false);
  });
});
