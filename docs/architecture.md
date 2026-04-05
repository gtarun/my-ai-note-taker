# Architecture Notes

## Goal

Use the simplest architecture that works for a solo builder shipping fast.

## Current Stack

- Expo
- React Native
- TypeScript
- Expo Router
- Expo SQLite
- Expo Audio
- Expo Document Picker
- Expo Secure Store
- Supabase Auth

## App Structure

### Routing

- `app/index.tsx`: meetings list and entry actions
- `app/account.tsx`: account signup/sign-in and Google Drive connect entry point
- `app/record.tsx`: manual recording flow
- `app/meetings/[id].tsx`: meeting detail and processing
- `app/settings.tsx`: API key and model settings
- `app/_layout.tsx`: app shell and bootstrap

### Local Data

- [`src/db.ts`](/Users/tarun/Documents/projects/my-ai-note-taker/src/db.ts) initializes SQLite
- metadata is stored in the `meetings` table
- provider settings are stored in Secure Store on native and localStorage on web
- account sessions are stored locally through the Supabase auth client
- the `app_settings` table is legacy scaffold and is not part of the active settings flow

### Services

- [`src/services/bootstrap.ts`](/Users/tarun/Documents/projects/my-ai-note-taker/src/services/bootstrap.ts): creates the local audio directory and initializes storage
- [`src/services/meetings.ts`](/Users/tarun/Documents/projects/my-ai-note-taker/src/services/meetings.ts): meeting CRUD and processing flow
- [`src/services/ai.ts`](/Users/tarun/Documents/projects/my-ai-note-taker/src/services/ai.ts): transcription and summary API calls
- [`src/services/settings.ts`](/Users/tarun/Documents/projects/my-ai-note-taker/src/services/settings.ts): local settings persistence
- [`src/services/account.ts`](/Users/tarun/Documents/projects/my-ai-note-taker/src/services/account.ts): Supabase auth client and Google Drive edge-function contract
- [`src/services/providers.ts`](/Users/tarun/Documents/projects/my-ai-note-taker/src/services/providers.ts): provider catalog and defaults
- `supabase/functions/google-drive-connect-url`: Google OAuth start/callback handler
- `supabase/migrations/20260405_create_google_drive_connections.sql`: token storage table for linked Drive accounts

## Planned Cloud Flow

1. Customer signs up or signs in through the backend API
2. Supabase Auth stores the user and returns a session token
3. User starts Google Drive connect from the app
4. A Supabase Edge Function or REST endpoint owns Google OAuth and stores tokens server-side
5. App stores meeting metadata locally and later syncs files/metadata through authenticated Supabase-backed calls

## Processing Flow

1. Audio file is saved into app storage
2. Meeting row is inserted into SQLite with status `local_only`
3. User triggers processing
4. App uploads audio to transcription API
5. Transcript is saved locally
6. App sends transcript to summary model
7. Summary JSON is saved locally
8. Meeting status becomes `ready`

## Current Limitations

- no background job system
- no cloud sync
- Google Drive server-side integration is not implemented yet
- no provider capability verification beyond local config
- imported file duration is not yet resolved

## Design Principle

Keep the code easy to debug.

For MVP, that means:

- thin services
- direct SQLite usage
- no custom backend
- no overbuilt abstraction layers
