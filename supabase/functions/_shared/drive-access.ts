import { decryptSecret, encryptSecret, readEncryptionKey } from './secrets.ts';
import {
  GOOGLE_INTEGRATION_PROVIDER,
  hasGoogleScope,
  normalizeGrantedScopes,
} from './google-integration.ts';

export type GoogleDriveEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  googleClientId: string;
  googleClientSecret: string;
};

export function readGoogleDriveEnv(): GoogleDriveEnv {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    throw new Error('Missing required Supabase function environment variables.');
  }

  if (!googleClientId || !googleClientSecret) {
    throw new Error('Missing required Google OAuth client secrets.');
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    googleClientId,
    googleClientSecret,
  };
}

type ConnectionRow = {
  google_account_email: string | null;
  access_token: string;
  refresh_token: string | null;
  expiry_date: string | null;
  scope: string | null;
  save_folder_id: string | null;
  save_folder_name: string | null;
  updated_at: string | null;
};

type IntegrationRow = {
  account_email: string | null;
  granted_scopes: string[] | null;
  encrypted_access_token: string | null;
  encrypted_refresh_token: string | null;
  token_expires_at: string | null;
  needs_reconnect: boolean;
  drive_save_folder_id: string | null;
  drive_save_folder_name: string | null;
  updated_at: string | null;
};

export async function getValidAccessToken(
  adminClient: SupabaseClient,
  env: GoogleDriveEnv,
  userId: string,
  requiredScope?: string
): Promise<string> {
  const encryptionKey = readEncryptionKey();
  const [{ data: integrationData, error: integrationError }, { data: legacyData, error: legacyError }] =
    await Promise.all([
      adminClient
        .from('user_integrations')
        .select(
          'account_email, granted_scopes, encrypted_access_token, encrypted_refresh_token, token_expires_at, needs_reconnect, drive_save_folder_id, drive_save_folder_name, updated_at'
        )
        .eq('user_id', userId)
        .eq('provider', GOOGLE_INTEGRATION_PROVIDER)
        .maybeSingle(),
      adminClient
        .from('google_drive_connections')
        .select(
          'google_account_email, access_token, refresh_token, expiry_date, scope, save_folder_id, save_folder_name, updated_at'
        )
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

  if (integrationError) {
    throw new Error(integrationError.message);
  }

  if (legacyError) {
    throw new Error(legacyError.message);
  }

  const integrationRow = integrationData as IntegrationRow | null;
  const legacyRow = legacyData as ConnectionRow | null;

  if (!integrationRow && !legacyRow) {
    throw new Error('Google Drive is not connected.');
  }

  const grantedScopes = integrationRow?.granted_scopes?.length
    ? normalizeGrantedScopes(integrationRow.granted_scopes)
    : normalizeGrantedScopes(legacyRow?.scope);

  if (requiredScope && !hasGoogleScope(grantedScopes, requiredScope)) {
    throw new Error('Reconnect Google to grant Google Sheets access for this feature.');
  }

  const integratedAccessToken = await decryptSecret(integrationRow?.encrypted_access_token, encryptionKey);
  const integratedRefreshToken = await decryptSecret(integrationRow?.encrypted_refresh_token, encryptionKey);
  const expiryMs = integrationRow?.token_expires_at
    ? new Date(integrationRow.token_expires_at).getTime()
    : legacyRow?.expiry_date
      ? new Date(legacyRow.expiry_date).getTime()
      : 0;
  const freshEnough = expiryMs > Date.now() + 90_000;

  if (freshEnough && integratedAccessToken) {
    return integratedAccessToken;
  }

  if (freshEnough && legacyRow?.access_token) {
    await upsertIntegrationFromLegacy(adminClient, userId, legacyRow, encryptionKey);
    return legacyRow.access_token;
  }

  const refreshToken = integratedRefreshToken || legacyRow?.refresh_token;

  if (!refreshToken) {
    throw new Error('Drive session expired. Connect Google Drive again.');
  }

  const tokens = await refreshAccessToken(env, refreshToken);

  const nextExpiry =
    typeof tokens.expires_in === 'number'
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

  const { error: updateError } = await adminClient.from('user_integrations').upsert(
    {
      user_id: userId,
      provider: GOOGLE_INTEGRATION_PROVIDER,
      status: 'connected',
      account_email: integrationRow?.account_email ?? legacyRow?.google_account_email ?? null,
      granted_scopes: normalizeGrantedScopes(tokens.scope ?? grantedScopes),
      encrypted_access_token: await encryptSecret(tokens.access_token, encryptionKey),
      encrypted_refresh_token: await encryptSecret(refreshToken, encryptionKey),
      token_expires_at: nextExpiry,
      needs_reconnect: false,
      drive_save_folder_id: integrationRow?.drive_save_folder_id ?? legacyRow?.save_folder_id ?? null,
      drive_save_folder_name: integrationRow?.drive_save_folder_name ?? legacyRow?.save_folder_name ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' }
  );

  if (updateError) {
    throw new Error(updateError.message);
  }

  return tokens.access_token;
}

async function refreshAccessToken(env: GoogleDriveEnv, refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as {
    access_token: string;
    expires_in?: number;
    scope?: string;
  };
}

async function upsertIntegrationFromLegacy(
  adminClient: SupabaseClient,
  userId: string,
  legacyRow: ConnectionRow,
  encryptionKey: string
) {
  const { error } = await adminClient.from('user_integrations').upsert(
    {
      user_id: userId,
      provider: GOOGLE_INTEGRATION_PROVIDER,
      status: 'connected',
      account_email: legacyRow.google_account_email,
      granted_scopes: normalizeGrantedScopes(legacyRow.scope),
      encrypted_access_token: await encryptSecret(legacyRow.access_token, encryptionKey),
      encrypted_refresh_token: legacyRow.refresh_token
        ? await encryptSecret(legacyRow.refresh_token, encryptionKey)
        : null,
      token_expires_at: legacyRow.expiry_date,
      needs_reconnect: false,
      drive_save_folder_id: legacyRow.save_folder_id,
      drive_save_folder_name: legacyRow.save_folder_name,
      updated_at: legacyRow.updated_at ?? new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' }
  );

  if (error) {
    throw new Error(error.message);
  }
}
