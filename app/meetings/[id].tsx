import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MeetingRow, SummaryPayload } from '../../src/types';
import { getMeeting, processMeeting } from '../../src/services/meetings';
import { formatDuration, formatTimestamp } from '../../src/utils/format';
import { palette } from '../../src/theme';

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [meeting, setMeeting] = useState<MeetingRow | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const loadMeeting = useCallback(async () => {
    if (!id) {
      return;
    }

    const data = await getMeeting(id);
    setMeeting(data);
  }, [id]);

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
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>{meeting.title}</Text>
          <Text style={styles.meta}>
            {formatTimestamp(meeting.createdAt)}
            {meeting.durationMs ? ` • ${formatDuration(meeting.durationMs)}` : ''}
          </Text>
          <Text style={styles.status}>Status: {meeting.status.replace('_', ' ')}</Text>
          {meeting.errorMessage ? <Text style={styles.errorText}>{meeting.errorMessage}</Text> : null}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.primaryButton} onPress={handleProcess} disabled={isBusy}>
            <Text style={styles.primaryButtonText}>{isBusy ? 'Processing…' : 'Run transcript + summary'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={handleShare}>
            <Text style={styles.secondaryButtonText}>Share</Text>
          </Pressable>
        </View>

        <Section title="Summary">
          <Text style={styles.bodyText}>{summary?.summary || 'No summary yet.'}</Text>
        </Section>

        <Section title="Action items">
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

        <Section title="Decisions">
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

        <Section title="Transcript">
          <Text style={styles.transcriptText}>{meeting.transcriptText || 'No transcript yet.'}</Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
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
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 6,
  },
  title: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '800',
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
    borderRadius: 16,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: palette.paper,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
  },
  secondaryButtonText: {
    color: palette.ink,
    fontWeight: '700',
  },
  section: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 10,
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
