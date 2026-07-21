import { describe, expect, test } from 'vitest';

import type { MeetingRow } from '../../types';
import {
  getDashboardCloudStatusCopy,
  getDashboardEmptyStateCopy,
  getOfflineSetupCardCopy,
  getMeetingStatusMeta,
  groupMeetingsByDay,
  isMeetingProcessing,
} from './presentation';

function meeting(id: string, createdAt: string): MeetingRow {
  return {
    id,
    title: id,
    createdAt,
    updatedAt: createdAt,
    audioUri: `file:///${id}.m4a`,
    durationMs: 1000,
    sourceType: 'recording',
    status: 'ready',
    transcriptText: null,
    summaryJson: null,
    summaryShort: null,
    errorMessage: null,
    extractionResult: null,
  };
}

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
      body: 'Start a recording or import audio to begin.',
    });
  });

  test('returns compact signed-out cloud copy', () => {
    expect(getDashboardCloudStatusCopy(null)).toEqual({
      title: 'Cloud not connected',
      actionLabel: 'Set up account',
    });
  });

  test('returns compact signed-in cloud copy', () => {
    expect(
      getDashboardCloudStatusCopy({
        user: {
          driveConnection: { status: 'connected' },
        },
      } as never)
    ).toEqual({
      title: 'Cloud connected',
      actionLabel: 'Open profile',
    });
  });

  test('returns dashboard copy for paused offline setup', () => {
    expect(
      getOfflineSetupCardCopy({
        status: 'paused_offline',
        bundleLabel: 'Starter',
        progressPercent: 42,
      })
    ).toEqual({
      title: 'Offline setup paused',
      body: 'Connection was interrupted while Starter was downloading.',
      actionLabel: 'Resume',
      action: 'open-local-models',
      tone: 'tertiary',
    });
  });

  test('sends every actionable state to the screen that owns downloads', () => {
    // Every state used to navigate to the Settings tab regardless of its label,
    // including states whose downloads live on the Local models screen.
    for (const status of ['paused_offline', 'paused_user', 'failed', 'preparing', 'downloading'] as const) {
      expect(
        getOfflineSetupCardCopy({ status, bundleLabel: 'Starter', progressPercent: 10 }).action
      ).toBe('open-local-models');
    }
  });

  test('the ready state dismisses instead of navigating', () => {
    // Its label is "Dismiss" but it pushed a route, and isDismissed was never
    // set anywhere, so the card could not be removed from the home screen.
    const copy = getOfflineSetupCardCopy({
      status: 'ready',
      bundleLabel: 'Starter',
      progressPercent: 100,
    });

    expect(copy.actionLabel).toBe('Dismiss');
    expect(copy.action).toBe('dismiss');
  });

  test('knows which statuses are mid-pipeline', () => {
    // These four drive the skeleton on the meeting row; everything else is a
    // settled state that should render real content.
    expect(isMeetingProcessing('transcribing')).toBe(true);
    expect(isMeetingProcessing('summarizing')).toBe(true);
    expect(isMeetingProcessing('transcribing_local')).toBe(true);
    expect(isMeetingProcessing('summarizing_local')).toBe(true);

    expect(isMeetingProcessing('ready')).toBe(false);
    expect(isMeetingProcessing('failed')).toBe(false);
    expect(isMeetingProcessing('local_only')).toBe(false);
  });
});

describe('groupMeetingsByDay', () => {
  const now = new Date('2026-07-21T18:00:00.000Z');

  test('separates today from yesterday', () => {
    const groups = groupMeetingsByDay(
      [
        meeting('a', '2026-07-21T09:00:00.000Z'),
        meeting('b', '2026-07-20T09:00:00.000Z'),
      ],
      now
    );

    expect(groups.map((group) => group.title)).toEqual(['Today', 'Yesterday']);
    expect(groups[0].meetings.map((m) => m.id)).toEqual(['a']);
  });

  test('keeps several meetings from one day in a single group, in order', () => {
    const groups = groupMeetingsByDay(
      [
        meeting('late', '2026-07-21T16:00:00.000Z'),
        meeting('early', '2026-07-21T08:00:00.000Z'),
      ],
      now
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].meetings.map((m) => m.id)).toEqual(['late', 'early']);
  });

  test('buckets the rest of the week together, then falls back to a date', () => {
    const groups = groupMeetingsByDay(
      [
        meeting('midweek', '2026-07-18T09:00:00.000Z'),
        meeting('older', '2026-05-02T09:00:00.000Z'),
      ],
      now
    );

    expect(groups[0].title).toBe('Earlier this week');
    expect(groups[1].title).toBe('May 2');
  });

  test('keeps a malformed timestamp in the list instead of dropping it', () => {
    // formatTimestamp already guards render; the grouping must not silently
    // discard the row either, or a meeting disappears with its audio intact.
    const groups = groupMeetingsByDay([meeting('broken', 'not-a-date')], now);

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('Undated');
    expect(groups[0].meetings[0].id).toBe('broken');
  });

  test('returns nothing for an empty list', () => {
    expect(groupMeetingsByDay([], now)).toEqual([]);
  });
});
