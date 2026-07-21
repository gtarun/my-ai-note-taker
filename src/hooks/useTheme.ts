import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { getPalette, type ColorScheme } from '../theme';

export type Palette = ReturnType<typeof getPalette>;

/**
 * The active palette, following the system appearance.
 *
 * The app previously imported a frozen `palette` object at module scope and
 * built every StyleSheet from it, so appearance was decided once at import and
 * could never change — which is why `userInterfaceStyle` was pinned to light in
 * app.json. A recorder gets used in dim rooms; a bright screen in a meeting is
 * both unpleasant and conspicuous.
 */
export function useColorSchemeName(): ColorScheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

export function useTheme(): Palette {
  const scheme = useColorSchemeName();
  return useMemo(() => getPalette(scheme), [scheme]);
}

/**
 * Builds a StyleSheet from the active palette, rebuilding only when the
 * appearance actually changes.
 *
 * `factory` must be defined at module scope. Declaring it inside a component
 * would produce a new function identity on every render and defeat the memo,
 * rebuilding every stylesheet on every frame.
 */
export function useThemedStyles<T>(factory: (palette: Palette) => T): T {
  const palette = useTheme();
  return useMemo(() => factory(palette), [factory, palette]);
}
