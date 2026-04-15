# iOS Local Transcription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `MuFathomLocalAI.transcribe(...)` perform real offline transcription on iOS for the `whisper-base` model while keeping summary local support disabled.

**Architecture:** Keep the JavaScript processing flow stable and push all engine-specific work into the iOS Expo module. The runtime boundary already exists. This phase makes iOS transcription with `whisper.cpp` the first planned real engine slice by normalizing meeting audio to whisper-compatible WAV, resolving the installed `whisper-base` model file, running transcription natively, and returning plain transcript text to the existing JS pipeline.

**Tech Stack:** Expo Modules API, Swift, Objective-C++, CocoaPods, `whisper.cpp`, Expo File System paths, Vitest, TypeScript, Xcode build verification

---

### Task 1: Re-scope docs and support contract to iOS-first transcription

**Files:**
- Modify: `docs/superpowers/specs/2026-04-14-native-local-runtime-design.md`
- Modify: `docs/superpowers/plans/2026-04-14-native-local-runtime.md`
- Create: `docs/superpowers/plans/2026-04-14-ios-local-transcription.md`
- Modify: `docs/local-models.md`
- Modify: `docs/architecture.md`
- Modify: `docs/running-locally.md`
- Test: `src/services/localInference.test.ts`

- [ ] **Step 1: Update the local inference test with the new iOS support contract**

```ts
it('passes through iOS local transcription support when the native module is available', async () => {
  const localInference = await loadLocalInferenceForPlatform('ios', {
    getDeviceSupport: vi.fn(async () => ({
      localProcessingAvailable: true,
      supportsSummary: false,
      supportsTranscription: true,
      requiresCustomBuild: true,
      reason: 'iOS local transcription is available in this build.',
    })),
  });

  await expect(localInference.getLocalDeviceSupport()).resolves.toEqual({
    platform: 'ios',
    localProcessingAvailable: true,
    supportsSummary: false,
    supportsTranscription: true,
    requiresCustomBuild: true,
    reason: 'iOS local transcription is available in this build.',
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails against the current iOS fallback**

Run: `npx vitest run src/services/localInference.test.ts -t "passes through iOS local transcription support when the native module is available"`
Expected: FAIL because iOS currently reports local processing unavailable

- [ ] **Step 3: Update the docs to describe the new iOS-first goal**

```md
- first real local engine integration: iOS transcription with `whisper.cpp`
- supported local STT model in this phase: `whisper-base`
- iOS local summary remains unsupported
- Android local engine work moves to a later phase
```

- [ ] **Step 4: Update the JS test fixture for the new iOS support payload**

```ts
getDeviceSupport: vi.fn(async () => ({
  localProcessingAvailable: true,
  supportsSummary: false,
  supportsTranscription: true,
  requiresCustomBuild: true,
  reason: 'iOS local transcription is available in this build.',
}))
```

- [ ] **Step 5: Re-run the focused test to verify the contract change passes**

Run: `npx vitest run src/services/localInference.test.ts -t "passes through iOS local transcription support when the native module is available"`
Expected: PASS

- [ ] **Step 6: Commit the doc + contract re-scope**

```bash
git add docs/superpowers/specs/2026-04-14-native-local-runtime-design.md \
  docs/superpowers/plans/2026-04-14-native-local-runtime.md \
  docs/superpowers/plans/2026-04-14-ios-local-transcription.md \
  docs/local-models.md docs/architecture.md docs/running-locally.md \
  src/services/localInference.test.ts
