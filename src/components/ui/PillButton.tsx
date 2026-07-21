import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette, radii, spacing, type, typography } from '../../theme';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * The app's primary control.
 *
 * Now presses. Previously this rendered a bare `Pressable` with no pressed
 * state and no `accessibilityRole`, so VoiceOver announced the label as static
 * text rather than as a button — across every one of its call sites.
 */
export function PillButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  accessibilityLabel,
  accessibilityHint,
  fullWidth,
}: {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  variant?: Variant;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  fullWidth?: boolean;
}) {
  const isFilled = variant === 'primary' || variant === 'danger';

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.label, isFilled ? styles.filledLabel : styles.plainLabel]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  fullWidth: { alignSelf: 'stretch' },
  primary: { backgroundColor: palette.accent },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.line,
  },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: palette.danger },
  disabled: { opacity: 0.4 },
  icon: { alignItems: 'center', justifyContent: 'center' },
  label: {
    ...typography.label,
    fontSize: type.body.fontSize,
    letterSpacing: -0.1,
  },
  filledLabel: { color: palette.paper },
  plainLabel: { color: palette.ink },
});
