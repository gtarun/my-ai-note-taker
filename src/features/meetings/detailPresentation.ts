import { SummaryPayload } from '../../types';

export const MEETING_DETAIL_TITLE_ACTION_SLOT_MIN_WIDTH = 88;

export const MEETING_DETAIL_SECTION_ORDER = [
  'summary',
  'actionItems',
  'decisions',
  'extractedData',
  'transcript',
  'recording',
] as const;

/**
 * Classifies a processing failure the user can actually fix, and says which
 * screen fixes it. Used to offer a real action instead of a dead-end OK button
 * — the most likely failure on a first run, since the summary provider defaults
 * to one with no API key.
 *
 * `null` means the failure is transient or provider-side and there is nowhere
 * useful to send the user.
 */
export type ProviderSetupDestination = 'settings' | 'local-models';

export function getProviderSetupDestination(message: string): ProviderSetupDestination | null {
  const normalized = message.toLowerCase();

  // Model problems are fixed on the Local models screen, not in Settings.
  // Includes the whisper-small locale message, which names no provider and so
  // matched none of the older checks — the one message that most needed an
  // action attached to it.
  if (
    normalized.includes('download and install the selected') ||
    normalized.includes('download it from local models')
  ) {
    return 'local-models';
  }

  if (normalized.includes('configure the selected') || normalized.includes('in settings first')) {
    return 'settings';
  }

  return null;
}

export function getMeetingDetailTitleDraftState(draftTitle: string, savedTitle: string) {
  const trimmedDraft = draftTitle.trim();
  const trimmedSaved = savedTitle.trim();

  return {
    showSave: trimmedDraft !== trimmedSaved,
    isDisabled: trimmedDraft.length === 0 || trimmedDraft === trimmedSaved,
  };
}

export function getMeetingDetailPrimaryActionLabel(isBusy: boolean) {
  return isBusy ? 'Processing…' : 'Analyze recording';
}

export function getMeetingDetailLayerChooserPresentation(
  layerName: string | null,
  availableLayerCount: number
) {
  if (layerName) {
    return {
      title: 'Extraction layer',
      body: `Current layer: ${layerName}. Change it before re-running analysis if you want a different schema.`,
      actionLabel: 'Change layer',
    };
  }

  if (availableLayerCount > 0) {
    return {
      title: 'Extraction layer',
      body: 'No layer selected yet. Pick one before analysis if you want structured fields in the result.',
      actionLabel: 'Choose layer',
    };
  }

  return {
    title: 'Extraction layer',
    body: 'No layers created yet. Create one first if you want structured extraction in addition to transcript and summary.',
    actionLabel: 'Manage layers',
  };
}

export function getMeetingDetailLayerPickerHeightRatio(availableLayerCount: number) {
  if (availableLayerCount >= 6) {
    return 0.92;
  }

  if (availableLayerCount >= 3) {
    return 0.82;
  }

  return 0.7;
}

export function getPlaybackActionLabel(isPlaying: boolean) {
  return isPlaying ? 'Pause recording' : 'Play recording';
}

export function getMeetingDetailSummaryCopyText(summary: SummaryPayload | null) {
  return summary?.summary || 'No summary yet.';
}

export function getMeetingDetailActionItemsCopyText(summary: SummaryPayload | null) {
  return formatMeetingDetailListCopyText(summary?.actionItems, 'No action items yet.');
}

export function getMeetingDetailDecisionsCopyText(summary: SummaryPayload | null) {
  return formatMeetingDetailListCopyText(summary?.decisions, 'No decisions extracted yet.');
}

export function getMeetingDetailTranscriptCopyText(transcriptText: string | null) {
  return transcriptText || 'No transcript yet.';
}

export function getMeetingDetailExtractionCopyText(
  rows: Array<{ title: string; value: string }>
) {
  if (!rows.length) {
    return 'No extracted data yet.';
  }

  return rows.map((row) => `${row.title}: ${row.value || ''}`.trimEnd()).join('\n');
}

export function getExtractionSyncLabel(status: 'not_synced' | 'syncing' | 'synced' | 'sync_failed') {
  switch (status) {
    case 'syncing':
      return 'Syncing…';
    case 'synced':
      return 'Synced';
    case 'sync_failed':
      return 'Sync failed';
    default:
      return 'Not synced';
  }
}

function formatMeetingDetailListCopyText(items: string[] | undefined, emptyState: string) {
  if (!items?.length) {
    return emptyState;
  }

  return items.map((item) => `• ${item}`).join('\n');
}
