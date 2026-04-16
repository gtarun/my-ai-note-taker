import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

import { getValidAccessToken, readGoogleDriveEnv } from '../_shared/drive-access.ts';
import { buildSupabaseFunctionUrl, isAllowedRedirectBase } from '../_shared/redirect-base.ts';
import { createSignedPayload, parseSignedPayload } from '../_shared/signed-payload.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type PickerTokenPayload = {
  userId: string;
  redirectBase: string;
  exp: number;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestUrl = new URL(request.url);

  try {
    if (request.method === 'POST') {
      return await handlePost(request);
    }

    if (request.method === 'GET') {
      return await handleGet(requestUrl);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Google Drive folder picker error.' },
      500
    );
  }
});

async function handlePost(request: Request) {
  const env = readGoogleDriveEnv();
  const stateSecret = Deno.env.get('GOOGLE_STATE_SECRET') ?? '';

  if (!stateSecret) {
    throw new Error('Missing GOOGLE_STATE_SECRET.');
  }

  const userClient = createUserScopedClient(request, env);
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const body = (await request.json()) as { redirectBase?: unknown };
  const redirectBase = typeof body.redirectBase === 'string' ? body.redirectBase.trim() : '';

  if (!redirectBase || !isAllowedRedirectBase(redirectBase)) {
    return jsonResponse({ error: 'Invalid redirectBase.' }, 400);
  }

  const token = await createSignedPayload(
    {
      userId: user.id,
      redirectBase,
      exp: Date.now() + 10 * 60 * 1000,
    },
    stateSecret
  );

  const baseUrl = buildSupabaseFunctionUrl(env.supabaseUrl, 'google-drive-folder-picker');
  return jsonResponse({ url: `${baseUrl}?t=${encodeURIComponent(token)}` });
}

async function handleGet(requestUrl: URL) {
  const env = readGoogleDriveEnv();
  const stateSecret = Deno.env.get('GOOGLE_STATE_SECRET') ?? '';

  if (!stateSecret) {
    return htmlResponse(renderErrorPage('Server is not configured for Google Drive folder picking.'), 500);
  }

  const rawToken = requestUrl.searchParams.get('t');

  if (!rawToken) {
    return htmlResponse(renderErrorPage('Missing picker token.'), 400);
  }

  let payload: PickerTokenPayload;

  try {
    payload = await parseSignedPayload<PickerTokenPayload>(rawToken, stateSecret);
  } catch {
    return htmlResponse(renderErrorPage('Invalid or expired picker link. Open the folder picker from the app again.'), 400);
  }

  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) {
    return htmlResponse(renderErrorPage('This picker link expired. Start again from the app.'), 400);
  }

  const developerKey = Deno.env.get('GOOGLE_PICKER_DEVELOPER_KEY') ?? '';
  const appId = Deno.env.get('GOOGLE_PICKER_APP_ID') ?? '';

  if (!developerKey || !appId) {
    return htmlResponse(
      renderErrorPage('Set GOOGLE_PICKER_DEVELOPER_KEY and GOOGLE_PICKER_APP_ID on the Edge Function.'),
      500
    );
  }

  const adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let accessToken: string;

  try {
    accessToken = await getValidAccessToken(adminClient, env, payload.userId);
  } catch (error) {
    return htmlResponse(
      renderErrorPage(error instanceof Error ? error.message : 'Unable to load Google Drive session.'),
      400
    );
  }

  return htmlResponse(
    renderPickerPage({
      accessToken,
      developerKey,
      appId,
      redirectBase: payload.redirectBase,
    })
  );
}

function createUserScopedClient(request: Request, env: ReturnType<typeof readGoogleDriveEnv>) {
  const authorization = request.headers.get('Authorization');

  if (!authorization) {
    throw new Error('Missing Authorization header.');
  }

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

function renderErrorPage(message: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Folder picker</title>
    <style>
      body { font-family: Arial, sans-serif; background: #fff1ee; color: #17231f; padding: 32px; }
      .card { max-width: 520px; margin: 48px auto; background: #fffaf1; border: 1px solid #e7b0aa; border-radius: 20px; padding: 24px; }
      h1 { margin-top: 0; font-size: 20px; }
      p { line-height: 1.6; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Could not open folder picker</h1>
      <p>${escapeHtml(message)}</p>
    </div>
  </body>
</html>`;
}

function renderPickerPage(params: { accessToken: string; developerKey: string; appId: string; redirectBase: string }) {
  const safe = {
    accessToken: JSON.stringify(params.accessToken),
    developerKey: JSON.stringify(params.developerKey),
    appId: JSON.stringify(params.appId),
    redirectBase: JSON.stringify(params.redirectBase),
  };

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Choose a Drive folder</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f6f1e8; color: #17231f; padding: 24px; }
      .card { max-width: 560px; margin: 24px auto; background: #fffaf1; border: 1px solid #d7d0c3; border-radius: 20px; padding: 20px; }
      h1 { margin-top: 0; font-size: 20px; }
      p { line-height: 1.5; color: #3d4a47; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Select a Google Drive folder</h1>
      <p>Pick where mu-fathom should store recordings. We create a <strong>mu-fathom/recordings</strong> layout inside this folder.</p>
    </div>
    <script src="https://apis.google.com/js/api.js"></script>
    <script>
      const ACCESS_TOKEN = ${safe.accessToken};
      const DEVELOPER_KEY = ${safe.developerKey};
      const APP_ID = ${safe.appId};
      const REDIRECT_BASE = ${safe.redirectBase};

      function showPicker() {
        if (!window.gapi || !window.google || !google.picker) {
          document.body.innerHTML = '<div class="card"><h1>Picker unavailable</h1><p>Google Picker failed to load. Check network, API key, and that the Picker API is enabled for this project.</p></div>';
          return;
        }

        const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
          .setIncludeFolders(true)
          .setSelectFolderEnabled(true);

        const picker = new google.picker.PickerBuilder()
          .setAppId(APP_ID)
          .setOAuthToken(ACCESS_TOKEN)
          .setDeveloperKey(DEVELOPER_KEY)
          .addView(view)
          .setCallback(pickerCallback)
          .build();

        picker.setVisible(true);
      }

      function pickerCallback(data) {
        const action = data[google.picker.Response.ACTION];
        if (action === google.picker.Action.PICKED) {
          const doc = data[google.picker.Response.DOCUMENTS][0];
          const id = doc[google.picker.Document.ID];
          const name = doc[google.picker.Document.NAME] || 'Folder';
          const target = new URL(REDIRECT_BASE);
          target.searchParams.set('folderId', id);
          target.searchParams.set('folderName', name);
          window.location.href = target.toString();
          return;
        }
        if (action === google.picker.Action.CANCEL) {
          const target = new URL(REDIRECT_BASE);
          target.searchParams.set('picker', 'cancelled');
          window.location.href = target.toString();
        }
      }

      gapi.load('picker', showPicker);
    </script>
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
