import type { StatusChipTone } from '../../components/ui/StatusChip';

export type RecordingPhase = 'idle' | 'recording' | 'saving' | 'error';

// --- Hero Section ---

export function getHeroEyebrow(): string {
  return 'NEW RECORDING';
}

export function getHeroHeadline(): string {
  return 'Capture every word';
}

export function getHeroBody(): string {
  return "Start a recording and let AI Notes handle the rest. You'll get a full transcript and summary when you're done.";
}

// --- Recording Controls Card ---

export function getTitlePlaceholder(): string {
  return 'Team standup, client call, 1-on-1…';
}

// --- Notice Banner ---

export function getNoticeTitle(): string {
  return 'Background recording';
}

export function getNoticeBody(): string {
  return 'Recording continues while the app is in the background. Closing the app completely may end your session early.';
}

// --- Status Indicator ---

export function getStatusLabel(phase: RecordingPhase): string {
  switch (phase) {
    case 'idle':
      return 'Ready to record';
    case 'recording':
      return 'Recording in progress';
    case 'saving':
      return 'Saving…';
    case 'error':
      return 'Recording failed';
  }
}

export function getStatusTone(phase: RecordingPhase): StatusChipTone {
  switch (phase) {
    case 'idle':
      return 'secondary';
    case 'recording':
      return 'danger';
    case 'saving':
      return 'tertiary';
    case 'error':
      return 'secondary';
  }
}

// --- Record/Stop Button ---

export function getButtonLabel(phase: RecordingPhase): string {
  switch (phase) {
    case 'idle':
      return 'Start recording';
    case 'recording':
      return 'Stop and save';
    case 'saving':
      return 'Saving…';
    case 'error':
      return 'Start recording';
  }
}

export function getButtonVariant(phase: RecordingPhase): 'primary' | 'danger' {
  switch (phase) {
    case 'idle':
      return 'primary';
    case 'recording':
      return 'danger';
    case 'saving':
      return 'primary';
    case 'error':
      return 'primary';
  }
}

export function getButtonDisabled(phase: RecordingPhase): boolean {
  return phase === 'saving';
}

export function getButtonIconName(phase: RecordingPhase): string {
  switch (phase) {
    case 'recording':
      return 'stop-circle-outline';
    default:
      return 'microphone-outline';
  }
}

// --- Consent Footer ---

export function getConsentHeading(): string {
  return 'Recording consent';
}

export function getConsentBody(): string {
  return 'Please make sure everyone in the conversation knows they are being recorded.';
}

// --- Accessibility ---

export function getTimerAccessibilityLabel(durationMillis: number): string {
  const totalSeconds = Math.floor(durationMillis / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
  }

  return parts.join(' ');
}

export function getButtonAccessibilityLabel(phase: RecordingPhase): string {
  switch (phase) {
    case 'idle':
      return 'Start recording';
    case 'recording':
      return 'Stop and save recording';
    case 'saving':
      return 'Saving recording';
    case 'error':
      return 'Start recording';
  }
}