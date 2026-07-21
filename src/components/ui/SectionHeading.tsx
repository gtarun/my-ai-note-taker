import { Pressable, StyleSheet, Text, View } from 'react-native';

import { typography } from '../../theme';
import { useThemedStyles, type Palette } from '../../hooks/useTheme';

export function SectionHeading({
  title,
  subtitle,
  actionLabel,
  onActionPress,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onActionPress ? (
        <Pressable onPress={onActionPress}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (palette: Palette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: palette.ink,
    ...typography.heading,
    fontSize: 20,
  },
  subtitle: {
    color: palette.mutedInk,
    ...typography.body,
    fontSize: 14,
  },
  action: {
    color: palette.accent,
    ...typography.label,
    fontSize: 13,
  },
});
