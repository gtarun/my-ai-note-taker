import type { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { elevation, palette, radii, spacing } from '../../theme';
import { useThemedStyles, type Palette } from '../../hooks/useTheme';

/**
 * Surfaces, in three weights.
 *
 * One card style previously carried everything from a screen hero to a settings
 * toggle row — same radius, same border, same 24px-blur shadow, 71 times. A
 * shadow on everything means hierarchy on nothing, so depth now has to be
 * chosen:
 *
 * - `flat`    grouped rows and inline surfaces; no shadow, no border
 * - `raised`  the default card; a barely-there shadow
 * - `floating` sheets and the record bar; genuinely above the page
 */
export type SurfaceLevel = 'flat' | 'raised' | 'floating';

export function SurfaceCard({
  children,
  style,
  muted,
  level = 'raised',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Recedes into the page — use for secondary or supporting content. */
  muted?: boolean;
  level?: SurfaceLevel;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View
      style={[
        styles.base,
        level === 'flat' && styles.flat,
        level === 'raised' && styles.raised,
        level === 'floating' && styles.floating,
        muted && styles.muted,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const makeStyles = (palette: Palette) => StyleSheet.create({
  base: {
    backgroundColor: palette.card,
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  flat: {
    ...elevation.flat,
    backgroundColor: palette.cardMuted,
  },
  raised: {
    ...elevation.raised,
    borderWidth: 1,
    borderColor: palette.lineSoft,
  },
  floating: {
    ...elevation.floating,
    borderWidth: 1,
    borderColor: palette.lineSoft,
  },
  muted: {
    backgroundColor: palette.cardMuted,
    borderColor: 'transparent',
  },
});
