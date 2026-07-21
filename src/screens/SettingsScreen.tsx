import { Feather } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
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
import {
  buildActiveProviderSummary,
  displayModelLabel,
  formatBytes,
  getConfiguredProviderIds,
} from '../features/settings/presentation';
import {
  DEBUG_LOGS_ROUTE,
  LAYERS_ROUTE,
  LOCAL_MODELS_ROUTE,
  ONBOARDING_ROUTE,
} from '../navigation/routes';
import {
  IOS_LOCAL_TRANSCRIPTION_MODEL_ID,
  IOS_LOCAL_TRANSCRIPTION_MODEL_IDS,
  getLocalDeviceSupport,
} from '../services/localInference';
import { getInstalledModels, getInstalledModelsForKind } from '../services/localModels';
import { defaultProviderConfigs, providerDefinitions, providerMap } from '../services/providers';
import { getAppSettings, sanitizeAppSettings, saveAppSettings } from '../services/settings';
import { palette, radii, typography } from '../theme';
import type {
  AppSettings,
  InstalledModelRow,
  LocalDeviceSupport,
  ProviderConfig,
  ProviderId,
} from '../types';
import { ProviderConfigSheet } from './settings/ProviderConfigSheet';
import { ModelDropdown, ProviderDropdown, ProviderIcon } from './settings/SharedControls';

/**
 * Normalize the iOS local-transcription model selection. If the user previously
 * picked a non-iOS-supported model, fall back to whisper-base when it's
 * installed. Otherwise leave the value alone — the gating check elsewhere will
 * surface a friendly error.
 */
function getLocalTranscriptionModelId(modelId: string, baseModelInstalled: boolean) {
  if (Platform.OS !== 'ios') {
    return modelId;
  }

  const trimmed = modelId.trim();
  if (IOS_LOCAL_TRANSCRIPTION_MODEL_IDS.has(trimmed)) {
    return trimmed;
  }

  if (baseModelInstalled) {
    return IOS_LOCAL_TRANSCRIPTION_MODEL_ID;
  }

  return trimmed;
}

function getFallbackCloudProviderId(settings: AppSettings, mode: 'transcription' | 'summary'): ProviderId {
  const configured = getConfiguredProviderIds(settings.providers, mode).filter(
    (providerId) => providerId !== 'local'
  );
  return configured[0] ?? 'openai';
}

