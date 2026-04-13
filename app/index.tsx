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

import { FadeInView } from '../src/components/FadeInView';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { getAuthSession } from '../src/services/account';
import { createMeetingFromImport, listMeetings } from '../src/services/meetings';
import { AuthSession, MeetingRow } from '../src/types';
import { formatDuration, formatTimestamp } from '../src/utils/format';
import { elevation, palette } from '../src/theme';

export default function HomeScreen() {
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const loadMeetings = useCallback(async () => {
    const data = await listMeetings();
    setMeetings(data);

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
      router.push(`/meetings/${meetingId}`);
    } catch (error) {
      Alert.alert('Import failed', error instanceof Error ? error.message : 'Unable to import audio.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <View style={styles.container}>
        <FadeInView style={styles.hero}>
          <View style={styles.heroTopRow}>
            <Text style={styles.eyebrow}>Local-first meeting companion</Text>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>{meetings.length} saved</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>Record it. Upload it. Process it later.</Text>
          <Text style={styles.heroBody}>
            No bots. No calendar magic. Just a fast path from audio to transcript and action items.
          </Text>
          <View style={styles.heroStats}>
            <MetricPill label="Manual" value="Safe" />
            <MetricPill label="Storage" value="Local" />
            <MetricPill label="Flow" value="Post-call" />
          </View>
        </FadeInView>

        <FadeInView style={styles.actions} delay={80}>
          <ActionButton
            label="New recording"
            icon={<MaterialCommunityIcons name="microphone-outline" size={18} color={palette.paper} />}
            onPress={() => router.push('/record')}
          />
          <ActionButton
            label={isImporting ? 'Importing…' : 'Import audio'}
            icon={<Feather name="upload" size={18} color={palette.paper} />}
            onPress={handleImport}
            disabled={isImporting}
            secondary
          />
          <ActionButton
            label="Settings"
            icon={<Feather name="sliders" size={17} color={palette.ink} />}
            onPress={() => router.push('/settings')}
            tertiary
          />
        </FadeInView>

        <FadeInView style={styles.accountCard} delay={110}>
          <View style={styles.accountCopy}>
            <Text style={styles.accountTitle}>
              {session ? `Signed in as ${session.user.email}` : 'Cloud account not connected'}
            </Text>
            <Text style={styles.accountBody}>
              {session
                ? session.user.driveConnection.status === 'connected'
                  ? 'Google Drive is linked for cloud storage.'
                  : 'Finish connecting Google Drive so each customer gets their own storage.'
                : 'Add customer auth and Google Drive connection before turning on synced storage.'}
            </Text>
          </View>
          <Pressable style={styles.accountButton} onPress={() => router.push('/account')}>
            <Text style={styles.accountButtonText}>{session ? 'Manage account' : 'Set up account'}</Text>
          </Pressable>
        </FadeInView>

        <FadeInView style={styles.sectionHeader} delay={130}>
          <Text style={styles.sectionTitle}>Recent meetings</Text>
          <Text style={styles.sectionBody}>{meetings.length} saved locally</Text>
        </FadeInView>

        <FlatList
          data={meetings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={meetings.length === 0 ? styles.emptyList : styles.list}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/meetings/${item.id}`)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.status}>{statusLabel(item.status)}</Text>
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
              <View style={styles.cardFooter}>
                <Text style={styles.cardFooterLabel}>
                  {item.summaryShort ? 'Processed' : 'Needs processing'}
                </Text>
                <View style={styles.cardFooterActionWrap}>
                  <Text style={styles.cardFooterAction}>Open</Text>
                  <Feather name="arrow-up-right" size={14} color={palette.ink} />
                </View>
              </View>
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
  icon,
  onPress,
  disabled,
  secondary,
  tertiary,
}: {
  label: string;
  icon?: React.ReactNode;
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
      {icon ? <View style={styles.actionIconWrap}>{icon}</View> : null}
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

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function statusLabel(status: MeetingRow['status']) {
  switch (status) {
    case 'ready':
      return 'ready';
    case 'failed':
      return 'error';
    case 'transcribing':
      return 'transcribing';
    case 'transcribing_local':
      return 'local transcript';
    case 'summarizing':
      return 'summarizing';
    case 'summarizing_local':
      return 'local summary';
    default:
      return 'local only';
  }
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
    backgroundColor: palette.cardStrong,
    borderRadius: 30,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: palette.line,
    ...elevation.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  heroPill: {
    borderRadius: 999,
    backgroundColor: palette.ink,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroPillText: {
    color: palette.paper,
    fontWeight: '800',
    fontSize: 12,
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
  heroStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  metricPill: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.line,
  },
  metricLabel: {
    color: palette.mutedInk,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    color: palette.ink,
    fontWeight: '800',
    fontSize: 15,
    marginTop: 3,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 18,
  },
  actionButton: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: palette.ink,
    paddingVertical: 15,
    alignItems: 'center',
    ...elevation.card,
    gap: 8,
  },
  actionButtonSecondary: {
    backgroundColor: palette.accent,
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
  actionIconWrap: {
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonTextSecondary: {
    color: palette.paper,
  },
  actionButtonTextTertiary: {
    color: palette.ink,
  },
  sectionHeader: {
    marginBottom: 12,
    gap: 2,
  },
  accountCard: {
    marginTop: 2,
    marginBottom: 18,
    backgroundColor: palette.paper,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
    gap: 12,
  },
  accountCopy: {
    gap: 4,
  },
  accountTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  accountBody: {
    color: palette.mutedInk,
    lineHeight: 20,
    fontSize: 14,
  },
  accountButton: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: palette.ink,
  },
  accountButtonText: {
    color: palette.paper,
    fontWeight: '800',
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
    backgroundColor: palette.cardStrong,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 24,
    padding: 16,
    gap: 10,
    ...elevation.card,
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
    backgroundColor: palette.accentMist,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
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
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  cardFooterActionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardFooterLabel: {
    color: palette.mutedInk,
    fontSize: 12,
    fontWeight: '700',
  },
  cardFooterAction: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '800',
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
