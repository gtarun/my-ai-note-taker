import { describe, expect, test, vi } from 'vitest';

// theme.ts uses Platform.select for the iOS serif; importing the real module
// pulls React Native's Flow-typed entry point into the transform.
vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (options: Record<string, unknown>) =>
      'ios' in options ? options.ios : options.default,
  },
}));

import {
  elevation,
  getPalette,
  motion,
  palette,
  radii,
  resolveTypography,
  spacing,
  type,
  typography,
} from './theme';

describe('design tokens', () => {
  test('grounds the interface in warm neutrals rather than cold blue-grey', () => {
    // The previous palette paired #f7fafc paper with a generic SaaS blue. The
    // neutral is now chosen — pulled warm and slightly green so it sits under
    // the viridian accent instead of fighting it.
    expect(palette.paper).toBe('#f4f2ec');
    expect(palette.ink).toBe('#141a19');
    expect(palette.accent).toBe('#0b6e5f');
  });

  test('reserves the lit accent so saturation stays earned', () => {
    // The system rule: nothing in the interface may be brighter than the audio
    // currently coming in. `accentLit` exists only for an open microphone.
    expect(palette.accentLit).toBe('#12a184');
    expect(palette.accentLit).not.toBe(palette.accent);
  });

  test('keeps clay distinct from the accent so record always means record', () => {
    expect(palette.clay).toBe('#c2603c');
    expect(palette.clay).not.toBe(palette.accent);
  });

  test('ships a dark palette so the switch is wiring, not a redesign', () => {
    const dark = getPalette('dark');
    const light = getPalette('light');

    expect(dark.paper).not.toBe(light.paper);
    expect(dark.ink).not.toBe(light.ink);
    // Both grounds need a legible accent, so dark brightens rather than reusing.
    expect(dark.accent).toBe('#37d6a8');
    expect(light.paper).toBe('#f4f2ec');
  });

  test('exposes three elevation weights so depth has to be chosen', () => {
    // One shadow previously applied to all 71 cards, which meant a hero and a
    // toggle row sat at the same visual depth.
    expect(elevation.flat.shadowOpacity).toBe(0);
    expect(elevation.raised.shadowOpacity).toBeLessThan(elevation.floating.shadowOpacity);
    expect(elevation.raised.shadowRadius).toBeLessThan(elevation.floating.shadowRadius);
  });

  test('exposes a type scale rather than per-screen font sizes', () => {
    expect(type.display.fontSize).toBeGreaterThan(type.title.fontSize);
    expect(type.title.fontSize).toBeGreaterThan(type.heading.fontSize);
    expect(type.heading.fontSize).toBeGreaterThan(type.body.fontSize);
    expect(type.body.fontSize).toBeGreaterThan(type.caption.fontSize);
    // Display sizes get negative tracking; small text does not.
    expect(type.display.letterSpacing).toBeLessThan(0);
  });

  test('uses tabular figures for timers so digits do not jitter', () => {
    expect(typography.mono.fontVariant).toContain('tabular-nums');
  });

  test('exposes a spacing ramp on a 4pt base', () => {
    const ramp = [spacing.xs, spacing.sm, spacing.md, spacing.lg, spacing.xl, spacing.xxl];

    expect(ramp).toEqual([...ramp].sort((a, b) => a - b));
    expect(ramp.every((step) => step % 4 === 0)).toBe(true);
  });

  test('caps the list stagger so long lists do not cascade', () => {
    // Every card previously animated on every focus, including on return.
    expect(motion.stagger.maxItems).toBeLessThanOrEqual(6);
    expect(motion.press.scale).toBeLessThan(1);
  });

  test('falls back to system faces when the serif is unavailable', () => {
    const fallback = resolveTypography(false);

    expect(fallback.display.fontFamily).toBeUndefined();
    expect(fallback.display.fontWeight).toBe('700');
    expect(fallback.body.fontWeight).toBe('400');
  });

  test('keeps legacy aliases alive while screens migrate', () => {
    expect(palette.cardStrong).toBe(palette.cardMuted);
    expect(palette.accentMist).toBe(palette.accentSoft);
    expect(palette.lineStrong).toBe(palette.line);
    expect(radii.pill).toBe(999);
  });
});
