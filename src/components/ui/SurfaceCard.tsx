import type { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { elevation, palette, radii } from '../../theme';

export function SurfaceCard({
  children,
  style,
  muted,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  muted?: boolean;
}) {
  return <View style={[styles.base, muted && styles.muted, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: palette.card,
    borderRadius: radii.card,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.lineSoft,
    ...elevation.card,
  },
  muted: {
    backgroundColor: palette.cardMuted,
  },
});
