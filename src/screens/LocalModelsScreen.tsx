import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FadeInView } from '../components/FadeInView';
import { ScreenBackground } from '../components/ScreenBackground';
import {
  EditorialHero,
  PillButton,
  SectionHeading,
  StatusChip,
  SurfaceCard,
} from '../components/ui';
import { formatBytes } from '../features/settings/presentation';
import { getLocalDeviceSupport } from '../services/localInference';
import {
  deleteInstalledModel,
  downloadModel,
  getCatalogItemsForDevice,
  getInstalledModels,
  getInstalledModelsForKind,
  getModelCatalog,
} from '../services/localModels';
import {
  type OfflineSetupBundle,
  getOfflineSetupSession,
  markOfflineSetupFailed,
  markOfflineSetupPausedOffline,
  markOfflineSetupReady,
  startOfflineSetup,
  updateOfflineSetupProgress,
} from '../services/offlineSetupSession';
import { getAppSettings, saveAppSettings } from '../services/settings';
import { radii, type, typography } from '../theme';
import type {
  AppSettings,
  InstalledModelRow,
  LocalDeviceSupport,
  ModelCatalogItem,
  OfflineSetupSession,
} from '../types';
import { FieldGroup, Label, PlainInput } from './settings/SharedControls';
import { useTheme, useThemedStyles, type Palette } from '../hooks/useTheme';

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

