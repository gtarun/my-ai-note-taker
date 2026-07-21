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

/**
 * Contrast is the one part of a palette that cannot be judged by eye — a colour
 * can look fine and still be unreadable for someone else, and the failure only
 * shows up in a review or a complaint.
 */
function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('contrast', () => {
  it('keeps body text above the WCAG AA threshold on both grounds', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const p = getPalette(scheme);

      for (const ground of [p.paper, p.card] as const) {
        for (const text of [p.ink, p.mutedInk, p.faintInk] as const) {
          // faintInk carries timestamps and durations at 12px — body text, so
          // the large-text allowance does not apply to it.
          expect(
            contrastRatio(text, ground),
            `${scheme}: ${text} on ${ground}`
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('keeps the accent legible enough for buttons and icons', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const p = getPalette(scheme);
      // 3:1 is the WCAG floor for UI components and graphical objects.
      expect(contrastRatio(p.accent, p.paper), `${scheme} accent`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(p.clay, p.paper), `${scheme} clay`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps white content legible on a filled control', () => {
    // clay and clayFill exist separately because they have opposite jobs: one
    // is read against the page, the other is read *against*. Sharing a token
    // produced a record button whose dot looked like a punched hole.
    for (const scheme of ['light', 'dark'] as const) {
      const p = getPalette(scheme);

      expect(contrastRatio(p.onFill, p.clayFill), `${scheme} onFill/clayFill`).toBeGreaterThanOrEqual(4);
      // And the control still has to separate from the page behind it.
      expect(contrastRatio(p.clayFill, p.paper), `${scheme} clayFill/paper`).toBeGreaterThanOrEqual(3);
    }
  });
});