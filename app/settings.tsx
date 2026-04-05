import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  PressableProps,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FadeInView } from '../src/components/FadeInView';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { providerDefinitions, providerMap } from '../src/services/providers';
import { getAppSettings, saveAppSettings } from '../src/services/settings';
import { AppSettings, ProviderConfig, ProviderId } from '../src/types';
import { elevation, palette } from '../src/theme';

export default function SettingsScreen() {
  const [form, setForm] = useState<AppSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getAppSettings().then(setForm);
  }, []);

  if (!form) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading settings…</Text>
      </View>
    );
  }

  const transcriptionProvider = providerMap[form.selectedTranscriptionProvider];
  const summaryProvider = providerMap[form.selectedSummaryProvider];

  const updateForm = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateProvider = <K extends keyof ProviderConfig>(
    providerId: ProviderId,
    key: K,
    value: ProviderConfig[K]
  ) => {
    setForm((current) =>
      current
        ? {
            ...current,
            providers: {
              ...current.providers,
              [providerId]: {
                ...current.providers[providerId],
                [key]: value,
              },
            },
          }
        : current
    );
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await saveAppSettings(form);
      Alert.alert('Saved', 'Provider settings stored locally on this device.');
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <FadeInView style={styles.hero}>
          <View style={styles.heroHeader}>
            <MaterialCommunityIcons name="tune-variant" size={18} color={palette.ink} />
            <Text style={styles.heroTitle}>Provider setup</Text>
          </View>
          <Text style={styles.heroBody}>
            Keep this simple: pick one provider for transcription, one provider for summary, and only fill in the fields that matter for those choices.
          </Text>
        </FadeInView>

        <ProviderSection
          delay={40}
          title="Transcription"
          subtitle="Used for turning audio into text."
          icon={<Feather name="mic" size={18} color={palette.ink} />}
          selectedProviderId={form.selectedTranscriptionProvider}
          providerIds={providerDefinitions.filter((provider) => provider.supportsTranscription).map((p) => p.id)}
          providers={form.providers}
          onSelect={(providerId) => updateForm('selectedTranscriptionProvider', providerId)}
          onChange={updateProvider}
          mode="transcription"
        />

        <ProviderSection
          delay={90}
          title="Summary"
          subtitle="Used for summary, action items, and decisions."
          icon={<Feather name="file-text" size={18} color={palette.ink} />}
          selectedProviderId={form.selectedSummaryProvider}
          providerIds={providerDefinitions.filter((provider) => provider.supportsSummary).map((p) => p.id)}
          providers={form.providers}
          onSelect={(providerId) => updateForm('selectedSummaryProvider', providerId)}
          onChange={updateProvider}
          mode="summary"
        />

        <FadeInView style={styles.card} delay={120}>
          <Text style={styles.cardTitle}>Privacy defaults</Text>
          <View style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Delete remote audio after processing</Text>
              <Text style={styles.rowBody}>Only applies if your provider supports it.</Text>
            </View>
            <Switch
              value={form.deleteUploadedAudio}
              onValueChange={(value) => updateForm('deleteUploadedAudio', value)}
            />
          </View>
        </FadeInView>

        <FadeInView style={styles.notice} delay={150}>
          <View style={styles.noticeHeader}>
            <Feather name="alert-triangle" size={16} color={palette.ink} />
            <Text style={styles.noticeTitle}>Provider rules</Text>
          </View>
          <Text style={styles.noticeBody}>
            OpenRouter now works for transcription and summary. Anthropic and Gemini are still summary-only here. If you want one simple setup, use OpenAI for both.
          </Text>
        </FadeInView>

        <Pressable style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save settings'}</Text>
        </Pressable>

        <FadeInView style={styles.footerHint} delay={180}>
          <Text style={styles.footerHintText}>
            Active now: transcription via {transcriptionProvider.label}, summary via {summaryProvider.label}.
          </Text>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProviderSection({
  title,
  subtitle,
  icon,
  selectedProviderId,
  providerIds,
  providers,
  onSelect,
  onChange,
  mode,
  delay,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  selectedProviderId: ProviderId;
  providerIds: ProviderId[];
  providers: Record<ProviderId, ProviderConfig>;
  onSelect: (providerId: ProviderId) => void;
  onChange: <K extends keyof ProviderConfig>(providerId: ProviderId, key: K, value: ProviderConfig[K]) => void;
  mode: 'transcription' | 'summary';
  delay: number;
}) {
  const provider = providerMap[selectedProviderId];
  const config = providers[selectedProviderId];
  const modelLabel = mode === 'transcription' ? 'Transcription model' : 'Summary model';
  const modelKey = mode === 'transcription' ? 'transcriptionModel' : 'summaryModel';
  const modelOptions = mode === 'transcription' ? provider.transcriptionModels : provider.summaryModels;

  return (
    <FadeInView style={styles.card} delay={delay}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          {icon}
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        <Text style={styles.rowBody}>{subtitle}</Text>
      </View>

      <View style={styles.chipRow}>
        {providerIds.map((providerId) => (
          <ChipButton
            key={providerId}
            label={providerMap[providerId].label}
            selected={selectedProviderId === providerId}
            onPress={() => onSelect(providerId)}
          />
        ))}
      </View>

      <View style={styles.selectedProviderCard}>
        <View style={styles.providerHeader}>
          <View style={styles.providerTitleRow}>
            <ProviderIcon providerId={selectedProviderId} />
            <Text style={styles.selectedProviderTitle}>{provider.label}</Text>
          </View>
          <Text style={styles.activeBadge}>Selected</Text>
        </View>
        <Text style={styles.rowBody}>{provider.description}</Text>

        <Label text="API key" />
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={provider.apiKeyPlaceholder}
          placeholderTextColor={palette.mutedInk}
          secureTextEntry
          value={config.apiKey}
          onChangeText={(value) => onChange(selectedProviderId, 'apiKey', value)}
        />

        <Label text="Base URL" />
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={provider.baseUrlPlaceholder}
          placeholderTextColor={palette.mutedInk}
          value={config.baseUrl}
          onChangeText={(value) => onChange(selectedProviderId, 'baseUrl', value)}
        />

        <Label text={modelLabel} />
        <ModelDropdown
          label={modelLabel}
          value={config[modelKey]}
          options={modelOptions}
          onSelect={(value) => onChange(selectedProviderId, modelKey, value)}
          emptyText={`No ${mode} models configured for ${provider.label} yet.`}
        />
      </View>
    </FadeInView>
  );
}

function ModelDropdown({
  label,
  value,
  options,
  onSelect,
  emptyText,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  emptyText: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!options.length) {
    return <Text style={styles.rowBody}>{emptyText}</Text>;
  }

  return (
    <>
      <Pressable style={styles.selectButton} onPress={() => setIsOpen(true)}>
        <View style={styles.selectCopy}>
          <Text style={styles.selectValue}>{value || `Choose ${label.toLowerCase()}`}</Text>
          <Text style={styles.selectHint}>{options.length} models available</Text>
        </View>
        <Feather name="chevron-down" size={18} color={palette.ink} />
      </Pressable>

      <Modal transparent animationType="fade" visible={isOpen} onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Text style={styles.modalBody}>Pick one of the built-in models for this provider.</Text>

            <View style={styles.optionList}>
              {options.map((option) => {
                const selected = option === value;

                return (
                  <Pressable
                    key={option}
                    style={[styles.optionButton, selected && styles.optionButtonSelected]}
                    onPress={() => {
                      onSelect(option);
                      setIsOpen(false);
                    }}
                  >
                    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option}</Text>
                    {selected ? <Feather name="check" size={16} color={palette.paper} /> : null}
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.modalCloseButton} onPress={() => setIsOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function ChipButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: PressableProps['onPress'];
}) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function ProviderIcon({ providerId }: { providerId: ProviderId }) {
  switch (providerId) {
    case 'openai':
      return <MaterialCommunityIcons name="star-four-points-circle-outline" size={18} color={palette.ink} />;
    case 'openrouter':
      return <Feather name="shuffle" size={17} color={palette.ink} />;
    case 'groq':
      return <Feather name="zap" size={17} color={palette.ink} />;
    case 'anthropic':
      return <MaterialCommunityIcons name="brain" size={18} color={palette.ink} />;
    case 'gemini':
      return <MaterialCommunityIcons name="google-circles-communities" size={18} color={palette.ink} />;
    case 'together':
      return <Feather name="layers" size={17} color={palette.ink} />;
    case 'fireworks':
      return <Feather name="sun" size={17} color={palette.ink} />;
    case 'deepseek':
      return <Feather name="search" size={17} color={palette.ink} />;
    default:
      return <Feather name="settings" size={17} color={palette.ink} />;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.paper,
  },
  loadingText: {
    color: palette.mutedInk,
  },
  container: {
    padding: 20,
    gap: 16,
    paddingBottom: 32,
  },
  hero: {
    backgroundColor: palette.cardStrong,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 8,
    ...elevation.card,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 26,
    fontWeight: '800',
  },
  heroBody: {
    color: palette.mutedInk,
    lineHeight: 22,
  },
  card: {
    backgroundColor: palette.cardStrong,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 12,
    ...elevation.card,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  label: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.paper,
  },
  chipSelected: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  chipText: {
    color: palette.ink,
    fontWeight: '700',
    fontSize: 13,
  },
  chipTextSelected: {
    color: palette.paper,
  },
  selectedProviderCard: {
    backgroundColor: palette.paper,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 10,
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  providerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedProviderTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  activeBadge: {
    color: palette.accent,
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: palette.ink,
  },
  selectButton: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectCopy: {
    flex: 1,
    gap: 3,
  },
  selectValue: {
    color: palette.ink,
    fontWeight: '700',
  },
  selectHint: {
    color: palette.mutedInk,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: palette.ink,
    fontWeight: '700',
  },
  rowBody: {
    color: palette.mutedInk,
    lineHeight: 20,
  },
  notice: {
    backgroundColor: palette.rose,
    borderRadius: 24,
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
    fontWeight: '800',
    fontSize: 16,
  },
  noticeBody: {
    color: palette.mutedInk,
    lineHeight: 21,
  },
  saveButton: {
    backgroundColor: palette.ink,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: palette.paper,
    fontWeight: '800',
    fontSize: 16,
  },
  footerHint: {
    paddingHorizontal: 4,
  },
  footerHintText: {
    color: palette.mutedInk,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 35, 31, 0.24)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: palette.paper,
    borderRadius: 24,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: palette.line,
    ...elevation.card,
  },
  modalTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  modalBody: {
    color: palette.mutedInk,
    lineHeight: 21,
  },
  optionList: {
    gap: 8,
  },
  optionButton: {
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionButtonSelected: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  optionLabel: {
    color: palette.ink,
    fontWeight: '700',
    flex: 1,
  },
  optionLabelSelected: {
    color: palette.paper,
  },
  modalCloseButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modalCloseText: {
    color: palette.ink,
    fontWeight: '800',
  },
});
