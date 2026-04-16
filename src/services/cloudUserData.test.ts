import { describe, expect, test, vi } from 'vitest';

import type { CloudUserDataSnapshot } from '../types';
const invokeAuthenticatedFunction = vi.fn();

vi.mock('./account', () => ({
  invokeAuthenticatedFunction,
}));

describe('cloud bootstrap snapshot', () => {
  test('maps preferences and provider configs into AppSettings', async () => {
    const { mapBootstrapSnapshotToAppSettings } = await import('./cloudUserData');

    const snapshot: CloudUserDataSnapshot = {
      profile: { displayName: 'Tarun', avatarUrl: null, timezone: 'Asia/Kolkata' },
      preferences: {
        selectedTranscriptionProvider: 'openai',
        selectedSummaryProvider: 'groq',
        deleteUploadedAudio: true,
        modelCatalogUrl: 'https://models.example.com/catalog.json',
        hasSeenOnboarding: true,
      },
      providers: [
        {
          providerId: 'openai',
          apiKey: 'sk-openai',
          baseUrl: 'https://api.openai.com/v1',
          transcriptionModel: 'gpt-4o-mini-transcribe',
          summaryModel: 'gpt-4.1-mini',
        },
        {
          providerId: 'groq',
          apiKey: 'gsk-groq',
          baseUrl: 'https://api.groq.com/openai/v1',
          transcriptionModel: 'whisper-large-v3',
          summaryModel: 'llama-3.3-70b',
        },
      ],
      integrations: [],
      layers: [],
    };

    expect(mapBootstrapSnapshotToAppSettings(snapshot).selectedSummaryProvider).toBe('groq');
    expect(mapBootstrapSnapshotToAppSettings(snapshot).providers.openai.apiKey).toBe('sk-openai');
  });

  test('maps layer rows and ordered fields into ExtractionLayer objects', async () => {
    const { mapBootstrapSnapshotToLayers } = await import('./cloudUserData');

    const snapshot: CloudUserDataSnapshot = {
      profile: { displayName: null, avatarUrl: null, timezone: null },
      preferences: {
        selectedTranscriptionProvider: 'openai',
        selectedSummaryProvider: 'openai',
        deleteUploadedAudio: false,
        modelCatalogUrl: '',
        hasSeenOnboarding: false,
      },
      providers: [],
      integrations: [],
      layers: [
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
      ],
    };

    expect(mapBootstrapSnapshotToLayers(snapshot)).toEqual(snapshot.layers);
  });

  test('fetches the authenticated bootstrap snapshot', async () => {
    invokeAuthenticatedFunction.mockResolvedValueOnce({ profile: null });

    const { fetchCloudUserDataSnapshot } = await import('./cloudUserData');

    await fetchCloudUserDataSnapshot();

    expect(invokeAuthenticatedFunction).toHaveBeenCalledWith('user-data-bootstrap', {});
  });
});
