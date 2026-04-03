import { StyleSheet, View } from 'react-native';

import { palette } from '../theme';

export function ScreenBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.topBlob} />
      <View style={styles.sideBlob} />
      <View style={styles.bottomBlob} />
    </View>
  );
}

const styles = StyleSheet.create({
  topBlob: {
    position: 'absolute',
    top: -70,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: palette.accentMist,
  },
  sideBlob: {
    position: 'absolute',
    top: 180,
    left: -50,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: palette.rose,
    opacity: 0.45,
  },
  bottomBlob: {
    position: 'absolute',
    bottom: -40,
    right: 24,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: palette.sun,
    opacity: 0.18,
  },
});
