# Onboarding Offline Setup Design

## Goal

Make the last onboarding step proactively prepare local mode so first-run users can record now and analyze later with minimal setup friction.

The experience should feel automatic and polished:

- start local model preparation automatically on the last onboarding step
- keep the step skippable
- show real progress, bundle size, and rough time-to-ready
- keep progress visible after onboarding in the Meetings dashboard
- auto-apply local configuration when the required download is ready
- handle interruption honestly and predictably

## Product Decisions

- the last onboarding step becomes a dedicated offline setup step
- download starts automatically when the user lands on that step
- the step remains skippable
- the Meetings dashboard becomes the persistent follow-up surface for progress and recovery
- downloads may use both Wi-Fi and cellular
- if a download is interrupted and the user later relaunches the app, the app does not auto-resume
- the user must explicitly tap `Resume`
- the setup step shows a bundle choice with visible size and estimated time
- the recommended default bundle auto-starts immediately
- the experience should align with Option A from design review, with the bundle-size choice from Option C

## Problem

Today the app tells users they can configure local mode later from Settings, but that creates unnecessary friction:

- first-run users do not know whether local mode is ready
- download progress only exists as temporary screen-local state in Settings
- there is no app-wide download session that onboarding, Meetings, and Settings can all trust
- interruption states are not represented as product states
- local provider configuration is not automatically completed when downloads finish

The result is a setup journey that feels technical instead of intentional.

## Desired User Experience

### Final onboarding step

The existing `setup` slide becomes `Prepare offline mode`.

On entry:

- device capability is checked
- the model catalog is resolved
- the app computes the available bundle options for this platform
- the recommended bundle is selected by default
- download starts automatically for that default selection

The screen shows:

- the selected bundle name
- what the bundle unlocks
- total download size
- estimated time based on current connection speed heuristic or a fallback estimate
- a live progress bar with bytes downloaded
- a clear `Skip for now` action
- lightweight editorial cards showing what the user can still do while setup finishes:
  - record meetings
  - import audio
  - analyze when ready

### Bundle choice

The UI presents product-level bundle choices instead of raw model rows.

Initial bundle model:

1. `Starter`
   - minimum download required to unlock a useful first local analysis path on this platform
   - optimized for fastest time to first result
2. `Full`
   - larger bundle intended for better long-term local capability where supported

Platform behavior:

- if the current platform only supports one meaningful bundle, show that single recommended path without fake choice
- iOS collapses to the supported local transcription path in this phase
- Android can expose a fuller bundle only if the catalog and runtime support it honestly

If the user changes the bundle while the default auto-download is in progress:

- the current session is canceled cleanly
- the new bundle becomes the active session
- download restarts for the new choice

### Meetings dashboard handoff

After skip or onboarding completion, Meetings becomes the persistent control surface.

Add a prominent dashboard setup card near the top of [`src/screens/MeetingsScreen.tsx`](/Users/tarun/Documents/projects/mu-fathom/src/screens/MeetingsScreen.tsx).

Card states:

1. `Preparing`
   - checking device support and bundle choice
2. `Downloading`
   - progress bar
   - bytes downloaded
   - estimated time remaining
   - bundle label
3. `Paused: offline`
   - connection lost messaging
   - explicit `Resume` button
4. `Paused`
   - reserved for explicit pause support if we introduce it
   - not required for the first implementation slice
5. `Failed`
   - concise error
   - `Try again` action
6. `Ready`
   - confirmation that offline mode is prepared
   - optional dismiss/collapse treatment

The dashboard card must feel like product UI, not a debugging widget.

### Settings role after the change

Settings remains a management surface, not the primary first-run setup path.

Users can still:

- inspect installed models
- delete installed models
- change local selections
- upgrade from `Starter` to `Full`
- troubleshoot failures

But onboarding and Meetings should cover the main first-run journey without requiring a Settings detour.

## State Model

Introduce a persisted app-wide offline setup session.

Suggested states:

- `idle`
- `preparing`
- `downloading`
- `paused_offline`
- `paused_user`
- `failed`
- `ready`

Suggested persisted fields:

- `bundleId`
- `bundleLabel`
- `modelIds`
- `status`
- `bytesDownloaded`
- `totalBytes`
- `progress`
- `estimatedSecondsRemaining`
- `networkPolicy`
- `lastError`
- `startedAt`
- `updatedAt`
- `autoConfiguredAt`
- `isDismissed`

This session becomes the single source of truth for:

- onboarding presentation
- Meetings dashboard card
- Settings local model section

## Download Behavior

### Automatic start

When the onboarding setup step resolves a recommended bundle, download begins immediately.

### Network behavior

- downloads may run on Wi-Fi or cellular
- interruption due to network loss should move the session into `paused_offline`, not silently fail
- the app should preserve the partial session state when possible

