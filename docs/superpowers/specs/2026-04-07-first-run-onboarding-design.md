# First-Run Onboarding Design

## Summary

Add a lightweight first-run onboarding flow that appears once after install, explains the real product clearly, and always ends by sending the user to `Settings` so they can configure a provider before trying to use the app.

This is not a permissions wizard and not a marketing slideshow. It is a short product orientation flow for the current MVP.

## Goals

- show a cleaner first-install experience than dropping the user directly onto the meetings list
- explain the actual MVP shape in plain language
- reinforce privacy and consent expectations early
- push the user into provider setup before they hit a dead-end flow
- keep the implementation simple and consistent with the existing app design system

## Non-Goals

- requesting microphone or other system permissions during onboarding
- embedding provider configuration forms inside onboarding
- teaching the local/offline model path on first launch
- introducing a full tutorial, tips system, or coach marks
- supporting multi-page onboarding customization or experiments

## Product Rules

- onboarding is shown only once on first launch
- `Skip` is always available
- skipping still routes to `Settings`
- completing the last screen also routes to `Settings`
- onboarding copy is focused on the working remote-provider flow
- local/offline model messaging stays inside `Settings`, not first-run onboarding

## User Flow

### Entry

1. App boots normally through the existing bootstrap flow in `app/_layout.tsx`
2. After bootstrap completes, the app checks a local `hasSeenOnboarding` flag
3. If the flag is false, the app routes to `/onboarding`
4. If the flag is true, the app continues to the normal app stack

### Exit

- `Skip`:
  - mark onboarding as seen
  - route with `router.replace('/settings')`
- `Finish` on the last screen:
  - mark onboarding as seen
  - route with `router.replace('/settings')`
- `Back`:
  - move to the previous onboarding screen
  - never exits the flow unless the user chooses `Skip`

### Future reset

No reset UI is required now. A future “View onboarding again” entry can be added later in `Settings` without changing the core flow.

## Screen Design

The onboarding should use the same warm visual language as the home screen:

- soft paper background
- strong headline typography
- rounded cards
- restrained accent color
- clear CTA hierarchy

There should be 4 screens total.

### Screen 1: Welcome

Purpose:
- explain what the app is in one sentence

Content:
- headline: `Record it. Upload it. Process it later.`
- short body: manual meeting companion, not bots or auto-join
- supporting chips: `Manual`, `Local-first`, `Post-call`

### Screen 2: How It Works

Purpose:
- make the workflow obvious

Content:
- `Record or import`
- `Transcribe after the meeting`
- `Get summary + action items`

This screen should be short and scannable, not a paragraph.

### Screen 3: Privacy / Reality

Purpose:
- set expectations early

Content:
- meetings are stored locally first
- audio is only sent when the user chooses processing
- the user is responsible for participant consent

This screen should explicitly avoid stealth-recorder vibes.

### Screen 4: Setup CTA

Purpose:
- get the user to the only next step that matters

Content:
- headline about setting up a provider first
- short explanation that transcript and summary need provider configuration
- primary CTA: `Go to Settings`
- optional supporting line: skip still lands here

## UI Behavior

- full-screen route, not modal
- page index state stored locally inside the onboarding screen component
- progress dots at the bottom
- `Back` shown on screens 2-4
- `Skip` shown in the top area on all screens
- final screen uses a stronger CTA treatment than the earlier screens
- motion should be minimal: simple fade/slide transitions are enough

## Routing Design

### New route

Add:

- `app/onboarding.tsx`

This route owns:

- slide data
- current step index
- skip handling
- next/back handling
- completion handling

### App shell integration

`app/_layout.tsx` should:

1. wait for `bootstrapApp()`
2. read the onboarding state
3. redirect to `/onboarding` if needed

The app shell must never deadlock if the onboarding flag read fails.

Safe fallback:

- if onboarding state cannot be read, continue into the normal app rather than trapping the user on a broken loading state

## Persistence Design

Store onboarding state in the same local DB-backed app preferences layer already used for other app-level preferences.

Add a boolean-like field:

- `has_seen_onboarding INTEGER NOT NULL DEFAULT 0`

Recommended storage location:

- `app_preferences` table

Rationale:

- stays consistent with the current SQLite-first local app state
- easier to inspect and migrate than an extra ad-hoc storage location
- keeps “first-run UX state” in one place

## Copy Principles

- short
- direct
- honest
- no feature dumping
- no enterprise language
- no local-model promise on first run

This app should be presented as:

- a manual meeting recorder/import tool
- a post-meeting transcript + summary app
- a local-first workflow

It should not be presented as:

- a stealth recorder
- an automatic meeting bot
- an offline local-model app for first-time users

## Error Handling

- if onboarding save fails on completion:
  - still route to `Settings`
  - best effort only
- if onboarding state load fails:
  - do not block app launch
  - log if logging exists later
  - fall back to normal app entry
- if route replacement fails unexpectedly:
  - user should still be able to navigate manually without app crash

## Testing

### Functional checks

- fresh install shows onboarding
- returning app launch after completion does not show onboarding
- `Skip` routes to `Settings`
- finishing the last screen routes to `Settings`
- `Back` works on screens 2-4
- progress dots update correctly

### Regression checks

- app bootstrap still works when onboarding is already completed
- normal home screen flow still works after onboarding
- `Settings` remains reachable directly
- recording/import/processing flows are unaffected

### Edge cases

- corrupt or missing onboarding preference does not break app startup
- onboarding behaves correctly after app restart during first-run flow

## Implementation Scope

This spec covers:

- first-run route
- first-run state persistence
- onboarding UI screens
- routing into `Settings`

This spec does not cover:

- replay onboarding from settings
- permission prompts
- account onboarding
- local-model onboarding

## Recommendation

Implement the onboarding as a dedicated first-run route with 4 polished screens and a single clear exit into `Settings`.

That gives the app a better first-launch experience without turning onboarding into another half-built subsystem.
