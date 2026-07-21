import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

/**
 * Permanently deletes the calling user's account and all server-side data.
 *
 * Required by App Store Guideline 5.1.1(v): an app that lets people create an
 * account must let them delete it from inside the app. Deleting the auth user
 * needs the service role key, so it cannot happen client-side.
 *
 * The caller is always the account being deleted — the user id comes from the
 * verified JWT, never from the request body, so this cannot be pointed at
 * someone else's account.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Tables keyed directly by `user_id`. `user_extraction_layer_fields` is NOT in
 * this list — it is scoped by `layer_id` and is handled separately below, since
 * deleting it by `user_id` would error and silently orphan every field row.
 */
const USER_SCOPED_TABLES = [
  'user_extraction_layer_save_requests',
  'user_extraction_layers',
  'user_provider_configs',
  'user_preferences',
  'user_integrations',
  'google_drive_connections',
  'profiles',
] as const;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('Missing required Supabase function environment variables.');
    }

    const authorization = request.headers.get('Authorization') ?? '';

    if (!authorization) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Best-effort per table: a missing table or an already-empty result must not
    // block deleting the auth user, or the user is stuck unable to leave.
    const failedTables: string[] = [];

    // Field rows hang off layers by layer_id, so they must go first and by that
    // key — there is no user_id column to filter on.
    const { data: layerRows, error: layerLookupError } = await adminClient
      .from('user_extraction_layers')
      .select('id')
      .eq('user_id', user.id);

    if (layerLookupError) {
      failedTables.push(`user_extraction_layers (lookup): ${layerLookupError.message}`);
    } else if (layerRows?.length) {
      const { error: fieldsError } = await adminClient
        .from('user_extraction_layer_fields')
        .delete()
        .in(
          'layer_id',
          layerRows.map((row) => row.id)
        );

      if (fieldsError) {
        failedTables.push(`user_extraction_layer_fields: ${fieldsError.message}`);
      }
    }

    for (const table of USER_SCOPED_TABLES) {
      const { error } = await adminClient.from(table).delete().eq('user_id', user.id);

      if (error) {
        failedTables.push(`${table}: ${error.message}`);
      }
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      return jsonResponse(
        {
          error: `Could not delete the account: ${deleteUserError.message}`,
          failedTables,
        },
        500
      );
    }

    return jsonResponse({ deleted: true, failedTables });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected error deleting account.' },
      500
    );
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
