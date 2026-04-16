import { getDatabase } from '../db';
import type { ExtractionLayer, ExtractionLayerField } from '../types';
import { getAuthSession } from './account';
import {
  deleteCloudExtractionLayer,
  listCloudExtractionLayers,
  saveCloudExtractionLayer,
} from './cloudUserData';

type LayerRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  spreadsheet_id: string | null;
  spreadsheet_title: string | null;
  sheet_title: string | null;
};

type FieldRow = {
  field_id: string;
  title: string;
  description: string;
};

type SaveExtractionLayerInput = {
  id?: string;
  name: string;
  fields: ExtractionLayerField[];
  spreadsheetId?: string | null;
  spreadsheetTitle?: string | null;
  sheetTitle?: string | null;
};

export async function listExtractionLayers(): Promise<ExtractionLayer[]> {
  const cached = await listLocalExtractionLayers();

  try {
    const session = await getAuthSession();

    if (!session) {
      return cached;
    }

    const cloudLayers = await listCloudExtractionLayers();
    await replaceLocalExtractionLayers(cloudLayers);
    return cloudLayers;
  } catch {
    return cached;
  }
}

export async function getExtractionLayer(id: string): Promise<ExtractionLayer | null> {
  const local = await getLocalExtractionLayer(id);

  if (local) {
    return local;
  }

  const session = await getAuthSession();

  if (!session) {
    return null;
  }

  const cloudLayers = await listCloudExtractionLayers();
  await replaceLocalExtractionLayers(cloudLayers);
  return cloudLayers.find((layer) => layer.id === id) ?? null;
}

export async function saveExtractionLayer(input: SaveExtractionLayerInput): Promise<ExtractionLayer> {
  const localSaved = await saveExtractionLayerToLocalCache(input);
  const session = await getAuthSession();

  if (!session) {
    return localSaved;
  }

  const cloudSaved = await saveCloudExtractionLayer(localSaved);
  await saveExtractionLayerToLocalCache(cloudSaved);
  return cloudSaved;
}

export async function deleteExtractionLayer(id: string) {
  await deleteExtractionLayerFromLocalCache(id);
  const session = await getAuthSession();

  if (!session) {
    return;
  }

  await deleteCloudExtractionLayer(id);
}

export async function replaceLocalExtractionLayers(layers: ExtractionLayer[]) {
  const existing = await listLocalExtractionLayers();

  for (const layer of existing) {
    await deleteExtractionLayerFromLocalCache(layer.id);
  }

  for (const layer of layers) {
    await saveExtractionLayerToLocalCache(layer);
  }
}

async function listLocalExtractionLayers(): Promise<ExtractionLayer[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<LayerRow>('SELECT * FROM extraction_layers ORDER BY datetime(updated_at) DESC');

  return Promise.all(rows.map((row) => hydrateLayer(row)));
}

async function getLocalExtractionLayer(id: string): Promise<ExtractionLayer | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<LayerRow>('SELECT * FROM extraction_layers WHERE id = ?', id);

  if (!row) {
    return null;
  }

  return hydrateLayer(row);
}

async function saveExtractionLayerToLocalCache(input: SaveExtractionLayerInput): Promise<ExtractionLayer> {
  const db = getDatabase();
  const cleanName = input.name.trim();
  const cleanFields = normalizeFields(input.fields);
  const now = new Date().toISOString();
  const layerId = input.id ?? createId();

  if (!cleanName) {
    throw new Error('Layer name is required.');
  }

  if (!cleanFields.length) {
    throw new Error('Add at least one field to the layer.');
  }

  const existing = input.id ? await getLocalExtractionLayer(input.id) : null;

  if (existing) {
    await db.runAsync(
      `UPDATE extraction_layers
       SET name = ?, updated_at = ?, spreadsheet_id = ?, spreadsheet_title = ?, sheet_title = ?
       WHERE id = ?`,
      cleanName,
      now,
      cleanNullable(input.spreadsheetId),
      cleanNullable(input.spreadsheetTitle),
      cleanNullable(input.sheetTitle),
      layerId
    );
  } else {
    await db.runAsync(
      `INSERT INTO extraction_layers (
        id, name, created_at, updated_at, spreadsheet_id, spreadsheet_title, sheet_title
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      layerId,
      cleanName,
      now,
      now,
      cleanNullable(input.spreadsheetId),
      cleanNullable(input.spreadsheetTitle),
      cleanNullable(input.sheetTitle)
    );
  }

  await db.runAsync('DELETE FROM extraction_layer_fields WHERE layer_id = ?', layerId);

  for (const [index, field] of cleanFields.entries()) {
    await db.runAsync(
      `INSERT INTO extraction_layer_fields (
        id, layer_id, field_id, title, description, position, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      createId(),
      layerId,
      field.id,
      field.title,
      field.description,
      index,
      now,
      now
    );
  }

  const saved = await getLocalExtractionLayer(layerId);

  if (!saved) {
    throw new Error('Layer could not be reloaded after saving.');
  }

  return saved;
}

async function deleteExtractionLayerFromLocalCache(id: string) {
  const db = getDatabase();
  await db.runAsync('DELETE FROM extraction_layer_fields WHERE layer_id = ?', id);
  await db.runAsync('DELETE FROM extraction_layers WHERE id = ?', id);
}

function normalizeFields(fields: ExtractionLayerField[]): ExtractionLayerField[] {
  const cleanFields = fields.map((field) => ({
    id: field.id.trim(),
    title: field.title.trim(),
    description: field.description.trim(),
  }));

  if (cleanFields.some((field) => !field.id || !field.title)) {
    throw new Error('Each field needs both an ID and a title.');
  }

  const uniqueIds = new Set(cleanFields.map((field) => field.id));
  if (uniqueIds.size !== cleanFields.length) {
    throw new Error('Field IDs must be unique within a layer.');
  }

  return cleanFields;
}

async function hydrateLayer(row: LayerRow): Promise<ExtractionLayer> {
  const db = getDatabase();
  const fields = await db.getAllAsync<FieldRow>(
    'SELECT field_id, title, description FROM extraction_layer_fields WHERE layer_id = ? ORDER BY position ASC',
    row.id
  );

  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    spreadsheetId: row.spreadsheet_id,
    spreadsheetTitle: row.spreadsheet_title,
    sheetTitle: row.sheet_title,
    fields: fields.map((field) => ({
      id: field.field_id,
      title: field.title,
      description: field.description,
    })),
  };
}

function cleanNullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
