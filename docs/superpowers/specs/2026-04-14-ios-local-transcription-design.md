# iOS Local Transcription Design

## Goal

Make one real offline path work on the device we can actually test: iPhone.

This phase adds real on-device transcription on iOS using `whisper.cpp`, wired through the existing `MuFathomLocalAI` Expo module. The scope stays intentionally narrow:

- iOS only
- transcription only
- one supported model: `whisper-base`
- foreground-only
- no local summary yet

The point of this phase is not to build a full local-AI platform. The point is to make one honest offline success path work end-to-end.

## Why We Are Pivoting

The previous runtime-foundation work was Android-first because Android is the easier place to grow local runtimes over time.

That is not the right next step if the available test device is an iPhone.

So the next practical move is:

- keep the runtime boundary we already added
- switch the first real engine integration to iOS
- make local transcription actually work on the phone in hand

This is the fastest path to a real product win instead of speculative native plumbing.

## What This Phase Includes

- keep using the existing Expo local module `MuFathomLocalAI`
- change iOS from “not enabled yet” to real local transcription support
- integrate `whisper.cpp` into the iOS native build
- support exactly one local transcription model: `whisper-base`
- make `transcribe({ audioUri, modelId })` return real transcript text on iOS
- keep the JavaScript processing pipeline stable
- keep local summary explicitly unsupported in this phase
- keep web and Expo Go behavior honest

## What This Phase Does Not Include

- Android local transcription
- local summary or Gemma-family inference
- multiple local STT models
- arbitrary model import
- background transcription
- real-time transcription
- model sync across devices

If a requirement does not help us prove “iPhone can transcribe one meeting offline with one model,” it is out of scope.

## Product Behavior

### iOS custom build

If the app is running as a custom build or release build with the native module linked:

- `getLocalDeviceSupport()` reports:
  - `platform: "ios"`
  - `localProcessingAvailable: true`
  - `supportsTranscription: true`
  - `supportsSummary: false`
  - `requiresCustomBuild: true`
- local transcription works when the selected model is `whisper-base`
- local summary still fails clearly as unsupported

### Expo Go / web

- no false promise
- the app continues to say local runtime needs a custom build

### Unsupported model selection

If the user selects any local transcription model other than `whisper-base`, the app should fail clearly with an explicit message that only `whisper-base` is wired in this phase.

This is better than pretending the catalog’s full future shape already works.

## Architecture

### JavaScript layer

The JS layer stays thin:

- [`src/services/localInference.ts`](/Users/tarun/Documents/projects/mu-fathom/src/services/localInference.ts) remains the bridge the meeting pipeline uses
- [`src/services/ai.ts`](/Users/tarun/Documents/projects/mu-fathom/src/services/ai.ts) should not learn anything about `whisper.cpp`
- existing meeting processing flow should remain intact

JS responsibilities:

- call `MuFathomLocalAI.transcribe({ audioUri, modelId })`
- surface support/error state cleanly
- continue storing transcript and post-processing it as today

### Native iOS layer

The iOS Expo module becomes real for transcription:

- [`modules/mu-fathom-local-ai/ios/MuFathomLocalAIModule.swift`](/Users/tarun/Documents/projects/mu-fathom/modules/mu-fathom-local-ai/ios/MuFathomLocalAIModule.swift)
- supporting native wrapper files under [`modules/mu-fathom-local-ai/ios`](/Users/tarun/Documents/projects/mu-fathom/modules/mu-fathom-local-ai/ios)

Native responsibilities:

- validate `audioUri`
- validate `modelId`
- reject unsupported model ids
- resolve the installed model file path
- normalize the audio into a `whisper.cpp`-compatible format
- run `whisper.cpp`
- return plain transcript text

Engine-specific logic stays native. JS should only see a stable contract.

## Build Shape

### iOS project

We already have a checked-in [`ios/`](/Users/tarun/Documents/projects/mu-fathom/ios) project, so this phase should use it directly.

### Native dependency strategy

Use the smallest integration path that keeps the repo understandable:

- vendor `whisper.cpp` as a native dependency inside the module or a dedicated vendor folder
- link it through the module podspec
- avoid introducing a second native packaging system if CocoaPods can handle it

The integration should optimize for repeatable local builds, not elegance.

## Audio Pipeline

The app already records audio, but `whisper.cpp` wants predictable input.

The iOS transcription path should:

1. load the source meeting audio from `audioUri`
2. convert or export it to `16 kHz`, mono, PCM WAV
3. feed that normalized audio into `whisper.cpp`
4. collect transcript segments
5. return one combined transcript string to JS

If normalization fails, return a clear error. Do not attempt silent fallbacks.

## Model Handling

The app already stores installed-model metadata and downloaded files.

For this phase:

- only `whisper-base` is supported by the iOS runtime
- native code should verify that the requested model id is `whisper-base`
- native code should verify that the installed model file exists
- missing or incompatible model files should return a clear user-facing error

We should not broaden catalog promises yet. The app can still list future catalog entries, but the native runtime should be strict about what it actually supports.

## Error Handling

The app should distinguish these cases clearly:

1. no native module in this build
2. iOS custom build exists, but local transcription engine is unavailable
3. requested model is unsupported in this phase
4. selected model is missing on disk
5. audio normalization failed
6. transcription engine returned empty output

These errors should not collapse into one generic “local failed” message.

## Testing

### Core flow

On a real iPhone:

1. install `whisper-base`
2. set transcription provider to `Local`
3. keep summary on a remote provider or disabled
4. enable airplane mode
5. process a recorded meeting
6. verify transcript is produced locally

### Failure checks

- select a non-`whisper-base` local STT model and verify clear failure
- delete the installed model and verify clear failure
- use a broken or unsupported audio input and verify clear failure

### Build checks

- iOS custom build compiles
- JS tests still pass
- TypeScript still passes
- Expo export still passes

## Acceptance Criteria

- iOS `MuFathomLocalAI.getDeviceSupport()` reports local transcription available
- iOS `MuFathomLocalAI.transcribe(...)` returns real transcript text for `whisper-base`
- the meeting pipeline can produce a transcript fully offline on iPhone
- local summary remains explicitly unsupported
- unsupported model ids fail clearly
- docs explain that iOS transcription is the first real local engine, not full local AI