export default function SettingsScreen() {
  const [form, setForm] = useState<AppSettings | null>(null);
  const [installedModels, setInstalledModels] = useState<InstalledModelRow[]>([]);
  const [hasLoadedInstalledModels, setHasLoadedInstalledModels] = useState(false);
  const [deviceSupport, setDeviceSupport] = useState<LocalDeviceSupport | null>(null);
  const [editingProviderId, setEditingProviderId] = useState<ProviderId | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void hydrate();
  }, []);

  // Refetch installed models when returning from the local models screen so the
  // model dropdowns reflect new downloads or deletions immediately.
  useFocusEffect(
    useCallback(() => {
      void getInstalledModels().then(setInstalledModels);
    }, [])
  );

  async function hydrate() {
    // Any throw here used to leave `form` null forever, pinning the screen on
    // the "Loading settings…" text with no way back.
    try {
      const settings = await getAppSettings();
      setForm(sanitizeAppSettings(settings));

      const [support, models] = await Promise.all([getLocalDeviceSupport(), getInstalledModels()]);
      setDeviceSupport(support);
      setInstalledModels(models);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load your settings.');
    } finally {
      setHasLoadedInstalledModels(true);
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
  const localTranscriptionModelIsInstalled = useMemo(
    () => installedTranscriptionModels.some((model) => model.id === IOS_LOCAL_TRANSCRIPTION_MODEL_ID),
    [installedTranscriptionModels]
  );

  // Normalize iOS local transcription selection to whisper-base whenever the
  // model becomes available, mirroring the constraint enforced server-side.
  useEffect(() => {
    if (!form || Platform.OS !== 'ios' || !hasLoadedInstalledModels) {
      return;
    }

    const normalized = getLocalTranscriptionModelId(
      form.providers.local.transcriptionModel,
      localTranscriptionModelIsInstalled
    );

    if (normalized === form.providers.local.transcriptionModel) {
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
                transcriptionModel: normalized,
              },
            },
          }
        : current
    );
  }, [form, hasLoadedInstalledModels, localTranscriptionModelIsInstalled]);

  if (!form) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          {loadError ? (
            <>
              <Text style={styles.loadingText}>{loadError}</Text>
              <PillButton label="Try again" onPress={() => void hydrate()} />
            </>
          ) : (
            <>
              <ActivityIndicator color={palette.ink} />
              <Text style={styles.loadingText}>Loading settings…</Text>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const sanitized = sanitizeAppSettings(form);
  const localSummarySupported = deviceSupport?.supportsSummary !== false;
  const configuredProviderIds = getConfiguredProviderIds(sanitized.providers);
  const totalInstalledBytes = installedModels.reduce((acc, model) => acc + (model.sizeBytes || 0), 0);

  // Build provider option lists for each job. Local is included only when it's
  // viable on this device for the given mode.
  const transcriptionProviderOptions = (() => {
    const cloudIds = providerDefinitions
      .filter((d) => d.id !== 'local' && d.supportsTranscription)
      .map((d) => d.id);
    const localOption: ProviderId[] =
      deviceSupport?.supportsTranscription && installedTranscriptionModels.length > 0 ? ['local'] : [];
    return Array.from(new Set<ProviderId>([sanitized.selectedTranscriptionProvider, ...localOption, ...cloudIds]));
  })();

  const summaryProviderOptions = (() => {
    const cloudIds = providerDefinitions
      .filter((d) => d.id !== 'local' && d.supportsSummary)
      .map((d) => d.id);
    const localOption: ProviderId[] = localSummarySupported ? ['local'] : [];
    return Array.from(new Set<ProviderId>([sanitized.selectedSummaryProvider, ...localOption, ...cloudIds]));
  })();

  const effectiveSummaryProviderId =
    sanitized.selectedSummaryProvider === 'local' && !localSummarySupported
      ? getFallbackCloudProviderId(sanitized, 'summary')
      : sanitized.selectedSummaryProvider;

  const transcriptionProvider = providerMap[sanitized.selectedTranscriptionProvider];
  const summaryProvider = providerMap[effectiveSummaryProviderId];

  const transcriptionModelLabel =
    sanitized.selectedTranscriptionProvider === 'local'
      ? displayModelLabel(
          installedTranscriptionModels,
          form.providers.local.transcriptionModel || 'No model selected yet'
        )
      : sanitized.providers[sanitized.selectedTranscriptionProvider].transcriptionModel || 'No model selected yet';

  const summaryModelLabel =
    effectiveSummaryProviderId === 'local'
      ? displayModelLabel(
          installedSummaryModels,
          form.providers.local.summaryModel || 'No model selected yet'
        )
      : sanitized.providers[effectiveSummaryProviderId].summaryModel || 'No model selected yet';

  const activeSummaryLine = buildActiveProviderSummary({
    transcriptionProviderLabel: transcriptionProvider.label,
    summaryProviderLabel: summaryProvider.label,
    transcriptionModelLabel,
    summaryModelLabel,
  });

  const editingConfig = editingProviderId ? form.providers[editingProviderId] : null;
  const editingProviderConfigured = editingProviderId
    ? configuredProviderIds.includes(editingProviderId)
    : false;

  // ─── Handlers ────────────────────────────────────────────────────────────

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

  const setTranscriptionProvider = (next: ProviderId) => {
    updateForm('selectedTranscriptionProvider', next);
  };

  const setSummaryProvider = (next: ProviderId) => {
    if (next === 'local' && !localSummarySupported) {
      Alert.alert(
        'Local summary unavailable',
        'This iOS build does not include the local summary runtime yet. Pick a cloud provider for summary and analysis.'
      );
      return;
    }
    updateForm('selectedSummaryProvider', next);
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

  const clearProvider = (providerId: ProviderId) => {
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

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <FadeInView>
          <EditorialHero
            eyebrow="SETTINGS"
            title="Models in use right now."
            body="Pick where transcription and summary run. Tune the pieces you actually use; ignore the rest."
          />
        </FadeInView>

        {/* ─── Active now ─── */}
        <FadeInView delay={30}>
          <SurfaceCard style={styles.activeCard}>
            <View style={styles.activeHeader}>
              <Text style={styles.eyebrow}>ACTIVE NOW</Text>
            </View>

            <ActiveProviderRow
              kindLabel="Transcription"
              providerId={sanitized.selectedTranscriptionProvider}
              providerLabel={transcriptionProvider.label}
              modelLabel={transcriptionModelLabel}
            />
            <View style={styles.activeDivider} />
            <ActiveProviderRow
              kindLabel="Summary & analysis"
              providerId={effectiveSummaryProviderId}
              providerLabel={summaryProvider.label}
              modelLabel={summaryModelLabel}
            />

            <Text style={styles.body}>{activeSummaryLine}</Text>

            <PillButton
              label={isSaving ? 'Saving…' : 'Save changes'}
              onPress={handleSave}
              disabled={isSaving}
            />
          </SurfaceCard>
        </FadeInView>

        {/* ─── Transcription ─── */}
        <FadeInView delay={60}>
          <SurfaceCard style={styles.jobCard}>
            <SectionHeading
              title="Transcription"
              subtitle="Turns your recording into text. Local keeps audio on this device."
            />
            <ProviderDropdown
              label="Provider"
              value={sanitized.selectedTranscriptionProvider}
              providerIds={transcriptionProviderOptions}
              configuredProviderIds={configuredProviderIds}
              onSelect={setTranscriptionProvider}
            />

            <ModelDropdown
              label="Language"
              value={form.transcriptionLocale}
              options={[
                { label: 'English (US)', value: 'en-US' },
                { label: 'हिन्दी (Hindi)', value: 'hi-IN' },
                { label: 'ਪੰਜਾਬੀ (Punjabi)', value: 'pa-IN' },
                { label: 'Auto-detect / Mixed', value: 'auto' },
              ]}
              onSelect={(value) => updateForm('transcriptionLocale', value as AppSettings['transcriptionLocale'])}
              emptyText="Pick a language for transcription."
            />

            {sanitized.selectedTranscriptionProvider === 'local' ? (
              <>
                <ModelDropdown
                  label="Local model"
                  value={form.providers.local.transcriptionModel}
                  options={(Platform.OS === 'ios'
                    ? installedTranscriptionModels.filter((m) =>
                        IOS_LOCAL_TRANSCRIPTION_MODEL_IDS.has(m.id)
                      )
                    : installedTranscriptionModels
                  ).map((m) => ({ label: m.displayName, value: m.id }))}
                  onSelect={(value) => updateProvider('local', 'transcriptionModel', value)}
                  emptyText={
                    Platform.OS === 'ios'
                      ? 'Download Whisper Base or Whisper Small from Local models before choosing Local.'
                      : 'Download a local transcription model from Local models first.'
                  }
                />
                <PillButton
                  label="Manage local models"
                  onPress={() => router.push(LOCAL_MODELS_ROUTE)}
                  variant="secondary"
                  icon={<Feather name="hard-drive" size={16} color={palette.ink} />}
                />
              </>
            ) : (
              <PillButton
                label={
                  configuredProviderIds.includes(sanitized.selectedTranscriptionProvider)
                    ? 'Edit API key'
                    : 'Add API key'
                }
                onPress={() => setEditingProviderId(sanitized.selectedTranscriptionProvider)}
                variant="secondary"
                icon={<Feather name="key" size={16} color={palette.ink} />}
              />
            )}
          </SurfaceCard>
        </FadeInView>

        {/* ─── Summary & analysis ─── */}
        <FadeInView delay={90}>
          <SurfaceCard style={styles.jobCard}>
            <SectionHeading
              title="Summary & analysis"
              subtitle={
                localSummarySupported
                  ? 'Generates summary, action items, decisions, and structured fields.'
                  : 'Local summary is not available on this iOS build. Use a cloud provider here.'
              }
            />
            <ProviderDropdown
              label="Provider"
              value={effectiveSummaryProviderId}
              providerIds={summaryProviderOptions}
              configuredProviderIds={configuredProviderIds}
              onSelect={setSummaryProvider}
            />

            {effectiveSummaryProviderId === 'local' ? (
              <>
                <ModelDropdown
                  label="Local model"
                  value={form.providers.local.summaryModel}
                  options={installedSummaryModels.map((m) => ({ label: m.displayName, value: m.id }))}
                  onSelect={(value) => updateProvider('local', 'summaryModel', value)}
                  emptyText="Download a local summary model from Local models first."
                />
                <PillButton
                  label="Manage local models"
                  onPress={() => router.push(LOCAL_MODELS_ROUTE)}
                  variant="secondary"
                  icon={<Feather name="hard-drive" size={16} color={palette.ink} />}
                />
              </>
            ) : (
              <PillButton
                label={
                  configuredProviderIds.includes(effectiveSummaryProviderId) ? 'Edit API key' : 'Add API key'
                }
                onPress={() => setEditingProviderId(effectiveSummaryProviderId)}
                variant="secondary"
                icon={<Feather name="key" size={16} color={palette.ink} />}
              />
            )}
          </SurfaceCard>
        </FadeInView>

        {/* ─── Local models entry ─── */}
        <FadeInView delay={120}>
          <SurfaceCard muted style={styles.miniCard}>
            <Pressable style={styles.miniRow} onPress={() => router.push(LOCAL_MODELS_ROUTE)}>
              <View style={styles.miniIcon}>
                <Feather name="hard-drive" size={18} color={palette.ink} />
              </View>
              <View style={styles.miniCopy}>
                <Text style={styles.miniTitle}>Local model library</Text>
                <Text style={styles.miniMeta}>
                  {installedModels.length
                    ? `${installedModels.length} installed · ${formatBytes(totalInstalledBytes)}`
                    : 'No models installed yet'}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={palette.mutedInk} />
            </Pressable>
          </SurfaceCard>
        </FadeInView>

        {/* ─── More ─── */}
        <FadeInView delay={150}>
          <SurfaceCard muted style={styles.moreCard}>
            <SectionHeading title="More" />

            <NavRow
              icon={<Feather name="layers" size={18} color={palette.ink} />}
              label="Extraction layers"
              onPress={() => router.push(LAYERS_ROUTE)}
            />
            <NavRow
              icon={<Feather name="activity" size={18} color={palette.ink} />}
              label="Debug logs"
              onPress={() => router.push(DEBUG_LOGS_ROUTE)}
            />
            <NavRow
              icon={<Feather name="rotate-ccw" size={18} color={palette.ink} />}
              label="Replay onboarding"
              onPress={() => router.push(ONBOARDING_ROUTE)}
            />

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.miniTitle}>Delete remote audio after processing</Text>
                <Text style={styles.miniMeta}>
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

        {/* ─── Configured providers (compact list) ─── */}
        {configuredProviderIds.filter((id) => id !== 'local').length ? (
          <FadeInView delay={180}>
            <SurfaceCard muted style={styles.moreCard}>
              <SectionHeading
                title="Saved API keys"
                subtitle="Tap any to edit its key, model, or base URL."
              />
              {configuredProviderIds
                .filter((id) => id !== 'local')
                .map((providerId) => (
                  <ConfiguredProviderRow
                    key={providerId}
                    providerId={providerId}
                    active={
                      providerId === sanitized.selectedTranscriptionProvider ||
                      providerId === effectiveSummaryProviderId
                    }
                    onPress={() => setEditingProviderId(providerId)}
                  />
                ))}
            </SurfaceCard>
          </FadeInView>
        ) : null}
      </ScrollView>

      <ProviderConfigSheet
        visible={editingProviderId !== null && editingProviderId !== 'local'}
        providerId={editingProviderId ?? 'openai'}
        config={editingConfig ?? defaultProviderConfigs.openai}
        configured={editingProviderConfigured}
        isSaving={isSaving}
        onChange={(key, value) => editingProviderId && updateProvider(editingProviderId, key, value)}
        onSave={async () => {
          await handleSave();
          setEditingProviderId(null);
        }}
        onClear={() => editingProviderId && clearProvider(editingProviderId)}
        onClose={() => setEditingProviderId(null)}
      />
    </SafeAreaView>
  );
}

// ─── Internal components ────────────────────────────────────────────────────

function ActiveProviderRow({
  kindLabel,
  providerId,
  providerLabel,
  modelLabel,
}: {
  kindLabel: string;
  providerId: ProviderId;
  providerLabel: string;
  modelLabel: string;
}) {
  return (
    <View style={styles.activeRow}>
      <View style={styles.activeIcon}>
        <ProviderIcon providerId={providerId} />
      </View>
      <View style={styles.activeCopy}>
        <Text style={styles.activeKind}>{kindLabel}</Text>
        <Text style={styles.activeProvider}>
          {providerLabel} <Text style={styles.activeDot}>·</Text> <Text style={styles.activeModel}>{modelLabel}</Text>
        </Text>
      </View>
    </View>
  );
}

function ConfiguredProviderRow({
  providerId,
  active,
  onPress,
}: {
  providerId: ProviderId;
  active: boolean;
  onPress: () => void;
}) {
  const provider = providerMap[providerId];

  return (
    <Pressable style={styles.savedProviderRow} onPress={onPress}>
      <ProviderIcon providerId={providerId} />
      <View style={styles.savedProviderCopy}>
        <Text style={styles.miniTitle}>{provider.label}</Text>
        <Text style={styles.miniMeta} numberOfLines={1}>
          {provider.description}
        </Text>
      </View>
      {active ? <StatusChip label="Active" tone="secondary" /> : null}
      <Feather name="chevron-right" size={18} color={palette.mutedInk} />
    </Pressable>
  );
}

function NavRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.navRow} onPress={onPress}>
      <View style={styles.navIcon}>{icon}</View>
      <Text style={styles.navLabel}>{label}</Text>
      <Feather name="chevron-right" size={18} color={palette.mutedInk} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.paper },
  container: { padding: 20, gap: 18, paddingBottom: 48 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  loadingText: { color: palette.mutedInk, fontFamily: typography.body.fontFamily, fontSize: 15 },
  body: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
    lineHeight: 19,
  },
  eyebrow: {
    color: palette.tertiary,
    fontFamily: typography.label.fontFamily,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },

  // Active card
  activeCard: { gap: 12 },
  activeHeader: { gap: 4 },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activeIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: palette.cardUtility,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCopy: { flex: 1, gap: 2 },
  activeKind: {
    color: palette.mutedInk,
    fontFamily: typography.label.fontFamily,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  activeProvider: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 15,
  },
  activeDot: { color: palette.line },
  activeModel: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
  },
  activeDivider: {
    height: 1,
    backgroundColor: palette.lineSoft,
    marginVertical: 2,
  },

  // Job card
  jobCard: { gap: 12 },

  // Mini / nav rows
  miniCard: { gap: 0 },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  miniIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCopy: { flex: 1, gap: 2 },
  miniTitle: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 14,
  },
  miniMeta: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 12,
  },

  // More card
  moreCard: { gap: 4 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  navIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    flex: 1,
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  toggleCopy: { flex: 1, gap: 2 },

  // Saved provider rows
  savedProviderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  savedProviderCopy: { flex: 1, gap: 2 },
});
