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

/**
 * Whether a meeting is mid-pipeline, so the row can show a skeleton where its
 * summary will land instead of the flat "Open this meeting to process it."
 * placeholder every unfinished row used to share.
 */
export function isMeetingProcessing(status: MeetingRow['status']): boolean {
  return (
    status === 'transcribing' ||
    status === 'summarizing' ||
    status === 'transcribing_local' ||
    status === 'summarizing_local'
  );
}

export type MeetingGroup = {
  key: string;
  title: string;
  meetings: MeetingRow[];
};

function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

/**
 * Buckets meetings into day sections.
 *
 * A flat reverse-chronological list gives no sense of when anything happened —
 * "Today" and "three weeks ago" looked identical. Grouping is also what makes
 * the list scannable once someone has more than a handful of recordings.
 *
 * `now` is injected so the boundaries are testable rather than dependent on the
 * clock at the moment the suite runs.
 */
export function groupMeetingsByDay(meetings: MeetingRow[], now: Date = new Date()): MeetingGroup[] {
  const today = startOfDay(now);
  const dayMs = 86_400_000;
  const groups: MeetingGroup[] = [];
  const byKey = new Map<string, MeetingGroup>();

  for (const meeting of meetings) {
    const created = new Date(meeting.createdAt);
    // A malformed timestamp must not drop the meeting from the list entirely.
    const isValid = !Number.isNaN(created.getTime());
    const day = isValid ? startOfDay(created) : Number.NaN;

    let key: string;
    let title: string;

    if (!isValid) {
      key = 'undated';
      title = 'Undated';
    } else if (day === today) {
      key = 'today';
      title = 'Today';
    } else if (day === today - dayMs) {
      key = 'yesterday';
      title = 'Yesterday';
    } else if (day > today - dayMs * 7) {
      key = 'week';
      title = 'Earlier this week';
    } else {
      key = String(day);
      title = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: created.getFullYear() === now.getFullYear() ? undefined : 'numeric',
      }).format(created);
    }

    const existing = byKey.get(key);

    if (existing) {
      existing.meetings.push(meeting);
    } else {
      const group = { key, title, meetings: [meeting] };
      byKey.set(key, group);
      groups.push(group);
    }
  }

  return groups;
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

/**
 * What the card's button should actually do. Every state previously navigated
 * to the Settings tab regardless of its label — including "Dismiss", and
 * including the states whose downloads live on the Local models screen.
 */
export type OfflineSetupCardAction = 'dismiss' | 'open-local-models';

export function getOfflineSetupCardCopy(params: {
  status: Exclude<OfflineSetupStatus, 'idle'>;
  bundleLabel: string;
  progressPercent: number;
}): {
  title: string;
  body: string;
  actionLabel: string;
  action: OfflineSetupCardAction;
  tone: StatusChipTone;
} {
  switch (params.status) {
    case 'paused_offline':
      return {
        title: 'Offline setup paused',
        body: `Connection was interrupted while ${params.bundleLabel} was downloading.`,
        actionLabel: 'Resume',
        action: 'open-local-models',
        tone: 'tertiary',
      };
    case 'paused_user':
      return {
        title: 'Offline setup paused',
        body: `${params.bundleLabel} is paused until you resume it.`,
        actionLabel: 'Resume',
        action: 'open-local-models',
        tone: 'tertiary',
      };
    case 'failed':
      return {
        title: 'Offline setup failed',
        body: `We could not finish preparing ${params.bundleLabel}.`,
        actionLabel: 'Try again',
        action: 'open-local-models',
        tone: 'danger',
      };
    case 'ready':
      return {
        title: 'Offline mode ready',
        body: `${params.bundleLabel} finished downloading and is ready to use.`,
        actionLabel: 'Dismiss',
        action: 'dismiss',
        tone: 'secondary',
      };
    case 'preparing':
      return {
        title: 'Preparing offline mode',
        body: `Checking the best local setup for ${params.bundleLabel}.`,
        actionLabel: 'View details',
        action: 'open-local-models',
        tone: 'secondary',
      };
    case 'downloading':
    default:
      return {
        title: 'Preparing offline mode',
        body: `${params.bundleLabel} is ${params.progressPercent}% complete.`,
        actionLabel: 'View details',
        action: 'open-local-models',
        tone: 'secondary',
      };
  }
}
