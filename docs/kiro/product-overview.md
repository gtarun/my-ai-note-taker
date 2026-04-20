# Product Overview

## What Is It

AI Notes by Masters' Union is a local-first, mobile-first AI meeting companion for iOS and Android. Built with Expo + React Native + TypeScript.

App name: "AI Notes"
Internal codename: mu-fathom
URL scheme: mufathom

## Core Flow

```
record or import audio → transcribe → summarize → share
```

1. User records a meeting on-device or imports an audio file
2. Audio is stored locally in app storage (SQLite metadata + file system)
3. User manually triggers transcription (post-meeting, not real-time)
4. AI generates: summary, action items, decisions, follow-ups
5. User reviews on the meeting detail screen and shares via native share sheet

## Target Users

Solo builders, indie hackers, consultants, operators — anyone who wants a simple transcript + summary workflow without enterprise overhead.

## MVP Scope (what ships)

- Manual audio recording (with background recording on native builds)
- Audio file import via document picker
- Post-meeting transcription via remote AI providers (or local whisper-base on iOS native builds)
- AI-generated summary, action items, decisions
- Transcript view
- Local SQLite storage on device
- Native share/export
- Guided offline-mode setup with local model bundle progress
- Optional Google Drive backup for recordings (after Google sign-in + Drive connect)
- Extraction layers: user-defined structured data extraction from transcripts, with optional Google Sheets sync
- Supabase Auth for account management
- Cloud sync of settings, providers, and extraction layers when signed in

## Explicit Non-Goals (for MVP)

- Auto-joining calls / calendar integrations
- Zoom / Meet / Teams internal audio capture
- Real-time transcription
- Team collaboration / enterprise permissions
- CRM integrations
- Search across all meetings
- Full multi-device sync of meeting data

## Product Principle

If a feature makes the app harder to ship in a week, it's out of scope for MVP.

## Store Positioning

"A manual meeting recorder and import tool that turns audio into transcript and action items."

NOT: stealth recorder, automatic Zoom recorder, background call capture tool.
