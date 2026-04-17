# Layer Save And Sheet Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix signed-in layer saves so new layers use server-generated UUIDs, and simplify the layer editor so spreadsheet selection only appears through an explicit picker flow.

**Architecture:** Split the work into two clear pieces: first fix the extraction-layer save path so cloud creation omits `id` for new signed-in layers and replaces local cache entries with the server-returned UUID; then simplify `LayersScreen` by moving spreadsheet search/selection into a dedicated picker modal while keeping the main editor focused on details, sheet summary, and fields.

**Tech Stack:** React Native, Expo Router, Supabase Edge Functions, TypeScript, Vitest

---

## File Structure

- Modify: `src/services/cloudUserData.ts`
  - Allow cloud layer saves for new layers without a required `id` in the request payload.
- Modify: `src/services/extractionLayers.ts`
  - Separate local draft IDs from signed-in cloud creation behavior and replace the local cache with the server-returned layer.
- Modify: `src/services/extractionLayers.test.ts`
  - Add regression coverage for the UUID/save bug and local-cache replacement behavior.
- Modify: `supabase/functions/user-extraction-layers-sync/index.ts`
  - Accept missing `layer.id` on create and generate a UUID server-side before writing.
- Modify: `src/screens/LayersScreen.tsx`
  - Remove always-visible recent/search spreadsheet UI from the main editor and add a dedicated sheet-picker modal flow.
- Optional small modify: `src/features/layers/draft.ts`
  - Only if a tiny helper is needed to preserve sheet summary state cleanly between the editor and picker.

### Task 1: Fix Cloud Layer Creation To Use Server-Generated UUIDs

**Files:**
- Modify: `src/services/cloudUserData.ts`
- Modify: `src/services/extractionLayers.ts`
- Modify: `src/services/extractionLayers.test.ts`
- Modify: `supabase/functions/user-extraction-layers-sync/index.ts`

- [ ] **Step 1: Write the failing local service regression test**

```ts
test('uses the server-created UUID for new signed-in layers and removes the temporary local row', async () => {
  mockGetAuthSession.mockResolvedValue({ accessToken: 'token', user: { id: 'user-1' } });
  mockSaveCloudExtractionLayer.mockImplementation(async (layer) => ({
    ...layer,
    id: '7d7f6b4d-1d83-4f44-9d7a-4c4d8b2085af',
  }));

  const { listExtractionLayers, saveExtractionLayer } = await import('./extractionLayers');

  const saved = await saveExtractionLayer({
    name: 'Leads',
    fields: [{ id: 'name', title: 'Name', description: '' }],
  });

  expect(saved.id).toBe('7d7f6b4d-1d83-4f44-9d7a-4c4d8b2085af');
  await expect(listExtractionLayers()).resolves.toMatchObject([
    { id: '7d7f6b4d-1d83-4f44-9d7a-4c4d8b2085af', name: 'Leads' },
  ]);
  expect(layerRows).toHaveLength(1);
});
```

- [ ] **Step 2: Run the extraction-layers test to verify it fails**

Run: `npm test -- src/services/extractionLayers.test.ts`
Expected: FAIL because the service currently saves a temporary non-UUID local ID and sends it into the cloud save path.

- [ ] **Step 3: Update the cloud client save shape to allow create without `id`**

```ts
// src/services/cloudUserData.ts
export async function saveCloudExtractionLayer(
  layer: Omit<ExtractionLayer, 'id'> & { id?: string }
) {
  const response = await invokeAuthenticatedFunction<{ layer: ExtractionLayer }>(
    'user-extraction-layers-sync',
    {
      action: 'save',
      layer,
    }
  );

  return response.layer;
}
```

- [ ] **Step 4: Update the local save flow so signed-in creates omit the temporary local ID from cloud creation**

```ts
// src/services/extractionLayers.ts
export async function saveExtractionLayer(input: SaveExtractionLayerInput): Promise<ExtractionLayer> {
  const localSaved = await saveExtractionLayerToLocalCache(input);
  const session = await getAuthSession();

  if (!session) {
    return localSaved;
  }

  const isNewCloudLayer = !input.id;
  const cloudSaved = await saveCloudExtractionLayer(
    isNewCloudLayer
      ? {
          name: localSaved.name,
          createdAt: localSaved.createdAt,
          updatedAt: localSaved.updatedAt,
          spreadsheetId: localSaved.spreadsheetId,
          spreadsheetTitle: localSaved.spreadsheetTitle,
          sheetTitle: localSaved.sheetTitle,
          fields: localSaved.fields,
        }
      : localSaved
  );

  if (isNewCloudLayer && localSaved.id !== cloudSaved.id) {
    await deleteExtractionLayerFromLocalCache(localSaved.id);
  }

  await saveExtractionLayerToLocalCache(cloudSaved);
  return cloudSaved;
}
```

- [ ] **Step 5: Update the Supabase function to create UUIDs for new layers**

