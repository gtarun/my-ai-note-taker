import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const env = readEnv();
    const requestUrl = new URL(request.url);
    const urlCode = requestUrl.searchParams.get('code');
    const urlState = requestUrl.searchParams.get('state');
    const urlError = requestUrl.searchParams.get('error');

    if (request.method === 'GET' && urlError) {
      return htmlResponse(renderErrorPage(`Google OAuth returned an error: ${urlError}`));
    }

    if (request.method === 'GET' && urlCode && urlState) {
      const statePayload = await parseState(urlState, env.stateSecret);
      const adminClient = createAdminClient(env);
      const { data: existingConnection } = await adminClient
        .from('google_drive_connections')
        .select('refresh_token')
        .eq('user_id', statePayload.userId)
        .maybeSingle();

      const tokens = await exchangeCodeForTokens({
        code: urlCode,
        redirectUri: env.redirectUri,
        clientId: env.googleClientId,
        clientSecret: env.googleClientSecret,
      });

      const profile = await fetchGoogleProfile(tokens.access_token);

      const upsertResult = await adminClient.from('google_drive_connections').upsert(
        {
          user_id: statePayload.userId,
          google_account_email: profile.email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? existingConnection?.refresh_token ?? null,
          scope: tokens.scope ?? env.googleDriveScope,
          token_type: tokens.token_type ?? 'Bearer',
          expiry_date: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      if (upsertResult.error) {
        return htmlResponse(renderErrorPage(upsertResult.error.message), 500);
      }

      const { data: targetUser, error: targetUserError } = await adminClient.auth.admin.getUserById(statePayload.userId);

      if (targetUserError || !targetUser.user) {
        return htmlResponse(renderErrorPage(targetUserError?.message ?? 'Unable to load the target user.'), 500);
      }

      const prevDrive = targetUser.user.user_metadata?.driveConnection;
      const prevDriveObj = prevDrive && typeof prevDrive === 'object' ? (prevDrive as Record<string, unknown>) : {};

      const updateResult = await adminClient.auth.admin.updateUserById(statePayload.userId, {
        user_metadata: {
          ...(targetUser.user.user_metadata ?? {}),
          driveConnection: {
            ...prevDriveObj,
            status: 'connected',
            accountEmail: profile.email,
            connectedAt: new Date().toISOString(),
          },
        },
      });

      if (updateResult.error) {
        return htmlResponse(renderErrorPage(updateResult.error.message), 500);
      }

      return htmlResponse(renderSuccessPage(profile.email));
    }

    const userClient = createUserScopedClient(request, env);
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const signedState = await createState(
      {
        userId: user.id,
        issuedAt: Date.now(),
      },
      env.stateSecret
    );

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', env.googleClientId);
    authUrl.searchParams.set('redirect_uri', env.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('scope', env.googleDriveScope);
    authUrl.searchParams.set('state', signedState);

    return jsonResponse({ url: authUrl.toString() });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unknown Google Drive connect error.' },
      500
    );
  }
});

function readEnv() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
  const stateSecret = Deno.env.get('GOOGLE_STATE_SECRET') ?? '';
  // UserInfo requires openid + email (or userinfo.email); drive.file alone yields 401 on userinfo.
  const googleDriveScope =
    Deno.env.get('GOOGLE_DRIVE_SCOPE') ??
    'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.file';
  const redirectUri =
    Deno.env.get('GOOGLE_DRIVE_REDIRECT_URI') ??
    `${supabaseUrl.replace(/\/$/, '')}/functions/v1/google-drive-connect-url`;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    throw new Error('Missing required Supabase function environment variables.');
  }

  if (!googleClientId || !googleClientSecret || !stateSecret) {
    throw new Error('Missing required Google OAuth function secrets.');
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    googleClientId,
    googleClientSecret,
    googleDriveScope,
    redirectUri,
    stateSecret,
  };
}

function createUserScopedClient(request: Request, env: ReturnType<typeof readEnv>) {
  const authorization = request.headers.get('Authorization');

  if (!authorization) {
    throw new Error('Missing Authorization header.');
  }

  // Anon key + the caller's JWT is the supported way to resolve the user inside Edge Functions.
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function createAdminClient(env: ReturnType<typeof readEnv>) {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function createState(payload: { userId: string; issuedAt: number }, secret: string) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = await signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

async function parseState(state: string, secret: string) {
  const [encodedPayload, signature] = state.split('.');

  if (!encodedPayload || !signature) {
    throw new Error('Invalid OAuth state.');
  }

  const expectedSignature = await signValue(encodedPayload, secret);

  if (signature !== expectedSignature) {
    throw new Error('Invalid OAuth state.');
  }

  const payload = JSON.parse(fromBase64Url(encodedPayload)) as { userId: string; issuedAt: number };

  if (typeof payload.issuedAt !== 'number' || payload.issuedAt < Date.now() - STATE_MAX_AGE_MS) {
    throw new Error('OAuth state expired.');
  }

  return payload;
}

async function exchangeCodeForTokens(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };
}

async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as { email: string };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function htmlResponse(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

function renderSuccessPage(email: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Drive Connected</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f6f1e8; color: #17231f; padding: 32px; }
      .card { max-width: 520px; margin: 48px auto; background: #fffaf1; border: 1px solid #d7d0c3; border-radius: 20px; padding: 24px; }
      h1 { margin-top: 0; }
      p { line-height: 1.6; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Google Drive connected</h1>
      <p>The account <strong>${escapeHtml(email)}</strong> is now linked.</p>
      <p>You can return to the app and refresh the account screen.</p>
    </div>
  </body>
</html>`;
}

function renderErrorPage(message: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Drive Connection Failed</title>
    <style>
      body { font-family: Arial, sans-serif; background: #fff1ee; color: #17231f; padding: 32px; }
      .card { max-width: 520px; margin: 48px auto; background: #fffaf1; border: 1px solid #e7b0aa; border-radius: 20px; padding: 24px; }
      h1 { margin-top: 0; }
      p { line-height: 1.6; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Google Drive connection failed</h1>
      <p>${escapeHtml(message)}</p>
      <p>Return to the app and try again after checking the function secrets.</p>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toBase64Url(value: string) {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return atob(`${normalized}${padding}`);
}

async function signValue(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
