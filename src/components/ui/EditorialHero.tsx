import { StyleSheet, Text, View } from 'react-native';

import { palette, radii, typography } from '../../theme';
import { StatusChip } from './StatusChip';
import { SurfaceCard } from './SurfaceCard';

export function EditorialHero({
  eyebrow,
  title,
  body,
  pillLabel,
  chips = [],
}: {
  eyebrow: string;
  title: string;
  body: string;
  pillLabel?: string;
  chips?: string[];
}) {
  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        {pillLabel ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{pillLabel}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {!!chips.length && (
        <View style={styles.chips}>
          {chips.map((chip) => (
            <StatusChip key={chip} label={chip} tone="secondary" />
          ))}
        </View>
      )}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  eyebrow: {
    flex: 1,
    color: palette.accent,
    fontFamily: typography.label.fontFamily,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: palette.cardMuted,
  },
  pillText: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 12,
  },
  title: {
    color: palette.ink,
    fontFamily: typography.display.fontFamily,
    fontSize: 30,
    lineHeight: 34,
  },
  body: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    lineHeight: 22,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