git commit -m "docs: rescope local transcription plan to ios"
```

### Task 2: Vendor `whisper.cpp` into the iOS module and make it build

**Files:**
- Create: `modules/mu-fathom-local-ai/vendor/whisper.cpp/*`
- Modify: `modules/mu-fathom-local-ai/ios/MuFathomLocalAI.podspec`
- Create: `modules/mu-fathom-local-ai/ios/WhisperBridge.h`
- Create: `modules/mu-fathom-local-ai/ios/WhisperBridge.mm`
- Create: `modules/mu-fathom-local-ai/ios/WhisperRuntime.swift`

- [ ] **Step 1: Add a bridge-build verification target before wiring implementation**

```objc
// modules/mu-fathom-local-ai/ios/WhisperBridge.h
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface WhisperBridge : NSObject
+ (NSString *)sdkVersion;
@end

NS_ASSUME_NONNULL_END
```

```objc
// modules/mu-fathom-local-ai/ios/WhisperBridge.mm
#import "WhisperBridge.h"

@implementation WhisperBridge
+ (NSString *)sdkVersion {
  return @"whisper-bridge-scaffold";
}
@end
```

- [ ] **Step 2: Point the podspec at Objective-C++ bridge files and vendor sources**

```ruby
s.source_files = 'ios/**/*.{swift,h,m,mm}', 'vendor/whisper.cpp/**/*.{h,c,cpp,mm}'
s.compiler_flags = '-Wno-shorten-64-to-32'
s.pod_target_xcconfig = {
  'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
  'CLANG_CXX_LIBRARY' => 'libc++'
}
```

- [ ] **Step 3: Install pods to verify the module wiring is accepted**

Run: `cd ios && pod install`
Expected: `MuFathomLocalAI` installs without podspec errors

- [ ] **Step 4: Run an iOS build to verify the vendored bridge compiles before adding whisper logic**

Run: `xcodebuild -workspace ios/mufathom.xcworkspace -scheme mufathom -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 5: Commit the native dependency scaffold**

```bash
git add modules/mu-fathom-local-ai/ios/MuFathomLocalAI.podspec \
  modules/mu-fathom-local-ai/ios/WhisperBridge.h \
  modules/mu-fathom-local-ai/ios/WhisperBridge.mm \
  modules/mu-fathom-local-ai/ios/WhisperRuntime.swift \
  modules/mu-fathom-local-ai/vendor/whisper.cpp
git commit -m "feat: scaffold ios whisper runtime bridge"
```

### Task 3: Add iOS audio normalization and native transcription execution

**Files:**
- Modify: `modules/mu-fathom-local-ai/ios/MuFathomLocalAIModule.swift`
- Create: `modules/mu-fathom-local-ai/ios/AudioNormalizer.swift`
- Create: `modules/mu-fathom-local-ai/ios/LocalModelResolver.swift`
- Modify: `modules/mu-fathom-local-ai/ios/WhisperRuntime.swift`
- Modify: `modules/mu-fathom-local-ai/ios/WhisperBridge.h`
- Modify: `modules/mu-fathom-local-ai/ios/WhisperBridge.mm`
- Test: `src/services/localInference.test.ts`

- [ ] **Step 1: Add a failing JS contract test for iOS transcription availability**

```ts
it('uses the native transcription path when iOS reports local transcription support', async () => {
  const transcribe = vi.fn(async () => 'offline transcript');
  const localInference = await loadLocalInferenceForPlatform('ios', {
    getDeviceSupport: vi.fn(async () => ({
      localProcessingAvailable: true,
      supportsSummary: false,
      supportsTranscription: true,
      requiresCustomBuild: true,
      reason: 'iOS local transcription is available in this build.',
    })),
    transcribe,
  });

  await expect(
    localInference.transcribeLocalAudio({ audioUri: 'file:///meeting.m4a', modelId: 'whisper-base' })
  ).resolves.toBe('offline transcript');
  expect(transcribe).toHaveBeenCalledWith({ audioUri: 'file:///meeting.m4a', modelId: 'whisper-base' });
});
```

- [ ] **Step 2: Run the focused test to verify the contract fails before native support changes**

Run: `npx vitest run src/services/localInference.test.ts -t "uses the native transcription path when iOS reports local transcription support"`
Expected: FAIL if the iOS support fixture or bridge logic still blocks the path

