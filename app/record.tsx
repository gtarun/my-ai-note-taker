import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FadeInView } from '../src/components/FadeInView';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { uploadMeetingRecordingIfConfigured } from '../src/services/googleDrive';
import { createMeetingFromRecording } from '../src/services/meetings';
import { formatDuration } from '../src/utils/format';
import { elevation, palette } from '../src/theme';

export default function RecordScreen() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleRecordToggle = async () => {
    if (recorderState.isRecording) {
      try {
        setIsSaving(true);
        await recorder.stop();
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'duckOthers',
          allowsRecording: false,
          shouldPlayInBackground: false,
          shouldRouteThroughEarpiece: false,
        });
        const uri = recorder.uri ?? recorderState.url;

        if (!uri) {
          throw new Error('Recording finished but no file was returned.');
        }

        const meetingTitle = title.trim() || 'Untitled recording';
        const { id: meetingId, audioUri } = await createMeetingFromRecording({
          uri,
          title: meetingTitle,
          durationMs: recorderState.durationMillis,
        });

        const driveOutcome = await uploadMeetingRecordingIfConfigured({
          title: meetingTitle,
          localAudioUri: audioUri,
        });

        if (driveOutcome === 'failed') {
          Alert.alert(
            'Google Drive',
            'The recording is saved on this device, but uploading to Google Drive failed. Check your connection and folder settings on the Account screen.'
          );
        }

        router.replace(`/meetings/${meetingId}`);
      } catch (error) {
        Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save recording.');
      } finally {
        setIsSaving(false);
      }

      return;
    }

    const permission = await requestRecordingPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Microphone needed', 'Enable microphone access to record a meeting.');
      return;
    }

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        allowsRecording: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      Alert.alert('Recording failed', error instanceof Error ? error.message : 'Unable to start recording.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <FadeInView style={styles.notice}>
          <View style={styles.noticeHeader}>
            <Feather name="shield" size={16} color={palette.ink} />
            <Text style={styles.noticeTitle}>Week-1 safe mode</Text>
          </View>
          <Text style={styles.noticeBody}>
            Keep the app open while recording. This MVP is built for manual foreground recording, not stealth capture.
          </Text>
        </FadeInView>

        <FadeInView style={styles.card} delay={70}>
          <Text style={styles.label}>Meeting title</Text>
          <TextInput
            style={styles.input}
            placeholder="Founder sync, user interview, standup…"
            placeholderTextColor={palette.mutedInk}
            value={title}
            onChangeText={setTitle}
          />

          <View style={styles.timerWrap}>
            <View style={styles.liveChip}>
              {recorderState.isRecording ? (
                <MaterialCommunityIcons name="record-circle" size={14} color={palette.danger} />
              ) : (
                <Feather name="mic" size={13} color={palette.lineStrong} />
              )}
              <Text style={styles.liveChipText}>
                {recorderState.isRecording ? 'Recording live' : 'Ready to record'}
              </Text>
            </View>
            <Text style={styles.timerValue}>{formatDuration(recorderState.durationMillis)}</Text>
            <Text style={styles.timerLabel}>Phone mic, foreground only</Text>
          </View>

          <Pressable
            style={[styles.recordButton, recorderState.isRecording && styles.recordButtonActive]}
            onPress={handleRecordToggle}
            disabled={isSaving}
          >
            <MaterialCommunityIcons
              name={recorderState.isRecording ? 'stop-circle-outline' : 'microphone-outline'}
              size={20}
              color={palette.paper}
            />
            <Text style={styles.recordButtonText}>
              {isSaving ? 'Saving…' : recorderState.isRecording ? 'Stop and save' : 'Start recording'}
            </Text>
          </Pressable>
        </FadeInView>

        <FadeInView style={styles.footerCopy} delay={120}>
          <Text style={styles.footerTitle}>Consent reminder</Text>
          <Text style={styles.footerBody}>
            Make sure everyone in the meeting knows it’s being recorded. You own that responsibility.
          </Text>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  container: {
    padding: 20,
    gap: 16,
  },
  notice: {
    backgroundColor: palette.accentMist,
    borderRadius: 22,
    padding: 18,
    gap: 6,
    borderWidth: 1,
    borderColor: palette.line,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noticeTitle: {
    color: palette.ink,
    fontWeight: '700',
    fontSize: 16,
  },
  noticeBody: {
    color: palette.mutedInk,
    lineHeight: 21,
  },
  card: {
    backgroundColor: palette.cardStrong,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 14,
    ...elevation.card,
  },
  label: {
    color: palette.ink,
    fontWeight: '700',
    fontSize: 14,
  },
  input: {
    backgroundColor: palette.paper,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    color: palette.ink,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  timerWrap: {
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.line,
  },
  liveChipText: {
    color: palette.ink,
    fontWeight: '700',
    fontSize: 13,
  },
  timerLabel: {
    color: palette.mutedInk,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  timerValue: {
    color: palette.ink,
    fontSize: 56,
    fontWeight: '800',
  },
  recordButton: {
    backgroundColor: palette.ink,
    borderRadius: 22,
    paddingVertical: 20,
    alignItems: 'center',
    ...elevation.card,
    gap: 8,
  },
  recordButtonActive: {
    backgroundColor: palette.danger,
  },
  recordButtonText: {
    color: palette.paper,
    fontWeight: '800',
    fontSize: 16,
  },
  footerCopy: {
    gap: 6,
    paddingHorizontal: 4,
  },
  footerTitle: {
    color: palette.ink,
    fontWeight: '700',
    fontSize: 15,
  },
  footerBody: {
    color: palette.mutedInk,
    lineHeight: 21,
  },
});
