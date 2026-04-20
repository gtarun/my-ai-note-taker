import type { StatusChipTone } from '../../components/ui';
import type { AuthSession, MeetingRow, OfflineSetupStatus } from '../../types';

export function getMeetingStatusMeta(status: MeetingRow['status']): {
  label: string;
  tone: StatusChipTone;
} {
  switch (status) {
    case 'ready':
      return { label: 'Ready', tone: 'secondary' };
    case 'failed':
      return { label: 'Error', tone: 'danger' };
    case 'transcribing_local':
      return { label: 'Local transcript', tone: 'tertiary' };
    case 'summarizing_local':
      return { label: 'Local summary', tone: 'tertiary' };
    case 'transcribing':
      return { label: 'Transcribing', tone: 'secondary' };
    case 'summarizing':
      return { label: 'Summarizing', tone: 'secondary' };
    default:
      return { label: 'Local only', tone: 'tertiary' };
  }
}

export function getDashboardEmptyStateCopy() {
  return {
    title: 'No meetings yet',
    body: 'Start a recording or import audio to begin.',
  };
}

export function getDashboardCloudStatusCopy(session: AuthSession | null) {
  return session?.user.driveConnection.status === 'connected'
    ? {
        title: 'Cloud connected',
        actionLabel: 'Open profile',
      }
    : {
        title: 'Cloud not connected',
        actionLabel: 'Set up account',
      };
}

export function getOfflineSetupCardCopy(params: {
  status: Exclude<OfflineSetupStatus, 'idle'>;
  bundleLabel: string;
  progressPercent: number;
}): {
  title: string;
  body: string;
  actionLabel: string;
  tone: StatusChipTone;
} {
  switch (params.status) {
    case 'paused_offline':
      return {
        title: 'Offline setup paused',
        body: `Connection was interrupted while ${params.bundleLabel} was downloading.`,
        actionLabel: 'Resume',
        tone: 'tertiary',
      };
    case 'paused_user':
      return {
        title: 'Offline setup paused',
        body: `${params.bundleLabel} is paused until you resume it.`,
        actionLabel: 'Resume',
        tone: 'tertiary',
      };
    case 'failed':
      return {
        title: 'Offline setup failed',
        body: `We could not finish preparing ${params.bundleLabel}.`,
        actionLabel: 'Try again',
        tone: 'danger',
      };
    case 'ready':
      return {
        title: 'Offline mode ready',
        body: `${params.bundleLabel} finished downloading and is ready to use.`,
        actionLabel: 'Dismiss',
        tone: 'secondary',
      };
    case 'preparing':
      return {
        title: 'Preparing offline mode',
        body: `Checking the best local setup for ${params.bundleLabel}.`,
        actionLabel: 'View details',
        tone: 'secondary',
      };
    case 'downloading':
    default:
      return {
        title: 'Preparing offline mode',
        body: `${params.bundleLabel} is ${params.progressPercent}% complete.`,
        actionLabel: 'View details',
        tone: 'secondary',
      };
  }
}