- [ ] **Step 3: Add the iOS model resolver**

```swift
struct LocalModelResolver {
  func resolveWhisperBasePath(for modelId: String) throws -> String {
    guard modelId == "whisper-base" else {
      throw Exception(name: "E_LOCAL_TRANSCRIBE_MODEL_UNSUPPORTED", description: "Only whisper-base is supported for local transcription on iOS in this phase.")
    }

    let modelsDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("models", isDirectory: true)
    let installedUrl = modelsDirectory.appendingPathComponent("whisper-base.bin")

    guard FileManager.default.fileExists(atPath: installedUrl.path) else {
      throw Exception(name: "E_LOCAL_TRANSCRIBE_MODEL_MISSING", description: "whisper-base is not installed on this device.")
    }

    return installedUrl.path
  }
}
```

- [ ] **Step 4: Add audio normalization to `16 kHz` mono WAV**

```swift
struct AudioNormalizer {
  func normalizeForWhisper(inputUri: String) throws -> URL {
    let inputUrl = URL(string: inputUri) ?? URL(fileURLWithPath: inputUri)
    let outputUrl = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("wav")

    // AVAssetReader / AVAssetWriter or AVAudioFile pipeline:
    // - sample rate 16000
    // - channels 1
    // - PCM WAV output

    return outputUrl
  }
}
```

- [ ] **Step 5: Replace the scaffold bridge with real `whisper.cpp` transcription entrypoints**

```objc
// WhisperBridge.h
+ (NSString *)transcribeFileAtPath:(NSString *)audioPath
                         modelPath:(NSString *)modelPath
                             error:(NSError **)error;
```

```objc
// WhisperBridge.mm
+ (NSString *)transcribeFileAtPath:(NSString *)audioPath
                         modelPath:(NSString *)modelPath
                             error:(NSError **)error {
  // init whisper context from model path
  // load normalized wav samples from audio path
  // run whisper_full
  // join all segment text into one NSString and return it
}
```

- [ ] **Step 6: Make `MuFathomLocalAIModule.swift` perform real iOS transcription**

```swift
AsyncFunction("getDeviceSupport") {
  return [
    "platform": "ios",
    "localProcessingAvailable": true,
    "supportsSummary": false,
    "supportsTranscription": true,
    "requiresCustomBuild": true,
    "reason": "iOS local transcription is available in this build."
  ]
}

struct WhisperRuntime {
  func transcribe(audioPath: String, modelPath: String) throws -> String {
    var bridgeError: NSError?
    let transcript = WhisperBridge.transcribeFile(atPath: audioPath, modelPath: modelPath, error: &bridgeError)

    if let bridgeError {
      throw Exception(name: "E_LOCAL_TRANSCRIBE_FAILED", description: bridgeError.localizedDescription)
    }

    return transcript
  }
}

AsyncFunction("transcribe") { (params: LocalTranscribeParams) -> String in
  let modelPath = try LocalModelResolver().resolveWhisperBasePath(for: params.modelId)
  let normalizedAudio = try AudioNormalizer().normalizeForWhisper(inputUri: params.audioUri)
  let transcript = try WhisperRuntime().transcribe(audioPath: normalizedAudio.path, modelPath: modelPath)

  guard !transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
    throw Exception(name: "E_LOCAL_TRANSCRIBE_EMPTY", description: "Local transcription returned no text.")
  }

  return transcript
}
```

- [ ] **Step 7: Keep `summarize` explicitly unsupported**

```swift
AsyncFunction("summarize") { (_: LocalSummarizeParams) in
  throw Exception(
    name: "E_LOCAL_SUMMARY_UNAVAILABLE",
    description: "Local summary is not supported on iOS in this phase."
  )
}
```

- [ ] **Step 8: Re-run the focused contract tests**

Run: `npx vitest run src/services/localInference.test.ts -t "iOS"`
Expected: PASS

- [ ] **Step 9: Re-run the full iOS build**

