# Native Local Runtime Design

## Goal

Keep the existing local-model scaffold honest while making iOS transcription with `whisper.cpp` the first planned real engine slice.

The runtime boundary already exists. The first planned real engine slice is iOS transcription with `whisper.cpp`, and Android stays on a later-phase boundary-only contract.

## What This Phase Includes

- add a real Expo local module named `MuFathomLocalAI`
- make the JS local inference bridge talk to that module instead of only handling a missing-module case
- return real device/runtime support information from native code
- support iOS as the first planned platform for real local transcription availability
- keep Android on a later-phase path with a clear boundary-only contract
- keep the rest of the app contract stable:
  - `getDeviceSupport()`
  - `transcribe({ audioUri, modelId })`
  - `summarize({ prompt, modelId })`

## What This Phase Does Not Include

- real Gemma-family summary inference yet
- Android local engine bring-up
- arbitrary user-imported model files
- background inference
- real-time transcription

This is the runtime-foundation phase, not the full offline-processing phase.

## Product Behavior

### iOS

- the app includes a real local native module boundary
- `getLocalDeviceSupport()` still returns the checked-in not-enabled contract until transcription lands
- transcription calls will reach native code once the iOS implementation is added
- summary calls remain clearly unsupported in this phase

### Android

- the app keeps the same Expo module surface for consistency
- `getLocalDeviceSupport()` reports that Android is not the first real-engine slice in this phase
- transcription/summary calls stay on a later-phase contract with a clear reason string

### Web / Expo Go

- existing safe fallback behavior remains
- no false local-runtime promise

## Architecture

### JS Layer

Existing JS should stay thin:

- [`src/services/localInference.ts`](/Users/tarun/Documents/projects/mu-fathom/src/services/localInference.ts) remains the public bridge used by the meeting pipeline
- it continues to own transcript chunking and summary JSON repair prompts
- it should only depend on the native module contract, not platform-specific implementation details

### Native Layer

Add a local Expo module under `modules/mu-fathom-local-ai/` with:

- `expo-module.config.json`
- iOS implementation
- Android implementation for the later boundary-only slice
- module package metadata so Expo autolinking can pick it up from `./modules`

Native contract:

- `getDeviceSupport(): Promise<LocalDeviceSupport>`
- `transcribe({ audioUri, modelId }): Promise<string>`
- `summarize({ prompt, modelId }): Promise<string>`

## iOS-First Transcription Contract

Phase 2 should make iOS the first planned platform that can honestly say:

- this build contains the local runtime module
- the runtime layer is reachable from JS
- local transcription is available in this build once implemented

The iOS implementation should return:

- `platform: "ios"`
- `localProcessingAvailable: true`
- `supportsSummary: false`
- `supportsTranscription: true`
- `requiresCustomBuild: true`
- a reason string explaining that iOS local transcription is available in this build once implemented

Android stays on the same module surface, but it is not the first real engine slice.

## Build / Repo Shape

### New files

- `modules/mu-fathom-local-ai/...`

### Existing files to update

- [`src/services/localInference.ts`](/Users/tarun/Documents/projects/mu-fathom/src/services/localInference.ts)
- [`docs/local-models.md`](/Users/tarun/Documents/projects/mu-fathom/docs/local-models.md)
- [`docs/architecture.md`](/Users/tarun/Documents/projects/mu-fathom/docs/architecture.md)
- [`docs/running-locally.md`](/Users/tarun/Documents/projects/mu-fathom/docs/running-locally.md)
- optionally [`app.json`](/Users/tarun/Documents/projects/mu-fathom/app.json) only if the module/plugin setup requires it

## Error Handling

The app should surface three different cases clearly:

1. no native module in this build
2. module present, but this platform is not enabled yet
3. module present, platform enabled, but inference engine is not wired yet

Those are different developer states and should not collapse into the same generic error.

## Acceptance Criteria

- repo contains a real autolinkable Expo local module named `MuFathomLocalAI`
- `src/services/localInference.ts` resolves that module cleanly
- iOS can report module presence and a real support payload
- Android compiles with the same module and stays on a later-phase contract
- Expo export and TypeScript still pass
- docs explain that this is the runtime-foundation phase, not full offline inference yet
