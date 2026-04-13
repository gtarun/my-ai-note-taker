# Editorial UI Refresh Design

## Summary

Refresh the visual system and layout for the mobile app so `dashboard`, `settings`, and `onboarding` feel consistent with the shared "Digital Curator" design system from `stitch.zip`.

This is not a full app-wide redesign. The goal is a focused visual and structural pass that:

- fixes the messy first impression on the dashboard
- makes settings easier to understand
- upgrades onboarding so it feels intentional and premium
- introduces reusable UI primitives and theme tokens that can be reused later on the rest of the app

## Scope

### In scope

- Replace the current warm theme with the editorial cool-tone design system
- Redesign `app/index.tsx`
- Redesign `app/settings.tsx`
- Redesign `app/onboarding.tsx`
- Update `src/theme.ts`
- Add a small set of reusable UI primitives shared by the three screens

### Out of scope

- Full redesign of meeting detail, account, or record screens
- New product behavior
- New provider logic
- New onboarding flow logic
- Navigation architecture changes
- Web-specific redesign

## Goals

- Make the dashboard feel focused instead of crowded
- Reduce visual noise across settings
- Clarify the difference between configuring a provider and selecting which provider is active
- Make onboarding feel polished without adding new steps
- Create a reusable theme foundation for later screens

## Non-goals

- Pixel-perfect port of the HTML mockups
- Desktop-style navigation patterns inside the native app
- Fancy animation-heavy UI
- Large component framework refactor

## Design System Translation

The app should adopt the shared editorial system, but translate it into a mobile-native version instead of copying the web screens literally.

### Visual direction

- Calm, premium, editorial
- Large negative space
- Tonal surface hierarchy instead of strong divider lines
- Soft ambient background treatment
- Selective use of color accents

### Color system

Use the shared cool palette as the new baseline:

- app background: `#f7fafc`
- primary surface: `#ffffff`
- secondary surface: `#eff4f7`
- utility surface: `#e8eff2`
- text primary: `#2b3437`
- text secondary: `#576064`
- primary accent: `#0f57d0`
- primary accent strong: `#4e83fe`
- secondary chip: `#d8e3fa`
- tertiary accent: `#685781`
- tertiary chip: `#e4ceff`
- outline: `#aab3b7`

### Typography

- `Manrope` for large titles, section headings, editorial highlights, and important CTAs
- `Inter` for body copy, settings labels, metadata, and supporting text

If custom font loading is not already present, the implementation can either:

- add font loading properly, or
- temporarily preserve system fonts while still applying the rest of the design system

The implementation plan should decide based on effort and build stability.

### Shape and depth

- Rounded corners should feel soft and modern
- Avoid heavy drop shadows
- Use light elevation only on floating cards that need separation
- Avoid visible borders unless they clarify state or input affordance

### Buttons and chips

- Primary CTA: blue gradient or strong primary fill, full-pill shape
- Secondary CTA: tonal surface button
- Tertiary CTA: ghost text-style action
- Status chips: compact, tonal, low-noise

## Shared UI Structure

The redesign should introduce a minimal shared UI layer for these screens rather than re-styling each screen inline from scratch.

### Proposed reusable primitives

- `EditorialHero`
- `SurfaceCard`
- `SectionHeading`
- `PrimaryPillButton`
- `SecondaryButton`
- `StatusChip`
- `MetricChip`
- `SettingsGroup`
- `ProviderOptionCard`

These components should stay small and composable. They should not become a general-purpose design system package.

## Screen Design

### Dashboard (`app/index.tsx`)

#### Problem

The current dashboard feels messy because too many top-of-screen modules compete with each other:

- hero
- action buttons
- account card
- meetings section

The result is weak hierarchy and too many equally loud blocks.

#### New structure

Rebuild the dashboard into four sections only:

1. editorial hero
2. primary actions
3. compact account status
4. recent meetings

#### Editorial hero

The hero should include:

- small eyebrow or contextual label
- one strong headline
- one short support sentence
- one small count pill for saved meetings
- optional compact capability chips such as `Local-first`, `Manual capture`, `Post-call AI`

It should not include a dense metrics block unless the metrics are directly useful.

#### Primary actions

The dashboard should emphasize only two high-value actions:

- `New recording`
- `Import audio`

`Settings` should no longer sit as a third peer action beside them. It should become a quieter utility action, likely near the hero or section header.

#### Account status

Account and cloud sync status should remain visible, but no longer dominate the screen. It should become a smaller informational module with:

- short title
- short status sentence
- one action button if needed

It should avoid infrastructure-heavy copy.

#### Recent meetings

The meetings list should become the visual center of the dashboard.

Each meeting card should contain:

