import { isProviderConfigured, providerDefinitions } from '../../services/providers';
import type { AppSettings, InstalledModelRow, ProviderConfig, ProviderId } from '../../types';

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

export function buildSettingsOverviewItems({
  transcriptionProviderLabel,
  summaryProviderLabel,
  installedTranscriptionCount,
  installedSummaryCount,
}: {
  transcriptionProviderLabel: string;
  summaryProviderLabel: string;
  installedTranscriptionCount: number;
  installedSummaryCount: number;
}) {
  const installedCount = installedTranscriptionCount + installedSummaryCount;

  return [
    { label: 'Transcription', value: transcriptionProviderLabel },
    { label: 'Summary', value: summaryProviderLabel },
    {
      label: 'Local models',
      value: installedCount > 0 ? `${installedCount} installed` : 'None installed',
    },
  ];
}