### Relaunch behavior

If the app is reopened after an interrupted session:

- the app restores the previous session state
- the app does not auto-resume on launch
- the user must explicitly tap `Resume` from the Meetings dashboard or another clear control surface

This avoids surprising data usage and makes interruption recovery explicit.

## Auto-Configuration

When the required bundle reaches `ready`:

- update app settings so local mode is ready for the supported task path
- prefer filling empty local selections over overwriting explicit user choices
- record that auto-configuration has completed so the UI can stop prompting

This should allow the user to move from recording to later analysis without visiting Settings first.

## Architecture

### New service boundary

Add a dedicated offline setup / download session service rather than keeping progress in `SettingsScreen` component state.

Responsibilities:

- resolve device support
- resolve bundle options from model catalog + platform constraints
- start a bundle download
- track and persist session state
- expose subscribe/read APIs for onboarding, Meetings, and Settings
- map raw download failures into product states
- auto-apply local settings after success

### Relationship to existing local model services

Existing [`src/services/localModels.ts`](/Users/tarun/Documents/projects/mu-fathom/src/services/localModels.ts) remains the lower-level model catalog / file transfer layer.

New orchestration layer should sit above it:

- `localModels.ts` continues to understand catalog rows, installed models, and file download mechanics
- new session service understands bundles, onboarding intent, persisted progress state, and UI-facing status

This keeps the existing local model scaffolding reusable while giving the product a stable app-wide state model.

## Data Model Changes

Current `InstalledModelRow` only represents installed model records, not an in-flight cross-screen session.

We need either:

1. a new persisted table for offline setup sessions
2. or a dedicated persisted record in app settings / local storage

Preferred direction:

- create a dedicated persisted session record rather than overloading `AppSettings`
- keep installed-model records focused on file presence and installation status
- keep session records focused on user journey state

## Scope

### In scope

- redesign the last onboarding step into offline setup
- bundle choice with visible size/time
- automatic start on onboarding step entry
- explicit skip path
- Meetings dashboard progress card
- persisted session state across screens
- interruption states
- explicit user resume after relaunch/interruption
- automatic local configuration after successful setup
- Settings integration with the same state source

### Out of scope

- silent automatic resume on relaunch
- background OS-level resilient download manager beyond the current app/runtime capabilities
- inventing capabilities the current platform/runtime cannot support honestly
- real-time inference
- changing the background recording flow
- forcing users through offline setup before they can use the app

## Affected Areas

- [`app/onboarding.tsx`](/Users/tarun/Documents/projects/mu-fathom/app/onboarding.tsx)
- [`src/onboarding/model.ts`](/Users/tarun/Documents/projects/mu-fathom/src/onboarding/model.ts)
- [`src/features/onboarding/presentation.ts`](/Users/tarun/Documents/projects/mu-fathom/src/features/onboarding/presentation.ts)
- [`src/screens/MeetingsScreen.tsx`](/Users/tarun/Documents/projects/mu-fathom/src/screens/MeetingsScreen.tsx)
- [`src/features/dashboard/presentation.ts`](/Users/tarun/Documents/projects/mu-fathom/src/features/dashboard/presentation.ts)
- [`src/screens/SettingsScreen.tsx`](/Users/tarun/Documents/projects/mu-fathom/src/screens/SettingsScreen.tsx)
- [`src/services/localModels.ts`](/Users/tarun/Documents/projects/mu-fathom/src/services/localModels.ts)
- [`src/services/settings.ts`](/Users/tarun/Documents/projects/mu-fathom/src/services/settings.ts)
- [`src/types.ts`](/Users/tarun/Documents/projects/mu-fathom/src/types.ts)

## Acceptance Criteria

- the last onboarding step automatically starts offline setup for the recommended bundle
- the user can skip onboarding setup without blocking app entry
- the onboarding UI shows bundle size and rough time to download
- Meetings shows a persistent setup card after onboarding until the flow is ready or dismissed
- interruption due to connectivity becomes a visible paused state
- relaunch after interruption does not auto-resume
- resuming requires explicit user action
- successful setup automatically prepares local configuration without requiring a Settings visit
- Settings reflects the same persisted session state instead of a separate progress source

## Risks

- platform-specific download/resume behavior in Expo file APIs may limit how much true partial resume we can promise
- current built-in catalog support is asymmetric across iOS and Android, so bundle UX must not imply equal capability where it does not exist
- if raw model availability changes, bundle definitions must stay honest and be derived from real supported catalog/runtime combinations

## Recommendation

Build this as a product-facing orchestration layer now, even if the first implementation is backed by the current local model APIs.

That gives the app the right user experience immediately while leaving room to evolve into a more general download manager later.
