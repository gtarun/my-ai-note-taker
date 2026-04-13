import { StyleSheet, Text, View } from 'react-native';

import { palette, radii, typography } from '../../theme';

export type StatusChipTone = 'secondary' | 'tertiary' | 'danger';

const tones = {
  secondary: { backgroundColor: palette.accentSoft, color: palette.ink },
  tertiary: { backgroundColor: palette.tertiarySoft, color: palette.tertiary },
  danger: { backgroundColor: palette.dangerSoft, color: palette.danger },
} satisfies Record<StatusChipTone, { backgroundColor: string; color: string }>;

export function StatusChip({
  label,
  tone = 'secondary',
}: {
  label: string;
  tone?: StatusChipTone;
}) {
  return (
    <View style={[styles.base, { backgroundColor: tones[tone].backgroundColor }]}>
      <Text style={[styles.label, { color: tones[tone].color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  label: {
    fontSize: 12,
    fontFamily: typography.label.fontFamily,
  },
});
