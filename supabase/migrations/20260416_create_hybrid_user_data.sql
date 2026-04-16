create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_transcription_provider text not null default 'openai',
  selected_summary_provider text not null default 'openai',
  delete_uploaded_audio boolean not null default false,
  model_catalog_url text not null default '',
  has_seen_onboarding boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.user_provider_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id text not null,
  base_url text not null default '',
  transcription_model text not null default '',
  summary_model text not null default '',
  encrypted_api_key text,
  key_version integer not null default 1,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, provider_id)
);

create table if not exists public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  status text not null default 'not_connected',
  account_email text,
  granted_scopes text[] not null default '{}',
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  needs_reconnect boolean not null default false,
  drive_save_folder_id text,
  drive_save_folder_name text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, provider)
);

create table if not exists public.user_extraction_layers (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  spreadsheet_id text,
  spreadsheet_title text,
  sheet_title text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.user_extraction_layer_fields (
  id uuid primary key default gen_random_uuid(),
  layer_id uuid not null references public.user_extraction_layers(id) on delete cascade,
  field_id text not null,
  title text not null,
  description text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (layer_id, field_id)
);

create index if not exists user_provider_configs_user_id_updated_at_idx
  on public.user_provider_configs (user_id, updated_at desc);

create index if not exists user_integrations_user_id_updated_at_idx
  on public.user_integrations (user_id, updated_at desc);

create index if not exists user_extraction_layers_user_id_updated_at_idx
  on public.user_extraction_layers (user_id, updated_at desc);

create index if not exists user_extraction_layer_fields_layer_id_position_idx
  on public.user_extraction_layer_fields (layer_id, position asc);

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_provider_configs enable row level security;
alter table public.user_integrations enable row level security;
alter table public.user_extraction_layers enable row level security;
alter table public.user_extraction_layer_fields enable row level security;

create policy "Users can view their own profiles"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can upsert their own profiles"
on public.profiles
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can view their own preferences"
on public.user_preferences
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can upsert their own preferences"
on public.user_preferences
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can view their own provider configs"
on public.user_provider_configs
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can upsert their own provider configs"
on public.user_provider_configs
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can view their own integrations"
on public.user_integrations
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can upsert their own integrations"
on public.user_integrations
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can view their own extraction layers"
on public.user_extraction_layers
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can upsert their own extraction layers"
on public.user_extraction_layers
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can view their own extraction layer fields"
on public.user_extraction_layer_fields
for select
to authenticated
using (
  exists (
    select 1
    from public.user_extraction_layers layers
    where layers.id = user_extraction_layer_fields.layer_id
      and layers.user_id = auth.uid()
  )
);

create policy "Users can upsert their own extraction layer fields"
on public.user_extraction_layer_fields
for all
to authenticated
using (
  exists (
    select 1
    from public.user_extraction_layers layers
    where layers.id = user_extraction_layer_fields.layer_id
      and layers.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.user_extraction_layers layers
    where layers.id = user_extraction_layer_fields.layer_id
      and layers.user_id = auth.uid()
  )
);

insert into public.user_integrations (
  user_id,
  provider,
  status,
  account_email,
  granted_scopes,
  needs_reconnect,
  drive_save_folder_id,
  drive_save_folder_name,
  created_at,
  updated_at
)
select
  user_id,
  'google',
  'connected',
  google_account_email,
  case
    when coalesce(scope, '') = '' then '{}'::text[]
    else regexp_split_to_array(trim(scope), '\s+')
  end,
  false,
  save_folder_id,
  save_folder_name,
  created_at,
  updated_at
from public.google_drive_connections
on conflict (user_id, provider) do update
set
  account_email = excluded.account_email,
  granted_scopes = excluded.granted_scopes,
  drive_save_folder_id = excluded.drive_save_folder_id,
  drive_save_folder_name = excluded.drive_save_folder_name,
  updated_at = excluded.updated_at;
