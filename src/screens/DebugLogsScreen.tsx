import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FadeInView } from '../components/FadeInView';
import { ScreenBackground } from '../components/ScreenBackground';
import { PillButton, SectionHeading, StatusChip, SurfaceCard } from '../components/ui';
import {
  buildShareableAppLogs,
  clearAppLogs,
  formatLogEntry,
  getAppLogs,
  type AppLogEntry,
} from '../services/appLogs';
import { palette, radii, typography } from '../theme';

const LOG_LIMIT = 200;

export default function DebugLogsScreen() {
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const latestLog = logs[0] ?? null;
  const errorCount = useMemo(() => logs.filter((log) => log.level === 'error').length, [logs]);

  const loadLogs = useCallback(async (refreshing = false) => {
    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      setLogs(await getAppLogs(LOG_LIMIT));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load debug logs.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadLogs();
    }, [loadLogs])
  );

  const handleCopy = async () => {
    const text = await buildShareableAppLogs(LOG_LIMIT);
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Debug logs are now on your clipboard.');
  };

  const handleShare = async () => {
    const text = await buildShareableAppLogs(LOG_LIMIT);
    await Share.share({
      title: 'Mu Fathom debug logs',
      message: text,
    });
  };

  const handleClear = () => {
    Alert.alert('Clear debug logs?', 'This removes the saved logs from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear logs',
        style: 'destructive',
        onPress: () => {
          void clearAppLogs().then(() => loadLogs());
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Debug logs' }} />
      <ScreenBackground />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadLogs(true)} />}
        contentContainerStyle={styles.container}
      >
        <FadeInView>
          <SectionHeading
            title="Debug logs"
            subtitle="Share these when local transcription or analysis gets stuck. They include processing steps and timing, not transcript text or API keys."
          />
        </FadeInView>

        <FadeInView delay={30}>
          <SurfaceCard muted style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroIcon}>
                <Feather name="activity" size={24} color={palette.accent} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>Processing trace</Text>
                <Text style={styles.heroBody} selectable>
                  {latestLog
                    ? `Latest: ${latestLog.scope} - ${latestLog.message}`
                    : 'No logs yet. Run transcription or analysis, then come back here.'}
                </Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <StatusChip label={`${logs.length} entries`} tone="secondary" />
              <StatusChip label={`${errorCount} errors`} tone={errorCount > 0 ? 'danger' : 'tertiary'} />
            </View>
            <View style={styles.actionsRow}>
              <PillButton
                label="Share logs"
                onPress={handleShare}
                icon={<Feather name="share" size={16} color={palette.card} />}
              />
              <PillButton
                label="Copy"
                onPress={handleCopy}
                variant="secondary"
                icon={<Feather name="copy" size={16} color={palette.ink} />}
              />
            </View>
          </SurfaceCard>
        </FadeInView>

        <FadeInView delay={55}>
          <View style={styles.utilityRow}>
            <PillButton
              label="Refresh"
              onPress={() => loadLogs(true)}
              variant="secondary"
              icon={<Feather name="refresh-cw" size={16} color={palette.ink} />}
            />
            <PillButton
              label="Clear"
              onPress={handleClear}
              variant="danger"
              icon={<Feather name="trash-2" size={16} color={palette.card} />}
            />
          </View>
        </FadeInView>

        {errorMessage ? (
          <SurfaceCard style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not load logs</Text>
            <Text style={styles.errorBody} selectable>{errorMessage}</Text>
          </SurfaceCard>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={palette.accent} />
            <Text style={styles.loadingText}>Loading logs...</Text>
          </View>
        ) : null}

        {!isLoading && logs.length === 0 ? (
          <SurfaceCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No logs yet</Text>
            <Text style={styles.emptyBody}>
              Start a recording analysis, wait until it reaches Processing, then return here.
            </Text>
          </SurfaceCard>
        ) : null}

        <View style={styles.logList}>
          {logs.map((log) => (
            <LogRow key={log.id} log={log} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LogRow({ log }: { log: AppLogEntry }) {
  return (
    <SurfaceCard style={styles.logCard}>
      <View style={styles.logHeader}>
        <View style={[styles.levelDot, log.level === 'error' && styles.levelDotError]} />
        <Text style={styles.logScope}>{log.scope}</Text>
        <Text style={styles.logLevel}>{log.level.toUpperCase()}</Text>
      </View>
      <Text style={styles.logTime} selectable>{log.createdAt}</Text>
      <Text style={styles.logMessage} selectable>{log.message}</Text>
      {log.metadata ? (
        <Text style={styles.logMetadata} selectable>
          {JSON.stringify(log.metadata, null, 2)}
        </Text>
      ) : null}
      <Pressable
        style={styles.copyOneButton}
        onPress={() => Clipboard.setStringAsync(formatLogEntry(log))}
      >
        <Feather name="copy" size={14} color={palette.accent} />
        <Text style={styles.copyOneText}>Copy entry</Text>
      </Pressable>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  container: {
    padding: 20,
    paddingBottom: 36,
    gap: 18,
  },
  heroCard: {
    gap: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 20,
    fontFamily: typography.heading.fontFamily,
  },
  heroBody: {
    color: palette.mutedInk,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: typography.body.fontFamily,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  utilityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  loadingBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  loadingText: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
  },
  errorCard: {
    backgroundColor: palette.dangerSoft,
    gap: 8,
  },
  errorTitle: {
    color: palette.danger,
    fontSize: 17,
    fontFamily: typography.heading.fontFamily,
  },
  errorBody: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: typography.body.fontFamily,
  },
  emptyCard: {
    gap: 8,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 18,
    fontFamily: typography.heading.fontFamily,
  },
  emptyBody: {
    color: palette.mutedInk,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: typography.body.fontFamily,
  },
  logList: {
    gap: 12,
  },
  logCard: {
    gap: 10,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  levelDotError: {
    backgroundColor: palette.danger,
  },
  logScope: {
    flex: 1,
    color: palette.ink,
    fontSize: 15,
    fontFamily: typography.label.fontFamily,
  },
  logLevel: {
    color: palette.mutedInk,
    fontSize: 12,
    fontFamily: typography.label.fontFamily,
  },
  logTime: {
    color: palette.mutedInk,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontFamily: typography.body.fontFamily,
  },
  logMessage: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: typography.bodyStrong.fontFamily,
  },
  logMetadata: {
    color: palette.mutedInk,
    fontSize: 12,
    lineHeight: 18,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: palette.cardMuted,
    fontFamily: typography.body.fontFamily,
  },
  copyOneButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: palette.accentSoft,
  },
  copyOneText: {
    color: palette.accent,
    fontSize: 13,
    fontFamily: typography.label.fontFamily,
  },
});
