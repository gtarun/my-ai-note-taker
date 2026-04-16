import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

import { encryptSecret, readEncryptionKey } from '../_shared/secrets.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type PreferencesPayload = {
  selectedTranscriptionProvider?: string;
  selectedSummaryProvider?: string;
  deleteUploadedAudio?: boolean;
  modelCatalogUrl?: string;
  hasSeenOnboarding?: boolean;
};

type ProviderPayload = {
  providerId: string;
  apiKey: string;
  baseUrl: string;
  transcriptionModel: string;
  summaryModel: string;
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
    const body = (await request.json()) as {
      preferences?: PreferencesPayload;
      providers?: ProviderPayload[];
    };

    const { data: existingPreferences, error: existingPreferencesError } = await adminClient
      .from('user_preferences')
      .select(
        'selected_transcription_provider, selected_summary_provider, delete_uploaded_audio, model_catalog_url, has_seen_onboarding'
      )
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingPreferencesError) {
      return jsonResponse({ error: existingPreferencesError.message }, 500);
    }

    const mergedPreferences = {
      selected_transcription_provider:
        body.preferences?.selectedTranscriptionProvider ??
        existingPreferences?.selected_transcription_provider ??
        'openai',
      selected_summary_provider:
        body.preferences?.selectedSummaryProvider ??
        existingPreferences?.selected_summary_provider ??
        'openai',
      delete_uploaded_audio:
        body.preferences?.deleteUploadedAudio ?? existingPreferences?.delete_uploaded_audio ?? false,
      model_catalog_url: body.preferences?.modelCatalogUrl ?? existingPreferences?.model_catalog_url ?? '',
      has_seen_onboarding:
        body.preferences?.hasSeenOnboarding ?? existingPreferences?.has_seen_onboarding ?? false,
      updated_at: new Date().toISOString(),
    };

    const { error: profileError } = await adminClient.from('profiles').upsert(
      {
        user_id: user.id,
        display_name:
          typeof user.user_metadata?.name === 'string' ? user.user_metadata.name.trim() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (profileError) {
      return jsonResponse({ error: profileError.message }, 500);
    }

    const { error: preferencesError } = await adminClient.from('user_preferences').upsert(
      {
        user_id: user.id,
        ...mergedPreferences,
      },
      { onConflict: 'user_id' }
    );

    if (preferencesError) {
      return jsonResponse({ error: preferencesError.message }, 500);
    }

    for (const provider of body.providers ?? []) {
      const { error: providerError } = await adminClient.from('user_provider_configs').upsert(
        {
          user_id: user.id,
          provider_id: provider.providerId,
          encrypted_api_key: provider.apiKey
            ? await encryptSecret(provider.apiKey, encryptionKey)
            : null,
          base_url: provider.baseUrl,
          transcription_model: provider.transcriptionModel,
          summary_model: provider.summaryModel,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider_id' }
      );

      if (providerError) {
        return jsonResponse({ error: providerError.message }, 500);
      }
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unable to sync user settings.' },
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
