import { StyleSheet, Text, View } from 'react-native';

import { radii, spacing, type, typography } from '../../theme';
import { useTheme, useThemedStyles, type Palette } from '../../hooks/useTheme';

export type StatusChipTone = 'secondary' | 'tertiary' | 'danger';

/**
 * Tone colours have to be resolved per render.
 *
 * These were a module-scope constant built from the static light palette, so
 * every chip in the app stayed pale mint or pale pink on a dark screen no
 * matter what the theme said — the one thing on the page that hadn't got the
 * message.
 */
function getTone(palette: Palette, tone: StatusChipTone) {
  switch (tone) {
    case 'tertiary':
      return { backgroundColor: palette.claySoft, color: palette.clay };
    case 'danger':
      return { backgroundColor: palette.dangerSoft, color: palette.danger };
    default:
      return { backgroundColor: palette.accentSoft, color: palette.accent };
  }
}

export function StatusChip({
  label,
  tone = 'secondary',
  accessibilityLabel,
}: {
  label: string;
  tone?: StatusChipTone;
  accessibilityLabel?: string;
}) {
  const palette = useTheme();
  const styles = useThemedStyles(makeStyles);
  const toneStyle = getTone(palette, tone);

  return (
    <View
      style={[styles.base, { backgroundColor: toneStyle.backgroundColor }]}
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={[styles.label, { color: toneStyle.color }]}>{label}</Text>
    </View>
  );
}

const makeStyles = (_palette: Palette) =>
  StyleSheet.create({
    base: {
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      borderRadius: radii.pill,
      // Without this the chip stretches to fill its parent column — the
      // "First run" chip rendered as a full-width bar across the screen.
      alignSelf: 'flex-start',
    },
    label: {
      ...typography.label,
      ...type.caption,
    },
  });
