import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

import { getValidAccessToken, readGoogleDriveEnv } from '../_shared/drive-access.ts';
import { ensureLayerSpreadsheet, type ExtractionFieldPayload } from '../_shared/google-sheets.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const env = readGoogleDriveEnv();
    const userClient = createUserScopedClient(request, env);
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = (await request.json()) as {
      layerName?: string;
      spreadsheetId?: string | null;
      spreadsheetTitle?: string | null;
      sheetTitle?: string | null;
      fields?: ExtractionFieldPayload[];
    };

    if (!body.layerName?.trim()) {
      return jsonResponse({ error: 'layerName is required.' }, 400);
    }

    if (!body.fields?.length) {
      return jsonResponse({ error: 'At least one field is required.' }, 400);
    }

    const adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const accessToken = await getValidAccessToken(
      adminClient,
      env,
      user.id,
      'https://www.googleapis.com/auth/spreadsheets'
    );

    const result = await ensureLayerSpreadsheet({
      accessToken,
      layerName: body.layerName,
      spreadsheetId: body.spreadsheetId ?? null,
      spreadsheetTitle: body.spreadsheetTitle ?? null,
      sheetTitle: body.sheetTitle ?? null,
      fields: body.fields,
    });

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unable to prepare the Google Sheet.' },
      500
    );
  }
});

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
