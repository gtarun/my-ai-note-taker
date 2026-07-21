import { describe, expect, it, test } from 'vitest';

import { SummaryPayload } from '../../types';
import {
  MEETING_DELETE_WARNING,
  MEETING_DETAIL_TITLE_ACTION_SLOT_MIN_WIDTH,
  buildMeetingShareText,
  getMeetingStatusLabel,
  getProviderSetupDestination,
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

describe('getProviderSetupDestination', () => {
  it('sends provider configuration failures to Settings', () => {
    expect(
      getProviderSetupDestination('Configure the selected summary provider in Settings first.')
    ).toBe('settings');
    expect(
      getProviderSetupDestination('Configure the selected transcription provider in Settings first.')
    ).toBe('settings');
  });

  it('sends model failures to Local models, where downloads actually live', () => {
    expect(
      getProviderSetupDestination('Download and install the selected local transcription model first.')
    ).toBe('local-models');
  });

  it('handles the whisper-small locale message, which names no provider', () => {
    // This one matched nothing before and fell through to a dead-end alert —
    // despite being the message most in need of an action.
    expect(
      getProviderSetupDestination(
        'hi-IN transcription needs Whisper Small. Download it from Local models, then try again.'
      )
    ).toBe('local-models');
  });

  it('leaves transient and provider-side errors alone', () => {
    expect(getProviderSetupDestination('The request timed out after 120s.')).toBeNull();
    expect(getProviderSetupDestination('429 Too Many Requests')).toBeNull();
    expect(getProviderSetupDestination('Unable to process meeting.')).toBeNull();
  });
});

describe('buildMeetingShareText', () => {
  const summary: SummaryPayload = {
    summary: 'Reviewed the vendor contract.',
    actionItems: ['Send the draft tonight'],
    decisions: ['Renew for one year'],
    followUps: [],
  };

  it('formats each section exactly as the copy buttons do', () => {
    /*
     * Share used to be a second, independent implementation of the same
     * formatting — so a change to how action items read when copied left the
     * shared version behind. Sharing the helpers is the fix; this is the check
     * that they stay shared.
     */
    const shared = buildMeetingShareText({
      title: 'Vendor sync',
      summary,
      transcriptText: 'Raw words.',
      transcriptEnglish: null,
    });

    expect(shared).toContain(getMeetingDetailSummaryCopyText(summary));
    expect(shared).toContain(getMeetingDetailActionItemsCopyText(summary));
    expect(shared).toContain(getMeetingDetailDecisionsCopyText(summary));
    expect(shared).toContain(getMeetingDetailTranscriptCopyText('Raw words.'));
  });

  it('includes both transcripts when an English rendering exists', () => {
    const shared = buildMeetingShareText({
      title: 'Vendor sync',
      summary,
      transcriptText: 'वेंडर कॉन्ट्रैक्ट देखना है।',
      transcriptEnglish: 'We need to review the vendor contract.',
    });

    // The English leads because it is what a recipient can read, but the
    // verbatim record still goes with it — sharing must not quietly drop the
    // original words.
    expect(shared).toContain('Transcript (English)');
    expect(shared).toContain('Transcript (exact words)');
    expect(shared.indexOf('Transcript (English)')).toBeLessThan(
      shared.indexOf('Transcript (exact words)')
    );
    expect(shared).toContain('वेंडर कॉन्ट्रैक्ट देखना है।');
  });

  it('uses a single unlabelled transcript block when there is no translation', () => {
    const shared = buildMeetingShareText({
      title: 'Vendor sync',
      summary,
      transcriptText: 'Raw words.',
      transcriptEnglish: null,
    });

    expect(shared).toContain('Transcript\nRaw words.');
    expect(shared).not.toContain('Transcript (English)');
  });
});

describe('meeting status copy', () => {
  it('reads as a state rather than a database value', () => {
    expect(getMeetingStatusLabel('local_only')).toBe('Not analyzed yet');
    expect(getMeetingStatusLabel('transcribing_local')).toBe('Transcribing on device…');
    expect(getMeetingStatusLabel('failed')).toBe('Analysis failed');
  });

  it('degrades readably for a status it has never seen', () => {
    expect(getMeetingStatusLabel('some_new_state')).toBe('some new state');
  });

  it('states what deletion removes in exactly one place', () => {
    expect(MEETING_DELETE_WARNING).toContain('audio file');
    expect(MEETING_DELETE_WARNING).toContain('transcript');
  });
});
