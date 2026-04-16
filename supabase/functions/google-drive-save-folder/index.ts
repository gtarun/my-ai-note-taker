import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

import {
  buildGoogleIntegrationSummary,
  GOOGLE_INTEGRATION_PROVIDER,
  normalizeGrantedScopes,
} from '../_shared/google-integration.ts';
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

    const [{ data: existingIntegration, error: fetchIntegrationError }, { data: existingLegacy, error: fetchLegacyError }] =
      await Promise.all([
        adminClient
          .from('user_integrations')
          .select(
            'status, account_email, granted_scopes, needs_reconnect, drive_save_folder_id, drive_save_folder_name, updated_at'
          )
          .eq('user_id', user.id)
          .eq('provider', GOOGLE_INTEGRATION_PROVIDER)
          .maybeSingle(),
        adminClient
          .from('google_drive_connections')
          .select('google_account_email, scope, updated_at')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

    if (fetchIntegrationError) {
      return jsonResponse({ error: fetchIntegrationError.message }, 500);
    }

    if (fetchLegacyError) {
      return jsonResponse({ error: fetchLegacyError.message }, 500);
    }

    if (!existingIntegration && !existingLegacy) {
      return jsonResponse({ error: 'Connect Google Drive first.' }, 400);
    }

    const updatedAt = new Date().toISOString();
    const { error: updateConnError } = await adminClient.from('user_integrations').upsert(
      {
        user_id: user.id,
        provider: GOOGLE_INTEGRATION_PROVIDER,
        status: existingIntegration?.status ?? 'connected',
        account_email: existingIntegration?.account_email ?? existingLegacy?.google_account_email ?? null,
        granted_scopes: normalizeGrantedScopes(
          existingIntegration?.granted_scopes ?? existingLegacy?.scope ?? []
        ),
        needs_reconnect: existingIntegration?.needs_reconnect ?? false,
        drive_save_folder_id: folderId,
        drive_save_folder_name: folderName || null,
        updated_at: updatedAt,
      },
      { onConflict: 'user_id,provider' }
    );

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
          ...buildGoogleIntegrationSummary({
            status: existingIntegration?.status ?? 'connected',
            account_email: existingIntegration?.account_email ?? existingLegacy?.google_account_email ?? null,
            granted_scopes: normalizeGrantedScopes(
              existingIntegration?.granted_scopes ?? existingLegacy?.scope ?? []
            ),
            needs_reconnect: existingIntegration?.needs_reconnect ?? false,
            drive_save_folder_id: folderId,
            drive_save_folder_name: folderName || null,
            updated_at: updatedAt,
          }),
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
