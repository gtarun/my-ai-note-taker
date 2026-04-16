import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

import { buildBootstrapPayload } from '../_shared/user-data.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ExtractionLayerFieldPayload = {
  id: string;
  title: string;
  description: string;
};

type ExtractionLayerPayload = {
  id: string;
  name: string;
  spreadsheetId: string | null;
  spreadsheetTitle: string | null;
  sheetTitle: string | null;
  createdAt: string;
  updatedAt: string;
  fields: ExtractionLayerFieldPayload[];
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
    const body = (await request.json()) as {
      action?: 'list' | 'save' | 'delete';
      layer?: ExtractionLayerPayload;
      layerId?: string;
    };

    if (body.action === 'list') {
      return jsonResponse({
        layers: await readUserLayers(adminClient, user.id),
      });
    }

    if (body.action === 'save') {
      if (!body.layer) {
        return jsonResponse({ error: 'layer is required.' }, 400);
      }

      await upsertUserLayer(adminClient, user.id, body.layer);
      return jsonResponse({
        layer: await readUserLayer(adminClient, user.id, body.layer.id),
      });
    }

    if (body.action === 'delete') {
      const layerId = body.layerId?.trim() ?? '';
      if (!layerId) {
        return jsonResponse({ error: 'layerId is required.' }, 400);
      }

      const { error } = await adminClient
        .from('user_extraction_layers')
        .delete()
        .eq('user_id', user.id)
        .eq('id', layerId);

      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }

      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: 'action is required.' }, 400);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unable to sync extraction layers.' },
      500
    );
  }
});

async function upsertUserLayer(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  layer: ExtractionLayerPayload
) {
  const { error: layerError } = await adminClient.from('user_extraction_layers').upsert(
    {
      id: layer.id,
      user_id: userId,
      name: layer.name,
      spreadsheet_id: layer.spreadsheetId,
      spreadsheet_title: layer.spreadsheetTitle,
      sheet_title: layer.sheetTitle,
      created_at: layer.createdAt,
      updated_at: layer.updatedAt,
    },
    { onConflict: 'id' }
  );

  if (layerError) {
    throw new Error(layerError.message);
  }

  const { error: deleteFieldsError } = await adminClient
    .from('user_extraction_layer_fields')
    .delete()
    .eq('layer_id', layer.id);

  if (deleteFieldsError) {
    throw new Error(deleteFieldsError.message);
  }

  if (!layer.fields.length) {
    return;
  }

  const { error: insertFieldsError } = await adminClient.from('user_extraction_layer_fields').insert(
    layer.fields.map((field, index) => ({
      layer_id: layer.id,
      field_id: field.id,
      title: field.title,
      description: field.description,
      position: index,
      updated_at: layer.updatedAt,
    }))
  );

  if (insertFieldsError) {
    throw new Error(insertFieldsError.message);
  }
}

async function readUserLayers(adminClient: ReturnType<typeof createAdminClient>, userId: string) {
  const { data: layers, error: layersError } = await adminClient
    .from('user_extraction_layers')
    .select('id, name, created_at, updated_at, spreadsheet_id, spreadsheet_title, sheet_title')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (layersError) {
    throw new Error(layersError.message);
  }

  const layerIds = (layers ?? []).map((row) => row.id);
  const { data: fields, error: fieldsError } = layerIds.length
    ? await adminClient
        .from('user_extraction_layer_fields')
        .select('layer_id, field_id, title, description, position')
        .in('layer_id', layerIds)
        .order('position', { ascending: true })
    : { data: [], error: null };

  if (fieldsError) {
    throw new Error(fieldsError.message);
  }

  return buildBootstrapPayload({
    authUser: { id: userId },
    profile: null,
    preferences: null,
    providerConfigs: [],
    integrations: [],
    layers: layers ?? [],
    layerFields: fields ?? [],
  }).layers;
}

async function readUserLayer(adminClient: ReturnType<typeof createAdminClient>, userId: string, layerId: string) {
  const layers = await readUserLayers(adminClient, userId);
  const layer = layers.find((row) => row.id === layerId);

  if (!layer) {
    throw new Error('Layer could not be reloaded after save.');
  }

  return layer;
}

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
