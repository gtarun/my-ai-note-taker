import * as DocumentPicker from 'expo-document-picker';
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

import { MeetingRow } from '../src/types';
import { createMeetingFromImport, listMeetings } from '../src/services/meetings';
import { formatDuration, formatTimestamp } from '../src/utils/format';
import { palette } from '../src/theme';

export default function HomeScreen() {
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const loadMeetings = useCallback(async () => {
    const data = await listMeetings();
    setMeetings(data);
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
      router.push(`/meetings/${meetingId}`);
    } catch (error) {
      Alert.alert('Import failed', error instanceof Error ? error.message : 'Unable to import audio.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Local-first meeting companion</Text>
          <Text style={styles.heroTitle}>Record it. Upload it. Process it later.</Text>
          <Text style={styles.heroBody}>
            No bots. No calendar magic. Just a fast path from audio to transcript and action items.
          </Text>
        </View>

        <View style={styles.actions}>
          <ActionButton label="New recording" onPress={() => router.push('/record')} />
          <ActionButton
            label={isImporting ? 'Importing…' : 'Import audio'}
            onPress={handleImport}
            disabled={isImporting}
            secondary
          />
          <ActionButton label="Settings" onPress={() => router.push('/settings')} tertiary />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent meetings</Text>
          <Text style={styles.sectionBody}>{meetings.length} saved locally</Text>
        </View>

        <FlatList
          data={meetings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={meetings.length === 0 ? styles.emptyList : styles.list}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/meetings/${item.id}`)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.status}>{item.status.replace('_', ' ')}</Text>
              </View>
              <Text style={styles.cardMeta}>
                {formatTimestamp(item.createdAt)}
                {item.durationMs ? ` • ${formatDuration(item.durationMs)}` : ''}
              </Text>
              <Text numberOfLines={2} style={styles.cardSnippet}>
                {item.summaryShort ||
                  item.transcriptText?.slice(0, 120) ||
                  'No transcript yet. Open this meeting to process it.'}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No meetings yet</Text>
              <Text style={styles.emptyBody}>
                Start with a manual recording or import an existing Zoom/Meet/Teams file.
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  secondary,
  tertiary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  tertiary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionButton,
        secondary && styles.actionButtonSecondary,
        tertiary && styles.actionButtonTertiary,
        disabled && styles.actionButtonDisabled,
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          secondary && styles.actionButtonTextSecondary,
          tertiary && styles.actionButtonTextTertiary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
  hero: {
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: palette.line,
  },
  eyebrow: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    color: palette.ink,
  },
  heroBody: {
    color: palette.mutedInk,
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 18,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: palette.ink,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: palette.accentSoft,
  },
  actionButtonTertiary: {
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.line,
    flexBasis: 96,
    flexGrow: 0,
    paddingHorizontal: 16,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: palette.paper,
    fontWeight: '700',
  },
  actionButtonTextSecondary: {
    color: palette.ink,
  },
  actionButtonTextTertiary: {
    color: palette.ink,
  },
  sectionHeader: {
    marginBottom: 12,
    gap: 2,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionBody: {
    color: palette.mutedInk,
    fontSize: 14,
  },
  list: {
    paddingBottom: 32,
    gap: 12,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    color: palette.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  status: {
    color: palette.accent,
    textTransform: 'capitalize',
    fontSize: 12,
    fontWeight: '700',
  },
  cardMeta: {
    color: palette.mutedInk,
    fontSize: 13,
  },
  cardSnippet: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '700',
  },
  emptyBody: {
    color: palette.mutedInk,
    textAlign: 'center',
    lineHeight: 21,
  },
});
