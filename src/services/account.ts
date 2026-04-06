import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { createClient, FunctionsHttpError, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { AuthSession, CloudBackendConfig, DriveConnection } from '../types';

const SUPABASE_AUTH_STORAGE_KEY = 'supabase.auth.token';

const storageAdapter = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      return window.localStorage.getItem(key);
    }

    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(key, value);
      return;
    }

    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      window.localStorage.removeItem(key);
      return;
    }

    await SecureStore.deleteItemAsync(key);
  },
};

function readSupabaseConfig(): CloudBackendConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const supabaseUrl = typeof extra.supabaseUrl === 'string' ? extra.supabaseUrl.trim() : '';
  const supabaseAnonKey = typeof extra.supabaseAnonKey === 'string' ? extra.supabaseAnonKey.trim() : '';
  const googleDriveConnectFunctionName =
    typeof extra.googleDriveConnectFunctionName === 'string' && extra.googleDriveConnectFunctionName.trim()
      ? extra.googleDriveConnectFunctionName.trim()
      : 'google-drive-connect-url';

  let projectRef = '';

  try {
    projectRef = supabaseUrl ? new URL(supabaseUrl).host.split('.')[0] ?? '' : '';
  } catch {
    projectRef = '';
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    projectRef,
    googleDriveConnectFunctionName,
  };
}

const supabaseConfig = readSupabaseConfig();

const supabase = createClient(supabaseConfig.supabaseUrl || 'https://placeholder.supabase.co', supabaseConfig.supabaseAnonKey || 'placeholder-anon-key', {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: SUPABASE_AUTH_STORAGE_KEY,
    flowType: 'pkce',
  },
});

export function getCloudBackendConfig(): CloudBackendConfig {
  return supabaseConfig;
}

export function isCloudBackendConfigured() {
  return Boolean(supabaseConfig.supabaseUrl && supabaseConfig.supabaseAnonKey);
}

export async function getAuthSession(): Promise<AuthSession | null> {
  if (!isCloudBackendConfigured()) {
    return null;
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session?.user) {
    return null;
  }

  // getSession() returns the user snapshot from local storage. Drive connection is written to
  // user_metadata on the server when OAuth completes, so we must load the user from Auth to
  // see `driveConnection` after restarts (same idea as refreshCurrentSession).
  const {
    data: { user: serverUser },
    error: userError,
  } = await supabase.auth.getUser();

  const user = !userError && serverUser ? serverUser : session.user;
  return mapSupabaseSession(session.access_token, user);
}

export async function clearAuthSession() {
  if (!isCloudBackendConfigured()) {
    return;
  }

  await supabase.auth.signOut();
}

export async function signUpWithEmail(params: { email: string; password: string; name: string }) {
  ensureSupabaseConfigured();

  const { data, error } = await supabase.auth.signUp({
    email: params.email.trim(),
    password: params.password,
    options: {
      data: {
        name: params.name.trim(),
      },
    },
  });

  if (error) {
    throw error;
  }

  if (!data.session || !data.user) {
    throw new Error('Signup succeeded but no active session was returned. Check Supabase email confirmation settings.');
  }

  return mapSupabaseSession(data.session.access_token, data.user);
}

export async function signInWithEmail(params: { email: string; password: string }) {
  ensureSupabaseConfigured();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: params.email.trim(),
    password: params.password,
  });

  if (error) {
    throw error;
  }

  if (!data.session || !data.user) {
    throw new Error('Supabase returned no active session.');
  }

  return mapSupabaseSession(data.session.access_token, data.user);
}

export async function signInWithGoogle() {
  ensureSupabaseConfigured();

  const redirectTo = getOAuthRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  if (!data.url) {
    throw new Error('Supabase returned no Google sign-in URL.');
  }

  return data.url;
}

export function getOAuthRedirectUrl() {
  return Linking.createURL('account');
}

/** Same redirect the Edge Function registers with Google (`GOOGLE_DRIVE_REDIRECT_URI` default). Used to close the in-app auth browser when Google redirects back. */
export function getGoogleDriveOAuthRedirectUrl() {
  if (!isCloudBackendConfigured()) {
    return '';
  }

  const base = supabaseConfig.supabaseUrl.replace(/\/$/, '');
  return `${base}/functions/v1/${supabaseConfig.googleDriveConnectFunctionName}`;
}

export async function completeOAuthSignIn(callbackUrl: string) {
  ensureSupabaseConfigured();

  const authCode = extractOAuthAuthCode(callbackUrl);
  const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);

  if (error) {
    throw error;
  }

  if (!data.session || !data.user) {
    throw new Error('Supabase OAuth returned no active session.');
  }

  return mapSupabaseSession(data.session.access_token, data.user);
}

