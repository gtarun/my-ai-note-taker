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
- catalog-driven local model management for future offline processing
- optional Google Drive backup for recordings after Google sign-in + Drive connect
- native share/export from the meeting detail screen

## What It Does Not Do Yet

- automatic meeting capture
- Zoom / Google Meet / Teams internal audio capture
- real-time transcription
- actual on-device transcription and summary in Expo Go
- team sync
- CRM integrations
- full multi-device sync

## Stack

- Expo + React Native + TypeScript
- Expo Router
- Expo SQLite
- Expo Audio
- Expo Document Picker
- Expo File System
- Expo Secure Store
- OpenAI-compatible and direct provider APIs
- optional native local AI runtime boundary
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

### 1. Choose your processing path

The app currently has two modes:

- remote provider mode: works today in Expo Go with API keys
- local model mode: settings/UI/catalog are implemented, but real on-device inference still needs a custom native build with the local runtime linked

### 2. Configure a provider

For remote providers:

- open `Settings`
- configure one or more providers
- select which configured provider should handle transcription and summary

For local models:

- build a custom dev or release app that includes the native local runtime
- set `Model catalog URL` in `Settings` if you are hosting your own catalog
- download compatible transcription and summary models
- switch both provider selectors to `Local`

### 3. Create a meeting

You have two options:

- `New recording`: manually record audio from the phone mic
- `Import audio`: import an existing meeting recording file

### 4. Process the meeting

- open the saved meeting
- tap `Run transcript + summary`
- wait for transcription and summary generation to finish

### 5. Review and share

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
- local model catalog and install state exist now, but the native offline runtime is still a custom-build feature
- Google Drive backup is optional and only uploads the saved recording file
- imported files do not yet calculate duration metadata
- Google Drive backup needs Google Cloud + Supabase setup before it works

## Privacy Notes

- recordings and transcripts are stored locally on the device by default
- audio leaves the device only when the user runs transcription
- if Google Drive backup is connected, new recordings can also be copied into the user's chosen Drive folder
- users are responsible for obtaining participant consent before recording

## Documentation

- [Docs Index](/Users/tarun/Documents/projects/mu-fathom/docs/README.md)
- [Product Notes](/Users/tarun/Documents/projects/mu-fathom/docs/product.md)
- [Architecture Notes](/Users/tarun/Documents/projects/mu-fathom/docs/architecture.md)
- [Local Models](/Users/tarun/Documents/projects/mu-fathom/docs/local-models.md)

## Next Suggested Work

- native `MuFathomLocalAI` runtime for real on-device transcription and summary
- better processing progress and retry UX
- Drive upload status/history in the meeting detail screen
- imported-file backup to Google Drive
- optional metadata sync beyond file backup

## Supabase Drive Setup

The app now supports:

- Google sign-in through Supabase Auth
- connecting a Google Drive account
- choosing a parent Drive folder with Google Picker
- uploading new recordings under `mu-fathom/recordings/YYYY-MM`

### Google Cloud

Use one Google Cloud project for OAuth, Drive API, and Picker API.

1. Enable:
   - `Google Drive API`
   - `Google Picker API`
2. Create a Web OAuth client.
3. Add this authorized redirect URI:
   - `https://ulgbdlhwjwsyflzfdhma.supabase.co/functions/v1/google-drive-connect-url`
4. Create a browser API key for Google Picker.
   - HTTP referrer restrictions are fine.
   - If you restrict it, allow your Supabase function origin.
5. Copy the numeric Google Cloud project number.
   - This becomes `GOOGLE_PICKER_APP_ID`.

### Supabase Secrets

Set these Edge Function secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_STATE_SECRET`
- `GOOGLE_PICKER_DEVELOPER_KEY`
- `GOOGLE_PICKER_APP_ID`
- optional: `GOOGLE_DRIVE_SCOPE`
- optional: `GOOGLE_DRIVE_REDIRECT_URI`

If you override `GOOGLE_DRIVE_SCOPE`, it must still include:

- `openid`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/drive.file`

### Deploy

Run the database migration(s) and deploy these functions:

- `google-drive-connect-url`
- `google-drive-access-token`
- `google-drive-save-folder`
- `google-drive-folder-picker`

`google-drive-connect-url` now preserves existing `driveConnection` fields on reconnect so it does not wipe `saveFolderId` / `saveFolderName`.