```ts
// supabase/functions/user-extraction-layers-sync/index.ts
type ExtractionLayerPayload = {
  id?: string;
  name: string;
  spreadsheetId: string | null;
  spreadsheetTitle: string | null;
  sheetTitle: string | null;
  createdAt: string;
  updatedAt: string;
  fields: ExtractionLayerFieldPayload[];
};
```

```ts
async function upsertUserLayer(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  layer: ExtractionLayerPayload
) {
  const layerId = layer.id?.trim() || crypto.randomUUID();

  const { error: layerError } = await adminClient.from('user_extraction_layers').upsert(
    {
      id: layerId,
      user_id: userId,
      name: layer.name,
      spreadsheet_id: layer.spreadsheetId,
      spreadsheet_title: layer.spreadsheetTitle,
      sheet_title: layer.sheetTitle,
      created_at: layer.createdAt,
      updated_at: layer.updatedAt,
    },
    { onConflict: 'id' }
  );

  if (layerError) {
    throw new Error(layerError.message);
  }

  const { error: deleteFieldsError } = await adminClient
    .from('user_extraction_layer_fields')
    .delete()
    .eq('layer_id', layerId);

  if (deleteFieldsError) {
    throw new Error(deleteFieldsError.message);
  }

  if (layer.fields.length) {
    const { error: insertFieldsError } = await adminClient.from('user_extraction_layer_fields').insert(
      layer.fields.map((field, index) => ({
        layer_id: layerId,
        field_id: field.id,
        title: field.title,
        description: field.description,
        position: index,
        updated_at: layer.updatedAt,
      }))
    );

    if (insertFieldsError) {
      throw new Error(insertFieldsError.message);
    }
  }

  return layerId;
}
```

```ts
// inside save action
const savedLayerId = await upsertUserLayer(adminClient, user.id, body.layer);
return jsonResponse({
  layer: await readUserLayer(adminClient, user.id, savedLayerId),
});
```

- [ ] **Step 6: Run the focused regression tests**

Run: `npm test -- src/services/extractionLayers.test.ts`
Expected: PASS with the new signed-in create behavior covered.

- [ ] **Step 7: Commit the save-flow fix**

```bash
git add src/services/cloudUserData.ts src/services/extractionLayers.ts src/services/extractionLayers.test.ts supabase/functions/user-extraction-layers-sync/index.ts
git commit -m "fix: use server generated ids for new cloud layers"
```

### Task 2: Simplify The Layer Editor And Add A Dedicated Sheet Picker Flow

**Files:**
- Modify: `src/screens/LayersScreen.tsx`
- Optional Modify: `src/features/layers/draft.ts`

- [ ] **Step 1: Add the sheet-picker state and remove eager recent-sheet loading from editor open**

```ts
// src/screens/LayersScreen.tsx
const [isSheetPickerVisible, setIsSheetPickerVisible] = useState(false);
```

```ts
const openCreateModal = () => {
  resetEditorState(createEmptyDraft());
  setIsEditorVisible(true);
};

const openEditModal = (layer: ExtractionLayer) => {
  const nextDraft = createDraftFromLayer(layer);
  resetEditorState(nextDraft);
  setIsEditorVisible(true);
};
```

- [ ] **Step 2: Run TypeScript to verify the temporary state edits compile before UI restructuring**

Run: `npx tsc --noEmit`
Expected: PASS or surface any missing references before the larger screen edit.

- [ ] **Step 3: Add an explicit sheet destination summary block to the main editor**

```tsx
<View style={styles.sectionBlock}>
  <Text style={styles.smallSectionLabel}>Sheet destination</Text>
  <SurfaceCard muted style={styles.destinationCard}>
    <Text style={styles.destinationTitle}>{currentDestination}</Text>
    <Text style={styles.destinationBody}>
      {draft.spreadsheetId
        ? 'This layer will keep using the selected spreadsheet and tab until you change it.'
        : 'Choose a spreadsheet and tab only when you want to connect this layer.'}
    </Text>
    <View style={styles.destinationActions}>
      <PillButton
        label={draft.spreadsheetId ? 'Change sheet' : 'Connect sheet'}
        onPress={() => setIsSheetPickerVisible(true)}
        variant="ghost"
      />
    </View>
  </SurfaceCard>
</View>
```

- [ ] **Step 4: Move spreadsheet search and tab selection into a dedicated picker modal**

