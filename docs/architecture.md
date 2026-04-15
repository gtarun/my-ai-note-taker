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
- Expo File System
- Expo Crypto
- Expo Secure Store
- Supabase Auth
- Supabase Edge Functions
- optional native local AI runtime boundary

## App Structure

### Routing

- `app/index.tsx`: meetings list and entry actions
- `app/account.tsx`: account signup/sign-in and Google Drive connect entry point
- `app/record.tsx`: manual recording flow
- `app/meetings/[id].tsx`: meeting detail and processing
- `app/settings.tsx`: provider setup, local model downloads, and model selection
- `app/_layout.tsx`: app shell and bootstrap

### Local Data

- [`src/db.ts`](../src/db.ts) initializes SQLite
- metadata is stored in the `meetings` table
- local model install metadata is stored in the `installed_models` table
- model files are stored under `documentDirectory/models`
- provider settings are stored in Secure Store on native and localStorage on web
- account sessions are stored locally through the Supabase auth client
- the `app_settings` table is legacy scaffold and is not part of the active settings flow

### Services

- [`src/services/bootstrap.ts`](../src/services/bootstrap.ts): creates the local audio directory and initializes storage
- [`src/services/meetings.ts`](../src/services/meetings.ts): meeting CRUD and processing flow
- [`src/services/ai.ts`](../src/services/ai.ts): transcription and summary API calls
- [`src/services/settings.ts`](../src/services/settings.ts): local settings persistence
- [`src/services/account.ts`](../src/services/account.ts): Supabase auth client and Google Drive edge-function contract
- [`src/services/googleDrive.ts`](../src/services/googleDrive.ts): Drive folder creation and recording upload flow
- [`src/services/providers.ts`](../src/services/providers.ts): provider catalog and defaults
- [`src/services/localModels.ts`](../src/services/localModels.ts): model catalog loading, download, checksum verification, and install/delete
- [`src/services/localInference.ts`](../src/services/localInference.ts): local transcription/summary bridge and transcript chunking
- `modules/mu-fathom-local-ai`: Expo local native module that exposes the runtime support / transcription / summary contract
- `supabase/functions/google-drive-connect-url`: Google OAuth start/callback handler
- `supabase/functions/google-drive-access-token`: returns a fresh Drive access token for the signed-in user
- `supabase/functions/google-drive-save-folder`: persists the user-picked Drive folder
- `supabase/functions/google-drive-folder-picker`: serves a signed Google Picker page and returns the chosen folder
- `supabase/migrations/20260405_create_google_drive_connections.sql`: token storage table for linked Drive accounts
- `supabase/migrations/20260405120000_add_drive_save_folder.sql`: chosen parent folder for Drive uploads
## Current Cloud Flow

1. Customer signs up or signs in through the backend API
2. Supabase Auth stores the user and returns a session token
3. User starts Google Drive connect from the app
4. `google-drive-connect-url` owns Google OAuth and stores Drive tokens server-side
5. User opens `google-drive-folder-picker` and chooses a parent Drive folder
6. `google-drive-save-folder` stores the chosen folder id and name in both the Drive table and auth metadata
7. When a new recording is saved locally, the app asks `google-drive-access-token` for a valid Drive token
8. The app uploads the recording into `{chosen-folder}/mu-fathom/recordings/YYYY-MM`

## Processing Flow

1. Audio file is saved into app storage
2. Meeting row is inserted into SQLite with status `local_only`
3. If Google Drive backup is connected and a save folder is set, the recording file is also copied to Drive
4. User triggers processing
5. App uploads audio to transcription API
6. Transcript is saved locally
7. App sends transcript to summary model
8. Summary JSON is saved locally
9. Meeting status becomes `ready`

## Current Local Model Flow

1. Settings loads a model catalog from `modelCatalogUrl` or falls back to the built-in starter catalog
2. The app filters catalog entries by the current device platform
3. When the user downloads a model, the file is stored in `documentDirectory/models`
4. The app verifies file size and optional SHA-256 before marking the model installed
5. Installed model metadata is saved into `installed_models`
6. If the user selects `Local` for transcription and/or summary, `src/services/meetings.ts` routes processing into `src/services/localInference.ts`
7. `localInference` calls the Expo native module named `MuFathomLocalAI`
8. If that module is not present, the app shows a clear missing-runtime state
9. If the module is present on iOS:
   - `whisper-base` transcription runs for real and returns plain transcript text
   - any other local transcription model fails clearly
   - local summary still fails clearly because it is unsupported on-device
10. On Android, the module remains a later-phase boundary-only contract
11. The app does not pretend offline summary works until a real on-device summary engine is wired in

## Local Runtime Plan

- transcription engine shape: `whisper.cpp` on iOS first, with `whisper-base` now real
- summary engine shape: Gemma-family small model through `mediapipe-llm` or `litert-lm` in a later slice
- transcript chunking is already scaffolded in JS
- the runtime boundary already exists
- local summary remains unsupported in the current phase
- Android stays on a later-phase boundary-only contract

## Current Limitations

- no background job system
- no full cloud sync for meeting metadata
- Google Drive backup currently runs only for freshly recorded audio, not imported files
- Drive upload failures are surfaced as alerts but not persisted as retryable job state
- no provider capability verification beyond local config
- imported file duration is not yet resolved
- Expo Go and web builds do not provide real local inference
- local summary is not available on-device yet
- iOS local transcription is limited to `whisper-base`
- Android project files are not currently checked in, so Android native verification still needs `npx expo prebuild -p android` or `npx expo run:android`
- the built-in local model catalog is only a starter shape; real downloads require hosted model files and a real catalog URL
- arbitrary local model import is intentionally not supported in v1

## Design Principle

Keep the code easy to debug.

For MVP, that means:

- thin services
- direct SQLite usage
- no custom backend
- no overbuilt abstraction layers
