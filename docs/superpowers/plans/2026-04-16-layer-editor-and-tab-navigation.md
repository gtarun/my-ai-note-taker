# Layer Editor And Tab Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Layers into the fourth tab and ship a compact layer editor that preserves sheet links, supports per-field popups, and lets users browse/search spreadsheets, choose tabs, and optionally import headers as fields.

**Architecture:** Keep the existing `ExtractionLayer` persistence model, but move the screen into the tab shell and introduce a small draft/helper module so sheet metadata survives edits and sheet-header imports are testable. Add one new authenticated Supabase function for spreadsheet browsing and reuse the existing Sheets access-token path for metadata reads and header import.

**Tech Stack:** Expo Router, React Native, TypeScript, Vitest, Supabase Edge Functions, Google Sheets/Drive APIs

---

## File Structure

- Create: `app/(tabs)/layers.tsx`
- Modify: `app/layers.tsx`
- Create: `src/screens/LayersScreen.tsx`
- Modify: `src/navigation/tabs.ts`
- Modify: `src/navigation/tabs.test.ts`
- Modify: `src/navigation/routes.ts`
- Modify: `src/navigation/routes.test.ts`
- Modify: `src/screens/SettingsScreen.tsx`
- Create: `src/features/layers/draft.ts`
- Create: `src/features/layers/draft.test.ts`
- Modify: `src/types.ts`
- Modify: `src/services/googleSheets.ts`
- Create: `src/services/googleSheets.test.ts`
- Modify: `src/services/extractionLayers.test.ts`
- Create: `supabase/functions/google-sheets-browser/index.ts`
- Modify: `supabase/functions/_shared/google-sheets.ts`
- Modify: `supabase/config.toml`

`src/screens/LayersScreen.tsx` becomes the only real layer-management UI. Route files stay tiny wrappers. `src/features/layers/draft.ts` owns the tricky editor state transitions so they are unit-testable without mounting React Native components. `google-sheets-browser` handles recent/search/tabs/header reads, while the existing ensure/append functions keep their narrower responsibilities.

### Task 1: Move Layers Into The Tab Shell

**Files:**
- Create: `app/(tabs)/layers.tsx`
- Modify: `app/layers.tsx`
- Create: `src/screens/LayersScreen.tsx`
- Modify: `src/navigation/tabs.ts`
- Modify: `src/navigation/tabs.test.ts`
- Modify: `src/navigation/routes.ts`
- Modify: `src/navigation/routes.test.ts`
- Modify: `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Write the failing navigation tests**

```ts
import { describe, expect, test } from 'vitest';

import { APP_TABS } from './tabs';

describe('app tabs', () => {
  test('defines the four primary tabs in display order', () => {
    expect(APP_TABS.map((tab) => tab.name)).toEqual(['index', 'record', 'settings', 'layers']);
    expect(APP_TABS.map((tab) => tab.label)).toEqual(['Meetings', 'Record', 'Settings', 'Layers']);
  });
});
```

```ts
import { describe, expect, test } from 'vitest';

import {
  APP_TABS_ROUTE,
  LAYERS_TAB_ROUTE,
  RECORD_TAB_ROUTE,
  SETTINGS_TAB_ROUTE,
} from './routes';

