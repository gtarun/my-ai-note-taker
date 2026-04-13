import { describe, expect, test } from 'vitest';

import { getDashboardEmptyStateCopy, getMeetingStatusMeta } from './presentation';

describe('dashboard presentation', () => {
  test('maps meeting status to readable labels and tones', () => {
    expect(getMeetingStatusMeta('ready')).toEqual({ label: 'Ready', tone: 'secondary' });
    expect(getMeetingStatusMeta('failed')).toEqual({ label: 'Error', tone: 'danger' });
    expect(getMeetingStatusMeta('transcribing')).toEqual({
      label: 'Transcribing',
      tone: 'secondary',
    });
    expect(getMeetingStatusMeta('transcribing_local')).toEqual({
      label: 'Local transcript',
      tone: 'tertiary',
    });
    expect(getMeetingStatusMeta('summarizing_local')).toEqual({
      label: 'Local summary',
      tone: 'tertiary',
    });
    expect(getMeetingStatusMeta('summarizing')).toEqual({
      label: 'Summarizing',
      tone: 'secondary',
    });
    expect(getMeetingStatusMeta('local_only')).toEqual({
      label: 'Local only',
      tone: 'tertiary',
    });
  });

  test('returns concise empty-state copy', () => {
    expect(getDashboardEmptyStateCopy()).toEqual({
      title: 'No meetings yet',
      body: 'Start with a recording or import an existing audio file to process it later.',
    });
  });
});
