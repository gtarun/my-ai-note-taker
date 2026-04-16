# Supabase Hybrid User Data Design

## Summary

This design keeps meetings local-first while making Supabase the source of truth for account, profile, integration, and cross-device configuration data.

The intended boundary is:

- Supabase stores user identity, profile, unified Google integration state, synced provider settings, and synced extraction layers
- local SQLite continues to store meetings and meeting processing state first
- meetings can gain optional cloud sync later as a separate subsystem

This gives the product a scalable account model without forcing the app into a cloud-first meeting architecture too early.

## Current State

## What Supabase stores today

Supabase currently stores:

- `auth.users` identity records
- `public.google_drive_connections`
  - Google account email
  - access token
  - refresh token
  - token metadata
  - chosen Drive save folder id/name

Some Google Drive state is also duplicated into `auth.user_metadata`.

## What is still local-only

The following still live in SQLite today:

- app preferences
- provider settings, including API keys
- extraction layers
- extraction layer fields
- meetings
- meeting extraction/sync state
- installed model state

This means Supabase is currently too thin to support scalable multi-device user setup.

## Goals

- Keep meetings local-first
- Make account/profile/integration data cloud-backed
- Sync provider settings and extraction layers across user devices automatically
- Support unified Google connect once for Drive folder selection and Sheets usage
- Allow provider API keys to sync securely
- Create a clean schema that can support future optional meeting sync

## Non-Goals

- Move meetings to cloud-first storage now
- Build meeting sync in this phase
- Redesign local model installation sync in this phase
- Fully generalize every possible third-party integration before current needs exist

## Core Data Boundary

## Cloud source of truth

Supabase becomes the source of truth for:

- user profile
- user preferences
- provider configuration
- provider secrets
- unified Google integration state
- extraction layers
- extraction layer fields

## Local-first source of truth

SQLite remains the source of truth for:

- meetings
- transcripts
- summaries
- extraction results attached to meetings
- local model downloads and local runtime state
- future offline-first meeting edits before sync

## Local cache role

SQLite may still keep local copies of synced cloud settings for:

- fast startup
- offline access
- optimistic UI

But these copies become caches or mirrors, not canonical storage, for the synced user-owned configuration data.

## Unified Google Integration

Google must be modeled as one integration, not separate Drive and Sheets connections.

The user connects Google once, and that single token set grants access for:

- Drive folder picking
- Drive recording upload
- spreadsheet search
- spreadsheet tab listing
- header import from sheet
- Google Sheets append/update behavior

After the unified Google connect:

- the user may choose a Drive folder for recording uploads
- the user may choose spreadsheets and tabs inside Layers without a second auth flow

The app must not present separate "Connect Drive" and "Connect Sheets" account concepts.

If required Google scope is missing later, the app should ask the user to reconnect Google once.

## Proposed Schema

## `public.profiles`

Purpose: stable user profile data that should not live in `auth.user_metadata`.

Suggested columns:

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `display_name text`
- `avatar_url text`
- `timezone text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

## `public.user_preferences`

Purpose: one synced preferences row per user.

Suggested columns:

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `selected_transcription_provider text not null`
- `selected_summary_provider text not null`
- `delete_uploaded_audio boolean not null default false`
- `model_catalog_url text not null default ''`
- `has_seen_onboarding boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

## `public.user_provider_configs`

Purpose: one config row per user and provider.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `provider_id text not null`
- `base_url text not null default ''`
- `transcription_model text not null default ''`
- `summary_model text not null default ''`
- `encrypted_api_key text`
- `key_version integer not null default 1`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- unique `(user_id, provider_id)`

## `public.user_integrations`

