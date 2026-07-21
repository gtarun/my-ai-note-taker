import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FadeInView } from '../components/FadeInView';
import { ScreenBackground } from '../components/ScreenBackground';
import {
  PillButton,
  PressableScale,
  SkeletonParagraph,
  StatusChip,
  SurfaceCard,
} from '../components/ui';
import {
  getDashboardCloudStatusCopy,
  getDashboardEmptyStateCopy,
  getOfflineSetupCardCopy,
  getMeetingStatusMeta,
  groupMeetingsByDay,
  isMeetingProcessing,
} from '../features/dashboard/presentation';
import {
  LOCAL_MODELS_ROUTE,
  RECORD_TAB_ROUTE,
  getMeetingDetailRoute,
} from '../navigation/routes';
import { getAuthSession } from '../services/account';
import { createMeetingFromImport, listMeetings } from '../services/meetings';
import { dismissOfflineSetup, getOfflineSetupSession } from '../services/offlineSetupSession';
import type { AuthSession, MeetingRow, OfflineSetupSession } from '../types';
import { elevation, motion, radii, spacing, type, typography } from '../theme';
import { formatDuration, formatTimestamp } from '../utils/format';
import { useTheme, useThemedStyles, type Palette } from '../hooks/useTheme';

const emptyCopy = getDashboardEmptyStateCopy();

