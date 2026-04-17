# Background Recording Design

## Goal

Allow meeting recording to continue when `mu-fathom` goes into the background on both iOS and Android, while keeping the product honest about one important boundary:

- recording continues while the app remains alive in the background
- recording is not expected to survive a force-quit or swipe-away

This phase focuses on reliable background capture and state restoration, not lock-screen polish like iOS Live Activities or Dynamic Island.

## Decisions

- Support background recording on both iOS and Android.
- Do not support continuity after a force-quit or swipe-away.
- Move recording ownership out of the screen and into a small app-level recording controller/service.
- Keep the existing stop-and-save meeting flow, local persistence, and Google Drive upload flow.
- Show persistent OS-level recording indicators while background recording is active.
- Update the UI and copy to reflect that recording is no longer foreground-only.
- Defer iOS Live Activity / Dynamic Island work to a later phase.

## Problem Summary

The current implementation is intentionally foreground-only:

- [`src/screens/RecordScreen.tsx`](/Users/tarun/Documents/projects/mu-fathom/src/screens/RecordScreen.tsx) owns recording lifecycle directly
- audio mode is configured with background behavior disabled
- the screen copy explicitly tells the user to keep the app open

That is fine for the initial MVP, but it breaks the expected use case of recording a meeting while checking notes, switching apps, or locking the phone.

## Architecture

### Recording controller

Introduce a small app-level recording controller that owns:

- starting a recording session
- stopping a recording session
- exposing current recording state to the UI
- reconnecting the UI to an active session after navigation, backgrounding, or foreground return
- handing off the completed file to the existing meeting-save flow

This controller should be narrow and explicit. The record screen becomes a consumer of recording state instead of the owner of the recorder lifecycle.

### Screen responsibilities

[`src/screens/RecordScreen.tsx`](/Users/tarun/Documents/projects/mu-fathom/src/screens/RecordScreen.tsx) should:

- render current recording status from the controller
- let the user start and stop recording
- show resumed state if a recording is already active
- show saving/error states when stopping

It should no longer assume that leaving the screen means the session is gone.

### Native/background behavior

The controller will sit on top of background-capable `expo-audio` configuration.

On iOS:
- enable audio background mode in app config
- enable background recording in the audio session
- keep recording active while the app is backgrounded or the screen is locked

On Android:
- enable background recording support in app config
- allow `expo-audio` to run recording through its foreground-service-backed path
- show the required persistent notification while recording is active

## Product Behavior

### Start recording

When the user starts recording:

- the controller starts a session
- UI enters active-recording state
- background-capable audio mode is applied

### App backgrounds

If the app moves to the background:

- recording continues
- Android shows a persistent system notification
- iOS continues under audio background mode

### App returns to foreground

If the user comes back to the app:

- the record screen reconnects to the active session
- duration and state continue from the live session
- the app should not behave as if recording silently stopped unless the OS actually interrupted it

### Stop recording

When the user stops recording:

- the controller stops the recorder
- the file is passed through the existing local meeting creation flow
- existing Drive upload behavior remains unchanged
- audio mode is returned to non-recording configuration

## State Model

The recording controller should expose a minimal state shape covering:

- idle
- recording
- saving
- error

Recording state should also include the active session metadata needed by the UI, such as:

- title draft
- duration
- file URL when available
- interruption/error details if the OS ended the session unexpectedly

This state should be durable enough for the UI to reconnect after backgrounding, but it does not need to survive full process death in this phase.

## Error Handling

- If background recording is unavailable in the current build, start should fail clearly.
- If the OS interrupts recording while the app is backgrounded, the user should see that when they return.
- If stop/save fails, the app should surface the failure explicitly and avoid pretending the meeting was stored successfully.
- If Google Drive upload fails after a successful local save, keep the current behavior: save locally and show an upload warning.

## Config And Native Requirements

Expected configuration changes:

- `expo-audio` plugin configured for background recording support
- iOS audio background capability enabled
- Android foreground-service microphone permission path enabled through the plugin configuration

This phase does not add:

- iOS Live Activities
- Dynamic Island UI
- force-quit recovery
- background transcription

## Testing

### JS tests

Add focused tests around:

- recording controller state transitions
- record screen reconnection to an active session
- config/behavior expectations that changed from foreground-only to background-capable

### Manual verification

On both iOS and Android:

1. start recording
2. send the app to the background
3. wait with the screen off
4. return to the app
5. confirm recording is still active and duration advanced
6. stop recording
7. confirm the meeting saves successfully

Additional checks:

- Android shows a persistent notification while recording is active
- force-quit/swipe-away ends the session and is not treated as supported continuity
- existing local save and Drive upload behavior still works after a long background session

## Acceptance Criteria

- Recording continues while the app is backgrounded on both iOS and Android.
- Recording continues with the screen locked while the app remains alive.
- The record screen reconnects to an active recording session after returning to the app.
- Android shows the required persistent recording notification during background capture.
- The current local save flow still creates a meeting successfully after background recording.
- Google Drive upload still runs after a successful stop/save.
- Force-quit or swipe-away is explicitly out of scope and not treated as a supported continuation path.
- The product copy no longer says recording is foreground-only.
