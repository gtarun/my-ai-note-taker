import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

import { readGoogleDriveEnv } from '../_shared/drive-access.ts';

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

    const body = (await request.json()) as { folderId?: unknown; folderName?: unknown };
    const folderId = typeof body.folderId === 'string' ? body.folderId.trim() : '';
    const folderName = typeof body.folderName === 'string' ? body.folderName.trim() : '';

    if (!folderId) {
      return jsonResponse({ error: 'folderId is required.' }, 400);
    }

    const adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: existing, error: fetchError } = await adminClient
      .from('google_drive_connections')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      return jsonResponse({ error: fetchError.message }, 500);
    }

    if (!existing) {
      return jsonResponse({ error: 'Connect Google Drive first.' }, 400);
    }

    const { error: updateConnError } = await adminClient
      .from('google_drive_connections')
      .update({
        save_folder_id: folderId,
        save_folder_name: folderName || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateConnError) {
      return jsonResponse({ error: updateConnError.message }, 500);
    }

    const { data: targetUser, error: targetUserError } = await adminClient.auth.admin.getUserById(user.id);

    if (targetUserError || !targetUser.user) {
      return jsonResponse({ error: targetUserError?.message ?? 'Unable to load user.' }, 500);
    }

    const prev = targetUser.user.user_metadata?.driveConnection;
    const prevObj = prev && typeof prev === 'object' ? (prev as Record<string, unknown>) : {};

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(targetUser.user.user_metadata ?? {}),
        driveConnection: {
          ...prevObj,
          status: 'connected',
          saveFolderId: folderId,
          saveFolderName: folderName || null,
        },
      },
    });

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unable to save folder preference.' },
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