describe('navigation routes', () => {
  test('exposes canonical tab routes', () => {
    expect(APP_TABS_ROUTE).toBe('/(tabs)');
    expect(RECORD_TAB_ROUTE).toBe('/(tabs)/record');
    expect(SETTINGS_TAB_ROUTE).toBe('/(tabs)/settings');
    expect(LAYERS_TAB_ROUTE).toBe('/(tabs)/layers');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/navigation/tabs.test.ts src/navigation/routes.test.ts`

Expected: FAIL because `layers` and `LAYERS_TAB_ROUTE` do not exist yet.

- [ ] **Step 3: Add the fourth tab and canonical route**

```ts
export type AppTabDefinition = {
  name: 'index' | 'record' | 'settings' | 'layers';
  title: string;
  label: string;
  icon: 'home' | 'mic' | 'settings' | 'layers';
};

export const APP_TABS: AppTabDefinition[] = [
  { name: 'index', title: 'Meetings', label: 'Meetings', icon: 'home' },
  { name: 'record', title: 'New Recording', label: 'Record', icon: 'mic' },
  { name: 'settings', title: 'Settings', label: 'Settings', icon: 'settings' },
  { name: 'layers', title: 'Layers', label: 'Layers', icon: 'layers' },
];
```

```ts
export const LAYERS_TAB_ROUTE = '/(tabs)/layers' as const;
```

- [ ] **Step 4: Create the tab-backed route and shared screen wrapper**

```ts
// app/(tabs)/layers.tsx
export { default } from '../../src/screens/LayersScreen';
```

```ts
// app/layers.tsx
import { Redirect } from 'expo-router';

import { LAYERS_TAB_ROUTE } from '../src/navigation/routes';

export default function LegacyLayersRoute() {
  return <Redirect href={LAYERS_TAB_ROUTE} />;
}
```

```ts
// src/screens/LayersScreen.tsx
export { default } from '../../app/layers';
```

Replace the temporary re-export in the same task by moving the full current `app/layers.tsx` screen body into `src/screens/LayersScreen.tsx`, then leave `app/layers.tsx` as the redirect only.

- [ ] **Step 5: Remove the Settings promotion card**

Delete the `Structured capture / Manage layers` `SurfaceCard` block from `src/screens/SettingsScreen.tsx` so Layers is discovered through the tab bar instead of Settings.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/navigation/tabs.test.ts src/navigation/routes.test.ts`

Expected: PASS with 0 failures.

- [ ] **Step 7: Commit**

```bash
git add app/(tabs)/layers.tsx app/layers.tsx src/screens/LayersScreen.tsx src/navigation/tabs.ts src/navigation/tabs.test.ts src/navigation/routes.ts src/navigation/routes.test.ts src/screens/SettingsScreen.tsx
git commit -m "feat: move layers into tab navigation"
```

### Task 2: Lock Down Draft Behavior And Metadata Preservation

**Files:**
- Create: `src/features/layers/draft.ts`
- Create: `src/features/layers/draft.test.ts`
- Modify: `src/services/extractionLayers.test.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Write failing tests for draft behavior and metadata preservation**

```ts
import { describe, expect, test } from 'vitest';

import {
  applyImportedHeaders,
  createDraftFromLayer,
  toSaveLayerInput,
} from './draft';

describe('layer draft helpers', () => {
  test('preserves existing sheet metadata when building save input', () => {
    const draft = createDraftFromLayer({
      id: 'layer-1',
      name: 'Leads',
      spreadsheetId: 'sheet-123',
      spreadsheetTitle: 'Leads tracker',
      sheetTitle: 'Inbound',
      createdAt: '',
      updatedAt: '',
      fields: [{ id: 'name', title: 'Name', description: '' }],
    });

    expect(toSaveLayerInput(draft)).toMatchObject({
      spreadsheetId: 'sheet-123',
      spreadsheetTitle: 'Leads tracker',
      sheetTitle: 'Inbound',
    });
  });

  test('replaces fields from imported sheet headers', () => {
    expect(applyImportedHeaders(['Full Name', 'Deal Stage'])).toEqual([
      { id: 'full_name', title: 'Full Name', description: '' },
      { id: 'deal_stage', title: 'Deal Stage', description: '' },
    ]);
  });
});
```

```ts
test('keeps existing sheet metadata when updating layer fields', async () => {
  const { getExtractionLayer, saveExtractionLayer } = await import('./extractionLayers');

  const created = await saveExtractionLayer({
    name: 'Lead intake',
    spreadsheetId: 'sheet-123',
    spreadsheetTitle: 'Leads tracker',
    sheetTitle: 'Inbound',
    fields: [{ id: 'name', title: 'Name', description: '' }],
  });

  await saveExtractionLayer({
    id: created.id,
    name: 'Lead intake',
    spreadsheetId: 'sheet-123',
    spreadsheetTitle: 'Leads tracker',
    sheetTitle: 'Inbound',
    fields: [{ id: 'company', title: 'Company', description: '' }],
  });

  await expect(getExtractionLayer(created.id)).resolves.toMatchObject({
    spreadsheetId: 'sheet-123',
    spreadsheetTitle: 'Leads tracker',
    sheetTitle: 'Inbound',
    fields: [{ id: 'company', title: 'Company', description: '' }],
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/layers/draft.test.ts src/services/extractionLayers.test.ts`

Expected: FAIL because the helper module does not exist yet.

- [ ] **Step 3: Implement the draft helper module**

```ts
import type { ExtractionLayer, ExtractionLayerField } from '../../types';

export type EditableField = {
  key: string;
  id: string;
  title: string;
  description: string;
};

export type LayerDraft = {
  id?: string;
  name: string;
  spreadsheetId: string | null;
  spreadsheetTitle: string | null;
  sheetTitle: string | null;
  fields: EditableField[];
};

export function createDraftFromLayer(layer: ExtractionLayer): LayerDraft {
  return {
    id: layer.id,
    name: layer.name,
    spreadsheetId: layer.spreadsheetId,
    spreadsheetTitle: layer.spreadsheetTitle,
    sheetTitle: layer.sheetTitle,
    fields: layer.fields.map((field) => ({
      key: `${field.id}-${Math.random().toString(36).slice(2, 8)}`,
      ...field,
    })),
  };
}

export function applyImportedHeaders(headers: string[]): ExtractionLayerField[] {
  return headers
    .map((header) => header.trim())
    .filter(Boolean)
    .map((header) => ({
      id: header.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      title: header,
      description: '',
    }));
}

export function toSaveLayerInput(draft: LayerDraft) {
  return {
    id: draft.id,
    name: draft.name,
    spreadsheetId: draft.spreadsheetId,
    spreadsheetTitle: draft.spreadsheetTitle,
    sheetTitle: draft.sheetTitle,
    fields: draft.fields.map(({ id, title, description }) => ({ id, title, description })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/layers/draft.test.ts src/services/extractionLayers.test.ts`

Expected: PASS with all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/layers/draft.ts src/features/layers/draft.test.ts src/services/extractionLayers.test.ts src/types.ts
git commit -m "test: cover layer draft metadata preservation"
```

### Task 3: Add Spreadsheet Browse/Search/Tab/Header Services

**Files:**
- Create: `supabase/functions/google-sheets-browser/index.ts`
- Modify: `supabase/functions/_shared/google-sheets.ts`
- Modify: `supabase/config.toml`
- Modify: `src/services/googleSheets.ts`
- Create: `src/services/googleSheets.test.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Write the failing client service tests**

```ts
import { describe, expect, test, vi } from 'vitest';

const invokeAuthenticatedFunction = vi.fn();

vi.mock('./account', () => ({
  invokeAuthenticatedFunction,
}));

describe('google sheets service', () => {
  test('requests recent spreadsheets', async () => {
    invokeAuthenticatedFunction.mockResolvedValueOnce({ spreadsheets: [] });
    const service = await import('./googleSheets');

    await service.browseRecentSpreadsheets();

    expect(invokeAuthenticatedFunction).toHaveBeenCalledWith('google-sheets-browser', {
      mode: 'recent',
    });
  });

  test('requests tabs and headers for a selected spreadsheet', async () => {
    invokeAuthenticatedFunction.mockResolvedValueOnce({ tabs: [], headers: [] });
    const service = await import('./googleSheets');

    await service.getSpreadsheetTabsAndHeaders('sheet-123', 'Inbound');

    expect(invokeAuthenticatedFunction).toHaveBeenCalledWith('google-sheets-browser', {
      mode: 'details',
      spreadsheetId: 'sheet-123',
      sheetTitle: 'Inbound',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/googleSheets.test.ts`

Expected: FAIL because the browse APIs do not exist yet.

- [ ] **Step 3: Extend the shared Sheets helper and add the new function**

```ts
export async function searchSpreadsheets(accessToken: string, query: string) {
  const q = `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and name contains '${escapeDriveQueryName(query)}'`;
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&pageSize=10`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as { files: Array<{ id: string; name: string; modifiedTime?: string }> };
}

export async function listSpreadsheetTabs(accessToken: string, spreadsheetId: string) {
  const metadata = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  return metadata.sheets.map((sheet) => sheet.properties.title);
}

export async function readSheetHeaders(accessToken: string, spreadsheetId: string, sheetTitle: string) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(sheetTitle)}!1:1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) throw new Error(await response.text());
  const json = (await response.json()) as { values?: string[][] };
  return json.values?.[0] ?? [];
}
```

```ts
// supabase/functions/google-sheets-browser/index.ts
const body = (await request.json()) as {
  mode?: 'recent' | 'search' | 'details';
  query?: string;
  spreadsheetId?: string;
  sheetTitle?: string;
};
```

Support:

- `recent`: list the 3 most recently modified spreadsheets
- `search`: search spreadsheets by name
- `details`: return tabs and optional headers for the selected tab

Also add:

```toml
[functions.google-sheets-browser]
verify_jwt = false
```

- [ ] **Step 4: Add the client service wrappers**

```ts
export async function browseRecentSpreadsheets() {
  return invokeAuthenticatedFunction<SpreadsheetBrowserResponse>('google-sheets-browser', {
    mode: 'recent',
  });
}

export async function searchSpreadsheets(query: string) {
  return invokeAuthenticatedFunction<SpreadsheetBrowserResponse>('google-sheets-browser', {
    mode: 'search',
    query,
  });
}

export async function getSpreadsheetTabsAndHeaders(spreadsheetId: string, sheetTitle?: string) {
  return invokeAuthenticatedFunction<SpreadsheetBrowserResponse>('google-sheets-browser', {
    mode: 'details',
    spreadsheetId,
    sheetTitle,
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/services/googleSheets.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/google-sheets-browser/index.ts supabase/functions/_shared/google-sheets.ts supabase/config.toml src/services/googleSheets.ts src/services/googleSheets.test.ts src/types.ts
git commit -m "feat: add spreadsheet browsing services"
```

### Task 4: Refactor The Layers Screen To Option B

**Files:**
- Modify: `src/screens/LayersScreen.tsx`
- Modify: `src/features/layers/draft.ts`
- Modify: `src/services/googleSheets.ts`

- [ ] **Step 1: Write the failing draft-state tests for import-vs-keep**

```ts
test('keep current fields updates destination only', () => {
  const draft = {
    id: 'layer-1',
    name: 'Leads',
    spreadsheetId: null,
    spreadsheetTitle: null,
    sheetTitle: null,
    fields: [{ key: '1', id: 'name', title: 'Name', description: '' }],
  };

  expect(
    applySheetSelection(draft, {
      spreadsheetId: 'sheet-123',
      spreadsheetTitle: 'Leads tracker',
      sheetTitle: 'Inbound',
      headers: ['Company', 'Stage'],
      mode: 'keep',
    }).fields
  ).toEqual([{ key: '1', id: 'name', title: 'Name', description: '' }]);
});

test('import columns replaces fields from selected headers', () => {
  const draft = createEmptyDraft();
  const next = applySheetSelection(draft, {
    spreadsheetId: 'sheet-123',
    spreadsheetTitle: 'Leads tracker',
    sheetTitle: 'Inbound',
    headers: ['Company', 'Stage'],
    mode: 'import',
  });

  expect(next.fields.map((field) => field.id)).toEqual(['company', 'stage']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/layers/draft.test.ts`

Expected: FAIL because `applySheetSelection` does not exist yet.

- [ ] **Step 3: Implement the Option B editor flow**

Build the screen in `src/screens/LayersScreen.tsx` with these rules:

```ts
const [isFieldModalVisible, setIsFieldModalVisible] = useState(false);
const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
const [isSheetPickerVisible, setIsSheetPickerVisible] = useState(false);
const [spreadsheetSearch, setSpreadsheetSearch] = useState('');
const [recentSpreadsheets, setRecentSpreadsheets] = useState<SpreadsheetOption[]>([]);
const [searchResults, setSearchResults] = useState<SpreadsheetOption[]>([]);
const [availableTabs, setAvailableTabs] = useState<string[]>([]);
```

Use the helper module so:

- `openEditModal(layer)` seeds draft with existing sheet metadata
- `handleSave()` calls `saveExtractionLayer(toSaveLayerInput(draft))`
- field rows are compact list items instead of inline text-input stacks
- add/edit field opens a dedicated modal with id/title/description inputs
- sheet section always shows current spreadsheet and tab when available
- selecting a spreadsheet loads tabs
- selecting a tab triggers the `Keep current fields` vs `Import columns from sheet` decision

- [ ] **Step 4: Run targeted tests**

Run: `npx vitest run src/features/layers/draft.test.ts src/services/extractionLayers.test.ts src/services/googleSheets.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/LayersScreen.tsx src/features/layers/draft.ts src/features/layers/draft.test.ts
git commit -m "feat: redesign layer editor flow"
```

### Task 5: Final Verification And Cleanup

**Files:**
- Modify: `src/navigation/tabs.test.ts`
- Modify: `src/navigation/routes.test.ts`
- Modify: `src/services/extractionLayers.test.ts`
- Modify: `src/services/googleSheets.test.ts`
- Modify: `docs/superpowers/specs/2026-04-16-layer-editor-and-tab-navigation-design.md` (only if implementation reality requires a doc note)

- [ ] **Step 1: Run the full targeted verification suite**

Run: `npx vitest run src/navigation/tabs.test.ts src/navigation/routes.test.ts src/features/layers/draft.test.ts src/services/extractionLayers.test.ts src/services/googleSheets.test.ts`

Expected: PASS with 0 failed files.

- [ ] **Step 2: Smoke-check the changed app flows manually**

Manual checklist:

- open the app and confirm `Layers` appears as the fourth tab
- confirm `Settings` no longer contains the layer-management card
- create a new layer using the field popup flow
- edit an existing connected layer and save without changing sheet destination
- confirm the existing spreadsheet/tab remains attached
- choose an existing spreadsheet and tab
- verify the app offers `Keep current fields` and `Import columns from sheet`

- [ ] **Step 3: Commit**

```bash
git add src/navigation/tabs.test.ts src/navigation/routes.test.ts src/features/layers/draft.test.ts src/services/extractionLayers.test.ts src/services/googleSheets.test.ts src/screens/LayersScreen.tsx src/services/googleSheets.ts supabase/functions/google-sheets-browser/index.ts supabase/functions/_shared/google-sheets.ts supabase/config.toml
git commit -m "feat: ship layers tab and sheet-aware editor"
```

## Self-Review

- Spec coverage: covered navigation move, Option B editor, sheet preservation, spreadsheet + tab picking, keep-vs-import decision, recent/search flow, and non-goal of skipping reordering.
- Placeholder scan: no `TODO` or `TBD` markers remain.
- Type consistency: plan uses `spreadsheetId`, `spreadsheetTitle`, `sheetTitle`, and `fields` consistently across draft helpers, services, and screen steps.
