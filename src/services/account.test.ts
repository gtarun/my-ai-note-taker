import { describe, expect, test, vi } from 'vitest';

const invoke = vi.fn();

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

vi.mock('expo-secure-store', () => ({
  default: {
    getItemAsync: vi.fn(),
    setItemAsync: vi.fn(),
    deleteItemAsync: vi.fn(),
  },
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.mock('expo-linking', () => ({
  createURL: vi.fn((path: string) => `mufathom://${path}`),
  parse: vi.fn(() => ({ queryParams: {} })),
}));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: 'https://ulgbdlhwjwsyflzfdhma.supabase.co',
        supabaseAnonKey: 'anon-key',
        googleDriveConnectFunctionName: 'google-drive-connect-url',
        googleDriveRedirectUri:
          'https://ulgbdlhwjwsyflzfdhma.supabase.co/functions/v1/google-drive-connect-url',
      },
    },
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: 'access-token',
          },
        },
        error: null,
      })),
    },
    functions: {
      invoke,
    },
  })),
  FunctionsHttpError: class FunctionsHttpError extends Error {
    context = {
      clone: () => ({
        json: async () => ({}),
      }),
      text: async () => '',
    };
  },
}));

describe('google drive auth session wiring', () => {
  test('uses the app redirect URL for auth-session completion', async () => {
    const account = await import('./account');

    expect(account.getGoogleDriveOAuthRedirectUrl()).toBe('mufathom://account');
  });

  test('passes the app redirect URL to the drive connect function', async () => {
    invoke.mockResolvedValueOnce({
      data: {
        url: 'https://accounts.google.com/o/oauth2/v2/auth?state=test',
      },
      error: null,
    });

    const account = await import('./account');

    await expect(account.getGoogleDriveConnectUrl()).resolves.toContain('accounts.google.com');
    expect(invoke).toHaveBeenCalledWith(
      'google-drive-connect-url',
      expect.objectContaining({
        body: {
          redirectBase: 'mufathom://account',
        },
      })
    );
  });
});
