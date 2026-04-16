# Layer Editor And Tab Navigation Design

## Summary

This change improves structured capture in two ways:

1. Move `Layers` out of Settings and into the main tab bar as a dedicated fourth tab.
2. Replace the current long inline layer editor with a shorter editor that keeps sheet selection visible and edits each field in its own popup.

The goal is to make layer creation faster, preserve sheet connections during edits, and support connecting a layer to an existing Google Sheet tab without forcing users to create a new sheet each time.

## Problems

### Current layer editing is hard to use

The current `Layers` screen uses one long modal with all field inputs inline. As the field count grows, editing becomes slow and visually heavy.

### Editing a layer drops its sheet connection

The persistence layer supports `spreadsheetId`, `spreadsheetTitle`, and `sheetTitle`, but the current save flow only persists the layer name and fields from the editor. As a result, editing an existing layer clears the saved sheet connection and forces the user to reconnect.

### Sheet connection flow is too limited

Current behavior only supports "connect or refresh sheet" for a layer. It does not let the user:

- browse recent spreadsheets
- search for an existing spreadsheet
- choose a specific tab inside a spreadsheet
- decide whether sheet headers should replace the layer fields

### Layers are buried in Settings

Structured capture is important enough to deserve a first-class location in the app shell. Keeping it inside Settings hurts discoverability.

## Goals

- Make layer editing shorter and easier on mobile
- Preserve the current sheet connection when editing unless the user explicitly changes it
- Add a spreadsheet-and-tab chooser for existing sheets
- Let the user decide whether to keep current fields or import columns from the chosen sheet
- Move `Layers` to the fourth tab in the bottom navigation

## Non-Goals

- Field reordering in this pass
- Multi-sheet sync for one layer
- Advanced schema typing beyond the existing `id`, `title`, and `description`
- Full spreadsheet browsing history beyond a lightweight recent list

## Navigation

- Add `Layers` as a real fourth tab in the bottom tab bar
- Keep `Settings` as its own tab
- Remove the current "Manage layers" promotion card from Settings
- Make the tab-backed Layers screen the primary destination for structured capture

Tab order:

1. Meetings
2. Record
3. Settings
4. Layers

## Layers List

The main `Layers` tab continues to show:

- layer name
- field count
- sheet connection status
- actions for edit, connect or change sheet, and delete

The CTA remains lightweight: users tap into a dedicated editor for changes.

## Layer Editor

Use the approved `Option B` layout:

- The main editor stays compact
- Fields are shown as a short list
- `Add field` opens a dedicated field popup
- Tapping an existing field opens that field in a popup for edit or delete

### Main editor sections

1. `Layer name`
2. `Sheet destination`
3. `Fields`

### Sheet destination section

This section is always visible in create and edit mode.

When a layer already has a sheet connected, show:

- spreadsheet title
- selected tab title
- status badge

Also show:

- recent 2-3 spreadsheets
- a search box for spreadsheet lookup
- selected spreadsheet tabs after spreadsheet selection

### Field popup

Each field popup supports:

- field id
- field title
- field description
- delete action for existing fields

This keeps the main editor short while still allowing detailed field editing.

## Sheet Connection Behavior

### Preserve existing connection

Editing a layer must keep `spreadsheetId`, `spreadsheetTitle`, and `sheetTitle` intact unless the user explicitly changes the destination.

Saving a layer after changing only the name or fields must not disconnect the sheet.

### Existing spreadsheet flow

When the user connects an existing sheet:

1. pick spreadsheet
2. pick tab inside that spreadsheet
3. choose one of:
   - `Keep current fields`
   - `Import columns from sheet`

### Field import behavior

If the user chooses `Import columns from sheet`:

- read the header row from the selected tab
- convert each header cell into a layer field
- use a normalized value for the field `id`
- use the original header text as the field `title`
- leave `description` empty by default

If the user chooses `Keep current fields`:

- update only the destination metadata
- keep the current layer schema untouched

If the selected tab has no header row:

- keep current fields
- show a warning explaining that no columns were imported
- do not block the connection

### New sheet flow

The existing "create or ensure a sheet for this layer" behavior stays available, but it becomes one option inside the sheet destination section instead of the only connection path.

## Existing model reuse

The current `ExtractionLayer` model already supports:

- `spreadsheetId`
- `spreadsheetTitle`
- `sheetTitle`
- `fields`

No schema expansion is required for the first pass.

## Editor draft model

The editor draft should be expanded so edit mode includes connection state, not just name and fields.

Draft should include:

- `id`
- `name`
- `fields`
- `spreadsheetId`
- `spreadsheetTitle`
- `sheetTitle`

It may also include temporary UI-only selection state for:

- recent spreadsheets
- search query
- search results
- selected spreadsheet tabs
- pending import mode

## Google Sheets service additions

Add service support for:

- listing recent spreadsheets
- searching spreadsheets by name
- listing tabs for a spreadsheet
- reading the first row from a selected tab

This can be implemented through new authenticated Supabase Edge Functions or an expanded Google Sheets helper layer behind them.

The separation should stay clear:

- app UI decides how the picker behaves
- backend helpers talk to Google APIs
- layer persistence only stores the final chosen spreadsheet/tab and resulting fields

## Save behavior

`saveExtractionLayer` remains the single persistence entry point, but all edit saves must pass through existing sheet metadata unless the destination changed.

That change fixes the current regression where normal edits clear the connection.

## Error Handling

- If spreadsheet search fails, show an inline error and keep the editor open
- If tab loading fails, let the user retry without losing draft changes
- If importing columns fails, keep the selected destination and let the user continue with current fields
- If save fails, do not dismiss the editor

## Testing

### Service tests

Add or update tests covering:

- editing an existing layer preserves sheet metadata
- changing name/fields without changing destination does not clear sheet connection
- importing columns maps header row to fields correctly
- connecting to an existing spreadsheet/tab stores the chosen destination

### UI behavior tests

Where practical, add tests for:

- opening field popup for add/edit
- keeping sheet destination visible in edit mode
- choosing keep-vs-import after selecting a spreadsheet tab

### Navigation tests

Update tab navigation tests to reflect the new fourth tab and the move from a standalone Layers destination to a tab-backed Layers route.

## Rollout Notes

- This is a UX and flow improvement, not a data migration
- Existing layers continue to load with their saved sheet metadata
- Users with already connected layers should see their current spreadsheet/tab when they open edit

## Open Decisions Resolved

- Use `Option B` editor layout
- Keep sheet chooser visible inside edit flow
- Let users pick both spreadsheet and tab
- Ask users whether to keep current fields or import columns from sheet
- Move `Layers` to the fourth tab instead of leaving it in Settings
- Leave field reordering out for this pass
