import { describe, expect, test } from 'vitest';

import { SummaryPayload } from '../../types';
import {
  MEETING_DETAIL_TITLE_ACTION_SLOT_MIN_WIDTH,
  MEETING_DETAIL_SECTION_ORDER,
  getExtractionSyncLabel,
  getMeetingDetailLayerChooserPresentation,
  getMeetingDetailLayerPickerHeightRatio,
  getMeetingDetailExtractionCopyText,
  getMeetingDetailActionItemsCopyText,
  getMeetingDetailDecisionsCopyText,
  getMeetingDetailPrimaryActionLabel,
  getMeetingDetailSummaryCopyText,
  getMeetingDetailTitleDraftState,
  getMeetingDetailTranscriptCopyText,
  getPlaybackActionLabel,
} from './detailPresentation';

describe('meeting detail presentation', () => {
  const summaryPayload: SummaryPayload = {
    summary: 'Team aligned on shipping the mobile MVP this week.',
    actionItems: ['Send the latest TestFlight build', 'Draft the launch checklist'],
    decisions: ['Keep recording manual-first', 'Ship local storage in v1'],
    followUps: [],
  };

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
      'extractedData',
      'transcript',
      'recording',
    ]);
  });

  test('builds compact action labels for playback and processing', () => {
    expect(getMeetingDetailPrimaryActionLabel(false)).toBe('Analyze recording');
    expect(getMeetingDetailPrimaryActionLabel(true)).toBe('Processing…');
    expect(getPlaybackActionLabel(false)).toBe('Play recording');
    expect(getPlaybackActionLabel(true)).toBe('Pause recording');
  });

  test('builds summary copy text with an empty fallback', () => {
    expect(getMeetingDetailSummaryCopyText(summaryPayload)).toBe(
      'Team aligned on shipping the mobile MVP this week.'
    );
    expect(getMeetingDetailSummaryCopyText(null)).toBe('No summary yet.');
  });

  test('formats action items as a copy-ready bullet list', () => {
    expect(getMeetingDetailActionItemsCopyText(summaryPayload)).toBe(
      '• Send the latest TestFlight build\n• Draft the launch checklist'
    );
    expect(
      getMeetingDetailActionItemsCopyText({
        ...summaryPayload,
        actionItems: [],
      })
    ).toBe('No action items yet.');
  });

  test('formats decisions as a copy-ready bullet list', () => {
    expect(getMeetingDetailDecisionsCopyText(summaryPayload)).toBe(
      '• Keep recording manual-first\n• Ship local storage in v1'
    );
    expect(
      getMeetingDetailDecisionsCopyText({
        ...summaryPayload,
        decisions: [],
      })
    ).toBe('No decisions extracted yet.');
  });

  test('builds transcript copy text with an empty fallback', () => {
    expect(getMeetingDetailTranscriptCopyText('Discussed launch timing and QA owner.')).toBe(
      'Discussed launch timing and QA owner.'
    );
    expect(getMeetingDetailTranscriptCopyText(null)).toBe('No transcript yet.');
  });

  test('formats extracted field values for copy and review', () => {
    expect(
      getMeetingDetailExtractionCopyText([
        { title: 'Full name', value: 'Priya Sharma' },
        { title: 'Issue', value: 'Delayed payroll' },
      ])
    ).toBe('Full name: Priya Sharma\nIssue: Delayed payroll');
    expect(getMeetingDetailExtractionCopyText([])).toBe('No extracted data yet.');
  });

  test('builds friendly sync status labels for extraction results', () => {
    expect(getExtractionSyncLabel('not_synced')).toBe('Not synced');
    expect(getExtractionSyncLabel('syncing')).toBe('Syncing…');
    expect(getExtractionSyncLabel('synced')).toBe('Synced');
    expect(getExtractionSyncLabel('sync_failed')).toBe('Sync failed');
  });

  test('explains how to reopen and change the extraction layer chooser', () => {
    expect(getMeetingDetailLayerChooserPresentation(null, 2)).toEqual({
      title: 'Extraction layer',
      body: 'No layer selected yet. Pick one before analysis if you want structured fields in the result.',
      actionLabel: 'Choose layer',
    });

    expect(getMeetingDetailLayerChooserPresentation('Customer intake', 2)).toEqual({
      title: 'Extraction layer',
      body: 'Current layer: Customer intake. Change it before re-running analysis if you want a different schema.',
      actionLabel: 'Change layer',
    });

    expect(getMeetingDetailLayerChooserPresentation(null, 0)).toEqual({
      title: 'Extraction layer',
      body: 'No layers created yet. Create one first if you want structured extraction in addition to transcript and summary.',
      actionLabel: 'Manage layers',
    });
  });

  test('uses a taller adaptive sheet when there are more extraction layer options', () => {
    expect(getMeetingDetailLayerPickerHeightRatio(0)).toBe(0.7);
    expect(getMeetingDetailLayerPickerHeightRatio(2)).toBe(0.7);
    expect(getMeetingDetailLayerPickerHeightRatio(4)).toBe(0.82);
    expect(getMeetingDetailLayerPickerHeightRatio(8)).toBe(0.92);
  });
});
