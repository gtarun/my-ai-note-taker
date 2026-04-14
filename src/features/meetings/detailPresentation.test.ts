import { describe, expect, test } from 'vitest';

import {
  MEETING_DETAIL_TITLE_ACTION_SLOT_MIN_WIDTH,
  MEETING_DETAIL_SECTION_ORDER,
  getMeetingDetailPrimaryActionLabel,
  getMeetingDetailTitleDraftState,
  getPlaybackActionLabel,
} from './detailPresentation';

describe('meeting detail presentation', () => {
  test('shows the inline title save affordance only when the draft changed', () => {
    expect(getMeetingDetailTitleDraftState('Demo 1', 'Demo 1')).toEqual({
      showSave: false,
      isDisabled: true,
    });

    expect(getMeetingDetailTitleDraftState('  Demo 2  ', 'Demo 1')).toEqual({
      showSave: true,
      isDisabled: false,
    });

    expect(getMeetingDetailTitleDraftState('   ', 'Demo 1')).toEqual({
      showSave: true,
      isDisabled: true,
    });
  });

  test('keeps a stable title action slot width even when save is hidden', () => {
    expect(MEETING_DETAIL_TITLE_ACTION_SLOT_MIN_WIDTH).toBe(88);
  });

  test('keeps the meeting output sections in summary-first order', () => {
    expect(MEETING_DETAIL_SECTION_ORDER).toEqual([
      'summary',
      'actionItems',
      'decisions',
      'transcript',
      'recording',
    ]);
  });

  test('builds compact action labels for playback and processing', () => {
    expect(getMeetingDetailPrimaryActionLabel(false)).toBe('Run transcript + summary');
    expect(getMeetingDetailPrimaryActionLabel(true)).toBe('Processing…');
    expect(getPlaybackActionLabel(false)).toBe('Play recording');
    expect(getPlaybackActionLabel(true)).toBe('Pause recording');
  });
});
