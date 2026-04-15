import { SummaryPayload } from '../../types';

export const MEETING_DETAIL_TITLE_ACTION_SLOT_MIN_WIDTH = 88;

export const MEETING_DETAIL_SECTION_ORDER = [
  'summary',
  'actionItems',
  'decisions',
  'transcript',
  'recording',
] as const;

export function getMeetingDetailTitleDraftState(draftTitle: string, savedTitle: string) {
  const trimmedDraft = draftTitle.trim();
  const trimmedSaved = savedTitle.trim();

  return {
    showSave: trimmedDraft !== trimmedSaved,
    isDisabled: trimmedDraft.length === 0 || trimmedDraft === trimmedSaved,
  };
}

export function getMeetingDetailPrimaryActionLabel(isBusy: boolean) {
  return isBusy ? 'Processing…' : 'Run transcript + summary';
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

function formatMeetingDetailListCopyText(items: string[] | undefined, emptyState: string) {
  if (!items?.length) {
    return emptyState;
  }

  return items.map((item) => `• ${item}`).join('\n');
}
