import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
  mockGetAuthSession,
  mockListCloudExtractionLayers,
  mockSaveCloudExtractionLayer,
  mockDeleteCloudExtractionLayer,
} = vi.hoisted(() => ({
  mockGetAuthSession: vi.fn(),
  mockListCloudExtractionLayers: vi.fn(),
  mockSaveCloudExtractionLayer: vi.fn(),
  mockDeleteCloudExtractionLayer: vi.fn(),
}));

type LayerRecord = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  spreadsheet_id: string | null;
  spreadsheet_title: string | null;
  sheet_title: string | null;
};

type FieldRecord = {
  id: string;
  layer_id: string;
  field_id: string;
  title: string;
  description: string;
  position: number;
  created_at: string;
  updated_at: string;
};

const layerRows: LayerRecord[] = [];
const fieldRows: FieldRecord[] = [];

beforeEach(() => {
  layerRows.length = 0;
  fieldRows.length = 0;
  vi.resetModules();
  mockGetAuthSession.mockReset();
  mockListCloudExtractionLayers.mockReset();
  mockSaveCloudExtractionLayer.mockReset();
  mockDeleteCloudExtractionLayer.mockReset();
  mockGetAuthSession.mockResolvedValue(null);
});

vi.mock('./account', () => ({
  getAuthSession: mockGetAuthSession,
}));

vi.mock('./cloudUserData', () => ({
  listCloudExtractionLayers: mockListCloudExtractionLayers,
  saveCloudExtractionLayer: mockSaveCloudExtractionLayer,
  deleteCloudExtractionLayer: mockDeleteCloudExtractionLayer,
}));

vi.mock('../db', () => ({
  getDatabase: () => ({
    getFirstAsync: vi.fn(async (source: string, ...params: unknown[]) => {
      if (source.includes('FROM extraction_layers WHERE id = ?')) {
        return layerRows.find((row) => row.id === params[0]) ?? null;
      }

      return null;
    }),
    getAllAsync: vi.fn(async (source: string, ...params: unknown[]) => {
      if (source.includes('FROM extraction_layers')) {
        return [...layerRows].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      }

      if (source.includes('FROM extraction_layer_fields WHERE layer_id = ?')) {
        return fieldRows
          .filter((row) => row.layer_id === params[0])
          .sort((a, b) => a.position - b.position);
      }

      return [];
    }),
    runAsync: vi.fn(async (source: string, ...params: unknown[]) => {
      if (source.includes('INSERT INTO extraction_layers')) {
        layerRows.push({
          id: String(params[0]),
          name: String(params[1]),
          created_at: String(params[2]),
          updated_at: String(params[3]),
          spreadsheet_id: params[4] ? String(params[4]) : null,
          spreadsheet_title: params[5] ? String(params[5]) : null,
          sheet_title: params[6] ? String(params[6]) : null,
        });
        return;
      }

      if (source.includes('UPDATE extraction_layers') && source.includes('SET name = ?')) {
        const row = layerRows.find((layer) => layer.id === params[5]);
        if (!row) {
          return;
        }

        row.name = String(params[0]);
        row.updated_at = String(params[1]);
        row.spreadsheet_id = params[2] ? String(params[2]) : null;
        row.spreadsheet_title = params[3] ? String(params[3]) : null;
        row.sheet_title = params[4] ? String(params[4]) : null;
        return;
      }

      if (source.includes('DELETE FROM extraction_layer_fields WHERE layer_id = ?')) {
        const layerId = String(params[0]);
        for (let index = fieldRows.length - 1; index >= 0; index -= 1) {
          if (fieldRows[index]?.layer_id === layerId) {
            fieldRows.splice(index, 1);
          }
        }
        return;
      }

      if (source.includes('INSERT INTO extraction_layer_fields')) {
        fieldRows.push({
          id: String(params[0]),
          layer_id: String(params[1]),
          field_id: String(params[2]),
          title: String(params[3]),
          description: String(params[4]),
          position: Number(params[5]),
          created_at: String(params[6]),
          updated_at: String(params[7]),
        });
        return;
      }

      if (source.includes('DELETE FROM extraction_layers WHERE id = ?')) {
        const layerId = String(params[0]);
        for (let index = layerRows.length - 1; index >= 0; index -= 1) {
          if (layerRows[index]?.id === layerId) {
            layerRows.splice(index, 1);
          }
        }
      }
    }),
  }),
}));

