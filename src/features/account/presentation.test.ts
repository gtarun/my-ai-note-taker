import { describe, expect, test } from 'vitest';

import { getProfileInitials } from './presentation';

describe('account presentation', () => {
  test('builds initials from the profile name', () => {
    expect(getProfileInitials('Tarun Sharma', 'tarun@example.com')).toBe('TS');
  });

  test('falls back to the email local part when the name is missing', () => {
    expect(getProfileInitials('', 'priya.rao@example.com')).toBe('PR');
  });

  test('returns an empty string when no name or email exists', () => {
    expect(getProfileInitials(null, null)).toBe('');
    expect(getProfileInitials('   ', '')).toBe('');
  });
});
