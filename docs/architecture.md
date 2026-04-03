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

## App Structure

### Routing

- `app/index.tsx`: meetings list and entry actions
- `app/record.tsx`: manual recording flow
- `app/meetings/[id].tsx`: meeting detail and processing
- `app/settings.tsx`: API key and model settings
- `app/_layout.tsx`: app shell and bootstrap

### Local Data

- [`src/db.ts`](/Users/tarun/Documents/projects/mu-fathom/src/db.ts) initializes SQLite
- metadata is stored in the `meetings` table
- app config is stored in the `app_settings` table
- API keys are stored in Secure Store, not SQLite

### Services

- [`src/services/bootstrap.ts`](/Users/tarun/Documents/projects/mu-fathom/src/services/bootstrap.ts): creates the local audio directory and initializes storage
- [`src/services/meetings.ts`](/Users/tarun/Documents/projects/mu-fathom/src/services/meetings.ts): meeting CRUD and processing flow
- [`src/services/openai.ts`](/Users/tarun/Documents/projects/mu-fathom/src/services/openai.ts): transcription and summary API calls
- [`src/services/settings.ts`](/Users/tarun/Documents/projects/mu-fathom/src/services/settings.ts): local settings persistence

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
- no auth
- no provider abstraction beyond OpenAI-compatible settings
- no delete flow yet
- imported file duration is not yet resolved

## Design Principle

Keep the code easy to debug.

For MVP, that means:

- thin services
- direct SQLite usage
- no custom backend
- no overbuilt abstraction layers
