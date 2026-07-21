import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme, useThemedStyles, type Palette } from '../../hooks/useTheme';

/**
 * The audio, drawn as audio.
 *
 * The app records, meters and streams a live transcript, and previously showed
 * none of it — the recording screen was a timer in a box. Recording is the
 * moment a user most doubts the thing is working, so this exists to answer that
 * doubt continuously.
 *
 * Built from plain views driven by `scaleY` rather than SVG or Skia: it needs
 * no new native dependency, and transform-only animation stays on the native
 * driver, so the bars keep moving even while JS is busy transcribing.
 */

/** Bars sit still at this fraction of full height when there is no signal. */
const FLOOR = 0.08;

export function Waveform({
  /** Current input level, 0–1. Feed it from the recorder's metering. */
  level = 0,
  bars = 32,
  height = 96,
  color,
  /** 0–1. Bars past this point dim — used as a playback scrub track. */
  progress,
  style,
}: {
  level?: number;
  bars?: number;
  height?: number;
  /** Defaults to the lit accent — the colour reserved for an open microphone. */
  color?: string;
  progress?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = useTheme();
  const styles = useThemedStyles(makeStyles);
  const reduceMotion = useReducedMotion();
  const barColor = color ?? palette.accentLit;

  // Stable per-bar phase offsets, so the shape reads as a clip rather than a
  // bar chart. Generated once — regenerating per render would make it jitter.
  const phases = useMemo(
    () => Array.from({ length: bars }, (_, index) => (index * 137.5) % (Math.PI * 2)),
    [bars]
  );

  // Envelope: quieter at the edges, fuller in the middle.
  const envelopes = useMemo(
    () =>
      Array.from({ length: bars }, (_, index) => {
        const position = bars <= 1 ? 0.5 : index / (bars - 1);
        return 0.4 + Math.sin(position * Math.PI) * 0.6;
      }),
    [bars]
  );

  const values = useRef<Animated.Value[]>([]);
  if (values.current.length !== bars) {
    values.current = Array.from({ length: bars }, () => new Animated.Value(FLOOR));
  }

  const frame = useRef(0);
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelRef = useRef(level);
  levelRef.current = level;

  useEffect(() => {
    if (reduceMotion) {
      values.current.forEach((value) => value.setValue(FLOOR + 0.25));
      return;
    }

    // A timer rather than requestAnimationFrame: 20fps is plenty for a bar
    // meter, and it leaves the main thread free during transcription.
    raf.current = setInterval(() => {
      frame.current += 1;
      const t = frame.current;

      values.current.forEach((value, index) => {
        const wobble =
          (Math.sin(t / 3.2 + phases[index]) + Math.sin(t / 1.7 + phases[index] * 1.7)) / 2;
        const target = FLOOR + Math.abs(wobble) * envelopes[index] * levelRef.current;

        Animated.spring(value, {
          toValue: Math.min(1, target),
          tension: 120,
          friction: 9,
          useNativeDriver: true,
        }).start();
      });
    }, 50);

    return () => {
      if (raf.current) {
        clearInterval(raf.current);
        raf.current = null;
      }
    };
  }, [bars, envelopes, phases, reduceMotion]);

  return (
    <View
      style={[styles.row, { height }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {values.current.map((value, index) => {
        const isPast = progress != null && index / bars > progress;

        return (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                height,
                backgroundColor: barColor,
                opacity: isPast ? 0.25 : 1,
                transform: [{ scaleY: value }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const makeStyles = (palette: Palette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 3,
  },
  bar: {
    flex: 1,
    borderRadius: 999,
    minWidth: 2,
  },
});
