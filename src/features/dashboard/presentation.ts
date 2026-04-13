import type { StatusChipTone } from '../../components/ui';
import type { MeetingRow } from '../../types';

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
    body: 'Start with a recording or import an existing audio file to process it later.',
  };
}
