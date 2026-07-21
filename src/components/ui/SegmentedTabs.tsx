import { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, type, typography } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useThemedStyles, type Palette } from '../../hooks/useTheme';
import { PressableScale } from './PressableScale';

export type SegmentedTabOption = {
  id: string;
  label: string;
};

const TRACK_PADDING = 3;

/**
 * A two-or-three-way switch between renderings of the same content.
 *
 * Distinct from navigation on purpose: these tabs never change where you are,
 * only which version of the thing in front of you is shown. That is why the
 * indicator slides rather than cross-fading — the movement says "same content,
 * different view", where a fade would say "new content".
 */
export function SegmentedTabs({
  options,
  activeId,
  onChange,
  accessibilityLabel,
}: {
  options: SegmentedTabOption[];
  activeId: string;
  onChange: (id: string) => void;
  accessibilityLabel?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.id === activeId)
  );
  const slide = useRef(new Animated.Value(activeIndex)).current;

  /*
   * Driven by activeId rather than by the press handler, so the indicator still
   * lands correctly when the selection changes from outside — a section
   * collapsing to one tab, or a re-run clearing the English rendering.
   */
  useEffect(() => {
    if (reduceMotion) {
      slide.setValue(activeIndex);
      return;
    }

    Animated.spring(slide, {
      toValue: activeIndex,
      tension: 260,
      friction: 22,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, reduceMotion, slide]);

  // A single tab is not a choice, so rendering a switch for it is noise.
  if (options.length < 2) {
    return null;
  }

  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / options.length : 0;

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      style={styles.track}
      onLayout={handleLayout}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {/*
        Hidden until the track has been measured. React Native cannot translate
        by a percentage, so the position depends on a real width — showing the
        indicator before that arrives puts it under the wrong tab for a frame.
      */}
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: segmentWidth,
              transform: [
                {
                  translateX: slide.interpolate({
                    inputRange: options.map((_, index) => index),
                    outputRange: options.map((_, index) => index * segmentWidth),
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}

      {options.map((option) => {
        const isActive = option.id === activeId;

        return (
          <PressableScale
            key={option.id}
            style={styles.tab}
            scaleTo={0.98}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(option.id)}
          >
            <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: palette.cardUtility,
      borderRadius: radii.pill,
      padding: TRACK_PADDING,
      alignSelf: 'flex-start',
    },
    indicator: {
      position: 'absolute',
      top: TRACK_PADDING,
      bottom: TRACK_PADDING,
      left: TRACK_PADDING,
      borderRadius: radii.pill,
      backgroundColor: palette.card,
    },
    tab: {
      // Equal widths, so the measured segment width matches what is rendered.
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      ...typography.label,
      ...type.caption,
      color: palette.mutedInk,
    },
    labelActive: {
      color: palette.ink,
    },
  });
