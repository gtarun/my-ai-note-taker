import { Feather } from '@expo/vector-icons';
import type { ImageSourcePropType } from 'react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { getProfileInitials } from '../features/account/presentation';
import { palette, radii, typography } from '../theme';

export function ProfileAvatarButton({
  name,
  email,
  avatarUrl,
  onPress,
}: {
  name: string | null | undefined;
  email: string | null | undefined;
  avatarUrl: string | null | undefined;
  onPress: () => void;
}) {
  const initials = getProfileInitials(name, email);
  const imageSource: ImageSourcePropType | null = avatarUrl ? { uri: avatarUrl } : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open profile"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <View style={styles.shell}>
        {imageSource ? (
          <Image source={imageSource} style={styles.image} resizeMode="cover" />
        ) : initials ? (
          <View style={styles.fallback}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
        ) : (
          <View style={styles.fallback}>
            <Feather name="user" size={16} color={palette.accent} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginRight: 8,
  },
  pressed: {
    opacity: 0.72,
  },
  shell: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.lineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cardMuted,
  },
  initials: {
    color: palette.accent,
    fontFamily: typography.label.fontFamily,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
