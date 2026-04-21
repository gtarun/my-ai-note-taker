import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FadeInView } from '../components/FadeInView';
import { KeyboardAwareScrollView } from '../components/KeyboardAwareScrollView';
import { ScreenBackground } from '../components/ScreenBackground';
import { EditorialHero } from '../components/ui/EditorialHero';
import { PillButton } from '../components/ui/PillButton';
import { SectionHeading } from '../components/ui/SectionHeading';
import { StatusChip } from '../components/ui/StatusChip';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { getMeetingDetailEntryMethod } from '../features/meetings/navigation';
import {
  getButtonAccessibilityLabel,
  getButtonDisabled,
  getButtonIconName,
  getButtonLabel,
  getButtonVariant,
  getConsentBody,
  getConsentHeading,
  getHeroBody,
  getHeroEyebrow,
  getHeroHeadline,
  getNoticeBody,
  getNoticeTitle,
  getStatusLabel,
  getStatusTone,
  getTimerAccessibilityLabel,
  getTitlePlaceholder,
} from '../features/recording/presentation';
import { getMeetingDetailRoute } from '../navigation/routes';
import { recordingSession } from '../services/recordingSession';
import { formatDuration } from '../utils/format';
import { palette, typography } from '../theme';

export default function RecordScreen() {
  const [sessionSnapshot, setSessionSnapshot] = useState(() => recordingSession.getSnapshot());

  useEffect(() => {
    setSessionSnapshot(recordingSession.getSnapshot());
    return recordingSession.subscribe((snapshot) => {
      setSessionSnapshot(snapshot);
    });
  }, []);

  const { phase, titleDraft, durationMillis } = sessionSnapshot;

  const handleRecordToggle = async () => {
    if (phase === 'recording') {
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
      Alert.alert('Recording failed', error instanceof Error ? error.message : 'Unable to start recording.');
    }
  };

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

        <FadeInView delay={70}>
          <SurfaceCard style={styles.cardGap}>
            <TextInput
              style={styles.input}
              placeholder={getTitlePlaceholder()}
              placeholderTextColor={palette.mutedInk}
              value={titleDraft}
              onChangeText={(nextTitle) => recordingSession.setTitleDraft(nextTitle)}
              accessibilityLabel="Meeting title"
            />

            <StatusChip
              label={getStatusLabel(phase)}
              tone={getStatusTone(phase)}
              accessibilityLabel={getStatusLabel(phase)}
            />

            <View
              style={styles.timerWrap}
              accessibilityLabel={getTimerAccessibilityLabel(durationMillis)}
            >
              <Text style={styles.timerValue}>{formatDuration(durationMillis)}</Text>
            </View>

            <PillButton
              label={getButtonLabel(phase)}
              variant={getButtonVariant(phase)}
              icon={
                <MaterialCommunityIcons
                  name={getButtonIconName(phase)}
                  size={20}
                  color={palette.card}
                />
              }
              disabled={getButtonDisabled(phase)}
              accessibilityLabel={getButtonAccessibilityLabel(phase)}
              onPress={handleRecordToggle}
            />
          </SurfaceCard>
        </FadeInView>

        <FadeInView delay={140}>
          <SurfaceCard muted style={styles.noticeGap}>
            <SectionHeading title={getNoticeTitle()} />
            <Text style={styles.noticeBody}>{getNoticeBody()}</Text>
          </SurfaceCard>
        </FadeInView>

        <FadeInView delay={210}>
          <SectionHeading title={getConsentHeading()} />
          <Text style={styles.consentBody}>{getConsentBody()}</Text>
        </FadeInView>
      </KeyboardAwareScrollView>
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
  cardGap: {
    gap: 14,
  },
  input: {
    backgroundColor: palette.paper,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    color: palette.ink,
    fontFamily: typography.body.fontFamily,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  timerWrap: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  timerValue: {
    color: palette.ink,
    fontFamily: typography.display.fontFamily,
    fontSize: 56,
  },
  noticeGap: {
    gap: 6,
  },
  noticeBody: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    lineHeight: 21,
    fontSize: 15,
  },
  consentBody: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    lineHeight: 21,
    fontSize: 15,
    marginTop: 4,
  },
});