Run: `xcodebuild -workspace ios/mufathom.xcworkspace -scheme mufathom -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 10: Commit the native transcription implementation**

```bash
git add modules/mu-fathom-local-ai/ios/MuFathomLocalAIModule.swift \
  modules/mu-fathom-local-ai/ios/AudioNormalizer.swift \
  modules/mu-fathom-local-ai/ios/LocalModelResolver.swift \
  modules/mu-fathom-local-ai/ios/WhisperRuntime.swift \
  modules/mu-fathom-local-ai/ios/WhisperBridge.h \
  modules/mu-fathom-local-ai/ios/WhisperBridge.mm \
  src/services/localInference.test.ts
git commit -m "feat: add ios local whisper transcription"
```

### Task 4: Tighten app behavior around the supported local model and failure messages

**Files:**
- Modify: `src/services/localInference.ts`
- Modify: `src/services/ai.ts`
- Modify: `src/screens/SettingsScreen.tsx`
- Test: `src/services/localInference.test.ts`

- [ ] **Step 1: Add a failing JS test for unsupported local model ids**

```ts
it('fails clearly when a non-whisper-base model is selected on iOS local transcription', async () => {
  const transcribe = vi.fn(async () => {
    throw new Error('Only whisper-base is supported for local transcription on iOS in this phase.');
  });
  const localInference = await loadLocalInferenceForPlatform('ios', {
    getDeviceSupport: vi.fn(async () => ({
      localProcessingAvailable: true,
      supportsSummary: false,
      supportsTranscription: true,
      requiresCustomBuild: true,
      reason: 'iOS local transcription is available in this build.',
    })),
    transcribe,
  });

  await expect(
    localInference.transcribeLocalAudio({ audioUri: 'file:///meeting.m4a', modelId: 'whisper-small' })
  ).rejects.toThrow('Only whisper-base is supported for local transcription on iOS in this phase.');
});
```

- [ ] **Step 2: Run the focused test to verify the current messaging is insufficient**

Run: `npx vitest run src/services/localInference.test.ts -t "non-whisper-base model"`
Expected: FAIL until the bridge and UI copy reflect the stricter support

- [ ] **Step 3: Update the JS messaging and settings copy**

```ts
if (Platform.OS === 'ios' && params.modelId !== 'whisper-base') {
  throw new Error('Only whisper-base is supported for local transcription on iOS in this phase.');
}
```

```tsx
<Text>Local transcription on iPhone currently supports whisper-base only.</Text>
```

- [ ] **Step 4: Re-run the focused local inference tests**

Run: `npx vitest run src/services/localInference.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the support-messaging changes**

```bash
git add src/services/localInference.ts src/services/ai.ts src/screens/SettingsScreen.tsx src/services/localInference.test.ts
git commit -m "fix: clarify ios local transcription limits"
```

### Task 5: Final verification and docs pass

**Files:**
- Modify: `docs/local-models.md`
- Modify: `docs/architecture.md`
- Modify: `docs/running-locally.md`

- [ ] **Step 1: Update the docs with the finished iOS-first behavior**

```md
- iOS local transcription is now real for `whisper-base`
- local summary is still unsupported on-device
- Expo Go still cannot run the local engine
- testing path: custom iOS build on real phone, airplane mode, transcript only
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 3: Run TypeScript**

Run: `npx tsc --noEmit`
Expected: exit code `0`

- [ ] **Step 4: Run Expo export**

Run: `npx expo export --platform ios --platform android --output-dir /tmp/mu-fathom-export`
Expected: export completes successfully

- [ ] **Step 5: Run the iOS native build one final time**

Run: `xcodebuild -workspace ios/mufathom.xcworkspace -scheme mufathom -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 6: Commit the final verification and docs updates**

```bash
git add docs/local-models.md docs/architecture.md docs/running-locally.md
git commit -m "docs: finalize ios local transcription phase"
```
