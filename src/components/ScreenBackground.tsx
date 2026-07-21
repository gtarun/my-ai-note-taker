import { StyleSheet, View } from 'react-native';

import { palette } from '../theme';

/**
 * The page ground.
 *
 * This used to render three static translucent circles behind every screen —
 * decoration that carried no meaning, responded to nothing, and was the first
 * thing that dated the interface. The ground is now just the paper colour, so
 * the content and the single accent are the only things asking for attention.
 *
 * Kept as a component rather than deleted so there is still one place to change
 * if the ground ever gains a texture or gradient.
 */
export function ScreenBackground() {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ground]} />;
}

const styles = StyleSheet.create({
  ground: {
    backgroundColor: palette.paper,
  },
});
