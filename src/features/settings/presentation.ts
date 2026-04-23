import { isProviderConfigured, providerDefinitions } from '../../services/providers';
import type { AppSettings, InstalledModelRow, ProviderConfig, ProviderId } from '../../types';

export type SettingsProcessingMode = 'cloud' | 'offline';

export function getSettingsProcessingMode(selectedTranscriptionProvider: ProviderId): SettingsProcessingMode {
  return selectedTranscriptionProvider === 'local' ? 'offline' : 'cloud';
}

export function getConfiguredProviderIds(
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

export function pickInitialProvider(settings: AppSettings) {
  const configured = getConfiguredProviderIds(settings.providers);
  return configured[0] ?? settings.selectedSummaryProvider ?? settings.selectedTranscriptionProvider ?? 'openai';
}

export function displayModelLabel(models: InstalledModelRow[], modelId: string) {
  return models.find((model) => model.id === modelId)?.displayName ?? modelId;
}

export function formatBytes(value: number) {
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

export function buildActiveProviderSummary({
  transcriptionProviderLabel,
  summaryProviderLabel,
  transcriptionModelLabel,
  summaryModelLabel,
}: {
  transcriptionProviderLabel: string;
  summaryProviderLabel: string;
  transcriptionModelLabel: string;
  summaryModelLabel: string;
}) {
  return `Transcript: ${transcriptionProviderLabel} (${transcriptionModelLabel}) • Summary: ${summaryProviderLabel} (${summaryModelLabel})`;
}

export function buildProcessingModeDetails({
  processingMode,
  summaryProviderLabel,
}: {
  processingMode: SettingsProcessingMode;
  summaryProviderLabel: string;
}) {
  if (processingMode === 'offline') {
    if (summaryProviderLabel === 'Local') {
      return {
        title: 'Device-only processing',
        body: 'Transcription, summaries, and structured analysis use local models.',
      };
    }

    return {
      title: 'Local-first processing',
      body: `Transcription stays on this device. Summaries can use ${summaryProviderLabel} when you want cloud analysis.`,
    };
  }

  return {
    title: 'Cloud API processing',
    body: 'Transcription and summaries use the providers you choose below.',
  };
}

export function buildSettingsOverviewItems({
  processingMode,
  transcriptionProviderLabel,
  summaryProviderLabel,
  installedTranscriptionCount,
  installedSummaryCount,
}: {
  processingMode: SettingsProcessingMode;
  transcriptionProviderLabel: string;
  summaryProviderLabel: string;
  installedTranscriptionCount: number;
  installedSummaryCount: number;
}) {
  const installedLocalCount = installedTranscriptionCount + installedSummaryCount;

  return [
    { label: 'Mode', value: processingMode === 'offline' ? 'Local first' : 'Cloud APIs' },
    { label: 'Transcript', value: transcriptionProviderLabel },
    { label: 'Summary', value: summaryProviderLabel },
    {
      label: 'Local models',
      value: installedLocalCount > 0 ? `${installedLocalCount} installed` : 'Not installed',
    },
  ];
}

export function buildProviderPickerOptionCopy({
  providerLabel,
  providerDescription,
  configured,
}: {
  providerLabel: string;
  providerDescription: string;
  configured: boolean;
}) {
  return {
    title: providerLabel,
    statusLine: configured ? 'Configured' : 'Needs setup',
    description: providerDescription,
  };
}

export function buildConfiguredProviderMeta({
  configured,
  active,
}: {
  configured: boolean;
  active: boolean;
}) {
  return `${configured ? 'Credentials saved' : 'Needs setup'}${active ? ' • Active' : ''}`;
}

export function buildProviderEditorSelection(providerId: ProviderId) {
  return {
    editingProviderId: providerId,
    revealInlinePanel: true,
  } as const;
}
