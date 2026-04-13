import { describe, expect, test } from 'vitest';

import { getStartupPresentation } from './startup';

describe('getStartupPresentation', () => {
  test('keeps the app in loading while bootstrap is still running', () => {
    expect(
      getStartupPresentation({
        isReady: false,
        error: null,
        fontsLoaded: false,
        fontsError: null,
      }),
    ).toEqual({
      screen: 'loading',
      useCustomFonts: false,
    });
  });

  test('prefers the bootstrap error screen for fatal startup errors', () => {
    expect(
      getStartupPresentation({
        isReady: true,
        error: 'Bootstrap failed',
        fontsLoaded: true,
        fontsError: null,
      }),
    ).toEqual({
      screen: 'error',
      useCustomFonts: false,
    });
  });

  test('uses custom fonts only after they are loaded', () => {
    expect(
      getStartupPresentation({
        isReady: true,
        error: null,
        fontsLoaded: true,
        fontsError: null,
      }),
    ).toEqual({
      screen: 'ready',
      useCustomFonts: true,
    });
  });

  test('falls back to system fonts when font assets fail to load', () => {
    expect(
      getStartupPresentation({
        isReady: true,
        error: null,
        fontsLoaded: false,
        fontsError: new Error('Font fetch failed'),
      }),
    ).toEqual({
      screen: 'ready',
      useCustomFonts: false,
    });
  });
});
