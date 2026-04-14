import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { FadeInView } from '../../src/components/FadeInView';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import {
  MEETING_DETAIL_TITLE_ACTION_SLOT_MIN_WIDTH,
  getMeetingDetailPrimaryActionLabel,
  getMeetingDetailTitleDraftState,
  getPlaybackActionLabel,
} from '../../src/features/meetings/detailPresentation';
import {
  getMeetingDetailHeaderFallback,
  shouldShowMeetingDetailMissingStateButton,
} from '../../src/features/meetings/navigation';
import { APP_TABS_ROUTE } from '../../src/navigation/routes';
import { getAppSettings } from '../../src/services/settings';
import { MeetingRow, SummaryPayload } from '../../src/types';
import { deleteMeeting, getMeeting, processMeeting, renameMeeting } from '../../src/services/meetings';
import { formatDuration, formatTimestamp } from '../../src/utils/format';
import { elevation, palette } from '../../src/theme';

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [meeting, setMeeting] = useState<MeetingRow | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [runsOffline, setRunsOffline] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const player = useAudioPlayer(meeting?.audioUri ?? null);
  const playerStatus = useAudioPlayerStatus(player);
  const canReturnToPreviousScreen = router.canGoBack();
  const headerFallback = getMeetingDetailHeaderFallback(canReturnToPreviousScreen);

  const loadMeeting = useCallback(async () => {
    if (!id) {
      setHasLoaded(true);
      return;
    }

    const [data, settings] = await Promise.all([getMeeting(id), getAppSettings()]);
    setMeeting(data);
    setDraftTitle(data?.title ?? '');
    setRunsOffline(
      settings.selectedTranscriptionProvider === 'local' &&
        settings.selectedSummaryProvider === 'local'
    );
    setHasLoaded(true);
  }, [id]);

  useEffect(() => {
    if (meeting?.audioUri) {
      player.replace(meeting.audioUri);
    }
  }, [meeting?.audioUri, player]);

  useFocusEffect(
    useCallback(() => {
      loadMeeting();
    }, [loadMeeting])
  );

  const handleProcess = async () => {
    if (!id) {
      return;
    }

    try {
      setIsBusy(true);
      await processMeeting(id);
      await loadMeeting();
    } catch (error) {
      Alert.alert('Processing failed', error instanceof Error ? error.message : 'Unable to process meeting.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleShare = async () => {
    if (!meeting) {
      return;
    }

    const shareBody = buildShareText(meeting);
    await Share.share({
      title: meeting.title,
      message: shareBody,
    });
  };

  const handleRename = async () => {
    if (!meeting || !id) {
      return;
    }

    try {
      setIsSavingTitle(true);
      await renameMeeting(id, draftTitle);
      await loadMeeting();
    } catch (error) {
      Alert.alert('Rename failed', error instanceof Error ? error.message : 'Unable to rename meeting.');
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleDelete = async () => {
    if (!meeting || !id) {
      return;
    }

    Alert.alert('Delete recording?', 'This removes the audio file, transcript, and summary from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsDeleting(true);
            player.pause();
            await deleteMeeting(id);
            router.replace(APP_TABS_ROUTE);
          } catch (error) {
            Alert.alert(
              'Delete failed',
              error instanceof Error ? error.message : 'Unable to delete this recording.'
            );
          } finally {
            setIsDeleting(false);
          }
        },
      },
    ]);
  };

  const handlePlaybackToggle = () => {
    if (playerStatus.playing) {
      player.pause();
      return;
    }

    player.play();
  };

  if (!hasLoaded) {
    return (
      <View style={styles.centered}>
        <Stack.Screen
          options={{
            headerBackVisible: !headerFallback,
            headerLeft: headerFallback
              ? () => (
                  <Pressable
                    style={styles.headerFallbackButton}
                    onPress={() => router.replace(headerFallback.href)}
                  >
                    <Feather name="arrow-left" size={16} color={palette.ink} />
                    <Text style={styles.headerFallbackButtonText}>{headerFallback.label}</Text>
                  </Pressable>
                )
              : undefined,
          }}
        />
        <ActivityIndicator size="large" color={palette.ink} />
      </View>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen
          options={{
            headerBackVisible: !headerFallback,
            headerLeft: headerFallback
              ? () => (
                  <Pressable
                    style={styles.headerFallbackButton}
                    onPress={() => router.replace(headerFallback.href)}
                  >
                    <Feather name="arrow-left" size={16} color={palette.ink} />
                    <Text style={styles.headerFallbackButtonText}>{headerFallback.label}</Text>
                  </Pressable>
                )
              : undefined,
          }}
        />
        <ScreenBackground />
        <View style={styles.centered}>
          <Text style={styles.notFoundTitle}>Meeting not found</Text>
          <Text style={styles.notFoundBody}>
            This recording may have been deleted or the link is no longer valid.
          </Text>
          {shouldShowMeetingDetailMissingStateButton(canReturnToPreviousScreen) ? (
            <Pressable style={styles.primaryButton} onPress={() => router.replace(APP_TABS_ROUTE)}>
              <Text style={styles.primaryButtonText}>Back to meetings</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const summary = parseSummary(meeting.summaryJson);
  const titleDraftState = getMeetingDetailTitleDraftState(draftTitle, meeting.title);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen
        options={{
          headerBackVisible: !headerFallback,
          headerLeft: headerFallback
            ? () => (
                <Pressable
                  style={styles.headerFallbackButton}
                  onPress={() => router.replace(headerFallback.href)}
                >
                  <Feather name="arrow-left" size={16} color={palette.ink} />
                  <Text style={styles.headerFallbackButtonText}>{headerFallback.label}</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <FadeInView style={styles.headerCard}>
          <View style={styles.titleRow}>
            <TextInput
              style={styles.titleInput}
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder="Meeting title"
              placeholderTextColor={palette.mutedInk}
            />
            <View style={styles.inlineSaveSlot}>
              {titleDraftState.showSave ? (
                <Pressable
                  style={[
                    styles.inlineSaveButton,
                    (isSavingTitle || titleDraftState.isDisabled) && styles.inlineSaveButtonDisabled,
                  ]}
                  onPress={handleRename}
                  disabled={isSavingTitle || titleDraftState.isDisabled}
                >
                  <Feather name={isSavingTitle ? 'loader' : 'check'} size={16} color={palette.card} />
                  <Text style={styles.inlineSaveButtonText}>{isSavingTitle ? 'Saving…' : 'Save'}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Text style={styles.meta}>
            {formatTimestamp(meeting.createdAt)}
            {meeting.durationMs ? ` • ${formatDuration(meeting.durationMs)}` : ''}
          </Text>
          <View style={styles.statusWrap}>
            <View style={styles.statusRow}>
              <StatusIcon status={meeting.status} />
              <Text style={styles.status}>Status: {meeting.status.replace('_', ' ')}</Text>
            </View>
            {runsOffline ? (
              <View style={styles.inlineOfflineBadge}>
                <Feather name="smartphone" size={14} color={palette.ink} />
                <Text style={styles.inlineOfflineBadgeText}>Runs fully offline</Text>
              </View>
            ) : null}
          </View>
          {meeting.errorMessage ? <Text style={styles.errorText}>{meeting.errorMessage}</Text> : null}
        </FadeInView>

        <FadeInView style={styles.primaryActionWrap} delay={60}>
          <Pressable style={styles.primaryButton} onPress={handleProcess} disabled={isBusy}>
            <MaterialCommunityIcons name="text-box-search-outline" size={18} color={palette.paper} />
            <Text style={styles.primaryButtonText}>{getMeetingDetailPrimaryActionLabel(isBusy)}</Text>
          </Pressable>
        </FadeInView>

        <FadeInView style={styles.secondaryActions} delay={90}>
          <Pressable style={styles.secondaryButton} onPress={handlePlaybackToggle}>
            <Feather
              name={playerStatus.playing ? 'pause-circle' : 'play-circle'}
              size={17}
              color={palette.ink}
            />
            <Text style={styles.secondaryButtonText}>{getPlaybackActionLabel(playerStatus.playing)}</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={handleShare}>
            <Feather name="share-2" size={17} color={palette.ink} />
            <Text style={styles.secondaryButtonText}>Share</Text>
          </Pressable>
        </FadeInView>

        <Section title="Summary" delay={120}>
          <Text style={styles.bodyText}>{summary?.summary || 'No summary yet.'}</Text>
        </Section>

        <Section title="Action items" delay={150}>
          {summary?.actionItems?.length ? (
            summary.actionItems.map((item) => (
              <Text key={item} style={styles.listText}>
                • {item}
              </Text>
            ))
          ) : (
            <Text style={styles.bodyText}>No action items yet.</Text>
          )}
        </Section>

        <Section title="Decisions" delay={180}>
          {summary?.decisions?.length ? (
            summary.decisions.map((item) => (
              <Text key={item} style={styles.listText}>
                • {item}
              </Text>
            ))
          ) : (
            <Text style={styles.bodyText}>No decisions extracted yet.</Text>
          )}
        </Section>

        <Section title="Transcript" delay={210}>
          <Text style={styles.transcriptText}>{meeting.transcriptText || 'No transcript yet.'}</Text>
        </Section>

        <Section title="Recording" delay={240}>
          <Text style={styles.bodyText}>
            {playerStatus.playing ? 'Playing now.' : 'Ready to play.'}
            {playerStatus.duration ? ` Total length: ${formatDuration(playerStatus.duration * 1000)}` : ''}
          </Text>
          <Text style={styles.bodyText}>
            Current position: {formatDuration(playerStatus.currentTime * 1000)}
          </Text>
        </Section>

        <FadeInView style={styles.dangerZone} delay={270}>
          <Text style={styles.dangerZoneTitle}>Delete meeting</Text>
          <Text style={styles.dangerZoneBody}>
            This permanently removes the audio file, transcript, and summary from this device.
          </Text>
          <Pressable style={styles.dangerButton} onPress={handleDelete} disabled={isDeleting}>
            <Feather name="trash-2" size={16} color={palette.danger} />
            <Text style={styles.dangerButtonText}>{isDeleting ? 'Deleting…' : 'Delete meeting'}</Text>
          </Pressable>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusIcon({ status }: { status: MeetingRow['status'] }) {
  switch (status) {
    case 'ready':
      return <Feather name="check-circle" size={16} color={palette.accent} />;
    case 'failed':
      return <Feather name="alert-circle" size={16} color={palette.danger} />;
    case 'transcribing':
    case 'transcribing_local':
    case 'summarizing':
    case 'summarizing_local':
      return <Feather name="loader" size={16} color={palette.accent} />;
    default:
      return <Feather name="clock" size={16} color={palette.accent} />;
  }
}

function Section({
  title,
  children,
  delay = 0,
}: {
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <FadeInView style={styles.section} delay={delay}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </FadeInView>
  );
}

function parseSummary(summaryJson: string | null): SummaryPayload | null {
  if (!summaryJson) {
    return null;
  }

  try {
    return JSON.parse(summaryJson) as SummaryPayload;
  } catch {
    return null;
  }
}

function buildShareText(meeting: MeetingRow) {
  const summary = parseSummary(meeting.summaryJson);
  const actionItems = summary?.actionItems?.length
    ? summary.actionItems.map((item) => `- ${item}`).join('\n')
    : '- None';

  return `${meeting.title}

Summary
${summary?.summary || 'No summary yet.'}

Action items
${actionItems}

Transcript
${meeting.transcriptText || 'No transcript yet.'}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.paper,
    padding: 24,
    gap: 12,
  },
  headerFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headerFallbackButtonText: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  notFoundTitle: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '800',
  },
  notFoundBody: {
    color: palette.mutedInk,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  container: {
    padding: 20,
    gap: 16,
  },
  headerCard: {
    backgroundColor: palette.cardStrong,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 10,
    ...elevation.card,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  titleInput: {
    flex: 1,
    color: palette.ink,
    fontSize: 28,
    fontWeight: '800',
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    paddingBottom: 8,
  },
  inlineSaveSlot: {
    width: MEETING_DETAIL_TITLE_ACTION_SLOT_MIN_WIDTH,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  inlineSaveButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  inlineSaveButtonDisabled: {
    opacity: 0.55,
  },
  inlineSaveButtonText: {
    color: palette.card,
    fontWeight: '700',
    fontSize: 14,
  },
  meta: {
    color: palette.mutedInk,
    fontSize: 14,
  },
  statusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  status: {
    color: palette.accent,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineOfflineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: palette.accentMist,
    borderWidth: 1,
    borderColor: palette.line,
  },
  inlineOfflineBadgeText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: palette.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryActionWrap: {
    width: '100%',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    width: '100%',
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: palette.ink,
    borderRadius: 18,
    paddingVertical: 15,
    ...elevation.card,
    gap: 8,
  },
  primaryButtonText: {
    color: palette.paper,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardStrong,
    gap: 8,
  },
  secondaryButtonText: {
    color: palette.ink,
    fontWeight: '700',
  },
  dangerZone: {
    backgroundColor: '#fff4f2',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#efc2bc',
    gap: 12,
  },
  dangerZoneTitle: {
    color: palette.danger,
    fontWeight: '800',
    fontSize: 17,
  },
  dangerZoneBody: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  dangerButton: {
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e7b0aa',
    backgroundColor: '#fff1ee',
    gap: 8,
  },
  dangerButtonText: {
    color: palette.danger,
    fontWeight: '700',
  },
  section: {
    backgroundColor: palette.cardStrong,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 10,
    ...elevation.card,
  },
  sectionTitle: {
    color: palette.ink,
    fontWeight: '800',
    fontSize: 17,
  },
  sectionBody: {
    gap: 8,
  },
  bodyText: {
    color: palette.ink,
    lineHeight: 22,
    fontSize: 15,
  },
  listText: {
    color: palette.ink,
    lineHeight: 22,
    fontSize: 15,
  },
  transcriptText: {
    color: palette.ink,
    lineHeight: 22,
    fontSize: 14,
  },
});
