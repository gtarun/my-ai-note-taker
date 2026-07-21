import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { motion, palette, radii, spacing } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useThemedStyles, type Palette } from '../../hooks/useTheme';

/**
 * Loading placeholders shaped like the content that is coming.
 *
 * The app's only loading affordances were a bare `ActivityIndicator` and, on
 * the settings screen, the literal words "Loading settings…". A skeleton shaped
 * like the answer tells the eye where to wait; a spinner tells it nothing.
 */
export function Skeleton({
  width = '100%',
  height = 12,
  radius = radii.sm,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: motion.shimmer.duration / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: motion.shimmer.duration / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulse, reduceMotion]);

  const opacity = reduceMotion
    ? 0.5
    : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: palette.line, opacity }, style]}
    />
  );
}

/**
 * A paragraph-shaped run of skeleton lines. The last line is short, the way a
 * real paragraph ends, so the placeholder reads as prose rather than as bars.
 */
export function SkeletonParagraph({
  lines = 3,
  style,
}: {
  lines?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(makeStyles);
  // Deterministic widths — random ones shift on every re-render and flicker.
  const widths: `${number}%`[] = ['100%', '94%', '97%', '88%', '92%'];

  return (
    <View
      style={[styles.paragraph, style]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          height={11}
          width={index === lines - 1 ? '62%' : widths[index % widths.length]}
        />
      ))}
    </View>
  );
}

const makeStyles = (palette: Palette) => StyleSheet.create({
  paragraph: {
    gap: spacing.sm,
  },
});
