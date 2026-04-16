import { describe, expect, test } from 'vitest';

import { buildGoogleIntegrationSummary, normalizeGrantedScopes } from './google-integration';

describe('google integration helpers', () => {
  test('marks reconnect when sheets scope is missing', () => {
    expect(
      buildGoogleIntegrationSummary({
        status: 'connected',
        account_email: 'owner@example.com',
        granted_scopes: ['https://www.googleapis.com/auth/drive.file'],
        drive_save_folder_id: 'folder-1',
        drive_save_folder_name: 'Recordings',
        updated_at: '2026-04-16T00:00:00.000Z',
      }).needsReconnect
    ).toBe(true);
  });

  test('normalizes the oauth scope string into a stable list', () => {
    expect(
      normalizeGrantedScopes('openid https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets')
    ).toEqual([
      'openid',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/spreadsheets',
    ]);
  });
});
