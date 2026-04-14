# Navigation Shell And Settings Cleanup Design

## Goal

Fix the current app flow so onboarding no longer drops users into a confusing dead-end settings screen, and give the app a stable mobile navigation model with a persistent bottom tab bar.

## Problem

The current app uses a stack-only structure for the main experience:

- onboarding ends by replacing into `settings`
- `settings` is still dense and cognitively heavy
- there is no always-visible way back to the dashboard
- core actions are spread across one-off buttons instead of a stable app shell

This creates two UX failures:

1. first-run users finish onboarding and land in the least friendly screen
2. configured users can still get trapped in deep-scroll settings without a clear route back to meetings

## Decision

Move the core app into a 3-tab shell:

- `Meetings`
- `Record`
- `Settings`

Keep onboarding and meeting detail outside the tab shell.

After onboarding completes, route users to `Meetings`, not `Settings`.

## Why This Shape

This is the simplest mobile-first structure that solves the current UX issues without overbuilding:

- users always have a clear home screen
- recording becomes a first-class action
- settings stays reachable, but no longer acts like the center of the app
- Expo Router tabs handle navigation state cleanly without a custom fake footer

Alternative options were considered and rejected:

- stack-only plus extra escape buttons: too patchy
- custom sticky footer in stack screens: too much complexity for no real gain
- 4 tabs including account: adds clutter before it adds value

## Scope

### In Scope

- add a tab shell for the main app
- move `Meetings`, `Record`, and `Settings` into that shell
- change onboarding completion route to `Meetings`
- simplify the settings screen hierarchy inside the new shell
- add consistent top headers for the three tab screens
- use native bottom tabs with icons and safe-area-aware spacing

### Out Of Scope

- redesigning the meeting detail screen again
- splitting settings into multiple sub-pages
- making account a fourth tab
- reworking auth or account flows
- changing provider behavior or local model logic beyond presentation/routing

## Route Structure

### New Route Layout

Main shell:

- `app/(tabs)/_layout.tsx`
- `app/(tabs)/index.tsx`
- `app/(tabs)/record.tsx`
- `app/(tabs)/settings.tsx`

Outside tabs:

- `app/onboarding.tsx`
- `app/meetings/[id].tsx`
- `app/account.tsx`

### Routing Rules

- app bootstrap continues to decide whether onboarding should show
- onboarding completion replaces to the canonical route `/(tabs)`
- tab screens navigate within the shell naturally
- meeting detail pushes above the tab shell and hides the bottom bar automatically due to route structure

## Navigation UX

### Bottom Tabs

Tabs:

- `Meetings`
- `Record`
- `Settings`

Behavior:

- native Expo Router tabs, not a custom footer
- same icon family already used in the app
- active tab uses the accent color
- inactive tabs use muted ink
- bar respects bottom safe area
- labels remain visible for clarity in MVP

### Headers

Each tab screen gets a simple header:

- `Meetings`
- `New Recording`
- `Settings`

Header styling should stay aligned with the editorial refresh:

- paper background
- ink title
- clean, quiet chrome

Do not add extra header actions unless the screen truly needs them.

## Settings UX Cleanup

The settings screen should keep the same underlying behavior but become much easier to scan.

### Information Hierarchy

Top:

- current routing summary
- selected transcription provider
- selected summary provider
- save action

Middle:

- provider assignment controls
- configured provider cards

Lower:

- local models section

Bottom:

- advanced controls

### UX Rules

- choosing which provider is active must feel separate from configuring credentials
- local model management must feel separate from cloud provider setup
- the top of the screen should answer: “what is this app using right now?”
- the rest of the screen should answer: “how do I change or configure it?”

### Visual Changes

- reduce stacked emphasis at the top
- tighten vertical rhythm between summary and assignment sections
- keep strong section headings
- avoid making every card compete equally

This is a hierarchy cleanup, not a new provider system.

## Onboarding Flow Change

Current:

- onboarding finish -> `settings`

New:

- onboarding finish -> `Meetings`

Reason:

- the dashboard is the right landing surface after onboarding
- users can still reach settings immediately from the bottom tab bar
- this reduces first-run friction without hiding configuration

## Component And Architecture Notes

### Reuse Existing Work

Keep using the current editorial theme and shared primitives already built:

- theme tokens
- `EditorialHero`
- `SurfaceCard`
- `PillButton`
- `SectionHeading`
- `StatusChip`

### New Responsibility Boundaries

- root stack remains responsible for bootstrap and top-level route registration
- tab layout becomes responsible for persistent primary navigation
- each tab screen stays responsible for its own content
- settings presentation helpers may be extended, but provider services should remain unchanged

## Implementation Constraints

- do not break onboarding gating logic in root layout
- do not regress existing record or meeting-detail navigation
- do not introduce fake tab state in JS when Expo Router can own it
- do not mix account into primary navigation
- keep the change mobile-first and simple

## Testing Strategy

### Manual Flows

Verify:

1. first launch -> onboarding -> finish -> `Meetings`
2. from `Meetings`, switch to `Settings` via bottom tabs
3. from `Settings`, switch back to `Meetings`
4. from any tab, switch to `Record`
5. from `Meetings`, open a meeting detail and confirm tabs are not shown on the detail screen
6. complete a settings save flow and confirm the user is not trapped there

### Automated Checks

- update or add focused tests around onboarding completion routing if needed
- keep existing settings presentation tests passing
- run full test suite
- run `npx tsc --noEmit`
- run Expo export for iOS and Android

## Acceptance Criteria

- onboarding no longer routes users into settings
- the app has a persistent 3-tab shell for `Meetings`, `Record`, and `Settings`
- users can always reach the dashboard from settings in one tap
- settings remains functionally equivalent, but is easier to scan
- meeting detail remains outside the tab shell
- the refreshed app still builds for iOS and Android

## Risks And Mitigations

### Risk: Route churn breaks existing links

Mitigation:

- keep detail routes outside tabs
- update route pushes/replaces intentionally
- verify record -> detail and meetings -> detail flows manually

### Risk: Settings refactor accidentally changes provider behavior

Mitigation:

- treat this as a presentation cleanup
- keep provider services and save logic intact
- preserve existing tests and extend only where routing changes demand it

### Risk: Tabs feel visually out of place with the editorial refresh

Mitigation:

- style the tab bar with the same theme tokens
- keep it quiet, native, and lightweight rather than overly decorative
