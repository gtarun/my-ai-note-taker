import { describe, expect, it } from 'vitest';

import { formatDuration, formatTimestamp } from './format';

describe('formatDuration', () => {
  it('formats whole and partial minutes', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5_000)).toBe('0:05');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(3_600_000)).toBe('60:00');
  });

  it('clamps negative input rather than rendering a negative clock', () => {
    expect(formatDuration(-1_000)).toBe('0:00');
  });

  it('survives NaN and Infinity instead of rendering "NaN:NaN"', () => {
    // The audio player reports NaN for currentTime before the first status
    // event, which used to render literally in the meeting detail header.
    expect(formatDuration(Number.NaN)).toBe('0:00');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});

describe('formatTimestamp', () => {
  it('formats a valid ISO timestamp', () => {
    expect(formatTimestamp('2026-03-14T15:09:00.000Z')).toMatch(/Mar 14/);
  });

  it('returns a placeholder instead of throwing on an invalid date', () => {
    // Intl.DateTimeFormat throws a RangeError on an invalid date, so a single
    // malformed created_at used to crash the entire meetings list render.
    expect(() => formatTimestamp('not-a-date')).not.toThrow();
    expect(formatTimestamp('not-a-date')).toBe('Unknown date');
    expect(formatTimestamp('')).toBe('Unknown date');
  });
});
