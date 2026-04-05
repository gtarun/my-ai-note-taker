import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { createClient, User } from '@supabase/supabase-js';
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

  return mapSupabaseSession(session.access_token, session.user);
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

export async function completeOAuthSignIn(callbackUrl: string) {
  ensureSupabaseConfigured();

  const { data, error } = await supabase.auth.exchangeCodeForSession(callbackUrl);

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

  const { data, error } = await supabase.functions.invoke<{ url?: string }>(
    supabaseConfig.googleDriveConnectFunctionName,
    {
      method: 'POST',
    }
  );

  if (error) {
    throw error;
  }

  if (!data?.url) {
    throw new Error('Supabase function returned no Google Drive connect URL.');
  }

  return data.url;
}

function ensureSupabaseConfigured() {
  if (!isCloudBackendConfigured()) {
    throw new Error('Supabase is not configured yet. Add supabaseUrl and supabaseAnonKey to app config.');
  }
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
    };
  }

  const connection = rawDriveConnection as Record<string, unknown>;

  return {
    status: connection.status === 'connected' ? 'connected' : 'not_connected',
    accountEmail: typeof connection.accountEmail === 'string' ? connection.accountEmail : null,
    connectedAt: typeof connection.connectedAt === 'string' ? connection.connectedAt : null,
  };
}
