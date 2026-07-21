import { describe, expect, it, vi } from 'vitest';

const { schemeState } = vi.hoisted(() => ({ schemeState: { value: 'light' as string | null } }));

vi.mock('react-native', () => ({
  useColorScheme: () => schemeState.value,
  Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default },
}));

import { getPalette } from '../theme';

describe('palette selection', () => {
  it('returns a legible accent on both grounds', () => {
    // A single accent cannot serve both: the light viridian disappears on a
    // dark ground, so dark brightens rather than reusing it.
    expect(getPalette('light').accent).not.toBe(getPalette('dark').accent);
  });

  it('keeps every token defined in both schemes', () => {
    // A token missing from one palette renders as `undefined`, which React
    // Native silently treats as "no colour" rather than failing.
    const light = getPalette('light');
    const dark = getPalette('dark');

    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
    for (const [key, value] of Object.entries(dark)) {
      expect(value, `dark.${key} should be defined`).toBeTruthy();
    }
  });

  it('exposes the legacy aliases on both palettes', () => {
    // These previously existed only on the light module-scope export, so a
    // themed component would lose them the moment it switched to dark.
    for (const scheme of ['light', 'dark'] as const) {
      const p = getPalette(scheme);
      expect(p.cardStrong).toBe(p.cardMuted);
      expect(p.accentMist).toBe(p.accentSoft);
      expect(p.tertiary).toBe(p.clay);
    }
  });

  it('inverts the ground between schemes', () => {
    expect(getPalette('dark').paper).toBe('#0e1312');
    expect(getPalette('light').paper).toBe('#f4f2ec');
  });
});

describe('useColorSchemeName', () => {
  it('follows the system appearance', async () => {
    const { useColorSchemeName } = await import('./useTheme');

    schemeState.value = 'dark';
    expect(useColorSchemeName()).toBe('dark');

    schemeState.value = 'light';
    expect(useColorSchemeName()).toBe('light');
  });

  it('falls back to light when the system reports nothing', async () => {
    // useColorScheme returns null on some platforms and during early startup.
    const { useColorSchemeName } = await import('./useTheme');

    schemeState.value = null;
    expect(useColorSchemeName()).toBe('light');
  });
});
