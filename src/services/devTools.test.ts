import { describe, expect, it, vi } from 'vitest';

// devTools imports expo-constants, which pulls React Native's Flow-typed entry
// point into the transform. Only the pure flag reader is under test here.
vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: {} } },
}));

import { readShowDeveloperToolsFlag } from './devTools';

describe('readShowDeveloperToolsFlag', () => {
  it('is off when the flag is absent', () => {
    // This is the case that matters: a public App Store build must not expose
    // the diagnostics screen, which was previously linked unconditionally.
    expect(readShowDeveloperToolsFlag({})).toBe(false);
    expect(readShowDeveloperToolsFlag(undefined)).toBe(false);
    expect(readShowDeveloperToolsFlag(null)).toBe(false);
  });

  it('is on only for a real boolean true', () => {
    expect(readShowDeveloperToolsFlag({ showDeveloperTools: true })).toBe(true);
  });

  it('does not accept truthy strings, so a stray "false" stays off', () => {
    expect(readShowDeveloperToolsFlag({ showDeveloperTools: 'true' })).toBe(false);
    expect(readShowDeveloperToolsFlag({ showDeveloperTools: 'false' })).toBe(false);
    expect(readShowDeveloperToolsFlag({ showDeveloperTools: 1 })).toBe(false);
  });

  it('is off when explicitly disabled', () => {
    expect(readShowDeveloperToolsFlag({ showDeveloperTools: false })).toBe(false);
  });
});
