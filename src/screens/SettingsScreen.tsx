import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Linking,
  Modal,
  type LayoutChangeEvent,
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
import { KeyboardAwareScrollView } from '../components/KeyboardAwareScrollView';
import { ScreenBackground } from '../components/ScreenBackground';
import {
  PillButton,
  SectionHeading,
  StatusChip,
  SurfaceCard,
} from '../components/ui';
import {
  buildActiveProviderSummary,
  buildConfiguredProviderMeta,
  buildProviderEditorSelection,
  buildProcessingModeDetails,
  buildProviderPickerOptionCopy,
  buildSettingsOverviewItems,
  displayModelLabel,
  formatBytes,
  getConfiguredProviderIds,
  getSettingsProcessingMode,
  pickInitialProvider,
} from '../features/settings/presentation';
import { LAYERS_ROUTE } from '../navigation/routes';
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
import {
  getOfflineSetupSession,
  markOfflineSetupFailed,
  markOfflineSetupPausedOffline,
  markOfflineSetupReady,
  startOfflineSetup,
  updateOfflineSetupProgress,
  type OfflineSetupBundle,
} from '../services/offlineSetupSession';
import type {
  AppSettings,
  InstalledModelRow,
  LocalDeviceSupport,
  ModelCatalogItem,
  OfflineSetupSession,
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
  const [offlineSetup, setOfflineSetup] = useState<OfflineSetupSession | null>(null);
  const [showAdvancedEndpoint, setShowAdvancedEndpoint] = useState(false);
  const [activeDownloadIds, setActiveDownloadIds] = useState<Set<string>>(() => new Set());
  const [providerSettingsSectionY, setProviderSettingsSectionY] = useState(0);
  // Mirror of activeDownloadIds used for synchronous guards inside handlers —
  // React state alone can race across quick successive taps.
  const activeDownloadIdsRef = useRef(new Set<string>());
  const settingsScrollViewRef = useRef<ScrollView | null>(null);

  const setActiveDownload = (modelId: string, isActive: boolean) => {
    if (isActive) {
      activeDownloadIdsRef.current.add(modelId);
    } else {
      activeDownloadIdsRef.current.delete(modelId);
    }
    setActiveDownloadIds(new Set(activeDownloadIdsRef.current));
  };

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
  const localSummaryOptions = useMemo(
    () =>
      installedSummaryModels.map((model) => ({
        label: model.displayName,
        value: model.id,
      })),
    [installedSummaryModels]
  );
  const visibleCatalog = useMemo(
    () => getCatalogItemsForDevice(catalog, deviceSupport),
    [catalog, deviceSupport]
  );
  const downloadProgress = useMemo(() => {
    if (!offlineSetup || offlineSetup.status !== 'downloading') {
      return {};
    }

    return offlineSetup.modelIds.reduce<Record<string, number>>((progressByModel, modelId) => {
      progressByModel[modelId] = offlineSetup.progress;
      return progressByModel;
    }, {});
  }, [offlineSetup]);
  const offlineSetupStatusByModel = useMemo(() => {
    if (!offlineSetup || offlineSetup.status === 'idle') {
      return {};
    }

    return offlineSetup.modelIds.reduce<Partial<Record<string, OfflineSetupSession['status']>>>(
      (statusByModel, modelId) => {
        statusByModel[modelId] = offlineSetup.status;
        return statusByModel;
      },
      {}
    );
  }, [offlineSetup]);

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
  const processingMode = getSettingsProcessingMode(form.selectedTranscriptionProvider);
  const localSummarySupported = deviceSupport?.supportsSummary !== false;
  const cloudTranscriptionProviderIds = getCloudProviderOptions({
    configuredProviderIds: getConfiguredProviderIds(sanitizedForm.providers, 'transcription'),
    selectedProviderId: sanitizedForm.selectedTranscriptionProvider,
    mode: 'transcription',
  });
  const cloudSummaryProviderIds = getCloudProviderOptions({
    configuredProviderIds: getConfiguredProviderIds(sanitizedForm.providers, 'summary'),
    selectedProviderId: sanitizedForm.selectedSummaryProvider,
    mode: 'summary',
  });
  const offlineSummaryProviderIds = Array.from(
    new Set<ProviderId>(localSummarySupported ? ['local', ...cloudSummaryProviderIds] : cloudSummaryProviderIds)
  );
  const selectedSummaryProviderId =
    sanitizedForm.selectedSummaryProvider === 'local' && !localSummarySupported
      ? getFallbackCloudProviderId(sanitizedForm, 'summary')
      : sanitizedForm.selectedSummaryProvider;
  const editingCloudProviderId = editingProviderId === 'local' ? 'openai' : editingProviderId;
  const editingProvider = providerMap[editingCloudProviderId];
  const editingConfig = form.providers[editingCloudProviderId];
  const selectedTranscriptionProviderId =
    processingMode === 'offline' ? 'local' : sanitizedForm.selectedTranscriptionProvider;
  const transcriptionProvider = providerMap[selectedTranscriptionProviderId];
  const transcriptionModelId =
    selectedTranscriptionProviderId === 'local'
      ? getLocalTranscriptionModelId(
          form.providers.local.transcriptionModel,
          localTranscriptionModelIsInstalled
        )
      : sanitizedForm.providers[selectedTranscriptionProviderId].transcriptionModel;
  const summaryModelId = sanitizedForm.providers[selectedSummaryProviderId].summaryModel;
  const localSummaryModelId = form.providers.local.summaryModel;
  const localSummaryModelLabel = displayModelLabel(
    installedSummaryModels,
    localSummaryModelId || 'No model selected yet'
  );
  const transcriptionModelLabel =
    selectedTranscriptionProviderId === 'local'
      ? displayModelLabel(installedTranscriptionModels, transcriptionModelId || 'No model selected yet')
      : transcriptionModelId || 'No model selected yet';
  const summaryModelLabel =
    selectedSummaryProviderId === 'local'
      ? displayModelLabel(installedSummaryModels, summaryModelId || 'No model selected yet')
      : summaryModelId || 'No model selected yet';
  const cloudProviderIds = providerDefinitions
    .filter((definition) => definition.id !== 'local')
    .map((definition) => definition.id);
  const configuredCloudProviderIds = configuredProviderIds.filter((providerId) => providerId !== 'local');
  const activeCloudProviderIds = [
    sanitizedForm.selectedTranscriptionProvider,
    selectedSummaryProviderId,
  ].filter(
    (providerId, index, providerIds): providerId is ProviderId =>
      providerId !== 'local' && providerIds.indexOf(providerId) === index
  );
  const cloudCredentialRows = configuredCloudProviderIds.length
    ? configuredCloudProviderIds
    : activeCloudProviderIds.length
      ? activeCloudProviderIds
      : (['openai'] as ProviderId[]);
  const activeProviderSummary = buildActiveProviderSummary({
    transcriptionProviderLabel: transcriptionProvider.label,
    summaryProviderLabel: providerMap[selectedSummaryProviderId].label,
    transcriptionModelLabel,
    summaryModelLabel,
  });
  const processingModeDetails = buildProcessingModeDetails({
    processingMode,
    summaryProviderLabel: providerMap[selectedSummaryProviderId].label,
  });
  const overviewItems = buildSettingsOverviewItems({
    processingMode,
    transcriptionProviderLabel: transcriptionProvider.label,
    summaryProviderLabel: providerMap[selectedSummaryProviderId].label,
    installedTranscriptionCount: installedTranscriptionModels.length,
    installedSummaryCount: installedSummaryModels.length,
  });

  const updateForm = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const setProcessingMode = (nextMode: typeof processingMode) => {
    setForm((current) => {
      if (!current) {
        return current;
      }

      if (nextMode === 'offline') {
        return {
          ...current,
          selectedTranscriptionProvider: 'local',
          selectedSummaryProvider:
            current.selectedSummaryProvider === 'local' && !localSummarySupported
              ? getFallbackCloudProviderId(current, 'summary')
              : current.selectedSummaryProvider,
        };
      }

      return {
        ...current,
        selectedTranscriptionProvider:
          current.selectedTranscriptionProvider === 'local'
            ? getFallbackCloudProviderId(current, 'transcription')
            : current.selectedTranscriptionProvider,
        selectedSummaryProvider:
          current.selectedSummaryProvider === 'local'
            ? getFallbackCloudProviderId(current, 'summary')
            : current.selectedSummaryProvider,
      };
    });
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

  async function refreshCatalog(catalogUrl: string, showFailureAlert = false) {
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
  }

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
      if (next.selectedSummaryProvider === 'local' && !localSummarySupported) {
        next.selectedSummaryProvider = getFallbackCloudProviderId(next, 'summary');
      }
      setForm(next);
      await saveAppSettings(next);
      Alert.alert('Saved', 'Processing route, API credentials, and local model preferences were stored on this device.');
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadModel = async (item: ModelCatalogItem) => {
    const bundle = buildOfflineSetupBundleFromModel(item);

    try {
      if (activeDownloadIdsRef.current.has(item.id)) {
        Alert.alert('Download in progress', `${item.displayName} is already downloading.`);
        return;
      }

      setActiveDownload(item.id, true);
      await startOfflineSetup(bundle);
      setOfflineSetup(await getOfflineSetupSession());

      await downloadModel(item, {
        onProgress: (progress) => {
          const bytesDownloaded = Math.round(item.sizeBytes * progress);
          setOfflineSetup((current) =>
            current && current.modelIds.includes(item.id)
              ? {
                  ...current,
                  status: 'downloading',
                  bytesDownloaded,
                  totalBytes: item.sizeBytes,
                  progress,
                  lastError: null,
                  updatedAt: new Date().toISOString(),
                }
              : current
          );
          void updateOfflineSetupProgress({
            bytesDownloaded,
            totalBytes: item.sizeBytes,
            progress,
          }).catch(() => undefined);
        },
      });

      const nextInstalledModels = await getInstalledModels();
      setInstalledModels(nextInstalledModels);
      await markOfflineSetupReady({
        preferredTranscriptionModelId: item.kind === 'transcription' ? item.id : null,
        preferredSummaryModelId: item.kind === 'summary' ? item.id : null,
      });
      setOfflineSetup(await getOfflineSetupSession());

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
      const message = error instanceof Error ? error.message : 'Unable to download this model.';
      if (/network|internet|offline|connection|timed out/i.test(message)) {
        await markOfflineSetupPausedOffline(message);
      } else {
        await markOfflineSetupFailed(message);
      }
      setOfflineSetup(await getOfflineSetupSession());
      Alert.alert('Download failed', message);
    } finally {
      setActiveDownload(item.id, false);
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

              if (next.providers.local.summaryModel === model.id) {
                next.providers.local.summaryModel =
                  getInstalledModelsForKind(nextInstalledModels, 'summary')[0]?.id ?? '';
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

  const openOnboarding = () => {
    router.push('/onboarding');
  };

  const openProviderEditor = (providerId: ProviderId) => {
    const next = buildProviderEditorSelection(providerId);
    setEditingProviderId(next.editingProviderId);

    if (!next.revealInlinePanel) {
      return;
    }

    requestAnimationFrame(() => {
      settingsScrollViewRef.current?.scrollTo({
        y: Math.max(providerSettingsSectionY - 24, 0),
        animated: true,
      });
    });
  };

  const handleProviderSettingsSectionLayout = (event: LayoutChangeEvent) => {
    setProviderSettingsSectionY(event.nativeEvent.layout.y);
  };

  const renderProviderSettingsPanel = () => (
    <View style={styles.selectedProviderCard}>
      <View style={styles.providerHeader}>
        <View style={styles.providerTitleRow}>
          <ProviderIcon providerId={editingCloudProviderId} />
          <View style={styles.providerCopy}>
            <Text style={styles.selectedProviderTitle}>{editingProvider.label}</Text>
            <Text style={styles.rowBody}>{editingProvider.description}</Text>
          </View>
        </View>
        <StatusChip
          label={configuredProviderIds.includes(editingCloudProviderId) ? 'Configured' : 'Not configured'}
          tone={configuredProviderIds.includes(editingCloudProviderId) ? 'secondary' : 'tertiary'}
        />
      </View>

      {editingProviderId === 'local' ? (
        <>
          <SurfaceCard style={styles.localRuntimeCard}>
            <Text style={styles.utilityLabel}>On-device runtime</Text>
            <Text style={styles.rowBody}>
              {deviceSupport?.localProcessingAvailable
                ? 'Ready for local processing in this build.'
                : deviceSupport?.reason ?? 'Checking local runtime availability.'}
            </Text>
            <Text style={styles.rowBody}>
              Pick the active transcription and summary models in{' '}
              {processingMode === 'offline' ? 'Offline mode above' : 'the Local models section'}. Download or manage
              model files in the Local models section.
            </Text>
          </SurfaceCard>

          <PillButton label="Clear local model selection" onPress={() => resetProvider('local')} variant="secondary" />
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
              onChangeText={(value) => updateProvider(editingCloudProviderId, 'apiKey', value)}
            />
          </FieldGroup>

          {editingProvider.supportsTranscription ? (
            <ModelDropdown
              label="Default transcription model"
              value={editingConfig.transcriptionModel}
              options={toModelOptions(editingProvider.transcriptionModels)}
              onSelect={(value) => updateProvider(editingCloudProviderId, 'transcriptionModel', value)}
              emptyText="This provider does not publish preset transcription models yet."
            />
          ) : null}

          {editingProvider.supportsSummary ? (
            <ModelDropdown
              label="Default summary model"
              value={editingConfig.summaryModel}
              options={toModelOptions(editingProvider.summaryModels)}
              onSelect={(value) => updateProvider(editingCloudProviderId, 'summaryModel', value)}
              emptyText="This provider does not publish preset summary models yet."
            />
          ) : null}

          {editingCloudProviderId === 'custom' || showAdvancedEndpoint ? (
            <FieldGroup>
              <Label text={editingCloudProviderId === 'custom' ? 'Base URL' : 'Advanced base URL'} />
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={editingProvider.baseUrlPlaceholder}
                placeholderTextColor={palette.mutedInk}
                value={editingConfig.baseUrl}
                onChangeText={(value) => updateProvider(editingCloudProviderId, 'baseUrl', value)}
              />
            </FieldGroup>
          ) : (
            <PillButton
              label="Show advanced endpoint"
              onPress={() => setShowAdvancedEndpoint(true)}
              variant="ghost"
              icon={<Feather name="sliders" size={16} color={palette.ink} />}
            />
          )}

          <PillButton label={isSaving ? 'Saving…' : 'Save provider settings'} onPress={handleSave} disabled={isSaving} />

          <PillButton label="Clear saved provider" onPress={() => resetProvider(editingCloudProviderId)} variant="secondary" />
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <KeyboardAwareScrollView scrollRef={settingsScrollViewRef} contentContainerStyle={styles.container}>
        <FadeInView>
          <SectionHeading
            title="Settings"
            subtitle="Mu Fathom is local-first. Pick where processing happens, then tune only the pieces you use."
          />
        </FadeInView>

        <FadeInView delay={30}>
          <SurfaceCard muted style={styles.summaryCard}>
            <View style={styles.modeSwitcher}>
              <ModeButton
                label="Cloud"
                description="Use API providers"
                selected={processingMode === 'cloud'}
                onPress={() => setProcessingMode('cloud')}
              />
              <ModeButton
                label="Offline"
                description="Prefer device models"
                selected={processingMode === 'offline'}
                onPress={() => setProcessingMode('offline')}
              />
            </View>

            <View style={styles.modeSummary}>
              <Text style={styles.modeSummaryTitle}>{processingModeDetails.title}</Text>
              <Text style={styles.summaryBody}>{processingModeDetails.body}</Text>
            </View>

            <View style={styles.summaryGrid}>
              {overviewItems.map((item) => (
                <View key={item.label} style={styles.summaryTile}>
                  <Text style={styles.summaryRowLabel}>{item.label}</Text>
                  <Text style={styles.summaryRowValue}>{item.value}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.activeSummaryText}>{activeProviderSummary}</Text>
            <View style={styles.summaryActions}>
              <PillButton
                label={isSaving ? 'Saving…' : 'Save settings'}
                onPress={handleSave}
                disabled={isSaving}
              />
              <PillButton
                label="Replay onboarding"
                onPress={openOnboarding}
                variant="ghost"
                icon={<Feather name="rotate-ccw" size={16} color={palette.ink} />}
              />
            </View>
          </SurfaceCard>
        </FadeInView>

        <FadeInView delay={55}>
          <SurfaceCard style={styles.processingCard}>
            {processingMode === 'cloud' ? (
              <>
                <SectionHeading
                  title="Cloud route"
                  subtitle="Choose the API provider for each job. Local recordings still stay on this device until processing starts."
                />
                <ProviderDropdown
                  label="Transcription provider"
                  value={sanitizedForm.selectedTranscriptionProvider}
                  providerIds={cloudTranscriptionProviderIds}
                  configuredProviderIds={configuredProviderIds}
                  onSelect={(providerId) => updateForm('selectedTranscriptionProvider', providerId)}
                />
                <ProviderDropdown
                  label="Summary provider"
                  value={selectedSummaryProviderId}
                  providerIds={cloudSummaryProviderIds}
                  configuredProviderIds={configuredProviderIds}
                  onSelect={(providerId) => updateForm('selectedSummaryProvider', providerId)}
                />
              </>
            ) : (
              <>
                <SectionHeading
                  title="Local route"
                  subtitle={
                    localSummarySupported
                      ? 'Transcription uses a downloaded model. Summary can stay local or move to a cloud provider.'
                      : 'Transcription uses a downloaded model. Installed local summary models can still be saved here, but this iOS build uses a cloud provider for summary and analysis.'
                  }
                />
                <View style={styles.inlineStatusBlock}>
                  <Text style={styles.utilityLabel}>On-device runtime</Text>
                  <Text style={styles.rowBody}>
                    {deviceSupport?.localProcessingAvailable
                      ? localSummarySupported
                        ? 'Ready for local processing in this build.'
                        : 'Ready for local transcription. Summary and analysis still need a cloud provider on iOS.'
                      : deviceSupport?.reason ?? 'Checking local runtime availability.'}
                  </Text>
                </View>
                <ModelDropdown
                  label="Local transcription model"
                  value={form.providers.local.transcriptionModel}
                  options={localTranscriptionOptions}
                  onSelect={(value) => updateProvider('local', 'transcriptionModel', value)}
                  emptyText={
                    Platform.OS === 'ios'
                      ? 'Download whisper-base from the local model library before choosing Offline.'
                      : 'Download a local transcription model from the local model library before choosing Offline.'
                  }
                />
                <ProviderDropdown
                  label="Summary and analysis"
                  value={selectedSummaryProviderId}
                  providerIds={offlineSummaryProviderIds}
                  configuredProviderIds={configuredProviderIds}
                  onSelect={(providerId) => updateForm('selectedSummaryProvider', providerId)}
                />
                {selectedSummaryProviderId === 'local' || !localSummarySupported ? (
                  <ModelDropdown
                    label={localSummarySupported ? 'Local summary model' : 'Preferred local summary model'}
                    value={form.providers.local.summaryModel}
                    options={localSummaryOptions}
                    onSelect={(value) => updateProvider('local', 'summaryModel', value)}
                    emptyText={
                      localSummarySupported
                        ? 'Download a local summary model from the local model library first.'
                        : 'Install a local summary model to keep a preferred one ready for a future on-device summary build.'
                    }
                  />
                ) : null}
                {!localSummarySupported ? (
                  <Text style={styles.rowBody}>
                    {localSummaryModelId
                      ? `Saved local model: ${localSummaryModelLabel}. Analyze still uses ${providerMap[selectedSummaryProviderId].label} for summary and structured analysis on this iOS build.`
                      : `Analyze still uses ${providerMap[selectedSummaryProviderId].label} for summary and structured analysis on this iOS build.`}
                  </Text>
                ) : null}
              </>
            )}
          </SurfaceCard>
        </FadeInView>

        <FadeInView delay={105}>
          <View onLayout={handleProviderSettingsSectionLayout}>
            <SurfaceCard style={styles.providersSection}>
              <SectionHeading
                title="Cloud credentials"
                subtitle="API keys and model defaults live here. Local models are managed below."
              />
              <View style={styles.providerStats}>
                <StatusChip label={`${configuredCloudProviderIds.length} configured`} tone="secondary" />
                <StatusChip label={`${cloudProviderIds.length} available`} tone="tertiary" />
              </View>

              <View style={styles.configuredProviderList}>
                <Text style={styles.utilityLabel}>Active or saved APIs</Text>
                {cloudCredentialRows.map((providerId) => (
                  <ConfiguredProviderRow
                    key={providerId}
                    providerId={providerId}
                    configured={configuredProviderIds.includes(providerId)}
                    active={
                      providerId === selectedTranscriptionProviderId ||
                      providerId === selectedSummaryProviderId
                    }
                    onConfigure={() => openProviderEditor(providerId)}
                  />
                ))}
              </View>

              <ProviderDropdown
                label="Edit API provider"
                value={editingCloudProviderId}
                providerIds={cloudProviderIds}
                configuredProviderIds={configuredProviderIds}
                onSelect={setEditingProviderId}
              />

              {renderProviderSettingsPanel()}
            </SurfaceCard>
          </View>
        </FadeInView>

        <FadeInView delay={150}>
          <View style={styles.localModelsSection}>
            <SectionHeading
              title="Local model library"
              subtitle="Download once, then use models in Offline mode or as a private fallback."
            />

            <View style={styles.runtimeStrip}>
              <View style={styles.providerCopy}>
                <Text style={styles.runtimeTitle}>Runtime</Text>
                <Text style={styles.rowBody}>
                  {deviceSupport?.reason ?? 'Checking local model support for this device.'}
                </Text>
              </View>
              <StatusChip
                label={deviceSupport?.localProcessingAvailable ? 'Ready' : 'Not ready'}
                tone={deviceSupport?.localProcessingAvailable ? 'secondary' : 'tertiary'}
              />
            </View>

            <FieldGroup>
              <Label text="Custom catalog URL" />
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

            <ModelCatalogSection
              title="Transcription models"
              items={visibleCatalog.filter((item) => item.kind === 'transcription')}
              installedModels={installedTranscriptionModels}
              activeModelId={getLocalTranscriptionModelId(
                form.providers.local.transcriptionModel,
                localTranscriptionModelIsInstalled
              )}
              downloadProgress={downloadProgress}
              offlineSetupStatusByModel={offlineSetupStatusByModel}
              activeDownloadIds={activeDownloadIds}
              onDownload={handleDownloadModel}
              onDelete={handleDeleteModel}
              onOpenSource={handleOpenModelSource}
              onSelectActive={(modelId) => updateProvider('local', 'transcriptionModel', modelId)}
              allowDownload={deviceSupport ? deviceSupport.platform !== 'web' : false}
            />
            <ModelCatalogSection
              title="Summary and analysis models"
              items={visibleCatalog.filter((item) => item.kind === 'summary')}
              installedModels={installedSummaryModels}
              activeModelId={form.providers.local.summaryModel}
              downloadProgress={downloadProgress}
              offlineSetupStatusByModel={offlineSetupStatusByModel}
              activeDownloadIds={activeDownloadIds}
              onDownload={handleDownloadModel}
              onDelete={handleDeleteModel}
              onOpenSource={handleOpenModelSource}
              onSelectActive={(modelId) => updateProvider('local', 'summaryModel', modelId)}
              allowDownload={deviceSupport ? deviceSupport.platform !== 'web' : false}
            />
          </View>
        </FadeInView>

        <FadeInView delay={165}>
          <SurfaceCard muted style={styles.advancedSection}>
            <SectionHeading
              title="Extraction layers"
              subtitle="Define the structured fields that get pulled from each meeting and optionally synced to Google Sheets."
            />
            <PillButton
              label="Manage extraction layers"
              onPress={() => router.push(LAYERS_ROUTE)}
              variant="secondary"
              icon={<Feather name="layers" size={16} color={palette.ink} />}
            />
          </SurfaceCard>
        </FadeInView>

        <FadeInView delay={180}>
          <SurfaceCard muted style={styles.advancedSection}>
            <SectionHeading
              title="Advanced"
              subtitle="Remote-provider cleanup."
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
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );

  async function hydrateScreen() {
    const settings = await getAppSettings();
    const next = sanitizeAppSettings(settings);
    setForm(next);
    const initialProvider = pickInitialProvider(next);
    setEditingProviderId(initialProvider === 'local' ? 'openai' : initialProvider);

    const [support, models, setupSession] = await Promise.all([
      getLocalDeviceSupport(),
      getInstalledModels(),
      getOfflineSetupSession(),
    ]);
    setDeviceSupport(support);
    setInstalledModels(models);
    setOfflineSetup(setupSession);
    setHasLoadedInstalledModels(true);
    await refreshCatalog(next.modelCatalogUrl);
  }
}

function buildOfflineSetupBundleFromModel(item: ModelCatalogItem): OfflineSetupBundle {
  return {
    id: item.recommended ? 'starter' : 'full',
    label: item.displayName,
    modelIds: [item.id],
    totalBytes: item.sizeBytes,
    estimatedSeconds: Math.max(60, Math.round(item.sizeBytes / (25 * 1024 * 1024))),
    isRecommended: item.recommended,
    description: item.description,
  };
}

function getFallbackCloudProviderId(settings: AppSettings, mode: 'transcription' | 'summary'): ProviderId {
  const configured = getConfiguredProviderIds(settings.providers, mode).filter((providerId) => providerId !== 'local');
  return configured[0] ?? 'openai';
}

function getCloudProviderOptions({
  configuredProviderIds,
  selectedProviderId,
  mode,
}: {
  configuredProviderIds: ProviderId[];
  selectedProviderId: ProviderId;
  mode: 'transcription' | 'summary';
}) {
  const eligibleProviderIds = providerDefinitions
    .filter((definition) => {
      if (definition.id === 'local') {
        return false;
      }

      return mode === 'transcription' ? definition.supportsTranscription : definition.supportsSummary;
    })
    .map((definition) => definition.id);
  const configuredCloudIds = configuredProviderIds.filter((providerId) =>
    eligibleProviderIds.includes(providerId)
  );
  const selectedCloudId = eligibleProviderIds.includes(selectedProviderId) ? selectedProviderId : 'openai';

  return Array.from(new Set([selectedCloudId, ...configuredCloudIds]));
}

function toModelOptions(models: string[]) {
  return models.map((model) => ({
    label: model,
    value: model,
  }));
}

function ModeButton({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: PressableProps['onPress'];
}) {
  return (
    <Pressable style={[styles.modeButton, selected ? styles.modeButtonSelected : null]} onPress={onPress}>
      <Text style={[styles.modeButtonLabel, selected ? styles.modeButtonLabelSelected : null]}>{label}</Text>
      <Text style={[styles.modeButtonDescription, selected ? styles.modeButtonDescriptionSelected : null]}>
        {description}
      </Text>
    </Pressable>
  );
}

function ProviderDropdown({
  label,
  value,
  providerIds,
  configuredProviderIds = [],
  onSelect,
}: {
  label: string;
  value: ProviderId;
  providerIds: ProviderId[];
  configuredProviderIds?: ProviderId[];
  onSelect: (value: ProviderId) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedProvider = providerMap[value] ?? providerMap.openai;
  const selectedStatus = configuredProviderIds.includes(selectedProvider.id) ? 'Configured' : 'Needs setup';

  return (
    <FieldGroup>
      <Label text={label} />
      <Pressable style={styles.selectButton} onPress={() => setIsOpen(true)}>
        <View style={styles.selectCopy}>
          <Text style={styles.selectValue}>{selectedProvider.label}</Text>
          <Text style={styles.selectHint}>
            {selectedStatus} • {selectedProvider.description}
          </Text>
        </View>
        <Feather name="chevron-down" size={18} color={palette.ink} />
      </Pressable>

      <Modal transparent animationType="fade" visible={isOpen} onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={[styles.modalCard, styles.providerPickerModalCard]} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Text style={styles.modalBody}>Pick one provider for this part of processing.</Text>

            <ScrollView style={styles.optionListScroll} contentContainerStyle={styles.optionList}>
              {providerIds.map((providerId) => {
                const selected = providerId === value;
                const provider = providerMap[providerId];
                const optionCopy = buildProviderPickerOptionCopy({
                  providerLabel: provider.label,
                  providerDescription: provider.description,
                  configured: configuredProviderIds.includes(providerId),
                });

                return (
                  <Pressable
                    key={providerId}
                    style={[styles.optionButton, selected && styles.optionButtonSelected]}
                    onPress={() => {
                      onSelect(providerId);
                      setIsOpen(false);
                    }}
                  >
                    <ProviderIcon providerId={providerId} />
                    <View style={styles.optionCopy}>
                      <View style={styles.optionHeader}>
                        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                          {optionCopy.title}
                        </Text>
                        <Text style={[styles.optionMeta, selected && styles.optionLabelSelected]}>
                          {optionCopy.statusLine}
                        </Text>
                      </View>
                      <Text style={[styles.optionDescription, selected && styles.optionLabelSelected]}>
                        {optionCopy.description}
                      </Text>
                    </View>
                    {selected ? <Feather name="check" size={16} color={palette.paper} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable style={styles.modalCloseButton} onPress={() => setIsOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </FieldGroup>
  );
}

function ConfiguredProviderRow({
  providerId,
  configured,
  active,
  onConfigure,
}: {
  providerId: ProviderId;
  configured: boolean;
  active: boolean;
  onConfigure: PressableProps['onPress'];
}) {
  const provider = providerMap[providerId];
  const meta = buildConfiguredProviderMeta({ configured, active });

  return (
    <Pressable style={styles.configuredProviderRow} onPress={onConfigure}>
      <View style={styles.providerTitleRow}>
        <ProviderIcon providerId={providerId} />
        <View style={styles.providerCopy}>
          <Text style={styles.configuredProviderTitle}>{provider.label}</Text>
          <Text style={styles.configuredProviderMeta}>{meta}</Text>
        </View>
      </View>
      <View style={styles.gearButton}>
        <Feather name="settings" size={17} color={palette.ink} />
      </View>
    </Pressable>
  );
}

function ModelCatalogSection({
  title,
  items,
  installedModels,
  activeModelId,
  downloadProgress,
  offlineSetupStatusByModel,
  activeDownloadIds,
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
  offlineSetupStatusByModel: Partial<Record<string, OfflineSetupSession['status']>>;
  activeDownloadIds: Set<string>;
  onDownload: (item: ModelCatalogItem) => void;
  onDelete: (item: InstalledModelRow) => void;
  onOpenSource: (item: ModelCatalogItem) => void;
  onSelectActive: (modelId: string) => void;
  allowDownload: boolean;
}) {
  return (
    <View style={styles.catalogSection}>
      <SectionHeading title={title} />
      <Text style={styles.modelHint}>
        Downloads can be large and may use your data plan. Start one model at a time and keep this screen open to
        watch progress.
      </Text>

      {items.length ? (
        items.map((item) => {
          const installed = installedModels.find((model) => model.id === item.id);
          const progress = downloadProgress[item.id];
          const setupStatus = offlineSetupStatusByModel[item.id];
          const isActivelyDownloading = activeDownloadIds.has(item.id);
          const downloadLabel =
            isActivelyDownloading
              ? `Downloading ${Math.round((progress ?? 0) * 100)}%`
              : setupStatus === 'downloading' ||
                  setupStatus === 'paused_offline' ||
                  setupStatus === 'paused_user'
              ? 'Resume'
              : setupStatus === 'failed'
                ? 'Try again'
                : 'Download';
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

              {typeof progress === 'number' ? (
                <View style={styles.modelProgressTrack}>
                  <View style={[styles.modelProgressFill, { width: `${Math.round(progress * 100)}%` }]} />
                </View>
              ) : null}

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
                        label={downloadLabel}
                        onPress={() => onDownload(item)}
                        variant="secondary"
                        disabled={!allowDownload || isActivelyDownloading}
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

function FieldGroup({ children }: { children: ReactNode }) {
  return <View style={styles.fieldGroup}>{children}</View>;
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
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
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryTile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 74,
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: palette.lineSoft,
    borderRadius: 16,
    backgroundColor: palette.card,
    padding: 12,
  },
  summaryRowLabel: {
    color: palette.mutedInk,
    fontFamily: typography.label.fontFamily,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryRowValue: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 15,
    flexShrink: 1,
  },
  summaryBody: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    lineHeight: 22,
  },
  activeSummaryText: {
    color: palette.ink,
    fontFamily: typography.bodyStrong.fontFamily,
    fontSize: 13,
    lineHeight: 20,
  },
  modeSummary: {
    gap: 6,
    borderLeftWidth: 3,
    borderLeftColor: palette.accent,
    paddingLeft: 12,
  },
  modeSummaryTitle: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 16,
  },
  summaryActions: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modeSwitcher: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    borderRadius: 22,
    backgroundColor: palette.cardUtility,
  },
  modeButton: {
    flex: 1,
    gap: 2,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modeButtonSelected: {
    backgroundColor: palette.ink,
  },
  modeButtonLabel: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 14,
  },
  modeButtonLabelSelected: {
    color: palette.paper,
  },
  modeButtonDescription: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 12,
  },
  modeButtonDescriptionSelected: {
    color: palette.cardMuted,
  },
  processingCard: {
    gap: 14,
  },
  providersSection: {
    gap: 14,
  },
  providerStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  configuredProviderList: {
    gap: 8,
  },
  configuredProviderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.lineSoft,
    borderRadius: 18,
    backgroundColor: palette.cardUtility,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  configuredProviderTitle: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 14,
  },
  configuredProviderMeta: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 12,
  },
  gearButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.lineSoft,
  },
  selectedProviderCard: {
    gap: 14,
    borderWidth: 1,
    borderColor: palette.lineSoft,
    borderRadius: 18,
    backgroundColor: palette.cardUtility,
    padding: 14,
  },
  localRuntimeCard: {
    gap: 8,
    padding: 12,
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
    flex: 1,
    minWidth: 0,
  },
  providerCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  selectedProviderTitle: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 18,
  },
  localModelsSection: {
    gap: 14,
    paddingTop: 2,
  },
  runtimeStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.lineSoft,
    borderRadius: 18,
    backgroundColor: palette.card,
    padding: 14,
  },
  inlineStatusBlock: {
    gap: 6,
    borderWidth: 1,
    borderColor: palette.lineSoft,
    borderRadius: 18,
    backgroundColor: palette.cardUtility,
    padding: 14,
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
  modelProgressTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: radii.pill,
    backgroundColor: palette.accentSoft,
  },
  modelProgressFill: {
    height: '100%',
    minWidth: 8,
    borderRadius: radii.pill,
    backgroundColor: palette.accent,
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
  providerPickerModalCard: {
    maxHeight: '82%',
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
  optionListScroll: {
    maxHeight: 460,
  },
  optionCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  optionHeader: {
    gap: 2,
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
    fontSize: 14,
  },
  optionLabelSelected: {
    color: palette.paper,
  },
  optionMeta: {
    color: palette.accent,
    fontFamily: typography.label.fontFamily,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionDescription: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 12,
    lineHeight: 17,
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
