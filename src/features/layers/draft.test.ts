import { describe, expect, test } from 'vitest';

import { applyImportedHeaders, createDraftFromLayer, toSaveLayerInput } from './draft';

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
