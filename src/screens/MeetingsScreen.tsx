import * as DocumentPicker from 'expo-document-picker';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FadeInView } from '../components/FadeInView';
import { ScreenBackground } from '../components/ScreenBackground';
import {
  PillButton,
  SectionHeading,
  StatusChip,
  SurfaceCard,
} from '../components/ui';
import {
  getDashboardCloudStatusCopy,
  getDashboardEmptyStateCopy,
  getOfflineSetupCardCopy,
  getMeetingStatusMeta,
} from '../features/dashboard/presentation';
import {
  RECORD_TAB_ROUTE,
  SETTINGS_TAB_ROUTE,
  getMeetingDetailRoute,
} from '../navigation/routes';
import { getAuthSession } from '../services/account';
import { createMeetingFromImport, listMeetings } from '../services/meetings';
import { getOfflineSetupSession } from '../services/offlineSetupSession';
import type { AuthSession, MeetingRow, OfflineSetupSession } from '../types';
import { palette, typography } from '../theme';
import { formatDuration, formatTimestamp } from '../utils/format';

const emptyCopy = getDashboardEmptyStateCopy();

export default function HomeScreen() {
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [offlineSetup, setOfflineSetup] = useState<OfflineSetupSession | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const loadMeetings = useCallback(async () => {
    const [data, setupSession] = await Promise.all([
      listMeetings(),
      getOfflineSetupSession(),
    ]);
    setMeetings(data);
    setOfflineSetup(setupSession);

    try {
      const storedSession = await getAuthSession();
      setSession(storedSession);
    } catch {
      setSession(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMeetings();
    }, [loadMeetings])
  );

  const handleImport = async () => {
    try {
      setIsImporting(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
        base64: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const meetingId = await createMeetingFromImport(result.assets[0]);
      await loadMeetings();
      router.push(getMeetingDetailRoute(meetingId));
    } catch (error) {
      Alert.alert('Import failed', error instanceof Error ? error.message : 'Unable to import audio.');
    } finally {
      setIsImporting(false);
    }
  };

  const importButtonLabel = isImporting ? 'Importing…' : 'Import audio';
  const cloudStatus = getDashboardCloudStatusCopy(session);
  const offlineSetupCard =
    offlineSetup && !offlineSetup.isDismissed && offlineSetup.status !== 'idle'
      ? getOfflineSetupCardCopy({
          status: offlineSetup.status,
          bundleLabel: offlineSetup.bundleLabel || 'Starter',
          progressPercent: Math.round(offlineSetup.progress * 100),
        })
      : null;
  const offlineSetupProgress = Math.round((offlineSetup?.progress ?? 0) * 100);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <View style={styles.container}>
        <FlatList
          data={meetings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.headerContent}>
              <FadeInView>
                <SurfaceCard muted style={styles.heroCard}>
                  <View style={styles.heroTopRow}>
                    <View style={styles.heroCopy}>
                      <Text style={styles.heroTitle}>Meetings</Text>
                      <Text style={styles.heroSubtitle}>
                        Capture meetings and process them when you are ready.
                      </Text>
                    </View>
                    <View pointerEvents="none" style={styles.heroIllustration}>
                      <View style={styles.heroNodePrimary} />
                      <View style={styles.heroNodeSecondary} />
                      <View style={styles.heroLineHorizontal} />
                      <View style={styles.heroLineVertical} />
                      <View style={styles.heroWaveA} />
                      <View style={styles.heroWaveB} />
                    </View>
                  </View>
                </SurfaceCard>
              </FadeInView>

              <FadeInView style={styles.primaryActions} delay={40}>
                <PillButton
                  label="New recording"
                  icon={
                    <MaterialCommunityIcons
                      name="microphone-outline"
                      size={18}
                      color={palette.card}
                    />
                  }
                  onPress={() => router.push(RECORD_TAB_ROUTE)}
                />
                <PillButton
                  label={importButtonLabel}
                  icon={<Feather name="upload" size={18} color={palette.ink} />}
                  onPress={handleImport}
                  variant="secondary"
                  disabled={isImporting}
                />
              </FadeInView>

              {offlineSetup && offlineSetupCard ? (
                <FadeInView delay={55}>
                  <SurfaceCard muted style={styles.offlineSetupCard}>
                    <View style={styles.offlineSetupHeader}>
                      <View style={styles.cloudCopy}>
                        <Text style={styles.cloudEyebrow}>Offline mode</Text>
                        <Text style={styles.cloudTitle}>{offlineSetupCard.title}</Text>
                        <Text style={styles.offlineSetupBody}>{offlineSetupCard.body}</Text>
                      </View>
                      <StatusChip
                        label={
                          offlineSetupCard.tone === 'danger'
                            ? 'Needs attention'
                            : offlineSetupCard.actionLabel
                        }
                        tone={offlineSetupCard.tone}
                      />
                    </View>

                    {offlineSetup.status === 'downloading' ? (
                      <View style={styles.offlineSetupProgressTrack}>
                        <View
                          style={[
                            styles.offlineSetupProgressFill,
                            { width: `${offlineSetupProgress}%` },
                          ]}
                        />
                      </View>
                    ) : null}

                    <PillButton
                      label={offlineSetupCard.actionLabel}
                      onPress={() => router.push(SETTINGS_TAB_ROUTE)}
                      variant="ghost"
                    />
                  </SurfaceCard>
                </FadeInView>
              ) : null}

              <FadeInView delay={70}>
                <SurfaceCard muted style={styles.cloudCard}>
                  <View style={styles.cloudRow}>
                    <View style={styles.cloudCopy}>
                      <Text style={styles.cloudEyebrow}>Cloud</Text>
                      <Text style={styles.cloudTitle}>{cloudStatus.title}</Text>
                    </View>
                    <PillButton
                      label={cloudStatus.actionLabel}
                      onPress={() => router.push('/account')}
                      variant="ghost"
                    />
                  </View>
                </SurfaceCard>
              </FadeInView>

              <SectionHeading
                title="Recent meetings"
                subtitle={`${meetings.length} stored on this device`}
              />
            </View>
          }
          renderItem={({ item }) => {
            const statusMeta = getMeetingStatusMeta(item.status);

            return (
              <Pressable
                onPress={() => router.push(getMeetingDetailRoute(item.id))}
                style={({ pressed }) => (pressed ? styles.meetingRowPressed : null)}
              >
                <SurfaceCard style={styles.meetingCard}>
                  <View style={styles.meetingHeader}>
                    <Text numberOfLines={1} style={styles.meetingTitle}>
                      {item.title}
                    </Text>
                    <StatusChip label={statusMeta.label} tone={statusMeta.tone} />
                  </View>
                  <Text style={styles.meetingMeta}>
                    {formatTimestamp(item.createdAt)}
                    {item.durationMs ? ` • ${formatDuration(item.durationMs)}` : ''}
                  </Text>
                  <Text style={styles.meetingSnippet} numberOfLines={1}>
                    {item.summaryShort ||
                      item.transcriptText?.slice(0, 88) ||
                      'Open this meeting to process it.'}
                  </Text>
                </SurfaceCard>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <SurfaceCard muted style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
              <Text style={styles.emptyBody}>{emptyCopy.body}</Text>
              <View style={styles.emptyActions}>
                <PillButton label="New recording" onPress={() => router.push(RECORD_TAB_ROUTE)} />
                <PillButton
                  label={importButtonLabel}
                  onPress={handleImport}
                  variant="secondary"
                  disabled={isImporting}
                />
              </View>
            </SurfaceCard>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  listContent: {
    paddingBottom: 28,
    gap: 12,
  },
  headerContent: {
    gap: 12,
    paddingBottom: 6,
  },
  heroCard: {
    gap: 12,
    paddingVertical: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    color: palette.ink,
    fontFamily: typography.display.fontFamily,
    fontSize: 26,
  },
  heroSubtitle: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 260,
  },
  heroIllustration: {
    width: 92,
    height: 72,
    borderRadius: 20,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.lineSoft,
    position: 'relative',
    overflow: 'hidden',
  },
  heroNodePrimary: {
    position: 'absolute',
    top: 16,
    left: 14,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  heroNodeSecondary: {
    position: 'absolute',
    right: 16,
    bottom: 14,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: palette.accentStrong,
  },
  heroLineHorizontal: {
    position: 'absolute',
    top: 20,
    left: 24,
    right: 18,
    height: 1,
    backgroundColor: palette.line,
  },
  heroLineVertical: {
    position: 'absolute',
    top: 20,
    bottom: 18,
    right: 20,
    width: 1,
    backgroundColor: palette.lineSoft,
  },
  heroWaveA: {
    position: 'absolute',
    left: 14,
    right: 28,
    bottom: 24,
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.accentSoft,
  },
  heroWaveB: {
    position: 'absolute',
    left: 26,
    right: 14,
    bottom: 14,
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.accent,
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cloudCard: {
    paddingVertical: 14,
  },
  offlineSetupCard: {
    gap: 12,
    paddingVertical: 16,
    borderColor: palette.accentSoft,
    backgroundColor: '#f8fbff',
  },
  offlineSetupHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  offlineSetupBody: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
    lineHeight: 19,
  },
  offlineSetupProgressTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
  },
  offlineSetupProgressFill: {
    height: '100%',
    minWidth: 8,
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  cloudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cloudCopy: {
    flex: 1,
    gap: 2,
  },
  cloudEyebrow: {
    color: palette.accent,
    fontFamily: typography.label.fontFamily,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cloudTitle: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 15,
  },
  meetingCard: {
    gap: 8,
    paddingVertical: 14,
  },
  meetingRowPressed: {
    opacity: 0.82,
  },
  meetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  meetingTitle: {
    flex: 1,
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 16,
  },
  meetingMeta: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 12,
  },
  meetingSnippet: {
    color: palette.ink,
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  emptyTitle: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 22,
  },
  emptyBody: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },
  emptyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
  },
});
