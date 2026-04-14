# Meeting Detail UI Refresh Design

## Goal

Clean up the meeting detail screen so it feels like a focused detail view instead of a mini dashboard.

## Problems To Fix

- two back controls can appear at once
- the native back label can show `.(tabs)` instead of a human label
- the main action buttons take too much space and compete equally
- `Rename` is in the wrong place as a standalone CTA
- destructive actions are mixed into the normal workflow
- content order gives too much weight to recording mechanics instead of summary output

## Decision

Keep the native header and native back navigation only. Remove the in-screen back pill.

Turn the top card into the meeting command center:

- inline editable title
- small save action only when the title changed
- metadata and status
- optional offline badge

Below that, reduce the action area to:

- one primary CTA for processing
- one compact secondary row for playback and share
- one separated delete action lower on the screen

Reorder the detail content to prioritize the meeting output:

1. Summary
2. Action items
3. Decisions
4. Transcript
5. Recording info

## Scope

### In Scope

- remove the duplicate in-screen back control
- make the native header back label read cleanly
- move rename inline into the title card
- reduce the action area to one clear primary CTA plus compact secondary actions
- move delete out of the main action cluster
- reorder the lower sections for better reading flow

### Out Of Scope

- changing meeting processing behavior
- changing audio playback behavior
- redesigning the summary data model
- adding edit modals
- changing the tabs shell

## Screen Structure

### Header

Use the native stack header only.

Requirements:

- no custom back pill inside the screen body
- title remains `Meeting`
- back label should prefer `Meetings`
- if a clean `Meetings` label cannot be guaranteed, hide the back title text and keep only the native chevron
- avoid exposing route-group text like `.(tabs)`

### Top Card

This becomes the main context card.

Contents:

- inline editable title input
- small save/check affordance only when title changed
- date and duration
- status row
- optional offline badge if both providers are local
- error text if processing failed

UX rules:

- title is always visible and editable
- save affordance is hidden when there is no title change
- rename is no longer a standalone button outside the card

### Action Area

Primary:

- one full-width primary CTA
- label can remain `Run transcript + summary`

Secondary:

- one compact row with:
  - `Play` or `Pause`
  - `Share`

Danger:

- delete action separated from the normal workflow
- visually quieter than the main CTA
- placed after the last content section at the bottom of the screen

### Content Sections

Order:

1. `Summary`
2. `Action items`
3. `Decisions`
4. `Transcript`
5. `Recording`

Reason:

- the user came here for the processed output first
- raw recording state is useful, but secondary

## Visual Direction

Stay within the current editorial design system:

- cool paper background
- soft card surfaces
- minimal border noise
- one strong CTA at a time

Changes:

- reduce oversized square action blocks
- tighten vertical rhythm
- make secondary actions shorter and lighter
- make the title card feel more intentional and less form-like

## Interaction Rules

### Back Behavior

- if stack history exists, native back handles return
- if history is missing, explicit fallback navigation still exists through the existing route logic
- no second back control inside the content body

### Rename

- user edits the title inline
- save action appears only when the title differs from the stored title
- save action uses the existing rename flow

### Processing

- processing button remains available near the top
- busy state still disables repeated taps and shows loading text

### Playback

- playback remains a secondary action
- label should switch between `Play recording` and `Pause recording` or shorter equivalents if needed

### Delete

- delete stays destructive and confirmed
- delete should not visually compete with processing

## Implementation Notes

- most changes stay inside `app/meetings/[id].tsx`
- reuse the existing navigation helper introduced for the back fallback
- keep the current service calls for `processMeeting`, `renameMeeting`, `deleteMeeting`, and sharing
- update stack header options in `app/_layout.tsx` only if needed to improve the back label

## Testing

### Manual

Verify:

1. opening a meeting from `Meetings` shows only one back affordance
2. back label no longer shows `.(tabs)`
3. editing the title shows a save affordance only after changes
4. saving the title still works
5. process/share/play are visible without dominating the screen
6. delete remains available but visually separated
7. section order is summary-first

### Automated

- add or update a focused meeting-detail presentation/navigation test where practical
- run full test suite
- run `npx tsc --noEmit`

## Acceptance Criteria

- the meeting detail screen shows only one back affordance
- rename is inline, not a standalone CTA
- the primary CTA is visually clear and the rest of the buttons no longer dominate the screen
- delete is visually separated from normal actions
- summary content appears before recording info
- existing detail behavior still works
