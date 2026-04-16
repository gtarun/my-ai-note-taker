import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

import { getValidAccessToken, readGoogleDriveEnv } from '../_shared/drive-access.ts';
import {
  getSpreadsheetMetadata,
  listRecentSpreadsheets,
  readSheetHeaders,
  searchSpreadsheetsByName,
} from '../_shared/google-sheets.ts';

const DRIVE_METADATA_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

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
      mode?: 'recent' | 'search' | 'details';
      query?: string;
      spreadsheetId?: string;
      sheetTitle?: string;
    };

    const adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (body.mode === 'recent') {
      const accessToken = await getValidAccessToken(adminClient, env, user.id, DRIVE_METADATA_SCOPE);
      const spreadsheets = await listRecentSpreadsheets(accessToken, 3);
      return jsonResponse({ spreadsheets });
    }

    if (body.mode === 'search') {
      const query = body.query?.trim() ?? '';
      if (!query) {
        return jsonResponse({ spreadsheets: [] });
      }

      const accessToken = await getValidAccessToken(adminClient, env, user.id, DRIVE_METADATA_SCOPE);
      const spreadsheets = await searchSpreadsheetsByName(accessToken, query, 10);
      return jsonResponse({ spreadsheets });
    }

    if (body.mode === 'details') {
      const spreadsheetId = body.spreadsheetId?.trim() ?? '';
      if (!spreadsheetId) {
        return jsonResponse({ error: 'spreadsheetId is required.' }, 400);
      }

      const accessToken = await getValidAccessToken(adminClient, env, user.id, SHEETS_SCOPE);
      const metadata = await getSpreadsheetMetadata(accessToken, spreadsheetId);
      const selectedSheetTitle = body.sheetTitle?.trim() ?? '';
      const headers = selectedSheetTitle
        ? await readSheetHeaders(accessToken, spreadsheetId, selectedSheetTitle)
        : [];

      return jsonResponse({
        spreadsheetTitle: metadata.properties.title,
        tabs: metadata.sheets.map((sheet) => sheet.properties.title),
        sheetTitle: selectedSheetTitle || null,
        headers,
      });
    }

    return jsonResponse({ error: 'mode is required.' }, 400);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unable to browse Google Sheets.' },
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
