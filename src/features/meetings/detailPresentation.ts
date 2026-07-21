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

/**
 * One sentence about what deleting removes, in one place.
 *
 * It was written out twice — once in the confirm dialog, once in the danger
 * zone card. Identical today, and exactly the kind of pair that drifts the
 * first time the list of deleted things changes.
 */
export const MEETING_DELETE_WARNING =
  'This permanently removes the audio file, transcript, summary, and extracted data from this device.';

/** Turns a stored status into something readable, without the "Status:" label. */
export function getMeetingStatusLabel(status: string) {
  switch (status) {
    case 'local_only':
      return 'Not analyzed yet';
    case 'transcribing':
      return 'Transcribing…';
    case 'transcribing_local':
      return 'Transcribing on device…';
    case 'summarizing':
      return 'Summarizing…';
    case 'failed':
      return 'Analysis failed';
    case 'ready':
      return 'Ready';
    default:
      return status.replace(/_/g, ' ');
  }
}

export function getMeetingDetailSummaryCopyText(summary: SummaryPayload | null) {
  return summary?.summary || 'No summary yet.';
}

/**
 * The text produced by Share.
 *
 * Assembled from the same helpers the copy buttons use, so a change to how a
 * section reads when copied cannot silently leave the shared version behind —
 * this used to be a second, independent implementation of the same formatting.
 */
export function buildMeetingShareText(input: {
  title: string;
  summary: SummaryPayload | null;
  transcriptText: string | null;
  transcriptEnglish: string | null;
}) {
  // The English rendering is the one a recipient can read, so it leads when it
  // exists; the verbatim text follows so nothing is lost by sharing.
  const transcriptBlocks = input.transcriptEnglish?.trim()
    ? [
        `Transcript (English)\n${input.transcriptEnglish.trim()}`,
        `Transcript (exact words)\n${getMeetingDetailTranscriptCopyText(input.transcriptText)}`,
      ]
    : [`Transcript\n${getMeetingDetailTranscriptCopyText(input.transcriptText)}`];

  return [
    input.title,
    `Summary\n${getMeetingDetailSummaryCopyText(input.summary)}`,
    `Action items\n${getMeetingDetailActionItemsCopyText(input.summary)}`,
    `Decisions\n${getMeetingDetailDecisionsCopyText(input.summary)}`,
    ...transcriptBlocks,
  ].join('\n\n');
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
