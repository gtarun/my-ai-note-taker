# Layer Save And Sheet Picker Design

## Goal

Fix the extraction-layer save failure caused by non-UUID client IDs in cloud sync, and simplify the layer editor so spreadsheet selection happens only through an explicit `Connect sheet` / `Change sheet` flow.

## Decisions

- Use server-generated IDs for new signed-in cloud layers.
- Do not send temporary local non-UUID IDs into `public.user_extraction_layers.id`.
- Keep existing persisted layer UUIDs stable for edits.
- Simplify the main layer editor so it no longer shows recent spreadsheets and search UI by default.
- Show a compact sheet destination summary inside the layer editor.
- Open a dedicated sheet-picker sub-flow only when the user taps `Connect sheet` or `Change sheet`.
- Keep the selected spreadsheet/tab attached when the user edits unrelated layer details.
- Keep `Create new sheet` available, but move it inside the picker flow instead of leaving it as the main editor emphasis.

## Problem Summary

### Save failure

New layers currently get client-side local IDs such as `1776415403279-w3hbqik3`. That works in local SQLite, but the cloud sync function writes the same ID into `public.user_extraction_layers.id`, which is typed as `uuid`. When a signed-in user saves a new layer, Supabase rejects the non-UUID value.

### Layer editor clutter

The current editor always shows:
- recent spreadsheets
- spreadsheet search
- spreadsheet/tab selection state

This makes the modal feel crowded, especially on phone. The user only needs those controls when they are explicitly connecting or changing a sheet.

## Data Flow Design

### New signed-in layer save

For a brand-new signed-in layer:
- local editor can still work with draft state normally
- cloud save request should omit `id`
- server creates the UUID
- server returns the saved layer with canonical UUID
- local cache updates to the returned layer record
- any temporary local representation should be replaced by the returned persisted record

### Existing signed-in layer save

For an existing synced layer:
- request includes the existing UUID
- server updates the same row
- selected spreadsheet/tab remains attached unless the user explicitly changes it

### Signed-out/local-only save

For signed-out users:
- local save can continue using client-generated IDs in SQLite
- cloud sync is skipped
- later sync/promotion can be handled separately when needed

## Layer Editor UX

### Main editor layout

The main editor should show three clear sections:
- layer name/details
- sheet destination summary
- fields list

The sheet destination summary should show either:
- `No sheet connected yet`
- or `Spreadsheet name • Tab name`

The main CTA in that section should be:
- `Connect sheet` when none exists
- `Change sheet` when a sheet is already connected

The main editor should not always show:
- recent spreadsheet lists
- spreadsheet search field
- tabs list

## Sheet Picker Sub-Flow

The sheet picker opens only when the user explicitly taps the sheet CTA.

### Picker flow

1. search/select spreadsheet
2. select tab
3. ask whether to:
   - `Keep current fields`
   - `Import columns`
4. return to the layer editor with updated sheet destination summary

### Existing sheet connection behavior

If the layer already has a connected spreadsheet/tab:
- opening the editor shows that existing connection in the summary block
- canceling the picker leaves the current connection untouched
- saving name/field changes does not disconnect the sheet

### Create new sheet behavior

`Create new sheet` remains supported, but it should live inside the sheet-picker flow rather than acting as a large always-visible control in the main editor.

This keeps the editor simpler while preserving sheet creation when the user needs it.

## Error Handling

- The UUID error should be eliminated by not sending temporary client IDs for new signed-in layers.
- If spreadsheet search or tab lookup fails, the picker shows an error while the layer editor remains intact.
- If the user cancels the picker, the existing destination remains unchanged.
- If a selected tab has no headers, `Import columns` should keep current fields and show the existing no-headers warning behavior.

## Technical Notes

Likely implementation areas:
- `src/services/extractionLayers.ts`
  - split local-only IDs from cloud save behavior for new signed-in layers
  - update local cache using the server-returned layer when cloud save succeeds
- `src/services/cloudUserData.ts`
  - allow save payloads for new layers without an `id`
- `supabase/functions/user-extraction-layers-sync/index.ts`
  - accept missing `id` for new saves and create UUID server-side
- `src/screens/LayersScreen.tsx`
  - remove always-visible recent/search blocks from the main editor
  - add compact destination summary section
  - move spreadsheet selection into a dedicated picker sub-flow
- related tests in extraction layer service and layer draft/presentation behavior

## Acceptance Criteria

- Saving a new signed-in layer no longer fails with `invalid input syntax for type uuid`.
- New signed-in layers are created with server-generated UUIDs.
- Existing synced layers keep their current UUIDs and update normally.
- The main layer editor no longer shows recent spreadsheets and search UI all the time.
- The editor shows a clean sheet destination summary.
- The sheet CTA reads `Connect sheet` or `Change sheet` appropriately.
- Tapping the sheet CTA opens a dedicated selection flow for spreadsheet + tab.
- Editing unrelated layer details does not disconnect the current sheet.
