export function formatDuration(durationMs: number) {
  if (!Number.isFinite(durationMs)) {
    return '0:00';
  }

  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatTimestamp(value: string) {
  const date = new Date(value);

  // Intl throws a RangeError on an invalid date rather than returning a
  // placeholder, so a single malformed row would crash the whole list render.
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
