import { describe, expect, test } from 'vitest';

import {
  getDashboardCloudStatusCopy,
  getDashboardEmptyStateCopy,
  getOfflineSetupCardCopy,
  getMeetingStatusMeta,
} from './presentation';

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
});