export default function LocalModelsScreen() {
  const palette = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [catalog, setCatalog] = useState<ModelCatalogItem[]>([]);
  const [installedModels, setInstalledModels] = useState<InstalledModelRow[]>([]);
  const [deviceSupport, setDeviceSupport] = useState<LocalDeviceSupport | null>(null);
  const [offlineSetup, setOfflineSetup] = useState<OfflineSetupSession | null>(null);
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeDownloadIds, setActiveDownloadIds] = useState<Set<string>>(() => new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloadPhase, setDownloadPhase] = useState<Record<string, 'downloading' | 'verifying'>>({});
  const activeDownloadIdsRef = useRef(new Set<string>());

  const setActiveDownload = (modelId: string, isActive: boolean) => {
    if (isActive) {
      activeDownloadIdsRef.current.add(modelId);
    } else {
      activeDownloadIdsRef.current.delete(modelId);
    }
    setActiveDownloadIds(new Set(activeDownloadIdsRef.current));
  };

  useEffect(() => {
    void hydrate();
  }, []);

  async function hydrate() {
    try {
      const [nextSettings, support, models, setupSession] = await Promise.all([
        getAppSettings(),
        getLocalDeviceSupport(),
        getInstalledModels(),
        getOfflineSetupSession(),
      ]);
      setSettings(nextSettings);
      setDeviceSupport(support);
      setInstalledModels(models);
      setOfflineSetup(setupSession);
      setLoadError(null);
      await refreshCatalog(nextSettings.modelCatalogUrl);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load local models.');
    }
  }

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
  const totalInstalledBytes = useMemo(
    () => installedModels.reduce((acc, model) => acc + (model.sizeBytes || 0), 0),
    [installedModels]
  );
  const downloadProgress = useMemo(() => {
    if (!offlineSetup || offlineSetup.status !== 'downloading') {
      return {} as Record<string, number>;
    }
    return offlineSetup.modelIds.reduce<Record<string, number>>((acc, modelId) => {
      acc[modelId] = offlineSetup.progress;
      return acc;
    }, {});
  }, [offlineSetup]);
  const offlineSetupStatusByModel = useMemo(() => {
    if (!offlineSetup || offlineSetup.status === 'idle') {
      return {} as Partial<Record<string, OfflineSetupSession['status']>>;
    }
    return offlineSetup.modelIds.reduce<Partial<Record<string, OfflineSetupSession['status']>>>(
      (acc, modelId) => {
        acc[modelId] = offlineSetup.status;
        return acc;
      },
      {}
    );
  }, [offlineSetup]);

  async function refreshCatalog(catalogUrl: string, showFailureAlert = false) {
    setIsRefreshingCatalog(true);
    try {
      const next = await getModelCatalog(catalogUrl);
      setCatalog(next);
    } catch (error) {
      const fallback = await getModelCatalog('');
      setCatalog(fallback);
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

  const updateModelCatalogUrl = (next: string) => {
    setSettings((current) => (current ? { ...current, modelCatalogUrl: next } : current));
  };

  const handleSaveCatalogUrl = async () => {
    if (!settings) return;
    try {
      await saveAppSettings(settings);
      Alert.alert('Saved', 'Custom catalog URL was stored on this device.');
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save the catalog URL.');
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
        onPhase: (phase) => {
          setDownloadPhase((current) => ({ ...current, [item.id]: phase }));
        },
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

      const nextInstalled = await getInstalledModels();
      setInstalledModels(nextInstalled);
      await markOfflineSetupReady({
        preferredTranscriptionModelId: item.kind === 'transcription' ? item.id : null,
        preferredSummaryModelId: item.kind === 'summary' ? item.id : null,
      });
      setOfflineSetup(await getOfflineSetupSession());

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
      setDownloadPhase((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    }
  };

  const handleDeleteModel = (model: InstalledModelRow) => {
    Alert.alert('Delete local model?', `Remove ${model.displayName} from this device?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteInstalledModel(model.id);
            const nextInstalled = await getInstalledModels();
            setInstalledModels(nextInstalled);
          } catch (error) {
            Alert.alert(
              'Delete failed',
              error instanceof Error ? error.message : 'Unable to remove this model.'
            );
          }
        },
      },
    ]);
  };

  const handleOpenSource = async (item: ModelCatalogItem) => {
    if (!item.sourceUrl) return;
    try {
      const supported = await Linking.canOpenURL(item.sourceUrl);
      if (!supported) {
        throw new Error('This source URL cannot be opened on this device.');
      }
      await Linking.openURL(item.sourceUrl);
    } catch (error) {
      Alert.alert(
        'Open source failed',
        error instanceof Error ? error.message : 'Unable to open this model source.'
      );
    }
  };

  const allowDownload = deviceSupport ? deviceSupport.platform !== 'web' : false;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <FadeInView>
          <EditorialHero
            eyebrow="LOCAL MODELS"
            title="Run privately on this device."
            body="Download once, then use models in Offline mode or as a private fallback."
            chips={[
              `${installedModels.length} installed`,
              // Zero bytes across installed models means Apple Speech and
              // nothing else — built into iOS, so it occupies no disk. The
              // formatBytes fallback called that "size unknown".
              installedModels.length && totalInstalledBytes > 0
                ? formatBytes(totalInstalledBytes)
                : 'No storage used',
            ]}
          />
        </FadeInView>

        {loadError ? (
          <FadeInView delay={20}>
            <SurfaceCard muted style={styles.runtimeCard}>
              <Text style={styles.modelTitle}>Couldn’t load local models</Text>
              <Text style={styles.modelMeta}>{loadError}</Text>
              <PillButton label="Try again" onPress={() => void hydrate()} variant="secondary" />
            </SurfaceCard>
          </FadeInView>
        ) : null}

        <FadeInView delay={30}>
          <SurfaceCard muted style={styles.runtimeCard}>
            <View style={styles.runtimeRow}>
              <View style={styles.runtimeCopy}>
                <Text style={styles.runtimeLabel}>Runtime</Text>
                <Text style={styles.body}>
                  {deviceSupport?.reason ?? 'Checking local model support for this device.'}
                </Text>
              </View>
              <StatusChip
                label={deviceSupport?.localProcessingAvailable ? 'Ready' : 'Not ready'}
                tone={deviceSupport?.localProcessingAvailable ? 'secondary' : 'tertiary'}
              />
            </View>
          </SurfaceCard>
        </FadeInView>

        <FadeInView delay={60}>
          <View style={styles.catalogContainer}>
            <ModelCatalogList
              title="Transcription models"
              items={visibleCatalog.filter((item) => item.kind === 'transcription')}
              installedModels={installedTranscriptionModels}
              downloadProgress={downloadProgress}
              downloadPhase={downloadPhase}
              offlineSetupStatusByModel={offlineSetupStatusByModel}
              activeDownloadIds={activeDownloadIds}
              onDownload={handleDownloadModel}
              onDelete={handleDeleteModel}
              onOpenSource={handleOpenSource}
              allowDownload={allowDownload}
            />
            <ModelCatalogList
              title="Summary and analysis models"
              items={visibleCatalog.filter((item) => item.kind === 'summary')}
              installedModels={installedSummaryModels}
              downloadProgress={downloadProgress}
              downloadPhase={downloadPhase}
              offlineSetupStatusByModel={offlineSetupStatusByModel}
              activeDownloadIds={activeDownloadIds}
              onDownload={handleDownloadModel}
              onDelete={handleDeleteModel}
              onOpenSource={handleOpenSource}
              allowDownload={allowDownload}
            />
          </View>
        </FadeInView>

        <FadeInView delay={90}>
          <SurfaceCard muted style={styles.advancedCard}>
            <View style={styles.advancedHeader}>
              <SectionHeading
                title="Advanced"
                subtitle={
                  showAdvanced
                    ? 'Custom catalog and refresh actions live here.'
                    : 'Custom catalog URL and manual catalog refresh.'
                }
              />
              <PillButton
                label={showAdvanced ? 'Hide' : 'Show'}
                onPress={() => setShowAdvanced((current) => !current)}
                variant="ghost"
              />
            </View>

            {showAdvanced && settings ? (
              <>
                <FieldGroup>
                  <Label text="Custom catalog URL" />
                  <PlainInput
                    value={settings.modelCatalogUrl}
                    onChangeText={updateModelCatalogUrl}
                    placeholder="https://your-hosted-catalog.example/catalog.json"
                  />
                </FieldGroup>
                <View style={styles.advancedActions}>
                  <PillButton
                    label={isRefreshingCatalog ? 'Refreshing…' : 'Refresh catalog'}
                    onPress={() => refreshCatalog(settings.modelCatalogUrl, true)}
                    variant="secondary"
                    disabled={isRefreshingCatalog}
                    icon={<Feather name="refresh-cw" size={16} color={palette.ink} />}
                  />
                  <PillButton label="Save URL" onPress={handleSaveCatalogUrl} variant="ghost" />
                </View>
              </>
            ) : null}
          </SurfaceCard>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModelCatalogList({
  title,
  items,
  installedModels,
  downloadProgress,
  downloadPhase,
  offlineSetupStatusByModel,
  activeDownloadIds,
  onDownload,
  onDelete,
  onOpenSource,
  allowDownload,
}: {
  title: string;
  items: ModelCatalogItem[];
  installedModels: InstalledModelRow[];
  downloadProgress: Record<string, number>;
  downloadPhase: Record<string, 'downloading' | 'verifying'>;
  offlineSetupStatusByModel: Partial<Record<string, OfflineSetupSession['status']>>;
  activeDownloadIds: Set<string>;
  onDownload: (item: ModelCatalogItem) => void;
  onDelete: (item: InstalledModelRow) => void;
  onOpenSource: (item: ModelCatalogItem) => void;
  allowDownload: boolean;
}) {
  const palette = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.catalogSection}>
      <SectionHeading title={title} />
      <Text style={styles.body}>
        Downloads can be large and may use your data plan. Start one model at a time and keep this screen open
        to watch progress.
      </Text>

      {items.length ? (
        items.map((item) => {
          const installed = installedModels.find((model) => model.id === item.id);
          const progress = downloadProgress[item.id];
          const setupStatus = offlineSetupStatusByModel[item.id];
          const isActivelyDownloading = activeDownloadIds.has(item.id);
          /*
           * The check now runs against the download host before any bytes are
           * fetched, so it is a brief pause at the start rather than a long one
           * at the end — and it carries no percentage, because there is no
           * progress to report on a single small request.
           */
          const isVerifying = downloadPhase[item.id] === 'verifying';
          const downloadLabel = isActivelyDownloading
            ? isVerifying
              ? 'Checking…'
              : `Downloading ${Math.round((progress ?? 0) * 100)}%`
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
            <SurfaceCard key={item.id} style={styles.modelCard}>
              <View style={styles.modelHeader}>
                <View style={styles.modelTitleWrap}>
                  <Text style={styles.modelTitle}>{item.displayName}</Text>
                  <Text style={styles.modelMeta}>
                    {item.engine}
                    {item.engine === 'apple-speech'
                      ? ' • built-in, no download'
                      : ` • ${formatBytes(item.sizeBytes)}`}
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

              <Text style={styles.body}>{item.description}</Text>

              {typeof progress === 'number' ? (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                </View>
              ) : null}

              <View style={styles.modelActionRow}>
                {item.engine === 'apple-speech' ? (
                  // Built into iOS — no download to start, no file to delete.
                  // Show a static chip-style action so the row reads correctly.
                  <PillButton
                    label="Always available"
                    onPress={() => undefined}
                    variant="secondary"
                    disabled
                    icon={<Feather name="check" size={16} color={palette.ink} />}
                  />
                ) : installed?.status === 'installed' ? (
                  <PillButton
                    label="Delete"
                    onPress={() => onDelete(installed)}
                    variant="secondary"
                    icon={<Feather name="trash-2" size={16} color={palette.ink} />}
                  />
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
                  This official model still needs an external download or license-acceptance step. Open the
                  source page for details.
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
        <Text style={styles.body}>No compatible catalog items are visible for this device yet.</Text>
      )}
    </View>
  );
}

const makeStyles = (palette: Palette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.paper },
  container: { padding: 20, gap: 18, paddingBottom: 48 },
  runtimeCard: { gap: 6 },
  runtimeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between' },
  runtimeCopy: { flex: 1, gap: 4 },
  runtimeLabel: {
    color: palette.mutedInk,
    ...typography.label,
    ...type.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  catalogContainer: { gap: 18 },
  catalogSection: { gap: 12 },
  modelCard: { gap: 10 },
  modelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modelTitleWrap: { flex: 1, gap: 2 },
  modelTitle: {
    color: palette.ink,
    ...typography.heading,
    ...type.body,
  },
  modelMeta: {
    color: palette.mutedInk,
    ...typography.body,
    ...type.caption,
  },
  modelActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modelHint: {
    color: palette.mutedInk,
    ...typography.body,
    ...type.caption,
  },
  body: {
    color: palette.mutedInk,
    ...typography.body,
    ...type.label,
  },
  progressTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: palette.cardUtility,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: palette.accent },
  errorText: {
    color: palette.danger,
    ...typography.body,
    ...type.label,
  },
  advancedCard: { gap: 12 },
  advancedHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  advancedActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
