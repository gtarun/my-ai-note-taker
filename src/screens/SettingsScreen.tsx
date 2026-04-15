import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  PressableProps,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FadeInView } from '../components/FadeInView';
import { ScreenBackground } from '../components/ScreenBackground';
import {
  PillButton,
  SectionHeading,
  StatusChip,
  SurfaceCard,
} from '../components/ui';
import {
  buildActiveProviderSummary,
  buildSettingsOverviewItems,
  displayModelLabel,
  formatBytes,
  getConfiguredProviderIds,
  pickInitialProvider,
} from '../features/settings/presentation';
import { IOS_LOCAL_TRANSCRIPTION_MODEL_ID, getLocalDeviceSupport } from '../services/localInference';
import {
  deleteInstalledModel,
  downloadModel,
  getCatalogItemsForDevice,
  getInstalledModels,
  getInstalledModelsForKind,
  getModelCatalog,
} from '../services/localModels';
import { defaultProviderConfigs, providerDefinitions, providerMap } from '../services/providers';
import { getAppSettings, sanitizeAppSettings, saveAppSettings } from '../services/settings';
import type {
  AppSettings,
  InstalledModelRow,
  LocalDeviceSupport,
  ModelCatalogItem,
  ProviderConfig,
  ProviderId,
} from '../types';
import { palette, radii, typography } from '../theme';

function getLocalTranscriptionModelId(modelId: string, whisperBaseInstalled: boolean) {
  const trimmed = modelId.trim();

  if (Platform.OS !== 'ios') {
    return trimmed;
  }

  if (!whisperBaseInstalled) {
    return '';
  }

  if (!trimmed) {
    return '';
  }

  return IOS_LOCAL_TRANSCRIPTION_MODEL_ID;
}

