import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { palette, radii, typography } from '../theme';
import type { MeetingProcessingProgressState, StageInfo } from './meetingProcessingProgressState';
import { useTheme, useThemedStyles, type Palette } from '../hooks/useTheme';

export type {
  MeetingProcessingProgressState,
  StageInfo,
  StagePhase,
  StageState,
} from './meetingProcessingProgressState';
export {
  applyProgressEvent,
  createInitialProgressState,
  markProgressFailed,
} from './meetingProcessingProgressState';

export function MeetingProcessingProgress({
  state,
}: {
  state: MeetingProcessingProgressState;
}) {
  const [now, setNow] = useState(Date.now());

  // Tick every second so the elapsed counter on the active stage stays live.
  // Stop ticking once nothing is active, to avoid spurious renders.
  const hasActiveStage = state.stages.some((stage) => stage.state === 'active');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!hasActiveStage) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [hasActiveStage]);

  const palette = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PROCESSING</Text>
        <Text style={styles.title}>
          {state.completed ? 'Done' : state.errorMessage ? 'Stopped' : 'Working on this recording'}
        </Text>
        <Text style={styles.body}>
          {state.completed
            ? 'Your transcript and summary are ready below.'
            : state.errorMessage
              ? state.errorMessage
              : 'This screen updates as each step finishes. Local models run on this device’s CPU; cloud providers depend on network.'}
        </Text>
      </View>

      <View style={styles.stages}>
        {state.stages.map((stage) => (
          <StageRow key={stage.phase} stage={stage} now={now} />
        ))}
      </View>

      {state.qualityWarning ? (
        <View style={styles.warning}>
          <View style={styles.warningIcon}>
            <Feather name="alert-triangle" size={16} color={palette.tertiary} />
          </View>
          <Text style={styles.warningText}>{state.qualityWarning}</Text>
        </View>
      ) : null}
    </View>
  );
}

function StageRow({ stage, now }: { stage: StageInfo; now: number }) {
  const palette = useTheme();
  const styles = useThemedStyles(makeStyles);
  const elapsedSeconds =
    stage.state === 'active' && stage.startedAt
      ? Math.max(0, Math.round((now - stage.startedAt) / 1000))
      : null;
  const finishedSeconds =
    stage.finishedDurationMs != null ? Math.max(0, Math.round(stage.finishedDurationMs / 1000)) : null;

  return (
    <View style={styles.stageRow}>
      <View style={styles.stageIcon}>
        {stage.state === 'active' ? (
          <ActivityIndicator size="small" color={palette.accent} />
        ) : stage.state === 'done' ? (
          <MaterialCommunityIcons name="check-circle" size={20} color={palette.accent} />
        ) : stage.state === 'failed' ? (
          <Feather name="x-circle" size={20} color={palette.danger} />
        ) : (
          <Feather name="circle" size={18} color={palette.line} />
        )}
      </View>
      <View style={styles.stageCopy}>
        <Text style={[styles.stageLabel, stage.state === 'pending' && styles.stageLabelPending]}>
          {stage.label}
        </Text>
        {stage.detail ? <Text style={styles.stageDetail}>{stage.detail}</Text> : null}
      </View>
      <Text style={styles.stageTiming}>
        {stage.state === 'active' && elapsedSeconds != null
          ? `${elapsedSeconds}s`
          : stage.state === 'done' && finishedSeconds != null
            ? `${finishedSeconds}s`
            : ''}
      </Text>
    </View>
  );
}

const makeStyles = (palette: Palette) => StyleSheet.create({
  container: {
    backgroundColor: palette.card,
    borderRadius: radii.card,
    padding: 18,
    gap: 14,
  },
  header: { gap: 4 },
  eyebrow: {
    color: palette.tertiary,
    ...typography.label,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.ink,
    ...typography.heading,
    fontSize: 18,
  },
  body: {
    color: palette.mutedInk,
    ...typography.body,
    fontSize: 13,
    lineHeight: 19,
  },
  stages: { gap: 4 },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  stageIcon: { width: 24, alignItems: 'center', justifyContent: 'center' },
  stageCopy: { flex: 1, gap: 2 },
  stageLabel: {
    color: palette.ink,
    ...typography.label,
    fontSize: 14,
  },
  stageLabelPending: { color: palette.mutedInk },
  stageDetail: {
    color: palette.mutedInk,
    ...typography.body,
    fontSize: 12,
  },
  stageTiming: {
    color: palette.mutedInk,
    ...typography.body,
    fontSize: 12,
    minWidth: 32,
    textAlign: 'right',
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: palette.cardMuted,
    borderRadius: radii.md,
    padding: 12,
    borderLeftWidth: 2,
    borderLeftColor: palette.tertiary,
  },
  warningIcon: {
    width: 24,
    height: 24,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.tertiarySoft,
  },
  warningText: {
    flex: 1,
    color: palette.ink,
    ...typography.body,
    fontSize: 13,
    lineHeight: 19,
  },
});
