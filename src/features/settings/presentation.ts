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
  return `Transcript uses ${transcriptionProviderLabel} (${transcriptionModelLabel}). Summary uses ${summaryProviderLabel} (${summaryModelLabel}).`;
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
        title: 'Offline processing on this device',
        body: 'Transcription runs on-device. Summaries and structured analysis use Local.',
      };
    }

    return {
      title: 'Offline transcription on this device',
      body: `Transcription runs on-device with a downloaded local model. Summaries still use ${summaryProviderLabel} in the cloud.`,
    };
  }

  return {
    title: 'Cloud transcription and summaries',
    body: 'Transcription and summaries both run through your selected API providers.',
  };
}

export function buildSettingsOverviewItems({
  transcriptionProviderLabel,
  installedTranscriptionCount,
}: {
  transcriptionProviderLabel: string;
  installedTranscriptionCount: number;
}) {
  return [
    { label: 'Transcription', value: transcriptionProviderLabel },
    {
      label: 'Local transcription',
      value: installedTranscriptionCount > 0 ? `${installedTranscriptionCount} installed` : 'None installed',
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
