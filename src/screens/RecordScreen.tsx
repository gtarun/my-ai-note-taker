import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FadeInView } from '../components/FadeInView';
import { KeyboardAwareScrollView } from '../components/KeyboardAwareScrollView';
import { ScreenBackground } from '../components/ScreenBackground';
import { EditorialHero } from '../components/ui/EditorialHero';
import { RecordButton } from '../components/ui/RecordButton';
import { SectionHeading } from '../components/ui/SectionHeading';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { Waveform } from '../components/ui/Waveform';
import { getMeetingDetailEntryMethod } from '../features/meetings/navigation';
import {
  getButtonAccessibilityLabel,
  getButtonDisabled,
  getConsentBody,
  getConsentHeading,
  getHeroBody,
  getHeroEyebrow,
  getHeroHeadline,
  getNoticeBody,
  getNoticeTitle,
  getStatusLabel,
  getTimerAccessibilityLabel,
  getTitlePlaceholder,
} from '../features/recording/presentation';
import { getMeetingDetailRoute } from '../navigation/routes';
import { MICROPHONE_PERMISSION_ERROR, recordingSession } from '../services/recordingSession';
import { formatDuration } from '../utils/format';
import { palette, radii, spacing, type, typography } from '../theme';

export default function RecordScreen() {
  const [sessionSnapshot, setSessionSnapshot] = useState(() => recordingSession.getSnapshot());

  useEffect(() => {
    setSessionSnapshot(recordingSession.getSnapshot());
    return recordingSession.subscribe((snapshot) => {
      setSessionSnapshot(snapshot);
    });
  }, []);

  const {
    phase,
    titleDraft,
    durationMillis,
    liveTranscript,
    liveTranscriptionEnabled,
    inputLevel,
  } = sessionSnapshot;

  const isRecording = phase === 'recording';
  const isBusy = phase === 'saving';

  const handleRecordToggle = async () => {
    if (isRecording) {
      try {
        const result = await recordingSession.stopAndSave();

        if (result.driveOutcome === 'failed') {
          Alert.alert(
            'Google Drive',
            'The recording is saved on this device, but uploading to Google Drive failed. Check your connection and folder settings on the Account screen.'
          );
        }

        const detailRoute = getMeetingDetailRoute(result.meetingId);

        if (getMeetingDetailEntryMethod() === 'push') {
          router.push(detailRoute);
        } else {
          router.replace(detailRoute);
        }
      } catch (error) {
        Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save recording.');
      }

      return;
    }

    try {
      await recordingSession.startRecording();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start recording.';

      // iOS only ever shows the microphone prompt once. After a denial the only
      // way back is the system settings app, so offer it rather than leaving the
      // Record tab permanently unusable.
      if (message === MICROPHONE_PERMISSION_ERROR) {
        Alert.alert(
          'Microphone access needed',
          'AI Notes needs microphone access to record meetings. You can turn it on in Settings.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => void Linking.openSettings() },
          ]
        );
        return;
      }

      Alert.alert('Recording failed', message);
    }
  };

  /*
   * While recording the screen becomes a dark stage: the microphone is open, so
   * the interface gets out of the way and the only bright things are the level
   * meter and the words being heard. Everything else — the title field, the
   * consent copy, the explanations — belongs to the moment before or after.
   */
  if (isRecording || isBusy) {
    return (
      <SafeAreaView style={styles.stageSafeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.stage}>
          <View style={styles.stageHeader}>
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>{getStatusLabel(phase).toUpperCase()}</Text>
            </View>
            <Text style={styles.stageMeta}>
              {liveTranscriptionEnabled ? 'Apple Speech · on device' : 'Audio only'}
            </Text>
          </View>

          <View style={styles.stageCenter}>
            <View
              accessible
              accessibilityRole="timer"
              accessibilityLabel={getTimerAccessibilityLabel(durationMillis)}
            >
              <Text style={styles.stageTimer}>{formatDuration(durationMillis)}</Text>
            </View>

            <Waveform
              level={isBusy ? 0.06 : inputLevel}
              color={palette.accentLit}
              height={104}
              bars={34}
              style={styles.wave}
            />

            {liveTranscriptionEnabled ? (
              <View style={styles.liveTranscriptBlock}>
                <Text style={styles.stageEyebrow}>LIVE TRANSCRIPT</Text>
                <Text
                  style={styles.liveTranscriptText}
                  numberOfLines={4}
                  accessibilityLabel={
                    liveTranscript ? `Live transcript: ${liveTranscript}` : 'Listening for speech'
                  }
                >
                  {liveTranscript || 'Listening — speak naturally. This stays on your device.'}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.stageFooter}>
            <RecordButton
              isRecording={isRecording}
              disabled={getButtonDisabled(phase)}
              accessibilityLabel={getButtonAccessibilityLabel(phase)}
              onPress={handleRecordToggle}
            />
            <Text style={styles.stageHint}>{isBusy ? 'Saving…' : 'Tap to stop and save'}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        <FadeInView delay={0}>
          <EditorialHero
            eyebrow={getHeroEyebrow()}
            title={getHeroHeadline()}
            body={getHeroBody()}
          />
        </FadeInView>

        <FadeInView delay={60}>
          <SurfaceCard style={styles.readyCard}>
            <TextInput
              style={styles.input}
              placeholder={getTitlePlaceholder()}
              placeholderTextColor={palette.faintInk}
              value={titleDraft}
              onChangeText={(nextTitle) => recordingSession.setTitleDraft(nextTitle)}
              accessibilityLabel="Meeting title"
            />

            <View style={styles.readyControl}>
              <RecordButton
                isRecording={false}
                disabled={getButtonDisabled(phase)}
                accessibilityLabel={getButtonAccessibilityLabel(phase)}
                onPress={handleRecordToggle}
              />
              <Text style={styles.readyHint}>Tap to start recording</Text>
            </View>
          </SurfaceCard>
        </FadeInView>

        <FadeInView delay={120}>
          <SurfaceCard muted level="flat" style={styles.noticeCard}>
            <SectionHeading title={getNoticeTitle()} />
            <Text style={styles.noticeBody}>{getNoticeBody()}</Text>
          </SurfaceCard>
        </FadeInView>

        <FadeInView delay={180}>
          <View style={styles.consentBlock}>
            <SectionHeading title={getConsentHeading()} />
            <Text style={styles.consentBody}>{getConsentBody()}</Text>
          </View>
        </FadeInView>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.paper },
  container: { padding: spacing.xl, gap: spacing.lg },

  readyCard: { gap: spacing.xl },
  input: {
    backgroundColor: palette.paper,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.lineSoft,
    color: palette.ink,
    ...typography.body,
    ...type.body,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  readyControl: { alignItems: 'center', gap: spacing.md, paddingBottom: spacing.xs },
  readyHint: { ...typography.body, ...type.caption, color: palette.mutedInk },

  noticeCard: { gap: spacing.xs },
  noticeBody: { ...typography.body, ...type.bodySm, color: palette.mutedInk },
  consentBlock: { gap: spacing.xs },
  consentBody: { ...typography.body, ...type.bodySm, color: palette.mutedInk },

  // ── recording stage ──────────────────────────────────────────────────────
  stageSafeArea: { flex: 1, backgroundColor: palette.stage },
  stage: { flex: 1, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  stageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: palette.clay },
  liveLabel: {
    ...typography.label,
    ...type.micro,
    color: palette.clay,
  },
  stageMeta: { ...typography.body, ...type.caption, color: palette.stageMutedInk },
  stageEyebrow: {
    ...typography.label,
    ...type.micro,
    color: palette.stageMutedInk,
  },

  stageCenter: { flex: 1, justifyContent: 'center', gap: spacing.xxl },
  stageTimer: {
    ...typography.mono,
    ...type.timer,
    color: palette.stageInk,
    textAlign: 'center',
  },
  wave: { paddingHorizontal: spacing.xs },
  liveTranscriptBlock: { gap: spacing.sm },
  liveTranscriptText: {
    ...typography.body,
    ...type.bodySm,
    color: palette.stageMutedInk,
    lineHeight: 21,
  },

  stageFooter: { alignItems: 'center', gap: spacing.md, paddingBottom: spacing.sm },
  stageHint: { ...typography.body, ...type.caption, color: palette.stageMutedInk },
});
