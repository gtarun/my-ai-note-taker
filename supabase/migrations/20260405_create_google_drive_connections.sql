create table if not exists public.google_drive_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_account_email text not null,
  access_token text not null,
  refresh_token text,
  token_type text,
  scope text,
  expiry_date timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.google_drive_connections enable row level security;

create policy "Users can view their own google drive connection"
on public.google_drive_connections
for select
to authenticated
using (auth.uid() = user_id);

create policy "Service role manages google drive connections"
on public.google_drive_connections
for all
to service_role
using (true)
with check (true);
