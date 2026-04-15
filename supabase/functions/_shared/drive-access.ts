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
  access_token: string;
  refresh_token: string | null;
  expiry_date: string | null;
  scope: string | null;
};

export async function getValidAccessToken(
  adminClient: SupabaseClient,
  env: GoogleDriveEnv,
  userId: string,
  requiredScope?: string
): Promise<string> {
  const { data, error } = await adminClient
    .from('google_drive_connections')
    .select('access_token, refresh_token, expiry_date, scope')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as ConnectionRow | null;

  if (!row) {
    throw new Error('Google Drive is not connected.');
  }

  if (requiredScope && !row.scope?.includes(requiredScope)) {
    throw new Error('Reconnect Google to grant Google Sheets access for this feature.');
  }

  const expiryMs = row.expiry_date ? new Date(row.expiry_date).getTime() : 0;
  const freshEnough = expiryMs > Date.now() + 90_000;

  if (freshEnough && row.access_token) {
    return row.access_token;
  }

  if (!row.refresh_token) {
    throw new Error('Drive session expired. Connect Google Drive again.');
  }

  const tokens = await refreshAccessToken(env, row.refresh_token);

  const nextExpiry =
    typeof tokens.expires_in === 'number'
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

  const { error: updateError } = await adminClient
    .from('google_drive_connections')
    .update({
      access_token: tokens.access_token,
      expiry_date: nextExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

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
  };
}
