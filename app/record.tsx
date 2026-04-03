import { router } from 'expo-router';
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
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

import { createMeetingFromRecording } from '../src/services/meetings';
import { formatDuration } from '../src/utils/format';
import { palette } from '../src/theme';

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
        const uri = recorder.uri ?? recorderState.url;

        if (!uri) {
          throw new Error('Recording finished but no file was returned.');
        }

        const meetingId = await createMeetingFromRecording({
          uri,
          title: title.trim() || 'Untitled recording',
          durationMs: recorderState.durationMillis,
        });

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
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      Alert.alert('Recording failed', error instanceof Error ? error.message : 'Unable to start recording.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Week-1 safe mode</Text>
          <Text style={styles.noticeBody}>
            Keep the app open while recording. This MVP is built for manual foreground recording, not stealth capture.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Meeting title</Text>
          <TextInput
            style={styles.input}
            placeholder="Founder sync, user interview, standup…"
            placeholderTextColor={palette.mutedInk}
            value={title}
            onChangeText={setTitle}
          />

          <View style={styles.timerWrap}>
            <Text style={styles.timerLabel}>Duration</Text>
            <Text style={styles.timerValue}>{formatDuration(recorderState.durationMillis)}</Text>
          </View>

          <Pressable
            style={[styles.recordButton, recorderState.isRecording && styles.recordButtonActive]}
            onPress={handleRecordToggle}
            disabled={isSaving}
          >
            <Text style={styles.recordButtonText}>
              {isSaving ? 'Saving…' : recorderState.isRecording ? 'Stop and save' : 'Start recording'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.footerCopy}>
          <Text style={styles.footerTitle}>Consent reminder</Text>
          <Text style={styles.footerBody}>
            Make sure everyone in the meeting knows it’s being recorded. You own that responsibility.
          </Text>
        </View>
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
    backgroundColor: palette.accentSoft,
    borderRadius: 20,
    padding: 18,
    gap: 6,
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
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 14,
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
    paddingVertical: 8,
    alignItems: 'center',
    gap: 6,
  },
  timerLabel: {
    color: palette.mutedInk,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timerValue: {
    color: palette.ink,
    fontSize: 42,
    fontWeight: '800',
  },
  recordButton: {
    backgroundColor: palette.ink,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
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
