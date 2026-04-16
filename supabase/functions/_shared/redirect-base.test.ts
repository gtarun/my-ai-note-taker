import { describe, expect, test } from 'vitest';

import { buildRedirectUrl, buildSupabaseFunctionUrl, isAllowedRedirectBase } from './redirect-base';

describe('isAllowedRedirectBase', () => {
  test('allows the production app scheme', () => {
    expect(isAllowedRedirectBase('mufathom://drive-folder')).toBe(true);
  });

  test('allows Expo dev-client schemes with exp+ prefixes', () => {
    expect(isAllowedRedirectBase('exp+ai-note-taker://drive-folder')).toBe(true);
    expect(isAllowedRedirectBase('exp://127.0.0.1:8081/--/drive-folder')).toBe(true);
  });

  test('allows localhost web callbacks', () => {
    expect(isAllowedRedirectBase('http://localhost:8081/drive-folder')).toBe(true);
    expect(isAllowedRedirectBase('https://127.0.0.1:3000/drive-folder')).toBe(true);
  });

  test('rejects unrelated hosts and malformed inputs', () => {
    expect(isAllowedRedirectBase('https://example.com/drive-folder')).toBe(false);
    expect(isAllowedRedirectBase('')).toBe(false);
    expect(isAllowedRedirectBase('not-a-url')).toBe(false);
  });

  test('builds app callback URLs with status parameters', () => {
    expect(buildRedirectUrl('mufathom://account', { drive: 'connected' })).toBe(
      'mufathom://account?drive=connected'
    );
  });

  test('builds the public supabase function URL from the project URL', () => {
    expect(
      buildSupabaseFunctionUrl(
        'https://ulgbdlhwjwsyflzfdhma.supabase.co/',
        'google-drive-folder-picker'
      )
    ).toBe('https://ulgbdlhwjwsyflzfdhma.supabase.co/functions/v1/google-drive-folder-picker');
  });
});
