import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

import { decryptSecret, readEncryptionKey } from '../_shared/secrets.ts';
import {
  buildBootstrapPayload,
  type IntegrationRow,
  type ProviderConfigRow,
} from '../_shared/user-data.ts';

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
    const env = readEnv();
    const userClient = createUserScopedClient(request, env);
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const adminClient = createAdminClient(env);
    const encryptionKey = readEncryptionKey();

    const [{ data: profile, error: profileError }, { data: preferences, error: preferencesError }, { data: providerRows, error: providerRowsError }, { data: integrationRows, error: integrationRowsError }, { data: layers, error: layersError }] =
      await Promise.all([
        adminClient.from('profiles').select('display_name, avatar_url, timezone').eq('user_id', user.id).maybeSingle(),
        adminClient
          .from('user_preferences')
          .select('selected_transcription_provider, selected_summary_provider, delete_uploaded_audio, model_catalog_url, has_seen_onboarding')
          .eq('user_id', user.id)
          .maybeSingle(),
        adminClient
          .from('user_provider_configs')
          .select('provider_id, encrypted_api_key, base_url, transcription_model, summary_model')
          .eq('user_id', user.id)
          .order('provider_id', { ascending: true }),
        adminClient
          .from('user_integrations')
          .select('provider, status, account_email, granted_scopes, needs_reconnect, drive_save_folder_id, drive_save_folder_name, updated_at')
          .eq('user_id', user.id)
          .order('provider', { ascending: true }),
        adminClient
          .from('user_extraction_layers')
          .select('id, name, created_at, updated_at, spreadsheet_id, spreadsheet_title, sheet_title')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false }),
      ]);

    for (const error of [
      profileError,
      preferencesError,
      providerRowsError,
      integrationRowsError,
      layersError,
    ]) {
      if (error) {
        throw new Error(error.message);
      }
    }

    const layerIds = (layers ?? []).map((row) => row.id);
    const { data: layerFields, error: layerFieldsError } = layerIds.length
      ? await adminClient
          .from('user_extraction_layer_fields')
          .select('layer_id, field_id, title, description, position')
          .in('layer_id', layerIds)
          .order('position', { ascending: true })
      : { data: [], error: null };

    if (layerFieldsError) {
      throw new Error(layerFieldsError.message);
    }

    const providerConfigs: ProviderConfigRow[] = [];
    for (const row of providerRows ?? []) {
      providerConfigs.push({
        provider_id: row.provider_id,
        api_key: await decryptSecret(row.encrypted_api_key, encryptionKey),
        base_url: row.base_url,
        transcription_model: row.transcription_model,
        summary_model: row.summary_model,
      });
    }

    const payload = buildBootstrapPayload({
      authUser: user,
      profile: profile ?? null,
      preferences: preferences ?? null,
      providerConfigs,
      integrations: (integrationRows ?? []) as IntegrationRow[],
      layers: layers ?? [],
      layerFields: layerFields ?? [],
    });

    return jsonResponse(payload);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unable to load cloud user data.' },
      500
    );
  }
});

function readEnv() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    throw new Error('Missing required Supabase function environment variables.');
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
  };
}

function createUserScopedClient(request: Request, env: ReturnType<typeof readEnv>) {
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

function createAdminClient(env: ReturnType<typeof readEnv>) {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
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
