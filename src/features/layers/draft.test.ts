import { describe, expect, test } from 'vitest';

import {
  applyImportedHeaders,
  applySheetSelection,
  createDraftFromLayer,
  createEmptyDraft,
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

  test('creates a new draft with a stable request token for saves', () => {
    const draft = createEmptyDraft();

    expect(draft.requestToken).toBeTruthy();
    expect(toSaveLayerInput(draft)).toMatchObject({
      requestToken: draft.requestToken,
    });
  });

  test('keeps the request token when applying sheet selection', () => {
    const draft = createEmptyDraft();

    expect(
      applySheetSelection(draft, {
        spreadsheetId: 'sheet-123',
        spreadsheetTitle: 'Leads tracker',
        sheetTitle: 'Inbound',
        headers: ['Company', 'Stage'],
        mode: 'keep',
      }).requestToken
    ).toBe(draft.requestToken);
  });

  test('replaces fields from imported sheet headers', () => {
    expect(applyImportedHeaders(['Full Name', 'Deal Stage'])).toEqual([
      { id: 'full_name', title: 'Full Name', description: '' },
      { id: 'deal_stage', title: 'Deal Stage', description: '' },
    ]);
  });

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
});
