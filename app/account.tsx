import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import { elevation, palette } from '../src/theme';

WebBrowser.maybeCompleteAuthSession();

function firstQueryParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <FadeInView style={styles.hero}>
          <View style={styles.heroHeader}>
            <MaterialCommunityIcons name="cloud-outline" size={18} color={palette.ink} />
            <Text style={styles.heroTitle}>Google account and Drive</Text>
          </View>
          <Text style={styles.heroBody}>
            Sign in with Google first, then connect the same Google account for Drive backups and Google Sheets sync.
          </Text>
        </FadeInView>

        <FadeInView style={styles.card} delay={40}>
          <View style={styles.statusPanel}>
            <Text style={styles.statusTitle}>
              {session ? session.user.name || session.user.email : 'Not signed in'}
            </Text>
            <Text style={styles.rowBody}>
              {session
                ? `${session.user.email}\nDrive: ${
                    driveConnection?.status === 'connected' ? 'Connected' : 'Not connected'
                  }`
                : 'Use Google sign-in first. Once signed in, connect the same Google account to Drive and Sheets.'}
            </Text>
            {driveConnection?.accountEmail ? (
              <Text style={styles.rowBody}>Drive account: {driveConnection.accountEmail}</Text>
            ) : null}
            {driveConnection?.status === 'connected' ? (
              <Text style={styles.rowBody}>
                Save folder:{' '}
                {driveConnection.saveFolderName?.trim()
                  ? driveConnection.saveFolderName
                  : 'Not chosen yet — pick a folder for cloud copies of recordings.'}
              </Text>
            ) : null}
          </View>

          {!session ? (
            <Pressable
              style={styles.primaryButton}
              onPress={handleGoogleSignIn}
              disabled={isGoogleSubmitting || !isConfigured}
            >
              <Text style={styles.primaryButtonText}>
                {isGoogleSubmitting ? 'Opening Google…' : 'Continue with Google'}
              </Text>
            </Pressable>
          ) : (
            <>
              <View style={styles.buttonRow}>
                <Pressable
                  style={styles.primaryButtonSplit}
                  onPress={handleConnectDrive}
                  disabled={isConnectingDrive || !isConfigured}
                >
                  <Text style={styles.primaryButtonText}>
                    {isConnectingDrive ? 'Opening Google…' : 'Connect Google Drive'}
                  </Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={handleRefresh} disabled={isRefreshing}>
                  <Text style={styles.secondaryButtonText}>{isRefreshing ? 'Refreshing…' : 'Refresh'}</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={handleSignOut}>
                  <Text style={styles.secondaryButtonText}>Sign out</Text>
                </Pressable>
              </View>
              {driveConnection?.status === 'connected' ? (
                <Pressable
                  style={styles.folderButton}
                  onPress={handleChooseDriveSaveFolder}
                  disabled={isPickingDriveFolder || !isConfigured}
                >
                  <Text style={styles.folderButtonText}>
                    {isPickingDriveFolder ? 'Opening Google picker…' : 'Choose Drive save folder'}
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}
        </FadeInView>
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
    backgroundColor: palette.cardStrong,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 8,
    ...elevation.card,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 26,
    fontWeight: '800',
  },
  heroBody: {
    color: palette.mutedInk,
    lineHeight: 22,
  },
  card: {
    backgroundColor: palette.cardStrong,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 12,
    ...elevation.card,
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  primaryButton: {
    backgroundColor: palette.ink,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonSplit: {
    flex: 1.4,
    backgroundColor: palette.ink,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: palette.paper,
    fontWeight: '800',
    fontSize: 16,
  },
  secondaryButton: {
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
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusPanel: {
    borderRadius: 18,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
    gap: 4,
  },
  statusTitle: {
    color: palette.ink,
    fontWeight: '800',
    fontSize: 15,
  },
  rowBody: {
    color: palette.mutedInk,
    lineHeight: 20,
  },
  inlineHint: {
    color: palette.mutedInk,
    fontSize: 13,
    lineHeight: 20,
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
    fontWeight: '800',
    fontSize: 15,
  },
});