export async function refreshCurrentSession() {
  if (!isCloudBackendConfigured()) {
    return null;
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session) {
    return null;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  return mapSupabaseSession(session.access_token, user);
}

export async function getGoogleDriveConnectUrl() {
  ensureSupabaseConfigured();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token) {
    throw new Error('Sign in first, then connect Google Drive.');
  }

  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
    supabaseConfig.googleDriveConnectFunctionName,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    }
  );

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const message = await readFunctionsErrorMessage(error);
      throw new Error(message);
    }
    throw error;
  }

  if (!data?.url) {
    const hint = typeof data?.error === 'string' ? data.error : 'Supabase function returned no Google Drive connect URL.';
    throw new Error(hint);
  }

  return data.url;
}

export async function requestGoogleDriveFolderPickerUrl(redirectBase: string) {
  ensureSupabaseConfigured();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token) {
    throw new Error('Sign in first.');
  }

  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>('google-drive-folder-picker', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: { redirectBase },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const message = await readFunctionsErrorMessage(error);
      throw new Error(message);
    }
    throw error;
  }

  if (!data?.url) {
    const hint = typeof data?.error === 'string' ? data.error : 'Could not start the Drive folder picker.';
    throw new Error(hint);
  }

  return data.url;
}

export async function saveGoogleDriveSaveFolder(folderId: string, folderName: string) {
  ensureSupabaseConfigured();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token) {
    throw new Error('Sign in first.');
  }

  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>('google-drive-save-folder', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: { folderId, folderName },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const message = await readFunctionsErrorMessage(error);
      throw new Error(message);
    }
    throw error;
  }

  if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string') {
    throw new Error((data as { error: string }).error);
  }
}

export async function fetchGoogleDriveAccessToken(): Promise<string> {
  ensureSupabaseConfigured();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token) {
    throw new Error('Sign in first.');
  }

  const { data, error } = await supabase.functions.invoke<{ accessToken?: string; error?: string }>('google-drive-access-token', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const message = await readFunctionsErrorMessage(error);
      throw new Error(message);
    }
    throw error;
  }

  if (!data?.accessToken) {
    const hint = typeof data?.error === 'string' ? data.error : 'Could not get a Google Drive access token.';
    throw new Error(hint);
  }

  return data.accessToken;
}

async function readFunctionsErrorMessage(error: FunctionsHttpError): Promise<string> {
  try {
    const body = await error.context.clone().json();
    if (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string') {
      return (body as { error: string }).error;
    }
  } catch {
    // fall through to text
  }

  try {
    const text = (await error.context.text()).trim();
    if (text) {
      return text;
    }
  } catch {
    // ignore
  }

  return error.message || 'Edge function request failed.';
}

function ensureSupabaseConfigured() {
  if (!isCloudBackendConfigured()) {
    throw new Error('Supabase is not configured yet. Add supabaseUrl and supabaseAnonKey to app config.');
  }
}

/** PKCE exchange expects the raw `code` value, not the full deep link URL. */
function extractOAuthAuthCode(callbackUrl: string): string {
  const parsed = Linking.parse(callbackUrl);
  const raw = parsed.queryParams?.code;
  const fromQuery = Array.isArray(raw) ? raw[0] : raw;
  if (typeof fromQuery === 'string' && fromQuery.length > 0) {
    return fromQuery;
  }

  try {
    const url = new URL(callbackUrl);
    const code = url.searchParams.get('code');
    if (code) {
      return code;
    }
  } catch {
    // non-standard scheme; Linking.parse above is the main path for Expo deep links
  }

  const hash = callbackUrl.includes('#') ? callbackUrl.split('#')[1] : '';
  if (hash) {
    const fromHash = new URLSearchParams(hash).get('code');
    if (fromHash) {
      return fromHash;
    }
  }

  const errRaw = parsed.queryParams?.error_description ?? parsed.queryParams?.error;
  const errMsg = Array.isArray(errRaw) ? errRaw[0] : errRaw;
  if (typeof errMsg === 'string' && errMsg.length > 0) {
    throw new Error(errMsg);
  }

  throw new Error('No authorization code found in the sign-in callback.');
}

function mapSupabaseSession(accessToken: string, user: User): AuthSession {
  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email ?? '',
      name: readUserName(user),
      driveConnection: readDriveConnection(user),
    },
  };
}

function readUserName(user: User) {
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const name = metadata?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

function readDriveConnection(user: User): DriveConnection {
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const rawDriveConnection = metadata?.driveConnection;

  if (!rawDriveConnection || typeof rawDriveConnection !== 'object') {
    return {
      status: 'not_connected',
      accountEmail: null,
      connectedAt: null,
      saveFolderId: null,
      saveFolderName: null,
    };
  }

  const connection = rawDriveConnection as Record<string, unknown>;

  return {
    status: connection.status === 'connected' ? 'connected' : 'not_connected',
    accountEmail: typeof connection.accountEmail === 'string' ? connection.accountEmail : null,
    connectedAt: typeof connection.connectedAt === 'string' ? connection.connectedAt : null,
    saveFolderId: typeof connection.saveFolderId === 'string' ? connection.saveFolderId : null,
    saveFolderName: typeof connection.saveFolderName === 'string' ? connection.saveFolderName : null,
  };
}
