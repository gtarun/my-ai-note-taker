# Local Models

## Goal

Support a real offline path without turning the app into a random model sandbox.

This repo uses a catalog-driven local model design:

- only curated compatible models are shown
- model choice is per-device
- model files stay local on the device
- `Local` is just another provider option in Settings

## Current Status

What is implemented now:

- `Local` can be selected as the transcription provider
- `Local` can be selected as the summary provider
- the app stores installed-model metadata in SQLite
- the app downloads model files into `documentDirectory/models`
- the app verifies file size and optional SHA-256
- the meeting pipeline already routes local jobs through `src/services/localInference.ts`
- summary chunking and JSON repair flow are scaffolded in JS

What still is not implemented:

- the native `MuFathomLocalAI` module
- actual `whisper.cpp` on-device transcription
- actual Gemma-family on-device summary runtime

Blunt version:

The local-model product flow is in place. The native inference engine is not.

## Model Types

Current starter catalog shape:

- transcription:
  - `whisper-base`
  - `whisper-small`
- summary:
  - `gemma-3n-e2b-preview`
  - `gemma-3n-e4b-preview`
  - `gemma-3-1b-it-q4`
  - `qwen2.5-1.5b-instruct-q8`

The built-in catalog is now meant to be useful on its own:

- some entries support direct download
- some official entries are source-only for now and need external setup or license acceptance
- custom `modelCatalogUrl` is optional, not required

## Where Things Live

- model files: app documents directory under `models/`
- install metadata: `installed_models` table
- provider selection: app settings storage
- remote provider API keys: Secure Store on native, localStorage on web

## How The Flow Works

1. User opens `Settings`
2. User optionally sets `Model catalog URL` if they want to override the built-in curated list
3. App loads the model catalog
4. App filters the catalog for the current device platform
5. User downloads a transcription model and a summary model
6. App stores the files locally and writes install metadata
7. User sets transcription and/or summary provider to `Local`
8. Meeting processing routes into the local inference bridge

If the native runtime is not linked, the app shows that local processing requires a custom build.

## Catalog Format

The app expects a JSON document shaped like this:

```json
{
  "models": [
    {
      "id": "whisper-base",
      "kind": "transcription",
      "engine": "whisper.cpp",
      "displayName": "Whisper Base",
      "version": "v1",
      "downloadUrl": "https://example.com/models/whisper-base.bin",
      "sourceUrl": "https://example.com/models/whisper-base",
      "sourceLabel": "View source",
      "requiresExternalSetup": false,
      "sha256": "optional-lowercase-sha256",
      "sizeBytes": 159383552,
      "platforms": ["ios", "android"],
      "minFreeSpaceBytes": 1073741824,
      "recommended": true,
      "experimental": false,
      "description": "Balanced local speech-to-text model."
    }
  ]
}
```

Rules:

- `kind` must be `transcription` or `summary`
- `engine` must be `whisper.cpp`, `mediapipe-llm`, or `litert-lm`
- `platforms` must contain `ios` and/or `android`
- only supported platforms are shown in the UI
- `downloadUrl` can be empty if the entry is source-only

## Runtime Assumptions

Planned runtime split:

- iOS summary: MediaPipe-compatible Gemma-family small model
- Android summary: LiteRT/MediaPipe-compatible Gemma-family small model
- transcription on both: `whisper.cpp`

JS already assumes:

- local transcription returns plain transcript text
- local summary returns JSON with `summary`, `actionItems`, `decisions`, and `followUps`
- long transcripts are chunked before the final combine pass

## Build Reality

Local inference is not an Expo Go feature.

To make this real, the project still needs:

- a custom dev build or release build
- the native `MuFathomLocalAI` module linked into the app
- actual platform runtime code for iOS and Android

Until then, the local-model UX is a real scaffold, not a fake promise.