export default function HomeScreen() {
  const palette = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [offlineSetup, setOfflineSetup] = useState<OfflineSetupSession | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadMeetings = useCallback(async () => {
    // A throw here used to leave the list at [] forever, so a database error
    // rendered as the "No meetings yet" empty state — the worst possible lie to
    // show someone whose recordings are still on disk.
    try {
      const [data, setupSession] = await Promise.all([
        listMeetings(),
        getOfflineSetupSession(),
      ]);
      setMeetings(data);
      setOfflineSetup(setupSession);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load your meetings.');
    } finally {
      setHasLoaded(true);
    }

    try {
      const storedSession = await getAuthSession();
      setSession(storedSession);
    } catch {
      setSession(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMeetings();
    }, [loadMeetings])
  );

  const handleDismissOfflineSetup = async () => {
    try {
      await dismissOfflineSetup();
      setOfflineSetup(await getOfflineSetupSession());
    } catch (error) {
      Alert.alert(
        'Could not dismiss',
        error instanceof Error ? error.message : 'Unable to dismiss this card.'
      );
    }
  };

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

  const sections = groupMeetingsByDay(meetings);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <View style={styles.container}>
        <SectionList
          sections={sections.map((group) => ({ ...group, data: group.meetings }))}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <View style={styles.headerContent}>
              <FadeInView>
                <View style={styles.masthead}>
                  <Text style={styles.mastheadTitle}>Meetings</Text>
                  <Text style={styles.mastheadMeta}>
                    {meetings.length
                      ? `${meetings.length} on this device`
                      : 'Nothing recorded yet'}
                  </Text>
                </View>
              </FadeInView>

              {offlineSetup && offlineSetupCard ? (
                <FadeInView delay={40}>
                  <SurfaceCard muted level="flat" style={styles.noticeCard}>
                    <View style={styles.noticeHeader}>
                      <View style={styles.noticeCopy}>
                        <Text style={styles.eyebrow}>OFFLINE MODE</Text>
                        <Text style={styles.noticeTitle}>{offlineSetupCard.title}</Text>
                        <Text style={styles.noticeBody}>{offlineSetupCard.body}</Text>
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
                      <View style={styles.progressTrack}>
                        <View
                          style={[styles.progressFill, { width: `${offlineSetupProgress}%` }]}
                        />
                      </View>
                    ) : null}

                    <PillButton
                      label={offlineSetupCard.actionLabel}
                      onPress={() => {
                        if (offlineSetupCard.action === 'dismiss') {
                          void handleDismissOfflineSetup();
                          return;
                        }
                        router.push(LOCAL_MODELS_ROUTE);
                      }}
                      variant="secondary"
                    />
                  </SurfaceCard>
                </FadeInView>
              ) : null}

              {cloudStatus.title === 'Cloud not connected' ? (
                <FadeInView delay={60}>
                  <PressableScale
                    onPress={() => router.push('/account')}
                    accessibilityLabel={cloudStatus.actionLabel}
                    style={styles.cloudRow}
                  >
                    <Feather name="cloud-off" size={16} color={palette.mutedInk} />
                    <Text style={styles.cloudText}>{cloudStatus.title}</Text>
                    <Text style={styles.cloudAction}>{cloudStatus.actionLabel}</Text>
                  </PressableScale>
                </FadeInView>
              ) : null}
            </View>
          }
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item, index }) => {
            const statusMeta = getMeetingStatusMeta(item.status);
            const processing = isMeetingProcessing(item.status);

            return (
              <FadeInView delay={Math.min(index, motion.stagger.maxItems) * motion.stagger.step}>
                <PressableScale
                  onPress={() => router.push(getMeetingDetailRoute(item.id))}
                  accessibilityLabel={`${item.title}, ${statusMeta.label}`}
                  style={styles.meetingCard}
                >
                  <View style={styles.meetingHeader}>
                    <Text numberOfLines={1} style={styles.meetingTitle}>
                      {item.title}
                    </Text>
                    <StatusChip label={statusMeta.label} tone={statusMeta.tone} />
                  </View>

                  <Text style={styles.meetingMeta}>
                    {formatTimestamp(item.createdAt)}
                    {item.durationMs ? `  ·  ${formatDuration(item.durationMs)}` : ''}
                  </Text>

                  {processing ? (
                    // A skeleton shaped like the summary that is coming, rather
                    // than a line of placeholder prose that never changes.
                    <SkeletonParagraph lines={2} style={styles.meetingSkeleton} />
                  ) : (
                    <Text style={styles.meetingSnippet} numberOfLines={2}>
                      {item.summaryShort ||
                        item.transcriptText?.slice(0, 120) ||
                        'Not processed yet.'}
                    </Text>
                  )}
                </PressableScale>
              </FadeInView>
            );
          }}
          ListEmptyComponent={
            !hasLoaded ? (
              <View style={styles.listLoading}>
                <ActivityIndicator color={palette.mutedInk} />
              </View>
            ) : loadError ? (
              <SurfaceCard muted level="flat" style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Couldn’t load your meetings</Text>
                <Text style={styles.emptyBody}>{loadError}</Text>
                <PillButton label="Try again" onPress={() => void loadMeetings()} />
              </SurfaceCard>
            ) : (
              <SurfaceCard muted level="flat" style={styles.emptyState}>
                <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
                <Text style={styles.emptyBody}>{emptyCopy.body}</Text>
              </SurfaceCard>
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={async () => {
                setIsRefreshing(true);
                await loadMeetings();
                setIsRefreshing(false);
              }}
              tintColor={palette.mutedInk}
            />
          }
        />

        {/* The record affordance stays reachable from the list itself. */}
        <View style={styles.dock}>
          <PressableScale
            onPress={() => router.push(RECORD_TAB_ROUTE)}
            accessibilityLabel="New recording"
            style={styles.dockRecord}
          >
            <View style={styles.dockRecordDot} />
          </PressableScale>
          <PillButton
            label={importButtonLabel}
            icon={<Feather name="upload" size={17} color={palette.ink} />}
            onPress={handleImport}
            variant="secondary"
            disabled={isImporting}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (palette: Palette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.paper },
  container: { flex: 1 },
  listContent: { paddingHorizontal: spacing.xl, paddingBottom: 120 },
  headerContent: { gap: spacing.md, paddingTop: spacing.sm },

  masthead: { paddingTop: spacing.sm, paddingBottom: spacing.xs, gap: 2 },
  mastheadTitle: { ...typography.display, ...type.display, color: palette.ink },
  mastheadMeta: { ...typography.body, ...type.bodySm, color: palette.mutedInk },

  eyebrow: { ...typography.label, ...type.micro, color: palette.mutedInk },

  sectionHeader: {
    ...typography.label,
    ...type.micro,
    color: palette.faintInk,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },

  meetingCard: {
    backgroundColor: palette.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: palette.lineSoft,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    gap: 3,
  },
  meetingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  meetingTitle: { ...typography.bodyStrong, ...type.body, color: palette.ink, flex: 1 },
  meetingMeta: { ...typography.mono, ...type.caption, color: palette.faintInk },
  meetingSnippet: { ...typography.body, ...type.bodySm, color: palette.mutedInk, marginTop: 4 },
  meetingSkeleton: { marginTop: spacing.sm, marginBottom: 2 },

  noticeCard: { gap: spacing.md },
  noticeHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  noticeCopy: { flex: 1, gap: 2 },
  noticeTitle: { ...typography.bodyStrong, ...type.body, color: palette.ink },
  noticeBody: { ...typography.body, ...type.bodySm, color: palette.mutedInk },

  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: palette.lineSoft,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: palette.accent },

  cloudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: palette.cardMuted,
  },
  cloudText: { ...typography.body, ...type.bodySm, color: palette.mutedInk, flex: 1 },
  cloudAction: { ...typography.label, ...type.label, color: palette.accent },

  listLoading: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, marginTop: spacing.lg },
  emptyTitle: { ...typography.heading, ...type.heading, color: palette.ink },
  emptyBody: {
    ...typography.body,
    ...type.bodySm,
    color: palette.mutedInk,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },

  dock: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dockRecord: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: palette.clayFill,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.floating,
  },
  dockRecordDot: { width: 19, height: 19, borderRadius: 999, backgroundColor: palette.onFill },
});
