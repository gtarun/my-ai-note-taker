import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
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
import { MeetingRow, SummaryPayload } from '../../src/types';
import { deleteMeeting, getMeeting, processMeeting, renameMeeting } from '../../src/services/meetings';
import { formatDuration, formatTimestamp } from '../../src/utils/format';
import { elevation, palette } from '../../src/theme';

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [meeting, setMeeting] = useState<MeetingRow | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const player = useAudioPlayer(meeting?.audioUri ?? null);
  const playerStatus = useAudioPlayerStatus(player);

  const loadMeeting = useCallback(async () => {
    if (!id) {
      return;
    }

    const data = await getMeeting(id);
    setMeeting(data);
    setDraftTitle(data?.title ?? '');
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
            router.replace('/');
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

  if (!meeting) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={palette.ink} />
      </View>
    );
  }

  const summary = parseSummary(meeting.summaryJson);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <FadeInView style={styles.headerCard}>
          <TextInput
            style={styles.titleInput}
            value={draftTitle}
            onChangeText={setDraftTitle}
            placeholder="Meeting title"
            placeholderTextColor={palette.mutedInk}
          />
          <Text style={styles.meta}>
            {formatTimestamp(meeting.createdAt)}
            {meeting.durationMs ? ` • ${formatDuration(meeting.durationMs)}` : ''}
          </Text>
          <View style={styles.statusRow}>
            <StatusIcon status={meeting.status} />
            <Text style={styles.status}>Status: {meeting.status.replace('_', ' ')}</Text>
          </View>
          {meeting.errorMessage ? <Text style={styles.errorText}>{meeting.errorMessage}</Text> : null}
        </FadeInView>

        <FadeInView style={styles.actions} delay={60}>
          <Pressable style={styles.primaryButton} onPress={handleProcess} disabled={isBusy}>
            <MaterialCommunityIcons name="text-box-search-outline" size={18} color={palette.paper} />
            <Text style={styles.primaryButtonText}>{isBusy ? 'Processing…' : 'Run transcript + summary'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={handleShare}>
            <Feather name="share-2" size={17} color={palette.ink} />
            <Text style={styles.secondaryButtonText}>Share</Text>
          </Pressable>
        </FadeInView>

        <FadeInView style={styles.actions} delay={100}>
          <Pressable style={styles.secondaryButton} onPress={handlePlaybackToggle}>
            <Feather
              name={playerStatus.playing ? 'pause-circle' : 'play-circle'}
              size={17}
              color={palette.ink}
            />
            <Text style={styles.secondaryButtonText}>
              {playerStatus.playing ? 'Pause recording' : 'Play recording'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={handleRename}
            disabled={isSavingTitle || draftTitle.trim() === meeting.title}
          >
            <Feather name="edit-3" size={16} color={palette.ink} />
            <Text style={styles.secondaryButtonText}>{isSavingTitle ? 'Saving…' : 'Rename'}</Text>
          </Pressable>
          <Pressable style={styles.dangerButton} onPress={handleDelete} disabled={isDeleting}>
            <Feather name="trash-2" size={16} color={palette.danger} />
            <Text style={styles.dangerButtonText}>{isDeleting ? 'Deleting…' : 'Delete'}</Text>
          </Pressable>
        </FadeInView>

        <Section title="Recording" delay={130}>
          <Text style={styles.bodyText}>
            {playerStatus.playing ? 'Playing now.' : 'Ready to play.'}
            {playerStatus.duration ? ` Total length: ${formatDuration(playerStatus.duration * 1000)}` : ''}
          </Text>
          <Text style={styles.bodyText}>
            Current position: {formatDuration(playerStatus.currentTime * 1000)}
          </Text>
        </Section>

        <Section title="Summary" delay={160}>
          <Text style={styles.bodyText}>{summary?.summary || 'No summary yet.'}</Text>
        </Section>

        <Section title="Action items" delay={190}>
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

        <Section title="Decisions" delay={220}>
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

        <Section title="Transcript" delay={250}>
          <Text style={styles.transcriptText}>{meeting.transcriptText || 'No transcript yet.'}</Text>
        </Section>
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
    case 'summarizing':
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
  },
  container: {
    padding: 20,
    gap: 16,
  },
  headerCard: {
    backgroundColor: palette.cardStrong,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 6,
    ...elevation.card,
  },
  title: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '800',
  },
  titleInput: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: '800',
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    paddingBottom: 8,
  },
  meta: {
    color: palette.mutedInk,
    fontSize: 14,
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
  errorText: {
    color: palette.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
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
  dangerButton: {
    flex: 1,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
