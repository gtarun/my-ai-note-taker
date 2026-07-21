import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { motion, palette } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { PressableScale } from './PressableScale';

/**
 * The record control.
 *
 * The inner shape carries the state — a circle at rest, a rounded square while
 * recording — which is the convention every hardware recorder and Apple's own
 * Voice Memos uses. That means the surrounding label confirms what is happening
 * rather than being the only thing that says it.
 *
 * A ring pulses outward while live. It is the one piece of ambient motion in
 * the app, and it is tied to a real state rather than being decoration.
 */
export function RecordButton({
  isRecording,
  onPress,
  disabled,
  accessibilityLabel,
  size = 72,
}: {
  isRecording: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  size?: number;
}) {
  const morph = useRef(new Animated.Value(isRecording ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    Animated.spring(morph, {
      toValue: isRecording ? 1 : 0,
      tension: 200,
      friction: 16,
      useNativeDriver: false, // borderRadius and size are not native-drivable
    }).start();
  }, [isRecording, morph]);

  useEffect(() => {
    if (!isRecording || reduceMotion) {
      pulse.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );

    animation.start();
    return () => animation.stop();
  }, [isRecording, pulse, reduceMotion]);

  const innerSize = morph.interpolate({
    inputRange: [0, 1],
    outputRange: [size * 0.38, size * 0.3],
  });
  const innerRadius = morph.interpolate({
    inputRange: [0, 1],
    outputRange: [size * 0.19, 6],
  });

  return (
    <View style={styles.wrap}>
      {isRecording && !reduceMotion ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: palette.clay,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
              transform: [
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) },
              ],
            },
          ]}
        />
      ) : null}

      <PressableScale
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ busy: isRecording }}
        scaleTo={motion.press.scale - 0.01}
        style={[
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: palette.clay,
          },
          disabled && styles.disabled,
        ]}
      >
        <Animated.View
          style={{
            width: innerSize,
            height: innerSize,
            borderRadius: innerRadius,
            backgroundColor: palette.paper,
          }}
        />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2 },
  button: { alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
