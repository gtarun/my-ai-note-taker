create table if not exists public.user_extraction_layer_save_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_token text not null,
  layer_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, request_token),
  unique (layer_id)
);

create index if not exists user_extraction_layer_save_requests_user_id_created_at_idx
  on public.user_extraction_layer_save_requests (user_id, created_at desc);

alter table public.user_extraction_layer_save_requests enable row level security;

create policy "Users can view their own extraction layer save requests"
on public.user_extraction_layer_save_requests
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can upsert their own extraction layer save requests"
on public.user_extraction_layer_save_requests
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
