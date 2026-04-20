import { describe, expect, test } from 'vitest';

import { formatBuildVersion, getBuildFooterParts, getProfileInitials } from './presentation';

describe('account presentation', () => {
  test('builds profile initials from name before email', () => {
    expect(getProfileInitials({ name: 'Mary-Jane Watson', email: 'mary@example.com' })).toBe('MJ');
    expect(getProfileInitials({ name: 'Single', email: 'single@example.com' })).toBe('SI');
    expect(getProfileInitials({ name: null, email: 'tarun.k@example.com' })).toBe('TK');
    expect(getProfileInitials({ name: '', email: '' })).toBe('');
  });

  test('returns an empty string when no name or email exists', () => {
    expect(getProfileInitials({ name: null, email: null })).toBe('');
    expect(getProfileInitials({ name: '   ', email: '' })).toBe('');
  });

  test('formats build versions with an optional build number', () => {
    expect(formatBuildVersion({ appVersion: '1.2.3', buildNumber: '45' })).toBe('v1.2.3 (45)');
    expect(formatBuildVersion({ appVersion: '1.2.3' })).toBe('v1.2.3');
  });

  test('splits app version and build number for footer display', () => {
    expect(
      getBuildFooterParts({
        appVersion: '1.2.3',
        buildNumber: '45',
      })
    ).toEqual({
      appVersionLabel: 'v1.2.3',
      buildNumberLabel: 'Build 45',
      versionLabel: 'v1.2.3 (45)',
    });
  });
});