- title
- date and duration row
- one or two small status chips
- short summary or transcript snippet
- single trailing affordance to open the meeting

The current footer-heavy card style should be simplified. Less text chrome, more breathing room.

#### Empty state

When there are no meetings, the list area should show:

- one clear empty title
- one short explanation
- direct actions to record or import

### Settings (`app/settings.tsx`)

#### Problem

The current screen exposes too much at once and mixes together several jobs:

- configuring providers
- choosing active providers
- managing local models
- showing advanced inference controls

This creates avoidable confusion.

#### New structure

The settings screen should be organized in this order:

1. calm header
2. task assignment summary
3. configured providers
4. local models
5. advanced controls

#### Task assignment summary

Near the top, show a high-clarity panel with:

- `Transcription provider`
- `Summary provider`
- selected local model names when local is active
- save action

This section answers the main user question: "what is powering transcript and summary right now?"

#### Configured providers

Provider setup should be visually separate from provider selection.

Configured provider cards should:

- show provider name and setup state
- allow editing stored credentials and model defaults
- highlight the active provider gently when selected for a task
- avoid repeating API key prompts everywhere

OpenRouter-specific behavior:

- if OpenRouter is configured, it can expose transcription and summary model selectors in the assignment or provider editor area
- model choice should feel tied to the provider, not like a random global input

#### Local models

The local model section should remain its own module with:

- runtime availability
- installed models
- downloadable models
- storage/status info

If `Local` is selected for a task, the screen should clearly show the selected local model names instead of empty or irrelevant API fields.

#### Advanced controls

Advanced toggles should move lower in the screen and be framed as optional behavior. They should not compete with the main provider configuration tasks.

### Onboarding (`app/onboarding.tsx`)

#### Problem

The current onboarding is functional, but it still feels like a themed app screen instead of a deliberate first-run experience.

#### New structure

Keep the current slide logic, but redesign the screen presentation around:

- stronger editorial headline
- smaller contextual phase label
- better vertical rhythm
- more intentional CTA treatment
- premium progress treatment

#### Mobile-native adaptation

The shared web design uses an asymmetric editorial split layout. On mobile, this should become a stacked layout:

- top context label and progress
- main editorial copy
- one visual feature panel or capability card
- optional highlight chips
- footer CTA row

#### CTA and progress

- `Skip` remains available but visually quiet
- primary next/finish CTA becomes a strong pill
- progress should look more premium than dot-heavy toy indicators

#### Content handling

The implementation should keep the current onboarding data model and existing slide content behavior. The redesign is presentation-focused, not logic-focused.

## Screen Background Strategy

The current decorative background blobs should be revised to match the new system.

Guidelines:

- keep subtle ambient shapes
- use low-opacity blue and tertiary tints instead of warm beige tones
- ensure decorative layers never reduce text contrast
- preserve performance by keeping the background simple

## Interaction and Motion

Motion should stay restrained.

Allowed:

- existing fade-in behavior
- subtle press feedback
- gentle entrance for hero or cards

Avoid:

- elaborate multi-stage motion
- heavy parallax
- unnecessary animation libraries for this pass

## Copy Guidelines

Copy on redesigned screens should become shorter and more direct.

### Dashboard copy

- action-oriented
- less infra talk
- less startup/dev language on the primary screen

### Settings copy

- task-oriented labels
- clear distinction between `configure` and `use`
- fewer repeated technical explanations

### Onboarding copy

- strong and calm
- premium but not pretentious
- brief enough for mobile scanning

## Accessibility and UX Constraints

- Preserve readable contrast for all text
- Ensure touch targets remain comfortably tappable
- Do not rely on color alone for status
- Keep scroll behavior straightforward
- Avoid layouts that feel desktop-transplanted onto a phone

## Implementation Constraints

- Preserve current behavior and data flow
- Avoid redesigning unrelated screens in this pass
- Prefer small reusable primitives over large styling abstractions
- Keep Expo compatibility intact
- Do not introduce risky runtime dependencies unless clearly necessary

## Testing and Verification

The implementation plan should verify:

- `dashboard`, `settings`, and `onboarding` still render correctly on iOS and Android
- provider configuration behavior remains intact
- local model state still displays correctly
- onboarding navigation still works through all slides
- empty and populated meeting states both look correct
- touch targets and text wrapping behave well on smaller phones

## Acceptance Criteria

- The dashboard has a clear hierarchy with recent meetings as the main content focus
- Settings clearly separate provider configuration from provider selection
- Onboarding feels polished and editorial without changing its flow
- All three screens share the same visual language
- The shared theme foundation is reusable for future screen refreshes
- No product behavior regresses during the redesign
