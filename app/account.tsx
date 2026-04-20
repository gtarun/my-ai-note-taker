import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FadeInView } from '../src/components/FadeInView';
import { ScreenBackground } from '../src/components/ScreenBackground';
import {
  formatBuildVersion,
  getProfileInitials,
} from '../src/features/account/presentation';
import {
  clearAuthSession,
  completeOAuthSignIn,
  getAuthSession,
  getGoogleDriveConnectUrl,
  getGoogleDriveOAuthRedirectUrl,
  getOAuthRedirectUrl,
  isCloudBackendConfigured,
  refreshCurrentSession,
  requestGoogleDriveFolderPickerUrl,
  saveGoogleDriveSaveFolder,
  signInWithGoogle,
} from '../src/services/account';
import { AuthSession } from '../src/types';
import { elevation, palette, radii, typography } from '../src/theme';

WebBrowser.maybeCompleteAuthSession();

function firstQueryParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function readTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getBuildInfo() {
  const expoConfig = Constants.expoConfig;
  const appVersion = readTrimmedString(expoConfig?.version) || 'dev';
  const iosBuildNumber = readTrimmedString(expoConfig?.ios?.buildNumber);
  const androidVersionCode = expoConfig?.android?.versionCode;
  const nativeBuildVersion = readTrimmedString((Constants as { nativeBuildVersion?: string | null }).nativeBuildVersion);

  const buildNumber =
    iosBuildNumber ||
    (typeof androidVersionCode === 'number' ? String(androidVersionCode) : '') ||
    nativeBuildVersion;

  const versionLabel = formatBuildVersion({
    appVersion,
    buildNumber,
  });

  return {
    appVersion,
    buildNumber: typeof buildNumber === 'string' ? buildNumber.trim() : '',
    versionLabel,
  };
}