Purpose: generic integration storage, with Google as the first implementation.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `provider text not null`
- `status text not null`
- `account_email text`
- `granted_scopes text[] not null default '{}'`
- `encrypted_access_token text`
- `encrypted_refresh_token text`
- `token_expires_at timestamptz`
- `needs_reconnect boolean not null default false`
- `drive_save_folder_id text`
- `drive_save_folder_name text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- unique `(user_id, provider)`

In this phase, `provider = 'google'` is the main use case.

## `public.user_extraction_layers`

Purpose: synced extraction layer headers per user.

Suggested columns:

- `id uuid primary key`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `name text not null`
- `spreadsheet_id text`
- `spreadsheet_title text`
- `sheet_title text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

## `public.user_extraction_layer_fields`

Purpose: synced field rows for each layer.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `layer_id uuid not null references public.user_extraction_layers(id) on delete cascade`
- `field_id text not null`
- `title text not null`
- `description text not null default ''`
- `position integer not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- unique `(layer_id, field_id)`

## Security Model

## Provider key security

Provider API keys must not be stored as plain text columns that the client reads directly.

Recommended model:

- encrypt provider keys in an Edge Function before writing to the database
- decrypt only in server-side code paths that truly need the raw key
- keep encryption keys in server-side environment secrets, not client config
- use a `key_version` column to support future key rotation

This means:

- RLS protects record ownership
- encryption protects the secret contents even if table reads are misconfigured later

## Token security

Google OAuth tokens should follow the same rule:

- store encrypted token material in `user_integrations`
- keep auth/session hints out of `auth.user_metadata` except where minimal convenience is needed

## Access pattern

For secrets and tokens, prefer function-mediated reads/writes:

- client writes through authenticated Edge Functions
- client does not directly upsert encrypted secret rows
- server-side code validates ownership and applies encryption/decryption

## RLS And Ownership

All user-owned tables should enforce user ownership with RLS:

- authenticated users can read and update only their own rows
- service role may manage rows where operationally required

Core indexes:

- `profiles(user_id)` via primary key
- `user_preferences(user_id)` via primary key
- `user_provider_configs(user_id, provider_id)` unique index
- `user_integrations(user_id, provider)` unique index
- `user_extraction_layers(user_id, updated_at desc)`
- `user_extraction_layer_fields(layer_id, position)`

## Migration Direction

## Phase 1: Add scalable user tables

Add:

- `profiles`
- `user_preferences`
- `user_provider_configs`
- `user_integrations`
- `user_extraction_layers`
- `user_extraction_layer_fields`

Add Edge Functions for:

- reading/writing preferences
- reading/writing provider configs securely
- reading/writing extraction layers
- managing unified Google integration state securely

## Phase 2: App sync adoption

Update the app so:

- preferences load from Supabase when signed in
- provider configs load from Supabase when signed in
- extraction layers load from Supabase when signed in
- local SQLite copies act as cache/mirror if desired

Offline behavior:

- if no network, use cached local copy
- when network returns, reconcile from cloud source of truth

## Phase 3: Replace old Google table shape

Current `google_drive_connections` can be:

- temporarily preserved during migration
- then folded into `user_integrations`

Recommended path:

1. backfill `user_integrations(provider='google')` from `google_drive_connections`
2. switch functions to read/write `user_integrations`
3. remove dependency on `auth.user_metadata` as primary storage
4. retire `google_drive_connections` after cutover

## Future Meeting Sync

Meetings should remain outside this migration.

When optional meeting sync is designed later, it should be treated as a separate subsystem with:

- cloud meeting identity
- local/cloud mapping
- sync status
- last synced at
- conflict strategy
- selective sync behavior

Possible future table:

- `meeting_sync_state`

But this design intentionally does not define the full meeting sync model yet.

## Why This Scales Better

- clean separation between cloud account data and local-first content data
- avoids overloading `auth.user_metadata`
- supports multi-device setup immediately
- supports secure cloud-backed API key sync
- keeps Google integration unified for the user
- leaves room for future optional meeting sync without needing to undo today’s structure

## Open Decisions Resolved

- meetings remain local-first
- meetings may gain optional sync later
- extraction layers sync automatically across devices
- provider settings sync automatically across devices
- provider API keys may sync, but must be secured with server-side encryption
- Google login, Drive folder selection, and Sheets access use one unified Google integration
