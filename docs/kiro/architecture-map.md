# Architecture Map

## Stack

- Expo SDK 54 + React Native 0.81 + TypeScript 5.9
- Expo Router 6 (file-based routing)
- Expo SQLite (local persistence)
- Expo Audio (recording with background support)
- Expo Document Picker (audio import)
- Expo File System (audio file storage)
- Expo Secure Store (API keys on native, localStorage on web)
- Supabase Auth + Edge Functions (cloud layer)
- Zustand (state management)
- Zod + react-hook-form (form validation)
- Vitest (unit testing, node environment)
- Custom Expo native module: MuFathomLocalAI (whisper.cpp on iOS)

## Folder Layout

```
app/                    Expo Router screens (file-based routing)
  _layout.tsx           Root layout — bootstrap, fonts, onboarding gate
  (tabs)/               Tab navigator
    _layout.tsx         Tab bar config
    index.tsx           → MeetingsScreen (dashboard)
    record.tsx          → RecordScreen
    settings.tsx        → SettingsScreen
    layers.tsx          → LayersScreen
  meetings/[id].tsx     Meeting detail + processing
  onboarding.tsx        First-run onboarding flow
  account.tsx           Sign-in/up + Google Drive connect
  layers.tsx            Layer management (standalone route)

src/
  types.ts              All shared TypeScript types
  theme.ts              Design tokens (palette, typography, radii, elevation)
  db.ts                 Platform-split SQLite entry (→ db.native.ts / db.web.ts)
  startup.ts            Startup presentation logic
  onboarding/model.ts   Onboarding state machine

  components/           Shared UI components
    ui/                 Design system primitives
      EditorialHero     Hero section component
      PillButton        Pill-shaped action button
      SectionHeading    Section title
      StatusChip        Status badge
      SurfaceCard       Card container
    FadeInView          Animated fade wrapper
    KeyboardAwareScrollView
    ProfileAvatarButton
    ScreenBackground    Ambient gradient background

  features/             Feature-level presentation logic (pure functions + tests)
    account/            Account presentation
    dashboard/          Dashboard/meetings list presentation
    layers/             Extraction layer draft + presentation
    meetings/           Meeting detail + navigation presentation
    onboarding/         Onboarding presentation
    recording/          Recording session presentation
    settings/           Settings presentation

  screens/              Screen components (thin, delegate to features/)
    MeetingsScreen
    RecordScreen
    SettingsScreen
    LayersScreen

  services/             App services (side effects, I/O)
    bootstrap.ts        App init, audio directory creation
    meetings.ts         Meeting CRUD, processing pipeline
    ai.ts               Transcription + summary API calls (multi-provider)
    settings.ts         Settings persistence (local + cloud)
    account.ts          Supabase auth client
    providers.ts        Provider catalog + defaults
    localModels.ts      Model catalog, download, checksum, install
    localInference.ts   Local transcription/summary bridge
    googleDrive.ts      Drive folder creation + upload
    googleSheets.ts     Sheets integration for extraction layers
    cloudUserData.ts    Cloud sync for settings/layers
    extractionLayers.ts Extraction layer CRUD (local + cloud)
    onboarding.ts       Onboarding state persistence
    offlineSetupSession.ts  Offline model setup session management
    recordingSession.ts Recording state machine
    recordingAudioMode.ts   Audio mode configuration

  utils/
    format.ts           Formatting helpers
    sha256.ts           SHA-256 for model verification

  navigation/
    routes.ts           Route constants
    tabs.ts             Tab configuration

modules/
  mu-fathom-local-ai/   Expo native module
    ios/                Swift + ObjC++ (WhisperRuntime, AudioNormalizer, WhisperBridge)
    android/            Boundary-only (later phase)
    src/                TS types + module interface
    vendor/whisper.cpp  Vendored whisper.cpp

supabase/
  functions/            Edge Functions
    _shared/            Shared utilities (secrets, auth, Drive/Sheets helpers)
    google-drive-*      Drive OAuth, token, folder picker, save
    google-sheets-*     Sheets integration functions
    user-data-bootstrap Cloud user data init
    user-settings-sync  Settings sync
    user-extraction-layers-sync  Layer sync
  migrations/           SQL migrations
```

## Data Flow

### Local Storage
- Meeting metadata → SQLite `meetings` table
- Installed model metadata → SQLite `installed_models` table
- Extraction layers → SQLite `extraction_layers` + `extraction_layer_fields` tables
- Audio files → `documentDirectory/audio/`
- Model files → `documentDirectory/models/`
- Provider API keys → Expo Secure Store (native) / localStorage (web)
- App settings → cloud-first when signed in, local cache fallback

### Processing Pipeline
1. Audio saved to app storage → meeting row inserted as `local_only`
2. Optional Drive backup if connected
3. User triggers processing → status becomes `transcribing` / `transcribing_local`
4. Audio sent to transcription provider (remote API or local whisper)
5. Transcript saved → status becomes `summarizing` / `summarizing_local`
6. Transcript sent to summary provider
7. Summary JSON saved → status becomes `ready`
8. Optional extraction layer processing → structured data extracted from transcript
9. Optional Sheets sync → extracted data appended to Google Sheet

### Cloud Layer (optional, requires Supabase Auth)
- User signs in → session stored via Supabase client
- Settings, providers, layers sync to cloud
- Google Drive connect → OAuth via Edge Function → tokens stored server-side
- Drive backup → app gets fresh token → uploads recording to chosen folder
- Sheets sync → Edge Function ensures sheet exists → app appends extracted row
