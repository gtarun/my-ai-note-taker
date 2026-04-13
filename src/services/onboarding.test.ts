import { describe, expect, test, vi } from 'vitest';

vi.mock('../db', () => ({
  getDatabase: () => ({
    getFirstAsync: vi.fn(),
    runAsync: vi.fn(),
  }),
}));

import {
  buildHasSeenOnboardingValue,
  mapHasSeenOnboardingValue,
} from './onboarding';

describe('onboarding service', () => {
  test('maps stored onboarding values to booleans', () => {
    expect(mapHasSeenOnboardingValue(1)).toBe(true);
    expect(mapHasSeenOnboardingValue(0)).toBe(false);
    expect(mapHasSeenOnboardingValue(null)).toBe(false);
    expect(mapHasSeenOnboardingValue(undefined)).toBe(false);
  });

  test('builds onboarding values for storage', () => {
    expect(buildHasSeenOnboardingValue(true)).toBe(1);
    expect(buildHasSeenOnboardingValue(false)).toBe(0);
  });
});