export default function AccountScreen() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isPickingDriveFolder, setIsPickingDriveFolder] = useState(false);
  const isConfigured = isCloudBackendConfigured();

  const loadState = useCallback(async () => {
    try {
      const storedSession = await getAuthSession();
      setSession(storedSession);
    } catch {
      setSession(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadState();
    }, [loadState])
  );

  useEffect(() => {
    const handleUrl = async ({ url }: { url: string }) => {
      const redirectPrefix = getOAuthRedirectUrl();

      if (!url.startsWith(redirectPrefix)) {
        return;
      }

      if (!url.includes('code=')) {
        return;
      }

      try {
        const nextSession = await completeOAuthSignIn(url);
        setSession(nextSession);
        Alert.alert('Signed in', 'Google sign-in completed.');
      } catch (error) {
        Alert.alert(
          'Google sign-in failed',
          error instanceof Error ? error.message : 'Unable to finish Google sign-in.'
        );
      } finally {
        setIsGoogleSubmitting(false);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const nextSession = await refreshCurrentSession();
      setSession(nextSession);
    } catch (error) {
      Alert.alert('Refresh failed', error instanceof Error ? error.message : 'Unable to refresh account data.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleSubmitting(true);
      const url = await signInWithGoogle();
      const redirectUrl = getOAuthRedirectUrl();
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);

      if (result.type === 'success' && result.url) {
        const nextSession = await completeOAuthSignIn(result.url);
        setSession(nextSession);
        Alert.alert('Signed in', 'Google sign-in completed.');
        return;
      }

      if (result.type !== 'cancel') {
        Alert.alert('Google sign-in', 'Google sign-in was not completed.');
      }
    } catch (error) {
      Alert.alert(
        'Google sign-in failed',
        error instanceof Error ? error.message : 'Unable to start Google sign-in.'
      );
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleChooseDriveSaveFolder = async () => {
    try {
      setIsPickingDriveFolder(true);
      const redirectBase = Linking.createURL('drive-folder');
      const pickerUrl = await requestGoogleDriveFolderPickerUrl(redirectBase);
      const result = await WebBrowser.openAuthSessionAsync(pickerUrl, redirectBase);

      if (result.type === 'success' && result.url) {
        const parsed = Linking.parse(result.url);
        const folderId = firstQueryParam(parsed.queryParams?.folderId);
        const folderName = firstQueryParam(parsed.queryParams?.folderName);
        const cancelled = firstQueryParam(parsed.queryParams?.picker) === 'cancelled';

        if (cancelled) {
          return;
        }

        if (folderId) {
          await saveGoogleDriveSaveFolder(folderId, folderName ?? '');
          const nextSession = await refreshCurrentSession();
          setSession(nextSession);
          Alert.alert(
            'Google Drive',
            'Save folder updated. New recordings are stored under mu-fathom/recordings/YYYY-MM inside this folder.'
          );
        }
      }
    } catch (error) {
      Alert.alert(
        'Folder picker',
        error instanceof Error ? error.message : 'Unable to choose a Google Drive folder.'
      );
    } finally {
      setIsPickingDriveFolder(false);
    }
  };

  const handleConnectDrive = async () => {
    try {
      setIsConnectingDrive(true);
      const authUrl = await getGoogleDriveConnectUrl();
      const redirectUrl = getGoogleDriveOAuthRedirectUrl();
      if (!redirectUrl) {
        throw new Error('Supabase URL is not configured.');
      }

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      if (result.type === 'success' && result.url) {
        const parsed = Linking.parse(result.url);
        const driveStatus = firstQueryParam(parsed.queryParams?.drive);
        const driveError = firstQueryParam(parsed.queryParams?.error);

        if (driveStatus === 'error') {
          throw new Error(driveError || 'Google Drive connection failed.');
        }

        const nextSession = await refreshCurrentSession();
        setSession(nextSession);
        Alert.alert('Google Drive', 'Connected. Your account has been updated.');
        return;
      }

      if (result.type !== 'cancel') {
        Alert.alert('Google Drive', 'Connection was not completed.');
      }
    } catch (error) {
      Alert.alert(
        'Drive connect failed',
        error instanceof Error ? error.message : 'Unable to start Google Drive connection.'
      );
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleSignOut = async () => {
    await clearAuthSession();
    setSession(null);
  };

  const driveConnection = session?.user.driveConnection;
  const initials = getProfileInitials({
    name: session?.user.name ?? null,
    email: session?.user.email ?? null,
  });
  const buildInfo = useMemo(() => getBuildInfo(), []);
  const displayName = session?.user.name?.trim() || session?.user.email || 'Your profile';
  const emailLabel = session?.user.email ?? 'Sign in with Google to sync your identity, backups, and Sheets.';
  const driveStatusCopy =
    driveConnection?.status === 'connected'
      ? 'Connected and ready for backups and Google Sheets sync.'
      : 'Not connected yet. Connect the same Google account to enable Drive backups.';
  const driveFolderCopy =
    driveConnection?.status === 'connected'
      ? driveConnection.saveFolderName?.trim() || 'Not chosen yet - pick a folder for cloud copies of recordings.'
      : 'Choose a Drive save folder after connecting your Google account.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <FadeInView style={styles.hero}>
          <View style={styles.profileRow}>
            {session?.user.avatarUrl ? (
              <Image resizeMode="cover" source={{ uri: session.user.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                {initials ? (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                ) : (
                  <Feather color={palette.accent} name="user" size={34} />
                )}
              </View>
            )}

            <View style={styles.identityBlock}>
              <Text style={styles.eyebrow}>{session ? 'Profile hub' : 'Welcome'}</Text>
              <Text style={styles.displayName}>{displayName}</Text>
              <Text style={styles.email}>{emailLabel}</Text>
            </View>
          </View>

          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <MaterialCommunityIcons
                color={session ? palette.accent : palette.mutedInk}
                name={session ? 'check-decagram-outline' : 'account-outline'}
                size={16}
              />
              <Text style={styles.heroBadgeText}>{session ? 'Signed in with Google' : 'Sign in to personalize'}</Text>
            </View>
            {!isConfigured ? (
              <Text style={styles.inlineHint}>Cloud backend is not configured on this build.</Text>
            ) : null}
          </View>

          <Text style={styles.heroBody}>
            {session
              ? 'Manage your Google account connection, refresh account details, and keep Drive backups pointed at the right folder.'
              : 'This profile page becomes your control center for Google sign-in, Drive backups, and Sheets sync once you connect your account.'}
          </Text>

          {!session ? (
            <Pressable
              style={styles.primaryButton}
              onPress={handleGoogleSignIn}
              disabled={isGoogleSubmitting || !isConfigured}
            >
              <Text style={styles.primaryButtonText}>
                {isGoogleSubmitting ? 'Opening Google...' : 'Continue with Google'}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.buttonRow}>
              <Pressable
                style={styles.secondaryButton}
                onPress={handleRefresh}
                disabled={isRefreshing}
              >
                <Text style={styles.secondaryButtonText}>{isRefreshing ? 'Refreshing...' : 'Refresh'}</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={handleSignOut}>
                <Text style={styles.secondaryButtonText}>Sign out</Text>
              </Pressable>
            </View>
          )}
        </FadeInView>

        <FadeInView style={styles.card} delay={40}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Google account</Text>
            <Text style={styles.cardStatus}>{session ? 'Active session' : 'Signed out'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Identity</Text>
            <Text style={styles.infoValue}>
              {session ? `${session.user.name?.trim() || session.user.email}\n${session.user.email}` : 'No Google account connected yet.'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Google integration</Text>
            <Text style={styles.infoValue}>
              {session
                ? 'Ready to connect Drive using the same Google account.'
                : 'Sign in first, then connect Drive and choose where recordings are backed up.'}
            </Text>
          </View>
        </FadeInView>

        <FadeInView style={styles.card} delay={80}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Drive backup</Text>
            <Text style={styles.cardStatus}>
              {driveConnection?.status === 'connected' ? 'Connected' : 'Not connected'}
            </Text>
          </View>

          {driveConnection?.accountEmail ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Drive account</Text>
              <Text style={styles.infoValue}>{driveConnection.accountEmail}</Text>
            </View>
          ) : null}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={styles.infoValue}>{driveStatusCopy}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Save folder</Text>
            <Text style={styles.infoValue}>{driveFolderCopy}</Text>
          </View>

          {session ? (
            <>
              <Pressable
                style={styles.primaryButton}
                onPress={handleConnectDrive}
                disabled={isConnectingDrive || !isConfigured}
              >
                <Text style={styles.primaryButtonText}>
                  {isConnectingDrive ? 'Opening Google...' : 'Connect Google Drive'}
                </Text>
              </Pressable>

              {driveConnection?.status === 'connected' ? (
                <Pressable
                  style={styles.folderButton}
                  onPress={handleChooseDriveSaveFolder}
                  disabled={isPickingDriveFolder || !isConfigured}
                >
                  <Text style={styles.folderButtonText}>
                    {isPickingDriveFolder ? 'Opening Google picker...' : 'Choose Drive save folder'}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
        </FadeInView>

        <Text style={styles.footer}>
          Version v{buildInfo.appVersion}
          {buildInfo.buildNumber ? `  •  Build ${buildInfo.buildNumber}` : ''}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  container: {
    padding: 20,
    gap: 16,
    paddingBottom: 32,
  },
  hero: {
    backgroundColor: palette.card,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: palette.lineSoft,
    gap: 16,
    ...elevation.card,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: radii.pill,
    backgroundColor: palette.cardMuted,
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.lineSoft,
  },
  avatarInitials: {
    color: palette.accent,
    fontFamily: typography.display.fontFamily,
    fontSize: 28,
  },
  identityBlock: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    color: palette.accent,
    fontFamily: typography.label.fontFamily,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  displayName: {
    color: palette.ink,
    fontFamily: typography.display.fontFamily,
    fontSize: 28,
    lineHeight: 32,
  },
  email: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    lineHeight: 22,
  },
  heroBadgeRow: {
    gap: 8,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: palette.cardMuted,
    borderWidth: 1,
    borderColor: palette.lineSoft,
  },
  heroBadgeText: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 13,
  },
  heroBody: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.lineSoft,
    gap: 14,
    ...elevation.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 19,
  },
  cardStatus: {
    color: palette.mutedInk,
    fontFamily: typography.label.fontFamily,
    fontSize: 13,
  },
  infoRow: {
    gap: 4,
  },
  infoLabel: {
    color: palette.mutedInk,
    fontFamily: typography.label.fontFamily,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: palette.ink,
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: palette.ink,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 2,
  },
  primaryButtonText: {
    color: palette.paper,
    fontFamily: typography.label.fontFamily,
    fontSize: 16,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.paper,
  },
  secondaryButtonText: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineHint: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
    lineHeight: 19,
  },
  folderButton: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.paper,
  },
  folderButtonText: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 15,
  },
  footer: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.72,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
