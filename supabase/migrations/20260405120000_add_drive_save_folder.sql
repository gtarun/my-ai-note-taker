alter table public.google_drive_connections
  add column if not exists save_folder_id text,
  add column if not exists save_folder_name text;
