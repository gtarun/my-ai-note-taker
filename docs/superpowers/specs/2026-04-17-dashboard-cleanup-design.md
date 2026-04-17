# Dashboard Cleanup Design

## Goal

Clean up the Meetings dashboard so it feels lighter and more technical, with less explanatory copy, denser meeting rows, and a smaller cloud/account utility surface.

## Decisions

- Replace the oversized editorial hero with a compact illustrated technical header.
- Keep the dashboard intro to a page title, one short subtitle, and the two primary actions.
- Keep a small cloud/account card on the dashboard.
- The cloud/account card shows only a one-line status plus one quick action.
- Use a more technical/AI-like visual language instead of editorial marketing copy.
- Make meeting rows denser so more content fits on screen.
- Remove the extra button chrome inside each meeting row and rely on the row tap target.

## UI/UX Direction

Guided by the `ui-ux-pro-max` skill, this cleanup should lean toward:
- flatter visual treatment over heavy editorial stacking
- concise hierarchy instead of long paragraphs
- technical/productive tone rather than playful marketing tone
- small geometric or signal-based illustration motifs
- fast-scanning mobile density

What to avoid:
- large paragraphs in hero cards
- repeated explanatory copy about cloud/account concepts
- oversized cards that push the actual meeting list below the fold
- unnecessary nested actions inside already tappable list rows

## Information Architecture

### Header area

The top of the Meetings screen becomes a compact dashboard header made of:
- a technical illustration accent
- a page title
- one short subtitle
- primary actions
  - `New recording`
  - `Import audio`

This section should feel like a tool dashboard, not a landing page.

### Cloud utility card

A smaller utility card sits under the header and keeps only:
- one-line cloud/account status
- one quick action
  - `Open profile` when signed in
  - `Set up account` when signed out

The dashboard should no longer carry detailed account explanation text. Full account detail belongs on `/account` behind the avatar entry.

### Meetings list

The meetings list remains the main content area and should start earlier on the screen.

Each row should keep:
- meeting title
- status chip
- timestamp and duration on a compact meta line
- a short snippet with tighter truncation

Each row should remove:
- the separate `Open meeting` button
- excess vertical padding
- overly tall card framing

## Visual Design

### Header illustration

The header illustration should feel technical/AI-like, not decorative for its own sake.

Suggested visual cues:
- waveform fragments
- grid lines
- signal nodes
- circuit/data-link geometry
- restrained accent color usage

The illustration should be supportive and compact, not a large banner image.

### Card treatment

Use smaller, cleaner surfaces with lighter copy density. Preserve the app’s existing palette and component language, but shift emphasis from narrative text toward utility.

This pass should feel:
- flatter
- tighter
- more operational

Not:
- louder
- more decorative
- more content-heavy

## Interaction Behavior

- `New recording` and `Import audio` remain the main entry actions.
- The cloud card quick action routes to `/account`.
- Meeting rows remain fully tappable and open the meeting detail.
- Removing the inline `Open meeting` button must not reduce discoverability because the full row remains interactive.

## Content Changes

### Replace current long copy with shorter content

Header copy should compress to:
- a stronger title
- one short subtitle only

Cloud card copy should compress to:
- `Cloud connected`
- `Cloud not connected`
- or similarly short one-line status text

Detailed explanatory text about local-first behavior, Drive linking, or optional cloud storage should move out of the dashboard.

## Technical Notes

Likely implementation areas:
- `src/screens/MeetingsScreen.tsx`
  - replace large hero + account card structure
  - densify row layout
- `src/features/dashboard/presentation.ts`
  - shorten empty state or status copy helpers if needed
- existing shared UI components may be reused where they still fit, but the screen should not feel forced into the previous `EditorialHero` structure if that component is now too verbose for the dashboard

## Acceptance Criteria

- The top of the Meetings screen is visibly more compact than before.
- The dashboard keeps an illustration, title, short subtitle, and primary actions.
- The cloud/account section becomes a small utility card with one-line status and one quick action.
- The long explanatory cloud/account text is removed from the dashboard.
- Meeting rows are denser and show more items on screen.
- The inline `Open meeting` button is removed and the row remains the tap target.
- The overall tone feels more technical/AI-like and less like a marketing card stack.
