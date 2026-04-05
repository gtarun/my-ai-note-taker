# mu-fathom

Open-source, mobile-first AI meeting companion for iOS and Android.

This is a local-first MVP built for one clean flow:

`record or import audio -> transcribe -> summarize -> share`

It is intentionally not a Fathom clone yet. No bots, no auto-join, no calendar magic.

## What It Does

- manual meeting recording on device
- audio file import
- post-meeting transcription with the user's own provider API key
- AI summary, action items, and decisions
- local SQLite storage on device
- native share/export from the meeting detail screen

## What It Does Not Do Yet

- automatic meeting capture
- Zoom / Google Meet / Teams internal audio capture
- real-time transcription
- team sync
- cloud backup
- CRM integrations
- customer auth and Google Drive sync backend

## Stack

- Expo + React Native + TypeScript
- Expo Router
- Expo SQLite
- Expo Audio
- Expo Document Picker
- Expo Secure Store
- OpenAI-compatible and direct provider APIs
- Supabase Auth + REST/Edge Function cloud scaffolding

## Project Structure

```text
app/                 Expo Router screens
src/db.ts            SQLite schema and mapping
src/services/        app services
src/types.ts         shared app types
src/utils/           formatting helpers
docs/                product and architecture docs
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the Expo dev server

```bash
npx expo start --lan --clear
```

Then open the app on a device using Expo Go.

## How To Use The App

### 1. Add your API key

- open `Settings`
- paste your OpenAI API key
- keep the default base URL unless you know you need a compatible endpoint

### 2. Create a meeting

You have two options:

- `New recording`: manually record audio from the phone mic
- `Import audio`: import an existing meeting recording file

### 3. Process the meeting

- open the saved meeting
- tap `Run transcript + summary`
- wait for transcription and summary generation to finish

### 4. Review and share

The meeting detail screen shows:

- summary
- action items
- decisions
- transcript

Use `Share` to export the result through the native share sheet.

## MVP Constraints

These are deliberate for speed:

- recording is manual
- processing is post-meeting only
- data is local-first
- audio is uploaded to the configured AI provider only when the user processes a meeting
- imported files do not yet calculate duration metadata
- customer auth and Google Drive storage need Supabase project credentials and function wiring

## Privacy Notes

- recordings and transcripts are stored locally on the device by default
- audio leaves the device only when the user runs transcription
- users are responsible for obtaining participant consent before recording

## Documentation

- [Docs Index](/Users/tarun/Documents/projects/my-ai-note-taker/docs/README.md)
- [Product Notes](/Users/tarun/Documents/projects/my-ai-note-taker/docs/product.md)
- [Architecture Notes](/Users/tarun/Documents/projects/my-ai-note-taker/docs/architecture.md)

## Next Suggested Work

- Supabase project config and Google Drive edge function
- better processing progress and retry UX
- optional cloud backup after the core flow is stable

## Supabase Drive Setup

To finish Google Drive connect, deploy the Supabase function and migration in `supabase/` and set these function secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_STATE_SECRET`
- optional: `GOOGLE_DRIVE_SCOPE`
- optional: `GOOGLE_DRIVE_REDIRECT_URI`
