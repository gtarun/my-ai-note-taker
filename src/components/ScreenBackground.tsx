import { StyleSheet, View } from 'react-native';

import { ambient } from '../theme';

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
    top: -90,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: ambient.topBlob,
  },
  sideBlob: {
    position: 'absolute',
    top: 200,
    left: -60,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: ambient.sideBlob,
  },
  bottomBlob: {
    position: 'absolute',
    bottom: -40,
    right: 20,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: ambient.bottomBlob,
  },
});
