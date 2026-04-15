import type {
  ExtractionLayer,
  ExtractionSheetAppendResult,
  ExtractionSheetConnection,
} from '../types';
import { invokeAuthenticatedFunction } from './account';

export async function ensureExtractionLayerSheet(
  layer: Pick<ExtractionLayer, 'id' | 'name' | 'fields' | 'spreadsheetId' | 'spreadsheetTitle' | 'sheetTitle'>
): Promise<ExtractionSheetConnection> {
  return invokeAuthenticatedFunction<ExtractionSheetConnection>('google-sheets-ensure-layer-sheet', {
    layerId: layer.id,
    layerName: layer.name,
    spreadsheetId: layer.spreadsheetId,
    spreadsheetTitle: layer.spreadsheetTitle,
    sheetTitle: layer.sheetTitle,
    fields: layer.fields.map((field) => ({
      id: field.id,
      title: field.title,
      description: field.description,
    })),
  });
}

export async function appendExtractionLayerRow(params: {
  layer: Pick<ExtractionLayer, 'id' | 'name' | 'fields' | 'spreadsheetId' | 'spreadsheetTitle' | 'sheetTitle'>;
  values: Record<string, string>;
}): Promise<ExtractionSheetAppendResult> {
  return invokeAuthenticatedFunction<ExtractionSheetAppendResult>('google-sheets-append-row', {
    layerId: params.layer.id,
    layerName: params.layer.name,
    spreadsheetId: params.layer.spreadsheetId,
    spreadsheetTitle: params.layer.spreadsheetTitle,
    sheetTitle: params.layer.sheetTitle,
    fields: params.layer.fields.map((field) => ({
      id: field.id,
      title: field.title,
      description: field.description,
    })),
    values: params.values,
  });
}
