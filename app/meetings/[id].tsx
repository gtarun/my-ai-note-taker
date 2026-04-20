import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FadeInView } from '../../src/components/FadeInView';
import { KeyboardAwareScrollView } from '../../src/components/KeyboardAwareScrollView';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import {
  MEETING_DETAIL_TITLE_ACTION_SLOT_MIN_WIDTH,
  getExtractionSyncLabel,
  getMeetingDetailActionItemsCopyText,
  getMeetingDetailDecisionsCopyText,
  getMeetingDetailExtractionCopyText,
  getMeetingDetailPrimaryActionLabel,
  getMeetingDetailSummaryCopyText,
  getMeetingDetailTitleDraftState,
  getMeetingDetailTranscriptCopyText,
  getPlaybackActionLabel,
} from '../../src/features/meetings/detailPresentation';
import { getMeetingDetailHeaderPresentation } from '../../src/features/meetings/navigation';
import { APP_TABS_ROUTE, LAYERS_ROUTE } from '../../src/navigation/routes';
import { listExtractionLayers } from '../../src/services/extractionLayers';
import {
  deleteMeeting,
  getMeeting,
  processMeeting,
  renameMeeting,
  saveMeetingExtractionValues,
  syncMeetingExtractionResult,
} from '../../src/services/meetings';
import type { ExtractionLayer, MeetingRow, SummaryPayload } from '../../src/types';
import { elevation, palette } from '../../src/theme';
import { formatDuration, formatTimestamp } from '../../src/utils/format';

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [meeting, setMeeting] = useState<MeetingRow | null>(null);
  const [availableLayers, setAvailableLayers] = useState<ExtractionLayer[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [extractionDraftValues, setExtractionDraftValues] = useState<Record<string, string>>({});
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isSavingExtraction, setIsSavingExtraction] = useState(false);
  const [isSyncingExtraction, setIsSyncingExtraction] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLayerPickerVisible, setIsLayerPickerVisible] = useState(false);
  const [copiedSection, setCopiedSection] = useState<CopyableMeetingSection | null>(null);
  const player = useAudioPlayer(meeting?.audioUri ?? null);
  const playerStatus = useAudioPlayerStatus(player);
  const canReturnToPreviousScreen = router.canGoBack();
  const headerPresentation = getMeetingDetailHeaderPresentation(canReturnToPreviousScreen);
  const screenOptions = getMeetingDetailScreenOptions(headerPresentation, () => {
    if (headerPresentation.fallback) {
      router.replace(headerPresentation.fallback.href);
    }
  });

  const loadMeeting = useCallback(async () => {
    if (!id) {
      setHasLoaded(true);
      return;
    }

    const [data, layers] = await Promise.all([getMeeting(id), listExtractionLayers()]);
    setMeeting(data);
    setAvailableLayers(layers);
    setDraftTitle(data?.title ?? '');
    setHasLoaded(true);
  }, [id]);

  useEffect(() => {
    if (meeting?.audioUri) {
      player.replace(meeting.audioUri);
    }
  }, [meeting?.audioUri, player]);

  useEffect(() => {
    if (!copiedSection) {
      return;
    }

    const timeout = setTimeout(() => {
      setCopiedSection((currentSection) => (currentSection === copiedSection ? null : currentSection));
    }, 1200);

    return () => {
      clearTimeout(timeout);
    };
  }, [copiedSection]);

  useEffect(() => {
    setExtractionDraftValues(meeting?.extractionResult?.values ?? {});
  }, [meeting?.extractionResult]);

  useFocusEffect(
    useCallback(() => {
      void loadMeeting();
    }, [loadMeeting])
  );

  const runAnalysis = async (layerId?: string | null) => {
    if (!id) {
      return;
    }

    try {
      setIsBusy(true);
      await processMeeting(id, { layerId: layerId ?? null });
      await loadMeeting();
    } catch (error) {
      Alert.alert('Processing failed', error instanceof Error ? error.message : 'Unable to process meeting.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleProcess = () => {
    setIsLayerPickerVisible(true);
  };

  const handleShare = async () => {
    if (!meeting) {
      return;
    }

    await Share.share({
      title: meeting.title,
      message: buildShareText(meeting),
    });
  };

  const handleRename = async () => {
    if (!meeting || !id) {
      return;
    }

    try {
      setIsSavingTitle(true);
      await renameMeeting(id, draftTitle);
      await loadMeeting();
    } catch (error) {
      Alert.alert('Rename failed', error instanceof Error ? error.message : 'Unable to rename meeting.');
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleDelete = async () => {
    if (!meeting || !id) {
      return;
    }

    Alert.alert('Delete recording?', 'This removes the audio file, transcript, summary, and extracted data from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsDeleting(true);
            player.pause();
            await deleteMeeting(id);
            router.replace(APP_TABS_ROUTE);
          } catch (error) {
            Alert.alert(
              'Delete failed',
              error instanceof Error ? error.message : 'Unable to delete this recording.'
            );
          } finally {
            setIsDeleting(false);
          }
        },
      },
    ]);
  };

  const handlePlaybackToggle = () => {
    if (playerStatus.playing) {
      player.pause();
      return;
    }

    player.play();
  };

  const handleCopySection = async (section: CopyableMeetingSection, text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedSection(section);
    } catch (error) {
      Alert.alert('Copy failed', error instanceof Error ? error.message : 'Unable to copy this text.');
    }
  };

  const handleSaveExtraction = async () => {
    if (!meeting?.extractionResult || !id) {
      return;
    }

    try {
      setIsSavingExtraction(true);
      await saveMeetingExtractionValues(id, extractionDraftValues);
      await loadMeeting();
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save extracted values.');
    } finally {
      setIsSavingExtraction(false);
    }
  };

  const handleSyncExtraction = async () => {
    if (!meeting?.extractionResult || !id) {
      return;
    }

    try {
      setIsSyncingExtraction(true);
      await saveMeetingExtractionValues(id, extractionDraftValues);
      await syncMeetingExtractionResult(id);
      await loadMeeting();
      Alert.alert('Synced', 'The extracted row was sent to Google Sheets.');
    } catch (error) {
      await loadMeeting();
      Alert.alert('Sync failed', error instanceof Error ? error.message : 'Unable to sync this row.');
    } finally {
      setIsSyncingExtraction(false);
    }
  };

  if (!hasLoaded) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={screenOptions} />
        <ActivityIndicator size="large" color={palette.ink} />
      </View>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={screenOptions} />
        <ScreenBackground />
        <View style={styles.centered}>
          <Text style={styles.notFoundTitle}>Meeting not found</Text>
          <Text style={styles.notFoundBody}>
            This recording may have been deleted or the link is no longer valid.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const summary = parseSummary(meeting.summaryJson);
  const extraction = meeting.extractionResult;
  const titleDraftState = getMeetingDetailTitleDraftState(draftTitle, meeting.title);
  const summaryCopyText = getMeetingDetailSummaryCopyText(summary);
  const actionItemsCopyText = getMeetingDetailActionItemsCopyText(summary);
  const decisionsCopyText = getMeetingDetailDecisionsCopyText(summary);
  const transcriptCopyText = getMeetingDetailTranscriptCopyText(meeting.transcriptText);
  const extractionRows =
    extraction?.fields.map((field) => ({
      id: field.id,
      title: field.title,
      description: field.description,
      value: extractionDraftValues[field.id] ?? '',
    })) ?? [];
  const extractionCopyText = getMeetingDetailExtractionCopyText(
    extractionRows.map((row) => ({ title: row.title, value: row.value }))
  );
  const extractionHasChanges =
    extraction?.fields.some((field) => (extraction.values[field.id] ?? '') !== (extractionDraftValues[field.id] ?? '')) ??
    false;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={screenOptions} />
      <ScreenBackground />
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        <FadeInView style={styles.headerCard}>
          <View style={styles.titleRow}>
            <TextInput
              style={styles.titleInput}
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder="Meeting title"
              placeholderTextColor={palette.mutedInk}
            />
            <View style={styles.inlineSaveSlot}>
              {titleDraftState.showSave ? (
                <Pressable
                  style={[
                    styles.inlineSaveButton,
                    (isSavingTitle || titleDraftState.isDisabled) && styles.inlineSaveButtonDisabled,
                  ]}
                  onPress={handleRename}
                  disabled={isSavingTitle || titleDraftState.isDisabled}
                >
                  <Feather name={isSavingTitle ? 'loader' : 'check'} size={16} color={palette.card} />
                  <Text style={styles.inlineSaveButtonText}>{isSavingTitle ? 'Saving…' : 'Save'}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Text style={styles.meta}>
            {formatTimestamp(meeting.createdAt)}
            {meeting.durationMs ? ` • ${formatDuration(meeting.durationMs)}` : ''}
          </Text>
          <View style={styles.statusWrap}>
            <View style={styles.statusRow}>
              <StatusIcon status={meeting.status} />
              <Text style={styles.status}>Status: {meeting.status.replace('_', ' ')}</Text>
            </View>
          </View>
          {meeting.errorMessage ? <Text style={styles.errorText}>{meeting.errorMessage}</Text> : null}
        </FadeInView>

        <FadeInView style={styles.primaryActionWrap} delay={60}>
          <Pressable style={styles.primaryButton} onPress={handleProcess} disabled={isBusy}>
            <MaterialCommunityIcons name="text-box-search-outline" size={18} color={palette.paper} />
            <Text style={styles.primaryButtonText}>{getMeetingDetailPrimaryActionLabel(isBusy)}</Text>
          </Pressable>
        </FadeInView>

        <FadeInView style={styles.secondaryActions} delay={90}>
          <Pressable style={styles.secondaryButton} onPress={handlePlaybackToggle}>
            <Feather
              name={playerStatus.playing ? 'pause-circle' : 'play-circle'}
              size={17}
              color={palette.ink}
            />
            <Text style={styles.secondaryButtonText}>{getPlaybackActionLabel(playerStatus.playing)}</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={handleShare}>
            <Feather name="share-2" size={17} color={palette.ink} />
            <Text style={styles.secondaryButtonText}>Share</Text>
          </Pressable>
        </FadeInView>

        <Section
          title="Summary"
          delay={120}
          isCopied={copiedSection === 'summary'}
          onCopyPress={() => handleCopySection('summary', summaryCopyText)}
        >
          <Text style={styles.bodyText}>{summaryCopyText}</Text>
        </Section>

        <Section
          title="Action items"
          delay={150}
          isCopied={copiedSection === 'actionItems'}
          onCopyPress={() => handleCopySection('actionItems', actionItemsCopyText)}
        >
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

        <Section
          title="Decisions"
          delay={180}
          isCopied={copiedSection === 'decisions'}
          onCopyPress={() => handleCopySection('decisions', decisionsCopyText)}
        >
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

        <Section
          title="Extracted data"
          delay={195}
          isCopied={copiedSection === 'extractedData'}
          onCopyPress={extraction ? () => handleCopySection('extractedData', extractionCopyText) : undefined}
        >
          {extraction ? (
            <View style={styles.extractionWrap}>
              <View style={styles.extractionMetaRow}>
                <Text style={styles.extractionMetaText}>Layer: {extraction.layerName}</Text>
                <View
                  style={[
                    styles.extractionSyncBadge,
                    extraction.syncStatus === 'synced' && styles.extractionSyncBadgeReady,
                    extraction.syncStatus === 'sync_failed' && styles.extractionSyncBadgeFailed,
                  ]}
                >
                  <Text
                    style={[
                      styles.extractionSyncBadgeText,
                      extraction.syncStatus === 'synced' && styles.extractionSyncBadgeTextReady,
                      extraction.syncStatus === 'sync_failed' && styles.extractionSyncBadgeTextFailed,
                    ]}
                  >
                    {getExtractionSyncLabel(extraction.syncStatus)}
                  </Text>
                </View>
              </View>

              {extraction.extractionErrorMessage ? (
                <Text style={styles.extractionErrorText}>{extraction.extractionErrorMessage}</Text>
              ) : null}
              {extraction.syncErrorMessage ? (
                <Text style={styles.extractionErrorText}>{extraction.syncErrorMessage}</Text>
              ) : null}

              {extractionRows.map((row) => (
                <View key={row.id} style={styles.extractionFieldCard}>
                  <Text style={styles.extractionFieldTitle}>{row.title}</Text>
                  {row.description ? <Text style={styles.extractionFieldDescription}>{row.description}</Text> : null}
                  <TextInput
                    style={styles.extractionInput}
                    value={row.value}
                    onChangeText={(value) =>
                      setExtractionDraftValues((current) => ({
                        ...current,
                        [row.id]: value,
                      }))
                    }
                    placeholder="No value extracted yet"
                    placeholderTextColor={palette.mutedInk}
                    multiline
                  />
                </View>
              ))}

              <View style={styles.extractionActions}>
                <Pressable
                  style={[
                    styles.secondaryButton,
                    (!extractionHasChanges || isSavingExtraction || isSyncingExtraction) && styles.secondaryButtonDisabled,
                  ]}
                  onPress={handleSaveExtraction}
                  disabled={!extractionHasChanges || isSavingExtraction || isSyncingExtraction}
                >
                  <Feather name="save" size={17} color={palette.ink} />
                  <Text style={styles.secondaryButtonText}>{isSavingExtraction ? 'Saving…' : 'Save changes'}</Text>
                </Pressable>

                <Pressable
                  style={[styles.primaryButton, styles.extractionSyncButton, isSyncingExtraction && styles.primaryButtonDisabled]}
                  onPress={handleSyncExtraction}
                  disabled={isSyncingExtraction}
                >
                  <Feather name="upload-cloud" size={17} color={palette.paper} />
                  <Text style={styles.primaryButtonText}>
                    {isSyncingExtraction ? 'Syncing…' : 'Sync to Google Sheets'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.bodyText}>No extracted data yet. Choose a layer when you run Analyze.</Text>
          )}
        </Section>

        <Section
          title="Transcript"
          delay={210}
          isCopied={copiedSection === 'transcript'}
          onCopyPress={() => handleCopySection('transcript', transcriptCopyText)}
        >
          <Text style={styles.transcriptText}>{transcriptCopyText}</Text>
        </Section>

        <Section title="Recording" delay={240}>
          <Text style={styles.bodyText}>
            {playerStatus.playing ? 'Playing now.' : 'Ready to play.'}
            {playerStatus.duration ? ` Total length: ${formatDuration(playerStatus.duration * 1000)}` : ''}
          </Text>
          <Text style={styles.bodyText}>
            Current position: {formatDuration(playerStatus.currentTime * 1000)}
          </Text>
        </Section>

        <FadeInView style={styles.dangerZone} delay={270}>
          <Text style={styles.dangerZoneTitle}>Delete meeting</Text>
          <Text style={styles.dangerZoneBody}>
            This permanently removes the audio file, transcript, summary, and extracted data from this device.
          </Text>
          <Pressable style={styles.dangerButton} onPress={handleDelete} disabled={isDeleting}>
            <Feather name="trash-2" size={16} color={palette.danger} />
            <Text style={styles.dangerButtonText}>{isDeleting ? 'Deleting…' : 'Delete meeting'}</Text>
          </Pressable>
        </FadeInView>
      </KeyboardAwareScrollView>

      <Modal visible={isLayerPickerVisible} animationType="slide" transparent onRequestClose={() => setIsLayerPickerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.layerPickerCard}>
            <View style={styles.layerPickerHeader}>
              <Text style={styles.layerPickerTitle}>Choose an extraction layer</Text>
              <Pressable onPress={() => setIsLayerPickerVisible(false)} hitSlop={10}>
                <Feather name="x" size={20} color={palette.ink} />
              </Pressable>
            </View>
            <Text style={styles.layerPickerBody}>
              Pick a layer for structured extraction, or continue without one to run the normal transcript + summary flow.
            </Text>

            <KeyboardAwareScrollView contentContainerStyle={styles.layerPickerOptions}>
              <Pressable
                style={styles.layerOption}
                onPress={() => {
                  setIsLayerPickerVisible(false);
                  void runAnalysis(null);
                }}
              >
                <Text style={styles.layerOptionTitle}>No layer</Text>
                <Text style={styles.layerOptionBody}>Run transcript + summary only.</Text>
              </Pressable>

              {availableLayers.map((layer) => (
                <Pressable
                  key={layer.id}
                  style={styles.layerOption}
                  onPress={() => {
                    setIsLayerPickerVisible(false);
                    void runAnalysis(layer.id);
                  }}
                >
                  <Text style={styles.layerOptionTitle}>{layer.name}</Text>
                  <Text style={styles.layerOptionBody}>
                    {layer.fields.length} fields
                    {layer.spreadsheetTitle ? ` • ${layer.spreadsheetTitle}` : ' • Google Sheet not connected yet'}
                  </Text>
                </Pressable>
              ))}
            </KeyboardAwareScrollView>

            <View style={styles.layerPickerActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  setIsLayerPickerVisible(false);
                  router.push(LAYERS_ROUTE);
                }}
              >
                <Feather name="layers" size={17} color={palette.ink} />
                <Text style={styles.secondaryButtonText}>Manage layers</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatusIcon({ status }: { status: MeetingRow['status'] }) {
  switch (status) {
    case 'ready':
      return <Feather name="check-circle" size={16} color={palette.accent} />;
    case 'failed':
      return <Feather name="alert-circle" size={16} color={palette.danger} />;
    case 'transcribing':
    case 'transcribing_local':
    case 'summarizing':
    case 'summarizing_local':
      return <Feather name="loader" size={16} color={palette.accent} />;
    default:
      return <Feather name="clock" size={16} color={palette.accent} />;
  }
}

type CopyableMeetingSection = 'summary' | 'actionItems' | 'decisions' | 'extractedData' | 'transcript';

function Section({
  title,
  children,
  delay = 0,
  isCopied = false,
  onCopyPress,
}: {
  title: string;
  children: React.ReactNode;
  delay?: number;
  isCopied?: boolean;
  onCopyPress?: () => void;
}) {
  return (
    <FadeInView style={styles.section} delay={delay}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onCopyPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Copy ${title}`}
            hitSlop={10}
            onPress={onCopyPress}
            style={[styles.sectionCopyButton, isCopied && styles.sectionCopyButtonActive]}
          >
            <Feather
              name={isCopied ? 'check' : 'copy'}
              size={15}
              color={isCopied ? palette.paper : palette.ink}
            />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </FadeInView>
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

function getMeetingDetailScreenOptions(
  headerPresentation: ReturnType<typeof getMeetingDetailHeaderPresentation>,
  handleFallbackPress: () => void
) {
  return {
    headerBackVisible: headerPresentation.headerBackVisible,
    headerBackButtonDisplayMode: headerPresentation.headerBackButtonDisplayMode,
    headerRight:
      headerPresentation.showHeaderFallback && headerPresentation.fallback
        ? () => (
            <Pressable style={styles.headerFallbackButton} onPress={handleFallbackPress}>
              <Feather name="arrow-left" size={16} color={palette.ink} />
              <Text style={styles.headerFallbackButtonText}>{headerPresentation.fallback.label}</Text>
            </Pressable>
          )
        : undefined,
  };
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
    padding: 24,
    gap: 12,
  },
  headerFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headerFallbackButtonText: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  notFoundTitle: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '800',
  },
  notFoundBody: {
    color: palette.mutedInk,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  container: {
    padding: 20,
    gap: 16,
  },
  headerCard: {
    backgroundColor: palette.cardStrong,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 10,
    ...elevation.card,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  titleInput: {
    flex: 1,
    color: palette.ink,
    fontSize: 28,
    fontWeight: '800',
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    paddingBottom: 8,
  },
  inlineSaveSlot: {
    width: MEETING_DETAIL_TITLE_ACTION_SLOT_MIN_WIDTH,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  inlineSaveButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  inlineSaveButtonDisabled: {
    opacity: 0.55,
  },
  inlineSaveButtonText: {
    color: palette.card,
    fontWeight: '700',
    fontSize: 14,
  },
  meta: {
    color: palette.mutedInk,
    fontSize: 14,
  },
  statusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  status: {
    color: palette.accent,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: palette.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryActionWrap: {
    width: '100%',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    width: '100%',
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: palette.ink,
    borderRadius: 18,
    paddingVertical: 15,
    ...elevation.card,
    gap: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: palette.paper,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardStrong,
    gap: 8,
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: palette.ink,
    fontWeight: '700',
  },
  extractionSyncButton: {
    flex: 1,
    minWidth: 220,
  },
  dangerZone: {
    backgroundColor: '#fff4f2',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#efc2bc',
    gap: 12,
  },
  dangerZoneTitle: {
    color: palette.danger,
    fontWeight: '800',
    fontSize: 17,
  },
  dangerZoneBody: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  dangerButton: {
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e7b0aa',
    backgroundColor: '#fff1ee',
    gap: 8,
  },
  dangerButtonText: {
    color: palette.danger,
    fontWeight: '700',
  },
  section: {
    backgroundColor: palette.cardStrong,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 10,
    ...elevation.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: palette.ink,
    fontWeight: '800',
    fontSize: 17,
  },
  sectionCopyButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
  },
  sectionCopyButtonActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accent,
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
  extractionWrap: {
    gap: 12,
  },
  extractionMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  extractionMetaText: {
    flex: 1,
    color: palette.mutedInk,
    fontSize: 13,
    lineHeight: 20,
  },
  extractionSyncBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.card,
  },
  extractionSyncBadgeReady: {
    backgroundColor: '#d7f4e5',
  },
  extractionSyncBadgeFailed: {
    backgroundColor: '#fde3e0',
  },
  extractionSyncBadgeText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  extractionSyncBadgeTextReady: {
    color: '#146c43',
  },
  extractionSyncBadgeTextFailed: {
    color: palette.danger,
  },
  extractionErrorText: {
    color: palette.danger,
    fontSize: 13,
    lineHeight: 20,
  },
  extractionFieldCard: {
    gap: 6,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
  },
  extractionFieldTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  extractionFieldDescription: {
    color: palette.mutedInk,
    fontSize: 13,
    lineHeight: 19,
  },
  extractionInput: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: palette.paper,
    color: palette.ink,
    textAlignVertical: 'top',
  },
  extractionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(22, 29, 37, 0.32)',
    justifyContent: 'flex-end',
  },
  layerPickerCard: {
    maxHeight: '80%',
    backgroundColor: palette.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    gap: 14,
  },
  layerPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  layerPickerTitle: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '800',
  },
  layerPickerBody: {
    color: palette.mutedInk,
    fontSize: 14,
    lineHeight: 21,
  },
  layerPickerOptions: {
    gap: 10,
    paddingBottom: 8,
  },
  layerOption: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    gap: 4,
  },
  layerOptionTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  layerOptionBody: {
    color: palette.mutedInk,
    fontSize: 13,
    lineHeight: 19,
  },
  layerPickerActions: {
    alignItems: 'flex-start',
  },
});
