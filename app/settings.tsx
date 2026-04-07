import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { getLocalDeviceSupport } from '../src/services/localInference';
import {
  deleteInstalledModel,
  downloadModel,
  getCatalogItemsForDevice,
  getInstalledModels,
  getInstalledModelsForKind,
  getModelCatalog,
} from '../src/services/localModels';
import {
  defaultProviderConfigs,
  isProviderConfigured,
  providerDefinitions,
  providerMap,
} from '../src/services/providers';
import { getAppSettings, sanitizeAppSettings, saveAppSettings } from '../src/services/settings';
import {
  AppSettings,
  InstalledModelRow,
  LocalDeviceSupport,
  ModelCatalogItem,
  ProviderConfig,
  ProviderId,
} from '../src/types';
import { elevation, palette } from '../src/theme';

export default function SettingsScreen() {
  const [form, setForm] = useState<AppSettings | null>(null);
  const [catalog, setCatalog] = useState<ModelCatalogItem[]>([]);
  const [installedModels, setInstalledModels] = useState<InstalledModelRow[]>([]);
  const [deviceSupport, setDeviceSupport] = useState<LocalDeviceSupport | null>(null);
  const [editingProviderId, setEditingProviderId] = useState<ProviderId>('openai');
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    void hydrateScreen();
  }, []);

  const installedTranscriptionModels = useMemo(
    () => getInstalledModelsForKind(installedModels, 'transcription'),
    [installedModels]
  );
  const installedSummaryModels = useMemo(
    () => getInstalledModelsForKind(installedModels, 'summary'),
    [installedModels]
  );
  const visibleCatalog = useMemo(
    () => getCatalogItemsForDevice(catalog, deviceSupport),
    [catalog, deviceSupport]
  );

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
  const localTranscriptionOptions = installedTranscriptionModels.map((model) => ({
    label: model.displayName,
    value: model.id,
  }));
  const localSummaryOptions = installedSummaryModels.map((model) => ({
    label: model.displayName,
    value: model.id,
  }));

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

  const refreshCatalog = async (catalogUrl: string, showFailureAlert = false) => {
    setIsRefreshingCatalog(true);

    try {
      const nextCatalog = await getModelCatalog(catalogUrl);
      setCatalog(nextCatalog);
    } catch (error) {
      const fallbackCatalog = await getModelCatalog('');
      setCatalog(fallbackCatalog);

      if (showFailureAlert) {
        Alert.alert(
          'Catalog refresh failed',
          error instanceof Error ? error.message : 'Unable to load the remote model catalog.'
        );
      }
    } finally {
      setIsRefreshingCatalog(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const next = sanitizeAppSettings(form);
      setForm(next);
      await saveAppSettings(next);
      Alert.alert('Saved', 'Provider settings and local model preferences were stored on this device.');
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadModel = async (item: ModelCatalogItem) => {
    try {
      await downloadModel(item, {
        onProgress: (progress) =>
          setDownloadProgress((current) => ({
            ...current,
            [item.id]: progress,
          })),
      });

      const nextInstalledModels = await getInstalledModels();
      setInstalledModels(nextInstalledModels);
      setDownloadProgress((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });

      setForm((current) => {
        if (!current) {
          return current;
        }

        const next = { ...current, providers: { ...current.providers, local: { ...current.providers.local } } };

        if (item.kind === 'transcription' && !next.providers.local.transcriptionModel) {
          next.providers.local.transcriptionModel = item.id;
        }

        if (item.kind === 'summary' && !next.providers.local.summaryModel) {
          next.providers.local.summaryModel = item.id;
        }

        return next;
      });

      Alert.alert('Model ready', `${item.displayName} was downloaded and registered locally.`);
    } catch (error) {
      setDownloadProgress((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      Alert.alert('Download failed', error instanceof Error ? error.message : 'Unable to download this model.');
    }
  };

  const handleDeleteModel = async (model: InstalledModelRow) => {
    Alert.alert('Delete local model?', `Remove ${model.displayName} from this device?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteInstalledModel(model.id);
            const nextInstalledModels = await getInstalledModels();
            setInstalledModels(nextInstalledModels);
            setForm((current) => {
              if (!current) {
                return current;
              }

              const next = { ...current, providers: { ...current.providers, local: { ...current.providers.local } } };
              const nextTranscriptionFallback =
                getInstalledModelsForKind(nextInstalledModels, 'transcription')[0]?.id ?? '';
              const nextSummaryFallback = getInstalledModelsForKind(nextInstalledModels, 'summary')[0]?.id ?? '';

              if (next.providers.local.transcriptionModel === model.id) {
                next.providers.local.transcriptionModel = nextTranscriptionFallback;
              }

              if (next.providers.local.summaryModel === model.id) {
                next.providers.local.summaryModel = nextSummaryFallback;
              }

              return next;
            });
          } catch (error) {
            Alert.alert('Delete failed', error instanceof Error ? error.message : 'Unable to remove this model.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <FadeInView style={styles.hero}>
          <View style={styles.heroHeader}>
            <MaterialCommunityIcons name="tune-variant" size={18} color={palette.ink} />
            <Text style={styles.heroTitle}>Providers + local models</Text>
          </View>
          <Text style={styles.heroBody}>
            Configure cloud providers once, manage on-device model downloads, and choose which configured
            provider handles transcript and summary for each meeting.
          </Text>
        </FadeInView>

        <FadeInView style={styles.card} delay={30}>
          <View style={styles.sectionTitleRow}>
            <MaterialCommunityIcons name="chip" size={18} color={palette.ink} />
            <Text style={styles.cardTitle}>Local Models</Text>
          </View>

          <View style={styles.runtimeCard}>
            <View style={styles.providerHeader}>
              <Text style={styles.runtimeTitle}>Runtime status</Text>
              <Text
                style={[
                  styles.statusBadge,
                  deviceSupport?.localProcessingAvailable ? styles.statusBadgeConfigured : styles.statusBadgeIdle,
                ]}
              >
                {deviceSupport?.localProcessingAvailable ? 'Ready' : 'Not ready'}
              </Text>
            </View>
            <Text style={styles.rowBody}>
              {deviceSupport?.reason ??
                'Checking device support for the native local AI runtime and model execution path.'}
            </Text>
          </View>

          <Label text="Model catalog URL" />
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://your-hosted-catalog.example/catalog.json"
            placeholderTextColor={palette.mutedInk}
            value={form.modelCatalogUrl}
            onChangeText={(value) => updateForm('modelCatalogUrl', value)}
          />

          <View style={styles.actionsRow}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => refreshCatalog(form.modelCatalogUrl, true)}
              disabled={isRefreshingCatalog}
            >
              <Feather name="refresh-cw" size={16} color={palette.ink} />
              <Text style={styles.secondaryButtonText}>
                {isRefreshingCatalog ? 'Refreshing…' : 'Refresh catalog'}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.rowBody}>
            Built-in starter entries are shown if no hosted catalog is configured yet. Add your own catalog
            URL to plug in real downloadable artifacts.
          </Text>

          <ModelCatalogSection
            title="Transcription models"
            items={visibleCatalog.filter((item) => item.kind === 'transcription')}
            installedModels={installedTranscriptionModels}
            activeModelId={form.providers.local.transcriptionModel}
            downloadProgress={downloadProgress}
            onDownload={handleDownloadModel}
            onDelete={handleDeleteModel}
            onSelectActive={(modelId) => updateProvider('local', 'transcriptionModel', modelId)}
            allowDownload={deviceSupport ? deviceSupport.platform !== 'web' : false}
          />

          <ModelCatalogSection
            title="Summary models"
            items={visibleCatalog.filter((item) => item.kind === 'summary')}
            installedModels={installedSummaryModels}
            activeModelId={form.providers.local.summaryModel}
            downloadProgress={downloadProgress}
            onDownload={handleDownloadModel}
            onDelete={handleDeleteModel}
            onSelectActive={(modelId) => updateProvider('local', 'summaryModel', modelId)}
            allowDownload={deviceSupport ? deviceSupport.platform !== 'web' : false}
          />
        </FadeInView>

        <FadeInView style={styles.card} delay={60}>
          <View style={styles.sectionTitleRow}>
            <Feather name="server" size={18} color={palette.ink} />
            <Text style={styles.cardTitle}>Configure providers</Text>
          </View>
          <Text style={styles.rowBody}>
            Each provider stores its own API key and default models. Local uses the downloaded models shown
            above instead of a remote key.
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

            {editingProviderId === 'local' ? (
              <>
                <View style={styles.localProviderHint}>
                  <Text style={styles.rowTitle}>On-device runtime</Text>
                  <Text style={styles.rowBody}>
                    {deviceSupport?.localProcessingAvailable
                      ? 'Ready for local execution in this build.'
                      : deviceSupport?.reason ?? 'Checking local runtime availability.'}
                  </Text>
                </View>

                <ModelDropdown
                  label="Active transcription model"
                  value={editingConfig.transcriptionModel}
                  options={localTranscriptionOptions}
                  onSelect={(value) => updateProvider('local', 'transcriptionModel', value)}
                  emptyText="Download a local transcription model above before selecting Local here."
                />

                <ModelDropdown
                  label="Active summary model"
                  value={editingConfig.summaryModel}
                  options={localSummaryOptions}
                  onSelect={(value) => updateProvider('local', 'summaryModel', value)}
                  emptyText="Download a local summary model above before selecting Local here."
                />

                <Pressable style={styles.secondaryButton} onPress={() => resetProvider('local')}>
                  <Text style={styles.secondaryButtonText}>Clear local model selection</Text>
                </Pressable>
              </>
            ) : (
              <>
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
              </>
            )}
          </View>
        </FadeInView>

        <AssignmentSection
          delay={100}
          title="Transcription provider"
          subtitle="Pick which configured provider turns audio into text."
          icon={<Feather name="mic" size={18} color={palette.ink} />}
          mode="transcription"
          selectedProviderId={sanitizedForm.selectedTranscriptionProvider}
          providerIds={transcriptionProviderIds}
          providers={sanitizedForm.providers}
          onSelect={(providerId) => updateForm('selectedTranscriptionProvider', providerId)}
          localModelOptions={localTranscriptionOptions}
        />

        <AssignmentSection
          delay={140}
          title="Summary provider"
          subtitle="Pick which configured provider writes summary, action items, and decisions."
          icon={<Feather name="file-text" size={18} color={palette.ink} />}
          mode="summary"
          selectedProviderId={sanitizedForm.selectedSummaryProvider}
          providerIds={summaryProviderIds}
          providers={sanitizedForm.providers}
          onSelect={(providerId) => updateForm('selectedSummaryProvider', providerId)}
          localModelOptions={localSummaryOptions}
        />

        <FadeInView style={styles.card} delay={160}>
          <Text style={styles.cardTitle}>Privacy defaults</Text>
          <View style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Delete remote audio after processing</Text>
              <Text style={styles.rowBody}>
                Only applies if your selected remote provider supports deleting uploaded audio.
              </Text>
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
            Transcript uses {transcriptionProvider.label}. Summary uses {summaryProvider.label}.
            {sanitizedForm.selectedTranscriptionProvider === 'local' &&
            sanitizedForm.providers.local.transcriptionModel
              ? ` Local transcription model: ${displayModelLabel(
                  installedTranscriptionModels,
                  sanitizedForm.providers.local.transcriptionModel
                )}.`
              : ''}
            {sanitizedForm.selectedSummaryProvider === 'local' && sanitizedForm.providers.local.summaryModel
              ? ` Local summary model: ${displayModelLabel(
                  installedSummaryModels,
                  sanitizedForm.providers.local.summaryModel
                )}.`
              : ''}
          </Text>
        </FadeInView>

        <Pressable style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save settings'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );

  async function hydrateScreen() {
    const settings = await getAppSettings();
    const next = sanitizeAppSettings(settings);
    setForm(next);
    setEditingProviderId(pickInitialProvider(next));

    const [support, models] = await Promise.all([getLocalDeviceSupport(), getInstalledModels()]);
    setDeviceSupport(support);
    setInstalledModels(models);
    await refreshCatalog(next.modelCatalogUrl);
  }
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
  localModelOptions,
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
  localModelOptions: Array<{ label: string; value: string }>;
}) {
  const selectedProvider = providerMap[selectedProviderId];
  const modelId =
    mode === 'transcription'
      ? providers[selectedProviderId].transcriptionModel
      : providers[selectedProviderId].summaryModel;
  const modelLabel =
    selectedProviderId === 'local'
      ? ((localModelOptions.find((option) => option.value === modelId)?.label ?? modelId) ||
        'No model selected yet')
      : modelId || 'No model selected yet';

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
            <Text style={styles.assignmentValue}>{modelLabel}</Text>
          </View>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No configured provider yet</Text>
          <Text style={styles.rowBody}>
            Configure a provider above and add its API key once. Local will appear here after you choose an
            installed model.
          </Text>
        </View>
      )}
    </FadeInView>
  );
}

function ModelCatalogSection({
  title,
  items,
  installedModels,
  activeModelId,
  downloadProgress,
  onDownload,
  onDelete,
  onSelectActive,
  allowDownload,
}: {
  title: string;
  items: ModelCatalogItem[];
  installedModels: InstalledModelRow[];
  activeModelId: string;
  downloadProgress: Record<string, number>;
  onDownload: (item: ModelCatalogItem) => void;
  onDelete: (item: InstalledModelRow) => void;
  onSelectActive: (modelId: string) => void;
  allowDownload: boolean;
}) {
  return (
    <View style={styles.catalogSection}>
      <Text style={styles.catalogSectionTitle}>{title}</Text>

      {items.length ? (
        items.map((item) => {
          const installed = installedModels.find((model) => model.id === item.id);
          const progress = downloadProgress[item.id];

          return (
            <View key={item.id} style={styles.modelCard}>
              <View style={styles.modelHeader}>
                <View style={styles.modelTitleWrap}>
                  <Text style={styles.modelTitle}>{item.displayName}</Text>
                  <Text style={styles.modelMeta}>
                    {item.engine} • {formatBytes(item.sizeBytes)}
                  </Text>
                </View>
                {installed ? (
                  <Text
                    style={[
                      styles.modelBadge,
                      installed.status === 'installed' ? styles.statusBadgeConfigured : styles.statusBadgeIdle,
                    ]}
                  >
                    {installed.status}
                  </Text>
                ) : item.recommended ? (
                  <Text style={[styles.modelBadge, styles.statusBadgeConfigured]}>Recommended</Text>
                ) : item.experimental ? (
                  <Text style={[styles.modelBadge, styles.statusBadgeIdle]}>Experimental</Text>
                ) : null}
              </View>

              <Text style={styles.rowBody}>{item.description}</Text>

              <View style={styles.modelActionRow}>
                {installed?.status === 'installed' ? (
                  <>
                    <Pressable style={styles.secondaryButton} onPress={() => onSelectActive(item.id)}>
                      <Feather name="check-circle" size={16} color={palette.ink} />
                      <Text style={styles.secondaryButtonText}>
                        {activeModelId === item.id ? 'Active' : 'Set active'}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.secondaryButton} onPress={() => onDelete(installed)}>
                      <Feather name="trash-2" size={16} color={palette.ink} />
                      <Text style={styles.secondaryButtonText}>Delete</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    style={[styles.secondaryButton, !allowDownload && styles.disabledButton]}
                    onPress={() => onDownload(item)}
                    disabled={!allowDownload}
                  >
                    <Feather name="download" size={16} color={palette.ink} />
                    <Text style={styles.secondaryButtonText}>
                      {typeof progress === 'number' ? `Downloading ${Math.round(progress * 100)}%` : 'Download'}
                    </Text>
                  </Pressable>
                )}
              </View>

              {!item.downloadUrl ? (
                <Text style={styles.modelHint}>Add a hosted model catalog URL to enable this download.</Text>
              ) : null}
              {installed?.errorMessage ? <Text style={styles.errorText}>{installed.errorMessage}</Text> : null}
            </View>
          );
        })
      ) : (
        <Text style={styles.rowBody}>No compatible catalog items are visible for this device yet.</Text>
      )}
    </View>
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
  options: Array<{ label: string; value: string }>;
  onSelect: (value: string) => void;
  emptyText: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!options.length) {
    return <Text style={styles.rowBody}>{emptyText}</Text>;
  }

  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <View style={styles.fieldGroup}>
      <Label text={label} />
      <Pressable style={styles.selectButton} onPress={() => setIsOpen(true)}>
        <View style={styles.selectCopy}>
          <Text style={styles.selectValue}>{selectedLabel || `Choose ${label.toLowerCase()}`}</Text>
          <Text style={styles.selectHint}>{options.length} options available</Text>
        </View>
        <Feather name="chevron-down" size={18} color={palette.ink} />
      </Pressable>

      <Modal transparent animationType="fade" visible={isOpen} onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Text style={styles.modalBody}>Pick one option for this processing step.</Text>

            <View style={styles.optionList}>
              {options.map((option) => {
                const selected = option.value === value;

                return (
                  <Pressable
                    key={option.value}
                    style={[styles.optionButton, selected && styles.optionButtonSelected]}
                    onPress={() => {
                      onSelect(option.value);
                      setIsOpen(false);
                    }}
                  >
                    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                      {option.label}
                    </Text>
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
    </View>
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
    case 'local':
      return <MaterialCommunityIcons name="chip" size={18} color={palette.ink} />;
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

      return isProviderConfigured(definition.id, providers[definition.id], mode);
    })
    .map((definition) => definition.id);
}

function pickInitialProvider(settings: AppSettings) {
  const configured = getConfiguredProviderIds(settings.providers);
  return configured[0] ?? settings.selectedSummaryProvider ?? settings.selectedTranscriptionProvider ?? 'openai';
}

function displayModelLabel(models: InstalledModelRow[], modelId: string) {
  return models.find((model) => model.id === modelId)?.displayName ?? modelId;
}

function formatBytes(value: number) {
  if (!value) {
    return 'size unknown';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 || unitIndex === 0 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`;
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
  runtimeCard: {
    backgroundColor: palette.paper,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 6,
  },
  runtimeTitle: {
    color: palette.ink,
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
  catalogSection: {
    gap: 10,
  },
  catalogSectionTitle: {
    color: palette.ink,
    fontWeight: '800',
    fontSize: 15,
  },
  modelCard: {
    backgroundColor: palette.paper,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 8,
  },
  modelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  modelTitleWrap: {
    flex: 1,
    gap: 3,
  },
  modelTitle: {
    color: palette.ink,
    fontWeight: '800',
  },
  modelMeta: {
    color: palette.mutedInk,
    fontSize: 12,
  },
  modelBadge: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  modelActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modelHint: {
    color: palette.mutedInk,
    fontSize: 12,
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
  localProviderHint: {
    gap: 4,
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
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: palette.paper,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: palette.ink,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
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
  errorText: {
    color: palette.danger,
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 35, 31, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: palette.paper,
    borderRadius: 24,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: palette.line,
  },
  modalTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  modalBody: {
    color: palette.mutedInk,
    lineHeight: 20,
  },
  optionList: {
    gap: 8,
  },
  optionButton: {
    backgroundColor: palette.card,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: palette.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
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
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalCloseText: {
    color: palette.ink,
    fontWeight: '700',
  },
});
