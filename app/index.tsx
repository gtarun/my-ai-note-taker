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
import {
  EditorialHero,
  PillButton,
  SectionHeading,
  StatusChip,
  SurfaceCard,
} from '../src/components/ui';
import {
  getDashboardEmptyStateCopy,
  getMeetingStatusMeta,
} from '../src/features/dashboard/presentation';
import { getAuthSession } from '../src/services/account';
import { createMeetingFromImport, listMeetings } from '../src/services/meetings';
import type { AuthSession, MeetingRow } from '../src/types';
import { palette, typography } from '../src/theme';
import { formatDuration, formatTimestamp } from '../src/utils/format';

const emptyCopy = getDashboardEmptyStateCopy();

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

  const importButtonLabel = isImporting ? 'Importing…' : 'Import audio';

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
                <EditorialHero
                  eyebrow="Local-first meeting companion"
                  title="Record it. Upload it. Process it later."
                  body="No bots. No calendar magic. Just a clean path from audio to transcript and action items."
                  pillLabel={`${meetings.length} saved`}
                  chips={['Local-first', 'Manual capture', 'Post-call AI']}
                />
              </FadeInView>

              <FadeInView style={styles.primaryActions} delay={60}>
                <PillButton
                  label="New recording"
                  icon={
                    <MaterialCommunityIcons
                      name="microphone-outline"
                      size={18}
                      color={palette.card}
                    />
                  }
                  onPress={() => router.push('/record')}
                />
                <PillButton
                  label={importButtonLabel}
                  icon={<Feather name="upload" size={18} color={palette.ink} />}
                  onPress={handleImport}
                  variant="secondary"
                  disabled={isImporting}
                />
              </FadeInView>

              <FadeInView delay={90}>
                <SurfaceCard muted style={styles.accountCard}>
                  <Text style={styles.accountEyebrow}>Cloud status</Text>
                  <Text style={styles.accountTitle}>
                    {session ? `Signed in as ${session.user.email}` : 'Cloud account not connected'}
                  </Text>
                  <Text style={styles.accountBody}>
                    {session
                      ? session.user.driveConnection.status === 'connected'
                        ? 'Google Drive is linked for optional sync and backup.'
                        : 'Finish linking Google Drive when you are ready for optional cloud storage.'
                      : 'This app works locally first. Connect an account only if you want cloud storage later.'}
                  </Text>
                  <View style={styles.accountActions}>
                    <PillButton
                      label={session ? 'Manage account' : 'Set up account'}
                      onPress={() => router.push('/account')}
                      variant="ghost"
                    />
                    <PillButton
                      label="Settings"
                      onPress={() => router.push('/settings')}
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
              <Pressable onPress={() => router.push(`/meetings/${item.id}`)}>
                <SurfaceCard style={styles.meetingCard}>
                  <View style={styles.meetingHeader}>
                    <Text style={styles.meetingTitle}>{item.title}</Text>
                    <StatusChip label={statusMeta.label} tone={statusMeta.tone} />
                  </View>
                  <Text style={styles.meetingMeta}>
                    {formatTimestamp(item.createdAt)}
                    {item.durationMs ? ` • ${formatDuration(item.durationMs)}` : ''}
                  </Text>
                  <Text style={styles.meetingSnippet} numberOfLines={2}>
                    {item.summaryShort ||
                      item.transcriptText?.slice(0, 120) ||
                      'Open this meeting to process it.'}
                  </Text>
                  <View style={styles.meetingAction}>
                    <PillButton
                      label="Open meeting"
                      onPress={() => router.push(`/meetings/${item.id}`)}
                      variant="ghost"
                    />
                  </View>
                </SurfaceCard>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <SurfaceCard muted style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
              <Text style={styles.emptyBody}>{emptyCopy.body}</Text>
              <View style={styles.emptyActions}>
                <PillButton label="New recording" onPress={() => router.push('/record')} />
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
    paddingBottom: 32,
    gap: 14,
  },
  headerContent: {
    gap: 16,
    paddingBottom: 8,
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  accountCard: {
    gap: 10,
  },
  accountEyebrow: {
    color: palette.accent,
    fontFamily: typography.label.fontFamily,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  accountTitle: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 18,
  },
  accountBody: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    lineHeight: 21,
  },
  accountActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginLeft: -8,
  },
  meetingCard: {
    gap: 10,
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
    fontSize: 18,
  },
  meetingMeta: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
  },
  meetingSnippet: {
    color: palette.ink,
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    lineHeight: 20,
  },
  meetingAction: {
    alignItems: 'flex-start',
    marginLeft: -8,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
  },
  emptyTitle: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 22,
  },
  emptyBody: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  emptyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
  },
});
