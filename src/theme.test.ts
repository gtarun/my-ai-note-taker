import { describe, expect, test } from 'vitest';

import { ambient, palette, radii, resolveTypography, typography } from './theme';

describe('editorial theme contract', () => {
  test('exposes the approved cool-tone palette', () => {
    expect(palette.paper).toBe('#f7fafc');
    expect(palette.card).toBe('#ffffff');
    expect(palette.cardMuted).toBe('#eff4f7');
    expect(palette.cardUtility).toBe('#e8eff2');
    expect(palette.ink).toBe('#2b3437');
    expect(palette.mutedInk).toBe('#576064');
    expect(palette.accent).toBe('#0f57d0');
    expect(palette.accentStrong).toBe('#4e83fe');
    expect(palette.accentSoft).toBe('#d8e3fa');
    expect(palette.tertiary).toBe('#685781');
    expect(palette.tertiarySoft).toBe('#e4ceff');
    expect(palette.line).toBe('#aab3b7');
  });

  test('exposes semantic radius + typography tokens', () => {
    expect(radii.card).toBe(24);
    expect(radii.pill).toBe(999);
    expect(typography.display.fontFamily).toBe('Manrope_800ExtraBold');
    expect(typography.heading.fontFamily).toBe('Manrope_700Bold');
    expect(typography.body.fontFamily).toBe('Inter_400Regular');
    expect(typography.label.fontFamily).toBe('Inter_600SemiBold');
  });

  test('resolves typography with custom fonts when they are available', () => {
    const resolvedTypography = resolveTypography(true);

    expect(resolvedTypography.display.fontFamily).toBe(typography.display.fontFamily);
    expect(resolvedTypography.heading.fontFamily).toBe(typography.heading.fontFamily);
    expect(resolvedTypography.body.fontFamily).toBe(typography.body.fontFamily);
    expect(resolvedTypography.label.fontFamily).toBe(typography.label.fontFamily);
  });

  test('resolves safe system typography fallbacks when custom fonts are unavailable', () => {
    const resolvedTypography = resolveTypography(false);

    expect(resolvedTypography.display.fontFamily).toBeUndefined();
    expect(resolvedTypography.display.fontWeight).toBe('800');
    expect(resolvedTypography.heading.fontFamily).toBeUndefined();
    expect(resolvedTypography.heading.fontWeight).toBe('700');
    expect(resolvedTypography.body.fontFamily).toBeUndefined();
    expect(resolvedTypography.body.fontWeight).toBe('400');
    expect(resolvedTypography.label.fontFamily).toBeUndefined();
    expect(resolvedTypography.label.fontWeight).toBe('600');
  });

  test('keeps transitional palette aliases stable for legacy screens', () => {
    expect(palette.cardStrong).toBe(palette.cardMuted);
    expect(palette.accentMist).toBe(palette.accentSoft);
    expect(palette.lineStrong).toBe(palette.line);
  });

  test('exposes ambient background tokens for editorial chrome', () => {
    expect(ambient.topBlob).toBe('rgba(78, 131, 254, 0.10)');
    expect(ambient.sideBlob).toBe('rgba(104, 87, 129, 0.08)');
    expect(ambient.bottomBlob).toBe('rgba(15, 87, 208, 0.05)');
  });
});
