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
import { providerDefinitions, providerMap } from '../src/services/providers';
import { getAppSettings, saveAppSettings } from '../src/services/settings';
import {
  AppSettings,
  InstalledModelRow,
  LocalDeviceSupport,
  LocalModelKind,
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
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    hydrateScreen();
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
      await saveAppSettings(form);
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
            Remote providers still work, but you can now manage local model downloads on-device and point transcription or summary at the local runtime when it is available.
          </Text>
        </FadeInView>

        <FadeInView style={styles.card} delay={30}>
          <View style={styles.sectionTitleRow}>
            <MaterialCommunityIcons name="chip" size={18} color={palette.ink} />
            <Text style={styles.cardTitle}>Local Models</Text>
          </View>

          <View style={styles.runtimeCard}>
            <View style={styles.runtimeTopRow}>
              <Text style={styles.runtimeTitle}>Runtime status</Text>
              <Text
                style={[
                  styles.runtimeBadge,
                  deviceSupport?.localProcessingAvailable ? styles.runtimeBadgeReady : styles.runtimeBadgeWaiting,
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
            Built-in starter entries are shown if no hosted catalog is configured yet. Add your own catalog URL to plug in real downloadable artifacts.
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
            allowDownload={deviceSupport?.platform !== 'web'}
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
            allowDownload={deviceSupport?.platform !== 'web'}
          />
        </FadeInView>

        <ProviderSection
          delay={60}
          title="Transcription"
          subtitle="Used for turning audio into text."
          icon={<Feather name="mic" size={18} color={palette.ink} />}
          selectedProviderId={form.selectedTranscriptionProvider}
          providerIds={providerDefinitions.filter((provider) => provider.supportsTranscription).map((p) => p.id)}
          providers={form.providers}
          onSelect={(providerId) => updateForm('selectedTranscriptionProvider', providerId)}
          onChange={updateProvider}
          mode="transcription"
          localModelOptions={installedTranscriptionModels.map((model) => ({
            label: model.displayName,
            value: model.id,
          }))}
          deviceSupport={deviceSupport}
        />

        <ProviderSection
          delay={100}
          title="Summary"
          subtitle="Used for summary, action items, and decisions."
          icon={<Feather name="file-text" size={18} color={palette.ink} />}
          selectedProviderId={form.selectedSummaryProvider}
          providerIds={providerDefinitions.filter((provider) => provider.supportsSummary).map((p) => p.id)}
          providers={form.providers}
          onSelect={(providerId) => updateForm('selectedSummaryProvider', providerId)}
          onChange={updateProvider}
          mode="summary"
          localModelOptions={installedSummaryModels.map((model) => ({
            label: model.displayName,
            value: model.id,
          }))}
          deviceSupport={deviceSupport}
        />

        <FadeInView style={styles.card} delay={130}>
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

        <FadeInView style={styles.notice} delay={160}>
          <View style={styles.noticeHeader}>
            <Feather name="info" size={16} color={palette.ink} />
            <Text style={styles.noticeTitle}>Current setup</Text>
          </View>
          <Text style={styles.noticeBody}>
            Transcription is set to {transcriptionProvider.label}. Summary is set to {summaryProvider.label}.
            {form.selectedTranscriptionProvider === 'local' && form.providers.local.transcriptionModel
              ? ` Local transcription model: ${displayModelLabel(installedTranscriptionModels, form.providers.local.transcriptionModel)}.`
              : ''}
            {form.selectedSummaryProvider === 'local' && form.providers.local.summaryModel
              ? ` Local summary model: ${displayModelLabel(installedSummaryModels, form.providers.local.summaryModel)}.`
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
    setForm(settings);

    const [support, models] = await Promise.all([getLocalDeviceSupport(), getInstalledModels()]);
    setDeviceSupport(support);
    setInstalledModels(models);
    await refreshCatalog(settings.modelCatalogUrl);
  }
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
  localModelOptions,
  deviceSupport,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  selectedProviderId: ProviderId;
  providerIds: ProviderId[];
  providers: Record<ProviderId, ProviderConfig>;
  onSelect: (providerId: ProviderId) => void;
  onChange: <K extends keyof ProviderConfig>(providerId: ProviderId, key: K, value: ProviderConfig[K]) => void;
  mode: 'transcription' | 'summary';
  delay: number;
  localModelOptions: Array<{ label: string; value: string }>;
  deviceSupport: LocalDeviceSupport | null;
}) {
  const provider = providerMap[selectedProviderId];
  const config = providers[selectedProviderId];
  const modelLabel = mode === 'transcription' ? 'Transcription model' : 'Summary model';
  const modelKey = mode === 'transcription' ? 'transcriptionModel' : 'summaryModel';
  const remoteModelOptions = mode === 'transcription' ? provider.transcriptionModels : provider.summaryModels;
  const modelOptions =
    selectedProviderId === 'local'
      ? localModelOptions
      : remoteModelOptions.map((option) => ({ label: option, value: option }));

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

        {selectedProviderId === 'local' ? (
          <>
            <View style={styles.localProviderHint}>
              <Text style={styles.rowTitle}>On-device runtime</Text>
              <Text style={styles.rowBody}>
                {deviceSupport?.localProcessingAvailable
                  ? 'Ready for local execution in this build.'
                  : deviceSupport?.reason ?? 'Checking local runtime availability.'}
              </Text>
            </View>

            <Label text={modelLabel} />
            <ModelDropdown
              label={modelLabel}
              value={config[modelKey]}
              options={modelOptions}
              onSelect={(value) => onChange(selectedProviderId, modelKey, value)}
              emptyText={`Download a local ${mode} model above before selecting Local here.`}
            />
          </>
        ) : (
          <>
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
          </>
        )}
      </View>
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
                  <Text style={[styles.modelBadge, installed.status === 'installed' ? styles.modelBadgeReady : styles.modelBadgeMuted]}>
                    {installed.status}
                  </Text>
                ) : item.recommended ? (
                  <Text style={[styles.modelBadge, styles.modelBadgeReady]}>Recommended</Text>
                ) : item.experimental ? (
                  <Text style={[styles.modelBadge, styles.modelBadgeMuted]}>Experimental</Text>
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
    <>
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
    case 'local':
      return <MaterialCommunityIcons name="chip" size={18} color={palette.ink} />;
    default:
      return <Feather name="settings" size={17} color={palette.ink} />;
  }
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
  runtimeCard: {
    backgroundColor: palette.paper,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 6,
  },
  runtimeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  runtimeTitle: {
    color: palette.ink,
    fontWeight: '800',
  },
  runtimeBadge: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  runtimeBadgeReady: {
    color: palette.accent,
  },
  runtimeBadgeWaiting: {
    color: palette.danger,
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
  modelBadgeReady: {
    color: palette.accent,
  },
  modelBadgeMuted: {
    color: palette.mutedInk,
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
  localProviderHint: {
    gap: 4,
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