describe('extraction layers service', () => {
  test('creates and lists a layer with trimmed fields and sheet metadata', async () => {
    const { listExtractionLayers, saveExtractionLayer } = await import('./extractionLayers');

    const saved = await saveExtractionLayer({
      name: '  Lead intake  ',
      spreadsheetId: 'sheet-123',
      spreadsheetTitle: 'mu-fathom - Lead intake',
      sheetTitle: 'Lead intake',
      fields: [
        {
          id: ' full_name ',
          title: ' Full name ',
          description: ' Customer name ',
        },
        {
          id: 'issue',
          title: 'Issue',
          description: 'Pain point',
        },
      ],
    });

    expect(saved.name).toBe('Lead intake');
    expect(saved.spreadsheetId).toBe('sheet-123');
    expect(saved.fields).toEqual([
      {
        id: 'full_name',
        title: 'Full name',
        description: 'Customer name',
      },
      {
        id: 'issue',
        title: 'Issue',
        description: 'Pain point',
      },
    ]);

    await expect(listExtractionLayers()).resolves.toEqual([saved]);
  });

  test('rejects duplicate field ids inside a layer', async () => {
    const { saveExtractionLayer } = await import('./extractionLayers');

    await expect(
      saveExtractionLayer({
        name: 'Lead intake',
        fields: [
          { id: 'email', title: 'Email', description: 'Primary email' },
          { id: ' email ', title: 'Secondary email', description: 'Duplicate id' },
        ],
      })
    ).rejects.toThrow('Field IDs must be unique within a layer.');
  });

  test('updates existing layers by replacing their fields', async () => {
    const { getExtractionLayer, saveExtractionLayer } = await import('./extractionLayers');

    const created = await saveExtractionLayer({
      name: 'Lead intake',
      fields: [{ id: 'email', title: 'Email', description: 'Primary email' }],
    });

    await saveExtractionLayer({
      id: created.id,
      name: 'Lead qualification',
      fields: [{ id: 'qualification', title: 'Qualification', description: 'Current qualification' }],
    });

    await expect(getExtractionLayer(created.id)).resolves.toMatchObject({
      id: created.id,
      name: 'Lead qualification',
      fields: [{ id: 'qualification', title: 'Qualification', description: 'Current qualification' }],
    });
  });

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

  test('lists cloud layers first when the user is signed in', async () => {
    mockGetAuthSession.mockResolvedValue({ accessToken: 'token', user: { id: 'user-1' } });
    mockListCloudExtractionLayers.mockResolvedValue([
      {
        id: 'layer-1',
        name: 'Leads',
        spreadsheetId: 'spreadsheet-1',
        spreadsheetTitle: 'Leads tracker',
        sheetTitle: 'Inbound',
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
        fields: [{ id: 'company', title: 'Company', description: '' }],
      },
    ]);

    const { listExtractionLayers } = await import('./extractionLayers');

    await expect(listExtractionLayers()).resolves.toMatchObject([
      { id: 'layer-1', spreadsheetId: 'spreadsheet-1', sheetTitle: 'Inbound' },
    ]);
  });

  test('keeps an existing sheet connection when editing a synced layer', async () => {
    mockGetAuthSession.mockResolvedValue({ accessToken: 'token', user: { id: 'user-1' } });
    mockSaveCloudExtractionLayer.mockImplementation(async (layer) => layer);

    const { saveExtractionLayer } = await import('./extractionLayers');

    await expect(
      saveExtractionLayer({
        id: 'layer-1',
        name: 'Leads',
        spreadsheetId: 'spreadsheet-1',
        spreadsheetTitle: 'Leads tracker',
        sheetTitle: 'Inbound',
        fields: [{ id: 'company', title: 'Company', description: '' }],
      })
    ).resolves.toMatchObject({
      spreadsheetId: 'spreadsheet-1',
      sheetTitle: 'Inbound',
    });
  });

  test('deletes a layer and its field rows', async () => {
    const { deleteExtractionLayer, listExtractionLayers, saveExtractionLayer } = await import('./extractionLayers');

    const created = await saveExtractionLayer({
      name: 'Lead intake',
      fields: [{ id: 'email', title: 'Email', description: 'Primary email' }],
    });

    await deleteExtractionLayer(created.id);

    await expect(listExtractionLayers()).resolves.toEqual([]);
    expect(fieldRows).toEqual([]);
  });
});
