import { Feather } from '@expo/vector-icons';
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
  const initials = getProfileInitials({
    name: name ?? null,
    email: email ?? null,
  });

  return (
    <Pressable
      accessibilityLabel="Open profile"
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      {avatarUrl ? (
        <Image resizeMode="cover" source={{ uri: avatarUrl }} style={styles.image} />
      ) : (
        <View style={styles.fallback}>
          {initials ? (
            <Text style={styles.initials}>{initials}</Text>
          ) : (
            <Feather color={palette.accent} name="user" size={16} />
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    marginRight: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.lineSoft,
  },
  pressed: {
    opacity: 0.72,
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