```tsx
<Modal animationType="slide" transparent visible={isSheetPickerVisible} onRequestClose={() => setIsSheetPickerVisible(false)}>
  <View style={styles.modalScrim}>
    <View style={styles.modalCard}>
      <Text style={styles.modalTitle}>Choose sheet</Text>

      <View style={styles.sectionBlock}>
        <Text style={styles.smallSectionLabel}>Search spreadsheets</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={spreadsheetSearch}
            onChangeText={setSpreadsheetSearch}
            placeholder="Search by spreadsheet name"
            placeholderTextColor={palette.mutedInk}
          />
          <PillButton
            label={isSearchingSheets ? 'Searching…' : 'Search'}
            onPress={() => void handleSearchSheets()}
            variant="secondary"
            disabled={isSearchingSheets}
          />
        </View>
      </View>

      {!!searchResults.length && (
        <View style={styles.sectionBlock}>
          <Text style={styles.smallSectionLabel}>Choose spreadsheet</Text>
          {searchResults.map((spreadsheet) => (
            <Pressable
              key={spreadsheet.id}
              style={styles.optionRow}
              onPress={() => void handleSelectSpreadsheet(spreadsheet)}
            >
              <Text style={styles.optionTitle}>{spreadsheet.title}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {!!selectedSpreadsheet && !!availableTabs.length && (
        <View style={styles.sectionBlock}>
          <Text style={styles.smallSectionLabel}>Choose tab</Text>
          {availableTabs.map((tab) => (
            <Pressable key={tab} style={styles.optionRow} onPress={() => void handleSelectTab(tab)}>
              <Text style={styles.optionTitle}>{tab}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.modalActions}>
        <PillButton label="Cancel" onPress={() => setIsSheetPickerVisible(false)} variant="ghost" />
        <PillButton
          label={isPreparingSheet ? 'Creating…' : 'Create new sheet'}
          onPress={() => void handleCreateOrRefreshSheet()}
          disabled={isPreparingSheet}
          variant="secondary"
        />
      </View>
    </View>
  </View>
</Modal>
```

- [ ] **Step 5: Close the picker after successful sheet selection while preserving editor state**

```ts
// inside handleSelectTab alert actions
setDraft((current) =>
  applySheetSelection(current, {
    spreadsheetId: selectedSpreadsheet.id,
    spreadsheetTitle,
    sheetTitle: tabTitle,
    headers,
    mode: 'keep',
  })
);
setIsSheetPickerVisible(false);
```

```ts
setDraft((current) =>
  applySheetSelection(current, {
    spreadsheetId: selectedSpreadsheet.id,
    spreadsheetTitle,
    sheetTitle: tabTitle,
    headers,
    mode: 'import',
  })
);
setIsSheetPickerVisible(false);
```

- [ ] **Step 6: Add compact styles for the destination summary and picker modal, and remove the old always-visible recent/search sections from the main editor**

```ts
destinationCard: {
  gap: 10,
},
destinationTitle: {
  color: palette.ink,
  fontFamily: typography.heading.fontFamily,
  fontSize: 15,
},
destinationBody: {
  color: palette.mutedInk,
  fontFamily: typography.body.fontFamily,
  fontSize: 13,
  lineHeight: 19,
},
destinationActions: {
  alignItems: 'flex-start',
  marginLeft: -8,
},
searchRow: {
  flexDirection: 'row',
  gap: 10,
  alignItems: 'center',
},
searchInput: {
  flex: 1,
  borderWidth: 1,
  borderColor: palette.line,
  borderRadius: radii.pill,
  paddingHorizontal: 16,
  paddingVertical: 12,
  color: palette.ink,
  backgroundColor: palette.paper,
},
```

- [ ] **Step 7: Run the UI-safe verification commands**

Run: `npm test -- src/services/extractionLayers.test.ts src/features/layers/draft.test.ts && npx tsc --noEmit`
Expected: PASS and no type errors from the simplified picker flow.

- [ ] **Step 8: Commit the layer editor cleanup**

```bash
git add src/screens/LayersScreen.tsx src/features/layers/draft.ts
git commit -m "feat: simplify layer sheet picker flow"
```

### Task 3: Verify The End-To-End Layer Flow

**Files:**
- No new files required unless verification exposes a small missing test

- [ ] **Step 1: Run the full automated verification**

Run: `npm test && npx tsc --noEmit`
Expected: PASS across the full suite and TypeScript compile.

- [ ] **Step 2: Perform manual app verification**

Run these checks in the app:
- Create a new signed-in layer and confirm save no longer fails with the UUID error.
- Confirm the saved new layer keeps a server-style UUID on subsequent edit/save flows.
- Open the layer editor and verify recent spreadsheets are not always visible.
- Tap `Connect sheet` and confirm the picker opens.
- Search/select a spreadsheet, choose a tab, and confirm the editor shows the summary `Spreadsheet • Tab` after returning.
- Edit the layer name or fields and save again without losing the connected sheet.
- Tap `Change sheet`, cancel, and confirm the existing sheet remains attached.

Expected: The save flow is stable and the layer editor feels cleaner on phone.

- [ ] **Step 3: Commit any final verification-only adjustments if needed**

```bash
git add src/services/extractionLayers.test.ts src/screens/LayersScreen.tsx supabase/functions/user-extraction-layers-sync/index.ts
git commit -m "test: verify layer save and picker flow"
```
