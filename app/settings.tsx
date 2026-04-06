import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
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
import {
  defaultProviderConfigs,
  isProviderConfigured,
  providerDefinitions,
  providerMap,
} from '../src/services/providers';
import { getAppSettings, sanitizeAppSettings, saveAppSettings } from '../src/services/settings';
import { AppSettings, ProviderConfig, ProviderId } from '../src/types';
import { elevation, palette } from '../src/theme';

export default function SettingsScreen() {
  const [form, setForm] = useState<AppSettings | null>(null);
  const [editingProviderId, setEditingProviderId] = useState<ProviderId>('openai');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getAppSettings().then((settings) => {
      const next = sanitizeAppSettings(settings);
      setForm(next);
      setEditingProviderId(pickInitialProvider(next));
    });
  }, []);

  if (!form) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading settings…</Text>
      </View>
    );
  }

  const sanitizedForm = sanitizeAppSettings(form);
  const configuredProviderIds = getConfiguredProviderIds(sanitizedForm.providers);
  const transcriptionProviderIds = getConfiguredProviderIds(sanitizedForm.providers, 'transcription');
  const summaryProviderIds = getConfiguredProviderIds(sanitizedForm.providers, 'summary');
  const editingProvider = providerMap[editingProviderId];
  const editingConfig = form.providers[editingProviderId];
  const transcriptionProvider = providerMap[sanitizedForm.selectedTranscriptionProvider];
  const summaryProvider = providerMap[sanitizedForm.selectedSummaryProvider];

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

  const resetProvider = (providerId: ProviderId) => {
    setForm((current) =>
      current
        ? {
            ...current,
            providers: {
              ...current.providers,
              [providerId]: {
                ...defaultProviderConfigs[providerId],
                apiKey: '',
              },
            },
          }
        : current
    );
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const next = sanitizeAppSettings(form);
      setForm(next);
      await saveAppSettings(next);
      Alert.alert('Saved', 'Providers are configured once and stored locally on this device.');
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
            Configure each provider once. Then choose which configured provider handles transcript and summary. Keys are stored locally in the app database on this device.
          </Text>
        </FadeInView>

        <FadeInView style={styles.card} delay={40}>
          <View style={styles.sectionTitleRow}>
            <Feather name="server" size={18} color={palette.ink} />
            <Text style={styles.cardTitle}>Configure providers</Text>
          </View>
          <Text style={styles.rowBody}>
            Add the key once for each provider you care about. After that, transcript and summary only pick from your configured providers.
          </Text>

          <View style={styles.statsRow}>
            <StatPill label={`${configuredProviderIds.length} configured`} />
            <StatPill label={`${providerDefinitions.length} available`} />
          </View>

          <View style={styles.providerChipGrid}>
            {providerDefinitions.map((definition) => (
              <ProviderPickerChip
                key={definition.id}
                providerId={definition.id}
                label={definition.label}
                selected={editingProviderId === definition.id}
                configured={configuredProviderIds.includes(definition.id)}
                onPress={() => setEditingProviderId(definition.id)}
              />
            ))}
          </View>

          <View style={styles.selectedProviderCard}>
            <View style={styles.providerHeader}>
              <View style={styles.providerTitleRow}>
                <ProviderIcon providerId={editingProviderId} />
                <Text style={styles.selectedProviderTitle}>{editingProvider.label}</Text>
              </View>
              <Text
                style={[
                  styles.statusBadge,
                  configuredProviderIds.includes(editingProviderId)
                    ? styles.statusBadgeConfigured
                    : styles.statusBadgeIdle,
                ]}
              >
                {configuredProviderIds.includes(editingProviderId) ? 'Configured' : 'Not configured'}
              </Text>
            </View>
            <Text style={styles.rowBody}>{editingProvider.description}</Text>

            <Label text="API key" />
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={editingProvider.apiKeyPlaceholder}
              placeholderTextColor={palette.mutedInk}
              secureTextEntry
              value={editingConfig.apiKey}
              onChangeText={(value) => updateProvider(editingProviderId, 'apiKey', value)}
            />

            <Label text={editingProviderId === 'custom' ? 'Base URL' : 'Base URL override'} />
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={editingProvider.baseUrlPlaceholder}
              placeholderTextColor={palette.mutedInk}
              value={editingConfig.baseUrl}
              onChangeText={(value) => updateProvider(editingProviderId, 'baseUrl', value)}
            />

            {editingProvider.supportsTranscription ? (
              <ModelField
                label="Default transcription model"
                value={editingConfig.transcriptionModel}
                options={editingProvider.transcriptionModels}
                onChange={(value) => updateProvider(editingProviderId, 'transcriptionModel', value)}
              />
            ) : null}

            {editingProvider.supportsSummary ? (
              <ModelField
                label="Default summary model"
                value={editingConfig.summaryModel}
                options={editingProvider.summaryModels}
                onChange={(value) => updateProvider(editingProviderId, 'summaryModel', value)}
              />
            ) : null}

            <Pressable style={styles.secondaryButton} onPress={() => resetProvider(editingProviderId)}>
              <Text style={styles.secondaryButtonText}>Clear saved provider</Text>
            </Pressable>
          </View>
        </FadeInView>

        <AssignmentSection
          delay={80}
          title="Transcription provider"
          subtitle="Pick which configured provider turns audio into text."
          icon={<Feather name="mic" size={18} color={palette.ink} />}
          mode="transcription"
          selectedProviderId={sanitizedForm.selectedTranscriptionProvider}
          providerIds={transcriptionProviderIds}
          providers={sanitizedForm.providers}
          onSelect={(providerId) => updateForm('selectedTranscriptionProvider', providerId)}
        />

        <AssignmentSection
          delay={120}
          title="Summary provider"
          subtitle="Pick which configured provider writes summary, action items, and decisions."
          icon={<Feather name="file-text" size={18} color={palette.ink} />}
          mode="summary"
          selectedProviderId={sanitizedForm.selectedSummaryProvider}
          providerIds={summaryProviderIds}
          providers={sanitizedForm.providers}
          onSelect={(providerId) => updateForm('selectedSummaryProvider', providerId)}
        />

        <FadeInView style={styles.card} delay={150}>
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

        <FadeInView style={styles.notice} delay={180}>
          <View style={styles.noticeHeader}>
            <Feather name="info" size={16} color={palette.ink} />
            <Text style={styles.noticeTitle}>Current setup</Text>
          </View>
          <Text style={styles.noticeBody}>
            Transcript uses {formatProviderSelection(transcriptionProvider.label, transcriptionProviderIds.length)}
            . Summary uses {formatProviderSelection(summaryProvider.label, summaryProviderIds.length)}.
          </Text>
        </FadeInView>

        <Pressable style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save settings'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function AssignmentSection({
  title,
  subtitle,
  icon,
  mode,
  selectedProviderId,
  providerIds,
  providers,
  onSelect,
  delay,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  mode: 'transcription' | 'summary';
  selectedProviderId: ProviderId;
  providerIds: ProviderId[];
  providers: Record<ProviderId, ProviderConfig>;
  onSelect: (providerId: ProviderId) => void;
  delay: number;
}) {
  const selectedProvider = providerMap[selectedProviderId];
  const model =
    mode === 'transcription'
      ? providers[selectedProviderId].transcriptionModel
      : providers[selectedProviderId].summaryModel;

  return (
    <FadeInView style={styles.card} delay={delay}>
      <View style={styles.sectionTitleRow}>
        {icon}
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.rowBody}>{subtitle}</Text>

      {providerIds.length ? (
        <>
          <View style={styles.chipRow}>
            {providerIds.map((providerId) => (
              <ChoiceChip
                key={providerId}
                label={providerMap[providerId].label}
                selected={selectedProviderId === providerId}
                onPress={() => onSelect(providerId)}
              />
            ))}
          </View>

          <View style={styles.assignmentCard}>
            <View style={styles.providerTitleRow}>
              <ProviderIcon providerId={selectedProviderId} />
              <Text style={styles.selectedProviderTitle}>{selectedProvider.label}</Text>
            </View>
            <Text style={styles.assignmentMeta}>
              {mode === 'transcription' ? 'Transcription model' : 'Summary model'}
            </Text>
            <Text style={styles.assignmentValue}>{model || 'No model selected yet'}</Text>
          </View>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No configured provider yet</Text>
          <Text style={styles.rowBody}>
            Configure a provider above and add its API key once. Then it will show up here.
          </Text>
        </View>
      )}
    </FadeInView>
  );
}

