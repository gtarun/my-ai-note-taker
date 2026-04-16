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

export function createEditableField(input?: Partial<ExtractionLayerField>): EditableField {
  return {
    key: Math.random().toString(36).slice(2, 10),
    id: input?.id ?? '',
    title: input?.title ?? '',
    description: input?.description ?? '',
  };
}

export function createEmptyDraft(): LayerDraft {
  return {
    name: '',
    spreadsheetId: null,
    spreadsheetTitle: null,
    sheetTitle: null,
    fields: [createEditableField()],
  };
}

export function createDraftFromLayer(layer: ExtractionLayer): LayerDraft {
  return {
    id: layer.id,
    name: layer.name,
    spreadsheetId: layer.spreadsheetId,
    spreadsheetTitle: layer.spreadsheetTitle,
    sheetTitle: layer.sheetTitle,
    fields: layer.fields.map((field) => ({
      key: `${field.id}-${Math.random().toString(36).slice(2, 8)}`,
      id: field.id,
      title: field.title,
      description: field.description,
    })),
  };
}

export function applyImportedHeaders(headers: string[]): ExtractionLayerField[] {
  return headers
    .map((header) => header.trim())
    .filter(Boolean)
    .map((header, index) => ({
      id: normalizeHeaderId(header, index),
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
    fields: draft.fields.map(({ id, title, description }) => ({
      id,
      title,
      description,
    })),
  };
}

export function applySheetSelection(
  draft: LayerDraft,
  input: {
    spreadsheetId: string;
    spreadsheetTitle: string;
    sheetTitle: string;
    headers: string[];
    mode: 'keep' | 'import';
  }
): LayerDraft {
  return {
    ...draft,
    spreadsheetId: input.spreadsheetId,
    spreadsheetTitle: input.spreadsheetTitle,
    sheetTitle: input.sheetTitle,
    fields:
      input.mode === 'import' && input.headers.length
        ? applyImportedHeaders(input.headers).map((field) => createEditableField(field))
        : draft.fields,
  };
}

function normalizeHeaderId(header: string, index: number) {
  const normalized = header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || `field_${index + 1}`;
}
