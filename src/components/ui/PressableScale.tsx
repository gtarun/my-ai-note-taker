import type { ReactNode } from 'react';
import { useRef } from 'react';
import {
  AccessibilityRole,
  AccessibilityState,
  Animated,
  Pressable,
  StyleProp,
  ViewStyle,
} from 'react-native';

import { motion } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * The app's press feel, in one place.
 *
 * Nothing in the interface previously responded to touch — the primary button
 * had no pressed style at all, across forty-plus call sites. On iOS a control
 * that does not answer the finger reads as broken, and it was the single
 * largest gap between this app and one that feels native.
 *
 * A spring rather than a timing curve so a quick double-tap does not queue up
 * two animations behind each other.
 */
export function PressableScale({
  children,
  onPress,
  disabled,
  style,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityState,
  accessibilityHint,
  hitSlop,
  scaleTo = motion.press.scale,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  accessibilityHint?: string;
  hitSlop?: number;
  scaleTo?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReducedMotion();

  const springTo = (value: number) => {
    if (reduceMotion) {
      return;
    }

    Animated.spring(scale, {
      toValue: value,
      tension: motion.press.tension,
      friction: motion.press.friction,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => springTo(scaleTo)}
      onPressOut={() => springTo(1)}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled), ...accessibilityState }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
