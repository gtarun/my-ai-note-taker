import { StyleSheet, View } from 'react-native';

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
    backgroundColor: 'rgba(78, 131, 254, 0.10)',
  },
  sideBlob: {
    position: 'absolute',
    top: 200,
    left: -60,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: 'rgba(104, 87, 129, 0.08)',
  },
  bottomBlob: {
    position: 'absolute',
    bottom: -40,
    right: 20,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 87, 208, 0.05)',
  },
});
