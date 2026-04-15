# Native Local Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real Expo local module for `MuFathomLocalAI` and wire the app to an iOS-first local-transcription contract with a stable native runtime boundary.

**Architecture:** Keep the JavaScript local inference layer thin and stable while adding an autolinkable Expo local module under `modules/`. The runtime boundary already exists. The first planned real engine slice is iOS transcription with `whisper.cpp`, and Android stays on a later-phase boundary-only contract.

**Tech Stack:** Expo Modules API, TypeScript, Expo Router, existing local inference services, Kotlin/Swift native module stubs, Expo autolinking

---

### Task 1: Add the Phase 2 runtime docs

**Files:**
- Create: `docs/superpowers/specs/2026-04-14-native-local-runtime-design.md`
- Create: `docs/superpowers/plans/2026-04-14-native-local-runtime.md`

- [ ] **Step 1: Write the design doc**

Create `docs/superpowers/specs/2026-04-14-native-local-runtime-design.md` with the iOS-first scope, non-goals, contract, and acceptance criteria.

- [ ] **Step 2: Write the implementation plan**

Create `docs/superpowers/plans/2026-04-14-native-local-runtime.md` with these tasks and exact file references.

- [ ] **Step 3: Verify the docs exist**

Run: `ls docs/superpowers/specs docs/superpowers/plans`
Expected: both new files are listed

### Task 2: Scaffold the Expo local module

**Files:**
- Create: `modules/mu-fathom-local-ai/*`

- [ ] **Step 1: Scaffold the module**

Run:

```bash
npx create-expo-module@latest --local --name MuFathomLocalAI --package expo.modules.mufathomlocalai ./modules/mu-fathom-local-ai
```

Expected: a local Expo module is created under `modules/mu-fathom-local-ai`

- [ ] **Step 2: Verify the autolinkable files exist**

Run:

```bash
find modules/mu-fathom-local-ai -maxdepth 3 -type f | sed -n '1,200p'
```

Expected: package metadata, `expo-module.config.json`, and Android/iOS source files exist

### Task 3: Implement the native support contract

**Files:**
- Modify: `modules/mu-fathom-local-ai/android/*`
- Modify: `modules/mu-fathom-local-ai/ios/*`

- [ ] **Step 1: Implement the iOS support payload**

The target support object for the planned iOS transcription slice should be:

```json
{
  "platform": "ios",
  "localProcessingAvailable": true,
  "supportsTranscription": true,
  "supportsSummary": false,
  "requiresCustomBuild": true,
  "reason": "iOS local transcription is available in this build."
}
```

- [ ] **Step 2: Keep Android method guards on the later-phase contract**

`transcribe` and `summarize` should still validate `audioUri`, `prompt`, and `modelId`, but Android should remain on the later-phase boundary-only contract.

- [ ] **Step 3: Implement iOS method guards and summary fallback**

iOS should return the real support payload above and keep summary explicitly disabled.

`transcribe` should reach the iOS transcription path, and `summarize` should continue to fail clearly because summary support is not part of this phase.

### Task 4: Tighten the JS bridge

**Files:**
- Modify: `src/services/localInference.ts`

- [ ] **Step 1: Add tests first if the bridge contract changes**

If helper shapes or messages change, add focused tests around the support/error behavior before updating production code.

- [ ] **Step 2: Keep the JS runtime checks aligned with the real module**

Update `src/services/localInference.ts` only where needed so it distinguishes:
- missing native module
- native module present but platform not enabled
- native module present but engine not implemented

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: exit code `0`

### Task 5: Update docs and verify the app still bundles

**Files:**
- Modify: `docs/local-models.md`
- Modify: `docs/architecture.md`
- Modify: `docs/running-locally.md`

- [ ] **Step 1: Update docs**

Explain that Phase 2 adds the native runtime boundary, iOS transcription is the first planned real engine slice, and Android stays on a later-phase path.

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 3: Run TypeScript**

Run: `npx tsc --noEmit`
Expected: exit code `0`

- [ ] **Step 4: Run Expo export**

Run: `npx expo export --platform ios --platform android --output-dir /tmp/mu-fathom-export`
Expected: both platform bundles export successfully
