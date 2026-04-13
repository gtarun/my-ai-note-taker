import { describe, expect, test } from 'vitest';

import { palette, radii, typography } from './theme';

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

  test('keeps transitional palette aliases stable for legacy screens', () => {
    expect(palette.cardStrong).toBe(palette.cardMuted);
    expect(palette.accentMist).toBe(palette.accentSoft);
    expect(palette.lineStrong).toBe(palette.line);
  });
});