function ModelField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Label text={label} />
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Enter model name"
        placeholderTextColor={palette.mutedInk}
        value={value}
        onChangeText={onChange}
      />
      {options.length ? (
        <View style={styles.presetRow}>
          {options.map((option) => (
            <ChoiceChip key={option} label={option} selected={value === option} onPress={() => onChange(option)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function ProviderPickerChip({
  providerId,
  label,
  selected,
  configured,
  onPress,
}: {
  providerId: ProviderId;
  label: string;
  selected?: boolean;
  configured?: boolean;
  onPress: PressableProps['onPress'];
}) {
  return (
    <Pressable style={[styles.providerPickerChip, selected && styles.providerPickerChipSelected]} onPress={onPress}>
      <View style={styles.providerPickerTopRow}>
        <ProviderIcon providerId={providerId} />
        {configured ? <View style={styles.configuredDot} /> : null}
      </View>
      <Text style={[styles.providerPickerLabel, selected && styles.providerPickerLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function ChoiceChip({
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

function StatPill({ label }: { label: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statPillText}>{label}</Text>
    </View>
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

function getConfiguredProviderIds(
  providers: Record<ProviderId, ProviderConfig>,
  mode?: 'transcription' | 'summary'
) {
  return providerDefinitions
    .filter((definition) => {
      if (mode === 'transcription' && !definition.supportsTranscription) {
        return false;
      }

      if (mode === 'summary' && !definition.supportsSummary) {
        return false;
      }

      return isProviderConfigured(definition.id, providers[definition.id]);
    })
    .map((definition) => definition.id);
}

function pickInitialProvider(settings: AppSettings) {
  const configured = getConfiguredProviderIds(settings.providers);
  return configured[0] ?? settings.selectedSummaryProvider ?? settings.selectedTranscriptionProvider ?? 'openai';
}

function formatProviderSelection(label: string, count: number) {
  if (!count) {
    return 'no configured provider yet';
  }

  return label;
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
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statPill: {
    borderRadius: 999,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statPillText: {
    color: palette.ink,
    fontWeight: '700',
    fontSize: 12,
  },
  providerChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  providerPickerChip: {
    width: '31%',
    minWidth: 96,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.paper,
    padding: 12,
    gap: 10,
  },
  providerPickerChipSelected: {
    backgroundColor: palette.card,
    borderColor: palette.accent,
  },
  providerPickerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  configuredDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  providerPickerLabel: {
    color: palette.ink,
    fontWeight: '700',
    fontSize: 13,
  },
  providerPickerLabelSelected: {
    color: palette.ink,
  },
  selectedProviderCard: {
    backgroundColor: palette.paper,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 12,
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
  statusBadge: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusBadgeConfigured: {
    color: palette.accent,
  },
  statusBadgeIdle: {
    color: palette.mutedInk,
  },
  label: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  fieldGroup: {
    gap: 8,
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
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  assignmentCard: {
    backgroundColor: palette.paper,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 6,
  },
  assignmentMeta: {
    color: palette.mutedInk,
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  assignmentValue: {
    color: palette.ink,
    fontWeight: '700',
    lineHeight: 20,
  },
  emptyState: {
    backgroundColor: palette.paper,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 6,
  },
  emptyStateTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  rowCopy: {
    flex: 1,
    gap: 4,
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
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 8,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noticeTitle: {
    color: palette.ink,
    fontWeight: '800',
  },
  noticeBody: {
    color: palette.mutedInk,
    lineHeight: 20,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: palette.cardStrong,
  },
  secondaryButtonText: {
    color: palette.ink,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: palette.ink,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },
  saveButtonText: {
    color: palette.paper,
    fontSize: 16,
    fontWeight: '800',
  },
});