export default function SettingsScreen() {
  const [form, setForm] = useState<AppSettings | null>(null);
  const [catalog, setCatalog] = useState<ModelCatalogItem[]>([]);
  const [installedModels, setInstalledModels] = useState<InstalledModelRow[]>([]);
  const [hasLoadedInstalledModels, setHasLoadedInstalledModels] = useState(false);
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
  const localTranscriptionModelIsInstalled = useMemo(
    () => installedTranscriptionModels.some((model) => model.id === IOS_LOCAL_TRANSCRIPTION_MODEL_ID),
    [installedTranscriptionModels]
  );
  const localTranscriptionOptions = useMemo(
    () =>
      (Platform.OS === 'ios'
        ? installedTranscriptionModels.filter((model) => model.id === IOS_LOCAL_TRANSCRIPTION_MODEL_ID)
        : installedTranscriptionModels
      ).map((model) => ({
        label: model.displayName,
        value: model.id,
      })),
    [installedTranscriptionModels]
  );
  const visibleCatalog = useMemo(
    () => getCatalogItemsForDevice(catalog, deviceSupport),
    [catalog, deviceSupport]
  );

  useEffect(() => {
    if (!form || Platform.OS !== 'ios' || !hasLoadedInstalledModels) {
      return;
    }

    const normalizedTranscriptionModelId = getLocalTranscriptionModelId(
      form.providers.local.transcriptionModel,
      localTranscriptionModelIsInstalled
    );

    if (normalizedTranscriptionModelId === form.providers.local.transcriptionModel) {
      return;
    }

    setForm((current) =>
      current
        ? {
            ...current,
            providers: {
              ...current.providers,
              local: {
                ...current.providers.local,
                transcriptionModel: normalizedTranscriptionModelId,
              },
            },
          }
        : current
    );
  }, [form, hasLoadedInstalledModels, localTranscriptionModelIsInstalled]);

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
  const transcriptionModelId =
    sanitizedForm.selectedTranscriptionProvider === 'local'
      ? getLocalTranscriptionModelId(
          sanitizedForm.providers.local.transcriptionModel,
          localTranscriptionModelIsInstalled
        )
      : sanitizedForm.providers[sanitizedForm.selectedTranscriptionProvider].transcriptionModel;
  const summaryModelId = sanitizedForm.providers[sanitizedForm.selectedSummaryProvider].summaryModel;
  const transcriptionModelLabel =
    sanitizedForm.selectedTranscriptionProvider === 'local'
      ? displayModelLabel(installedTranscriptionModels, transcriptionModelId || 'No model selected yet')
      : transcriptionModelId || 'No model selected yet';
  const summaryModelLabel = summaryModelId || 'No model selected yet';
  const activeProviderSummary = buildActiveProviderSummary({
    transcriptionProviderLabel: transcriptionProvider.label,
    summaryProviderLabel: summaryProvider.label,
    transcriptionModelLabel,
    summaryModelLabel,
  });
  const overviewItems = buildSettingsOverviewItems({
    transcriptionProviderLabel: transcriptionProvider.label,
    installedTranscriptionCount: installedTranscriptionModels.length,
  });

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
                [key]:
                  providerId === 'local' && key === 'transcriptionModel'
                    ? (getLocalTranscriptionModelId(
                        String(value),
                        localTranscriptionModelIsInstalled
                      ) as ProviderConfig[K])
                    : value,
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
      if (Platform.OS === 'ios' && hasLoadedInstalledModels) {
        next.providers.local.transcriptionModel = getLocalTranscriptionModelId(
          next.providers.local.transcriptionModel,
          localTranscriptionModelIsInstalled
        );
      }
      setForm(next);
      await saveAppSettings(next);
      Alert.alert('Saved', 'Provider settings and local transcription preferences were stored on this device.');
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
              const nextTranscriptionFallback = getLocalTranscriptionModelId(
                getInstalledModelsForKind(nextInstalledModels, 'transcription')[0]?.id ?? '',
                nextInstalledModels.some((installedModel) => installedModel.id === IOS_LOCAL_TRANSCRIPTION_MODEL_ID)
              );

              if (next.providers.local.transcriptionModel === model.id) {
                next.providers.local.transcriptionModel = nextTranscriptionFallback;
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

  const handleOpenModelSource = async (item: ModelCatalogItem) => {
    if (!item.sourceUrl) {
      return;
    }

    try {
      const supported = await Linking.canOpenURL(item.sourceUrl);

      if (!supported) {
        throw new Error('This source URL cannot be opened on this device.');
      }

      await Linking.openURL(item.sourceUrl);
    } catch (error) {
      Alert.alert('Open source failed', error instanceof Error ? error.message : 'Unable to open this model source.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <FadeInView>
          <SectionHeading
            title="Current setup"
            subtitle="Pick the provider for each job first. Configure credentials and local models below when you need to change them."
          />
        </FadeInView>

        <FadeInView delay={30}>
          <SurfaceCard muted style={styles.summaryCard}>
            <View style={styles.summaryRows}>
              {overviewItems.map((item) => (
                <View key={item.label} style={styles.summaryRow}>
                  <Text style={styles.summaryRowLabel}>{item.label}</Text>
                  <Text style={styles.summaryRowValue}>{item.value}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.summaryBody}>{activeProviderSummary}</Text>
            <View style={styles.summaryActions}>
              <PillButton
                label={isSaving ? 'Saving…' : 'Save settings'}
                onPress={handleSave}
                disabled={isSaving}
              />
            </View>
          </SurfaceCard>
        </FadeInView>

        <AssignmentSection
          delay={60}
          title="Transcription provider"
          subtitle="Choose which configured provider turns audio into text."
          icon={<Feather name="mic" size={18} color={palette.ink} />}
          mode="transcription"
          selectedProviderId={sanitizedForm.selectedTranscriptionProvider}
          providerIds={transcriptionProviderIds}
          providers={sanitizedForm.providers}
          onSelect={(providerId) => updateForm('selectedTranscriptionProvider', providerId)}
          localModelOptions={localTranscriptionOptions}
        />

        <AssignmentSection
          delay={90}
          title="Summary provider"
          subtitle="Choose which configured provider writes summaries, action items, and decisions."
          icon={<Feather name="file-text" size={18} color={palette.ink} />}
          mode="summary"
          selectedProviderId={sanitizedForm.selectedSummaryProvider}
          providerIds={summaryProviderIds}
          providers={sanitizedForm.providers}
          onSelect={(providerId) => updateForm('selectedSummaryProvider', providerId)}
          localModelOptions={[]}
        />

        <FadeInView delay={120}>
          <SurfaceCard style={styles.providersSection}>
            <SectionHeading
              title="Configured providers"
              subtitle="Configure each provider once, then reuse it above for transcription or summary."
            />
            <View style={styles.providerStats}>
              <StatusChip label={`${configuredProviderIds.length} configured`} tone="secondary" />
              <StatusChip label={`${providerDefinitions.length} available`} tone="tertiary" />
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

            <SurfaceCard muted style={styles.selectedProviderCard}>
              <View style={styles.providerHeader}>
                <View style={styles.providerTitleRow}>
                  <ProviderIcon providerId={editingProviderId} />
                  <View style={styles.providerCopy}>
                    <Text style={styles.selectedProviderTitle}>{editingProvider.label}</Text>
                    <Text style={styles.rowBody}>{editingProvider.description}</Text>
                  </View>
                </View>
                <StatusChip
                  label={configuredProviderIds.includes(editingProviderId) ? 'Configured' : 'Not configured'}
                  tone={configuredProviderIds.includes(editingProviderId) ? 'secondary' : 'tertiary'}
                />
              </View>

              {editingProviderId === 'local' ? (
                <>
                  <SurfaceCard style={styles.localRuntimeCard}>
                    <Text style={styles.utilityLabel}>On-device runtime</Text>
                    <Text style={styles.rowBody}>
                      {deviceSupport?.localProcessingAvailable
                        ? 'Ready for local transcription in this build.'
                        : deviceSupport?.reason ?? 'Checking local runtime availability.'}
                    </Text>
                    {Platform.OS === 'ios' ? (
                      <Text style={styles.rowBody}>
                        Local transcription on iOS currently supports whisper-base only.
                      </Text>
                    ) : null}
                  </SurfaceCard>

                  <ModelDropdown
                    label="Active transcription model"
                    value={editingConfig.transcriptionModel}
                    options={localTranscriptionOptions}
                    onSelect={(value) => updateProvider('local', 'transcriptionModel', value)}
                    emptyText={
                      Platform.OS === 'ios'
                        ? 'Local transcription on iOS currently supports whisper-base only. Download whisper-base below before selecting Local here.'
                        : 'Download a local transcription model below before selecting Local here.'
                    }
                  />

                  <PillButton
                    label="Clear local model selection"
                    onPress={() => resetProvider('local')}
                    variant="secondary"
                  />
                </>
              ) : (
                <>
                  <FieldGroup>
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
                  </FieldGroup>

                  <FieldGroup>
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
                  </FieldGroup>

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

                  <PillButton
                    label="Clear saved provider"
                    onPress={() => resetProvider(editingProviderId)}
                    variant="secondary"
                  />
                </>
              )}
            </SurfaceCard>
          </SurfaceCard>
        </FadeInView>

        <FadeInView delay={150}>
          <SurfaceCard style={styles.localModelsSection}>
            <SectionHeading
              title="Local models"
              subtitle="Manage on-device models for offline or private transcription."
            />

            <SurfaceCard muted style={styles.runtimeCard}>
              <View style={styles.providerHeader}>
                <View style={styles.providerCopy}>
                  <Text style={styles.runtimeTitle}>Runtime status</Text>
                  <Text style={styles.rowBody}>
                    {deviceSupport?.reason ??
                      'Checking device support for the native local transcription runtime and model execution path.'}
                  </Text>
                </View>
                <StatusChip
                  label={deviceSupport?.localProcessingAvailable ? 'Ready' : 'Not ready'}
                  tone={deviceSupport?.localProcessingAvailable ? 'secondary' : 'tertiary'}
                />
              </View>
            </SurfaceCard>

            <FieldGroup>
              <Label text="Optional custom model catalog URL" />
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="https://your-hosted-catalog.example/catalog.json"
                placeholderTextColor={palette.mutedInk}
                value={form.modelCatalogUrl}
                onChangeText={(value) => updateForm('modelCatalogUrl', value)}
              />
            </FieldGroup>

            <View style={styles.actionsRow}>
              <PillButton
                label={isRefreshingCatalog ? 'Refreshing…' : 'Refresh catalog'}
                onPress={() => refreshCatalog(form.modelCatalogUrl, true)}
                variant="secondary"
                disabled={isRefreshingCatalog}
                icon={<Feather name="refresh-cw" size={16} color={palette.ink} />}
              />
            </View>

            <Text style={styles.rowBody}>
              A curated starter catalog is built in now. Add your own catalog URL only if you want a self-hosted
              or custom model list later.
            </Text>

            <ModelCatalogSection
              title="Transcription models"
              items={visibleCatalog.filter((item) => item.kind === 'transcription')}
              installedModels={installedTranscriptionModels}
              activeModelId={getLocalTranscriptionModelId(
                form.providers.local.transcriptionModel,
                localTranscriptionModelIsInstalled
              )}
              downloadProgress={downloadProgress}
              onDownload={handleDownloadModel}
              onDelete={handleDeleteModel}
              onOpenSource={handleOpenModelSource}
              onSelectActive={(modelId) => updateProvider('local', 'transcriptionModel', modelId)}
              allowDownload={deviceSupport ? deviceSupport.platform !== 'web' : false}
            />
          </SurfaceCard>
        </FadeInView>

        <FadeInView delay={180}>
          <SurfaceCard muted style={styles.advancedSection}>
            <SectionHeading
              title="Advanced"
              subtitle="Optional storage and cleanup behavior for remote processing."
            />

            <View style={styles.toggleRow}>
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
          </SurfaceCard>
        </FadeInView>
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
    setHasLoadedInstalledModels(true);
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
    <FadeInView delay={delay}>
      <SurfaceCard style={styles.assignmentSection}>
        <View style={styles.sectionTitleRow}>
          {icon}
          <SectionHeading title={title} subtitle={subtitle} />
        </View>

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

            <SurfaceCard muted style={styles.assignmentCard}>
              <View style={styles.providerTitleRow}>
                <ProviderIcon providerId={selectedProviderId} />
                <Text style={styles.selectedProviderTitle}>{selectedProvider.label}</Text>
              </View>
              <Text style={styles.assignmentMeta}>
                {mode === 'transcription' ? 'Transcription model' : 'Summary model'}
              </Text>
              <Text style={styles.assignmentValue}>{modelLabel}</Text>
            </SurfaceCard>
          </>
        ) : (
          <SurfaceCard muted style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No configured provider yet</Text>
            <Text style={styles.rowBody}>
              Configure a provider below and add its API key once. Local transcription will appear here after you
              choose an installed model.
            </Text>
          </SurfaceCard>
        )}
      </SurfaceCard>
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
  onOpenSource,
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
  onOpenSource: (item: ModelCatalogItem) => void;
  onSelectActive: (modelId: string) => void;
  allowDownload: boolean;
}) {
  return (
    <View style={styles.catalogSection}>
      <SectionHeading title={title} />

      {items.length ? (
        items.map((item) => {
          const installed = installedModels.find((model) => model.id === item.id);
          const progress = downloadProgress[item.id];
          const canDirectDownload = Boolean(item.downloadUrl.trim());
          const canOpenSource = Boolean(item.sourceUrl?.trim());

          return (
            <SurfaceCard key={item.id} muted style={styles.modelCard}>
              <View style={styles.modelHeader}>
                <View style={styles.modelTitleWrap}>
                  <Text style={styles.modelTitle}>{item.displayName}</Text>
                  <Text style={styles.modelMeta}>
                    {item.engine} • {formatBytes(item.sizeBytes)}
                  </Text>
                </View>
                {installed ? (
                  <StatusChip
                    label={installed.status}
                    tone={installed.status === 'installed' ? 'secondary' : 'tertiary'}
                  />
                ) : item.recommended ? (
                  <StatusChip label="Recommended" tone="secondary" />
                ) : item.experimental ? (
                  <StatusChip label="Experimental" tone="tertiary" />
                ) : null}
              </View>

              <Text style={styles.rowBody}>{item.description}</Text>

              <View style={styles.modelActionRow}>
                {installed?.status === 'installed' ? (
                  <>
                    <PillButton
                      label={activeModelId === item.id ? 'Active' : 'Set active'}
                      onPress={() => onSelectActive(item.id)}
                      variant="secondary"
                      icon={<Feather name="check-circle" size={16} color={palette.ink} />}
                    />
                    <PillButton
                      label="Delete"
                      onPress={() => onDelete(installed)}
                      variant="secondary"
                      icon={<Feather name="trash-2" size={16} color={palette.ink} />}
                    />
                  </>
                ) : (
                  <>
                    {canDirectDownload ? (
                      <PillButton
                        label={typeof progress === 'number' ? `Downloading ${Math.round(progress * 100)}%` : 'Download'}
                        onPress={() => onDownload(item)}
                        variant="secondary"
                        disabled={!allowDownload}
                        icon={<Feather name="download" size={16} color={palette.ink} />}
                      />
                    ) : null}

                    {canOpenSource ? (
                      <PillButton
                        label={item.sourceLabel ?? 'View source'}
                        onPress={() => onOpenSource(item)}
                        variant="secondary"
                        icon={<Feather name="external-link" size={16} color={palette.ink} />}
                      />
                    ) : null}

                    {!canDirectDownload && !canOpenSource ? (
                      <PillButton
                        label="Unavailable"
                        onPress={() => undefined}
                        variant="secondary"
                        disabled
                        icon={<Feather name="slash" size={16} color={palette.ink} />}
                      />
                    ) : null}
                  </>
                )}
              </View>

              {!canDirectDownload && item.requiresExternalSetup ? (
                <Text style={styles.modelHint}>
                  This official model still needs an external download or license-acceptance step. Open the source page for details.
                </Text>
              ) : !canDirectDownload && canOpenSource ? (
                <Text style={styles.modelHint}>
                  This entry is curated by default, but the file is not fetched directly in-app yet.
                </Text>
              ) : null}
              {installed?.errorMessage ? <Text style={styles.errorText}>{installed.errorMessage}</Text> : null}
            </SurfaceCard>
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
    <FieldGroup>
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
    </FieldGroup>
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
    <FieldGroup>
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
    </FieldGroup>
  );
}

function FieldGroup({ children }: { children: ReactNode }) {
  return <View style={styles.fieldGroup}>{children}</View>;
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
    fontFamily: typography.body.fontFamily,
  },
  container: {
    padding: 20,
    gap: 16,
    paddingBottom: 32,
  },
  summaryCard: {
    gap: 14,
  },
  summaryRows: {
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  summaryRowLabel: {
    color: palette.mutedInk,
    fontFamily: typography.label.fontFamily,
    fontSize: 13,
  },
  summaryRowValue: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 14,
    flexShrink: 1,
    textAlign: 'right',
  },
  summaryBody: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    lineHeight: 22,
  },
  summaryActions: {
    alignItems: 'flex-start',
  },
  assignmentSection: {
    gap: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  providersSection: {
    gap: 14,
  },
  providerStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    borderColor: palette.lineSoft,
    backgroundColor: palette.cardUtility,
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
    borderRadius: radii.pill,
    backgroundColor: palette.accent,
  },
  providerPickerLabel: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 13,
  },
  providerPickerLabelSelected: {
    color: palette.ink,
  },
  selectedProviderCard: {
    gap: 14,
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  providerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  providerCopy: {
    flex: 1,
    gap: 4,
  },
  selectedProviderTitle: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 18,
  },
  localRuntimeCard: {
    gap: 6,
  },
  localModelsSection: {
    gap: 14,
  },
  runtimeCard: {
    gap: 8,
  },
  runtimeTitle: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 17,
  },
  utilityLabel: {
    color: palette.accent,
    fontFamily: typography.label.fontFamily,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  catalogSection: {
    gap: 10,
  },
  modelCard: {
    gap: 10,
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
    fontFamily: typography.heading.fontFamily,
    fontSize: 16,
  },
  modelMeta: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 12,
  },
  modelActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modelHint: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 12,
    lineHeight: 18,
  },
  label: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 13,
  },
  fieldGroup: {
    gap: 8,
  },
  input: {
    backgroundColor: palette.cardUtility,
    borderWidth: 1,
    borderColor: palette.lineSoft,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: palette.ink,
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
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
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.lineSoft,
    backgroundColor: palette.cardUtility,
  },
  chipSelected: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  chipText: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 13,
  },
  chipTextSelected: {
    color: palette.paper,
  },
  assignmentCard: {
    gap: 6,
  },
  assignmentMeta: {
    color: palette.accent,
    fontFamily: typography.label.fontFamily,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  assignmentValue: {
    color: palette.ink,
    fontFamily: typography.bodyStrong.fontFamily,
    fontSize: 15,
    lineHeight: 21,
  },
  emptyState: {
    gap: 6,
  },
  emptyStateTitle: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 16,
  },
  selectButton: {
    backgroundColor: palette.cardUtility,
    borderWidth: 1,
    borderColor: palette.lineSoft,
    borderRadius: 16,
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
    fontFamily: typography.bodyStrong.fontFamily,
    fontSize: 15,
  },
  selectHint: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 12,
  },
  rowCopy: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 16,
  },
  rowBody: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  advancedSection: {
    gap: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  errorText: {
    color: palette.danger,
    fontFamily: typography.body.fontFamily,
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
    borderRadius: radii.card,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: palette.lineSoft,
  },
  modalTitle: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 18,
  },
  modalBody: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    lineHeight: 20,
  },
  optionList: {
    gap: 8,
  },
  optionButton: {
    backgroundColor: palette.cardUtility,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: palette.lineSoft,
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
    fontFamily: typography.label.fontFamily,
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
    fontFamily: typography.label.fontFamily,
  },
});
