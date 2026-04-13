import { describe, expect, test } from 'vitest';

import {
  canGoBackOnOnboarding,
  getNextOnboardingIndex,
  getOnboardingCompletionRoute,
  getOnboardingProgress,
  getPreviousOnboardingIndex,
  isLastOnboardingSlide,
  ONBOARDING_SLIDES,
  shouldPresentOnboarding,
} from './model';

describe('onboarding model', () => {
  test('exposes the onboarding slides', () => {
    expect(ONBOARDING_SLIDES.map((slide) => slide.id)).toEqual([
      'welcome',
      'workflow',
      'privacy',
      'setup',
    ]);
    expect(ONBOARDING_SLIDES[0].title).toBe('Record it. Upload it. Process it later.');
    expect(ONBOARDING_SLIDES[3].ctaLabel).toBe('Go to Settings');
    expect(ONBOARDING_SLIDES.every((slide) => slide.showSkip)).toBe(true);
  });

  test('supports onboarding navigation helpers', () => {
    expect(getNextOnboardingIndex(0, 4)).toBe(1);
    expect(getNextOnboardingIndex(3, 4)).toBe(3);
    expect(getNextOnboardingIndex(-2, 4)).toBe(0);
    expect(getPreviousOnboardingIndex(1)).toBe(0);
    expect(getPreviousOnboardingIndex(0)).toBe(0);
    expect(isLastOnboardingSlide(3, 4)).toBe(true);
    expect(isLastOnboardingSlide(2, 4)).toBe(false);
    expect(getOnboardingProgress(0, ONBOARDING_SLIDES.length)).toEqual([true, false, false, false]);
    expect(getOnboardingProgress(1, 4)).toEqual([false, true, false, false]);
    expect(getOnboardingProgress(3, 4)).toEqual([false, false, false, true]);
    expect(canGoBackOnOnboarding(0)).toBe(false);
    expect(canGoBackOnOnboarding(2)).toBe(true);
    expect(getOnboardingCompletionRoute()).toBe('/settings');
  });

  test('does not present onboarding on onboarding routes', () => {
    expect(
      shouldPresentOnboarding({ hasSeenOnboarding: false, pathname: '/onboarding' })
    ).toBe(false);
    expect(
      shouldPresentOnboarding({ hasSeenOnboarding: true, pathname: '/onboarding' })
    ).toBe(false);
    expect(
      shouldPresentOnboarding({ hasSeenOnboarding: false, pathname: '/onboarding/setup' })
    ).toBe(false);
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

  test('gates app launch based on onboarding completion and pathname', () => {
    expect(
      shouldPresentOnboarding({ hasSeenOnboarding: false, pathname: '/settings' })
    ).toBe(true);
    expect(
      shouldPresentOnboarding({ hasSeenOnboarding: true, pathname: '/settings' })
    ).toBe(false);
    expect(
      shouldPresentOnboarding({ hasSeenOnboarding: false, pathname: '/onboarding' })
    ).toBe(false);
  });
});
