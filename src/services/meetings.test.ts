import { beforeEach, describe, expect, test, vi } from 'vitest';

type MeetingRecord = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  audio_uri: string;
  duration_ms: number;
  source_type: 'recording' | 'import';
  status: string;
  transcript_text: string | null;
  summary_json: string | null;
  summary_short: string | null;
  error_message: string | null;
  selected_layer_id: string | null;
  extraction_layer_name: string | null;
  extraction_fields_json: string | null;
  extraction_values_json: string | null;
  extraction_status: string | null;
  extraction_error_message: string | null;
  extraction_sync_status: string | null;
  extraction_sync_error_message: string | null;
  extraction_synced_at: string | null;
  extraction_synced_row_id: string | null;
};

const meetingState = new Map<string, MeetingRecord>();

const transcribeAudio = vi.fn(async () => 'Customer name is Priya. Qualification is B.Com. Main issue is delayed payroll.');
const summarizeTranscript = vi.fn(async () => ({
  summary: 'Customer shared onboarding details and an issue.',
  actionItems: ['Follow up on payroll issue'],
  decisions: [],
  followUps: [],
}));
const fileSystemCopyAsync = vi.fn(async () => undefined);
const fileSystemGetInfoAsync = vi.fn(async (_uri?: string) => ({ exists: false }));
const fileSystemReadAsStringAsync = vi.fn(async () => '');
const fileSystemDeleteAsync = vi.fn(async () => undefined);
const extractStructuredData = vi.fn(async () => ({
  full_name: 'Priya',
  qualification: 'B.Com',
  issue: 'Delayed payroll',
}));
const getAppSettingsMock = vi.fn<() => Promise<any>>(async () => ({
  selectedTranscriptionProvider: 'openai',
  selectedSummaryProvider: 'openai',
  providers: {
    openai: {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      transcriptionModel: 'gpt-4o-mini-transcribe',
      summaryModel: 'gpt-4.1-mini',
    },
    openrouter: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
    groq: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
    anthropic: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
    gemini: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
    together: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
    fireworks: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
    deepseek: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
    custom: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
    local: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
  },
  deleteUploadedAudio: false,
  modelCatalogUrl: '',
}));
const getLocalDeviceSupportMock = vi.fn<() => Promise<any>>(async () => ({
  platform: 'web',
  localProcessingAvailable: false,
  supportsSummary: false,
  supportsTranscription: false,
  requiresCustomBuild: false,
  reason: 'Local model runtime is mobile-only.',
}));
const getInstalledModelMock = vi.fn(async () => null);
const isProviderConfiguredMock = vi.fn(() => true);
const appendExtractionLayerRow = vi.fn(async () => ({
  rowRange: 'Lead intake!A2:C2',
  spreadsheetId: 'sheet-123',
  spreadsheetTitle: 'mu-fathom - Lead intake',
  sheetTitle: 'Lead intake',
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'web',
  },
}));

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  EncodingType: {
    Base64: 'base64',
  },
  copyAsync: fileSystemCopyAsync,
  getInfoAsync: fileSystemGetInfoAsync,
  readAsStringAsync: fileSystemReadAsStringAsync,
  deleteAsync: fileSystemDeleteAsync,
}));

beforeEach(() => {
  vi.resetModules();
  transcribeAudio.mockClear();
  summarizeTranscript.mockClear();
  extractStructuredData.mockClear();
  getAppSettingsMock.mockClear();
  getAppSettingsMock.mockImplementation(async () => ({
    selectedTranscriptionProvider: 'openai',
    selectedSummaryProvider: 'openai',
    providers: {
      openai: {
        apiKey: 'test-key',
        baseUrl: 'https://api.openai.com/v1',
        transcriptionModel: 'gpt-4o-mini-transcribe',
        summaryModel: 'gpt-4.1-mini',
      },
      openrouter: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
      groq: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
      anthropic: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
      gemini: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
      together: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
      fireworks: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
      deepseek: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
      custom: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
      local: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
    },
    deleteUploadedAudio: false,
    modelCatalogUrl: '',
  }));
  getLocalDeviceSupportMock.mockClear();
  getLocalDeviceSupportMock.mockImplementation(async () => ({
    platform: 'web',
    localProcessingAvailable: false,
    supportsSummary: false,
    supportsTranscription: false,
    requiresCustomBuild: false,
    reason: 'Local model runtime is mobile-only.',
  }));
  getInstalledModelMock.mockClear();
  getInstalledModelMock.mockImplementation(async () => null);
  isProviderConfiguredMock.mockClear();
  isProviderConfiguredMock.mockImplementation(() => true);
  appendExtractionLayerRow.mockClear();
  fileSystemCopyAsync.mockClear();
  fileSystemGetInfoAsync.mockReset();
  fileSystemGetInfoAsync.mockImplementation(async () => ({ exists: false }));
  fileSystemReadAsStringAsync.mockReset();
  fileSystemReadAsStringAsync.mockImplementation(async () => '');
  fileSystemDeleteAsync.mockClear();
  meetingState.clear();
  meetingState.set('meeting-1', {
    id: 'meeting-1',
    title: 'Lead call',
    created_at: '2026-04-15T09:00:00.000Z',
    updated_at: '2026-04-15T09:00:00.000Z',
    audio_uri: 'file:///lead-call.m4a',
    duration_ms: 0,
    source_type: 'recording',
    status: 'local_only',
    transcript_text: null,
    summary_json: null,
    summary_short: null,
    error_message: null,
    selected_layer_id: null,
    extraction_layer_name: null,
    extraction_fields_json: null,
    extraction_values_json: null,
    extraction_status: null,
    extraction_error_message: null,
    extraction_sync_status: null,
    extraction_sync_error_message: null,
    extraction_synced_at: null,
    extraction_synced_row_id: null,
  });
});

vi.mock('../db', () => ({
  getDatabase: () => ({
    getFirstAsync: vi.fn(async (source: string, ...params: unknown[]) => {
      if (source.includes('FROM meetings WHERE id = ?')) {
        return meetingState.get(String(params[0])) ?? null;
      }

      return null;
    }),
    getAllAsync: vi.fn(async (source: string) => {
      if (source.includes('FROM meetings')) {
        return [...meetingState.values()];
      }

      return [];
    }),
    runAsync: vi.fn(async (source: string, ...params: unknown[]) => {
      if (source.includes('SET status = ?, error_message = ?, updated_at = ?')) {
        const meeting = meetingState.get(String(params[3]));
        if (meeting) {
          meeting.status = String(params[0]);
          meeting.error_message = params[1] ? String(params[1]) : null;
          meeting.updated_at = String(params[2]);
        }
        return;
      }

      if (source.includes('UPDATE meetings SET audio_uri = ? WHERE id = ?')) {
        const meeting = meetingState.get(String(params[1]));
        if (meeting) {
          meeting.audio_uri = String(params[0]);
        }
        return;
      }

      if (source.includes('SET transcript_text = ?, updated_at = ?')) {
        const meeting = meetingState.get(String(params[2]));
        if (meeting) {
          meeting.transcript_text = String(params[0]);
          meeting.updated_at = String(params[1]);
        }
        return;
      }

      if (source.includes('SET summary_json = ?, summary_short = ?, updated_at = ?')) {
        const meeting = meetingState.get(String(params[3]));
        if (meeting) {
          meeting.summary_json = String(params[0]);
          meeting.summary_short = String(params[1]);
          meeting.updated_at = String(params[2]);
        }
        return;
      }

      if (source.includes('SET transcript_text = NULL, summary_json = NULL, summary_short = NULL')) {
        const meeting = meetingState.get(String(params[1]));
        if (meeting) {
          meeting.transcript_text = null;
          meeting.summary_json = null;
          meeting.summary_short = null;
          meeting.error_message = null;
          meeting.selected_layer_id = null;
          meeting.extraction_layer_name = null;
          meeting.extraction_fields_json = null;
          meeting.extraction_values_json = null;
          meeting.extraction_status = null;
          meeting.extraction_error_message = null;
          meeting.extraction_sync_status = null;
          meeting.extraction_sync_error_message = null;
          meeting.extraction_synced_at = null;
          meeting.extraction_synced_row_id = null;
          meeting.updated_at = String(params[0]);
        }
        return;
      }

      if (source.includes('selected_layer_id = ?') && source.includes('extraction_layer_name = ?')) {
        const meeting = meetingState.get(String(params[9]));
        if (meeting) {
          meeting.selected_layer_id = params[0] ? String(params[0]) : null;
          meeting.extraction_layer_name = params[1] ? String(params[1]) : null;
          meeting.extraction_fields_json = params[2] ? String(params[2]) : null;
          meeting.extraction_values_json = params[3] ? String(params[3]) : null;
          meeting.extraction_status = params[4] ? String(params[4]) : null;
          meeting.extraction_error_message = params[5] ? String(params[5]) : null;
          meeting.extraction_sync_status = params[6] ? String(params[6]) : null;
          meeting.extraction_sync_error_message = params[7] ? String(params[7]) : null;
          meeting.updated_at = String(params[8]);
        }
        return;
      }

      if (source.includes('extraction_values_json = ?') && source.includes('extraction_sync_status = ?')) {
        const meeting = meetingState.get(String(params[4]));
        if (meeting) {
          meeting.extraction_values_json = String(params[0]);
          meeting.extraction_sync_status = String(params[1]);
          meeting.extraction_sync_error_message = params[2] ? String(params[2]) : null;
          meeting.updated_at = String(params[3]);
        }
        return;
      }

      if (source.includes('extraction_sync_status = ?') && source.includes('extraction_sync_error_message = ?')) {
        const meeting = meetingState.get(String(params[5]));
        if (meeting) {
          meeting.extraction_sync_status = String(params[0]);
          meeting.extraction_sync_error_message = params[1] ? String(params[1]) : null;
          meeting.extraction_synced_at = params[2] ? String(params[2]) : null;
          meeting.extraction_synced_row_id = params[3] ? String(params[3]) : null;
          meeting.updated_at = String(params[4]);
        }
      }
    }),
  }),
  mapMeetingRow: (row: Record<string, unknown>) => ({
    id: String(row.id),
    title: String(row.title),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    audioUri: String(row.audio_uri),
    durationMs: Number(row.duration_ms),
    sourceType: row.source_type === 'import' ? 'import' : 'recording',
    status: row.status,
    transcriptText: row.transcript_text ? String(row.transcript_text) : null,
    summaryJson: row.summary_json ? String(row.summary_json) : null,
    summaryShort: row.summary_short ? String(row.summary_short) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    extractionResult: row.selected_layer_id
      ? {
          layerId: String(row.selected_layer_id),
          layerName: row.extraction_layer_name ? String(row.extraction_layer_name) : '',
          fields: row.extraction_fields_json ? JSON.parse(String(row.extraction_fields_json)) : [],
          values: row.extraction_values_json ? JSON.parse(String(row.extraction_values_json)) : {},
          extractionStatus: row.extraction_status,
          extractionErrorMessage: row.extraction_error_message ? String(row.extraction_error_message) : null,
          syncStatus: row.extraction_sync_status,
          syncErrorMessage: row.extraction_sync_error_message ? String(row.extraction_sync_error_message) : null,
          syncedAt: row.extraction_synced_at ? String(row.extraction_synced_at) : null,
          syncedRowId: row.extraction_synced_row_id ? String(row.extraction_synced_row_id) : null,
        }
      : null,
  }),
}));

vi.mock('./ai', () => ({
  transcribeAudio,
  summarizeTranscript,
  extractStructuredData,
}));

vi.mock('./settings', () => ({
  getAppSettings: getAppSettingsMock,
}));

vi.mock('./providers', () => ({
  providerDefinitions: [
    { id: 'openai', supportsTranscription: true, supportsSummary: true },
    { id: 'openrouter', supportsTranscription: true, supportsSummary: true },
    { id: 'groq', supportsTranscription: true, supportsSummary: true },
    { id: 'anthropic', supportsTranscription: false, supportsSummary: true },
    { id: 'gemini', supportsTranscription: false, supportsSummary: true },
    { id: 'together', supportsTranscription: false, supportsSummary: true },
    { id: 'fireworks', supportsTranscription: false, supportsSummary: true },
    { id: 'deepseek', supportsTranscription: false, supportsSummary: true },
    { id: 'custom', supportsTranscription: true, supportsSummary: true },
    { id: 'local', supportsTranscription: true, supportsSummary: true },
  ],
  isProviderConfigured: isProviderConfiguredMock,
}));

vi.mock('./localModels', () => ({
  getInstalledModel: getInstalledModelMock,
}));

vi.mock('./localInference', () => ({
  IOS_LOCAL_SUMMARY_UNAVAILABLE_ERROR:
    'Local summary and structured analysis are not available on iOS in this build. Keep transcription local, then choose a cloud provider for Summary and analysis in Settings.',
  IOS_LOCAL_SUMMARY_FALLBACK_REQUIRED_ERROR:
    'Local summary and structured analysis are not available on iOS in this build, and no cloud summary provider is configured. Keep transcription local, then add a cloud provider like OpenAI for Summary and analysis in Settings.',
  getLocalDeviceSupport: getLocalDeviceSupportMock,
}));

vi.mock('./extractionLayers', () => ({
  getExtractionLayer: vi.fn(async (layerId: string) => {
    if (layerId !== 'layer-1') {
      return null;
    }

    return {
      id: 'layer-1',
      name: 'Lead intake',
      spreadsheetId: 'sheet-123',
      spreadsheetTitle: 'mu-fathom - Lead intake',
      sheetTitle: 'Lead intake',
      createdAt: '2026-04-15T09:00:00.000Z',
      updatedAt: '2026-04-15T09:00:00.000Z',
      fields: [
        { id: 'full_name', title: 'Full name', description: 'Customer name' },
        { id: 'qualification', title: 'Qualification', description: 'Current qualification' },
        { id: 'issue', title: 'Issue', description: 'Pain point' },
      ],
    };
  }),
}));

vi.mock('./googleSheets', () => ({
  appendExtractionLayerRow,
}));

describe('meeting processing with extraction layers', () => {
  test('keeps the existing transcript + summary flow when no layer is selected', async () => {
    fileSystemGetInfoAsync.mockImplementation(async () => ({ exists: true, size: 128 }));
    fileSystemReadAsStringAsync.mockImplementation(async () => 'YQ==');
    const { getMeeting, processMeeting } = await import('./meetings');

    await processMeeting('meeting-1');

    const meeting = await getMeeting('meeting-1');
    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    expect(summarizeTranscript).toHaveBeenCalledTimes(1);
    expect(extractStructuredData).not.toHaveBeenCalled();
    expect(meeting?.status).toBe('ready');
    expect(meeting?.extractionResult).toBeNull();
  });

  test('falls back to a configured cloud summary provider when iOS local summary is unavailable', async () => {
    fileSystemGetInfoAsync.mockImplementation(async () => ({ exists: true, size: 128 }));
    fileSystemReadAsStringAsync.mockImplementation(async () => 'YQ==');
    getAppSettingsMock.mockImplementation(async () => ({
      selectedTranscriptionProvider: 'local',
      selectedSummaryProvider: 'local',
      providers: {
        openai: {
          apiKey: 'test-key',
          baseUrl: 'https://api.openai.com/v1',
          transcriptionModel: 'gpt-4o-mini-transcribe',
          summaryModel: 'gpt-4.1-mini',
        },
        openrouter: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        groq: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        anthropic: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        gemini: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        together: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        fireworks: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        deepseek: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        custom: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        local: { apiKey: '', baseUrl: '', transcriptionModel: 'whisper-base', summaryModel: 'gemma-3-1b-it-q4' },
      },
      deleteUploadedAudio: false,
      modelCatalogUrl: '',
    }));
    getLocalDeviceSupportMock.mockImplementation(async () => ({
      platform: 'ios',
      localProcessingAvailable: true,
      supportsSummary: false,
      supportsTranscription: true,
      requiresCustomBuild: true,
      reason: 'iOS supports local transcription in this build. Local summary and structured analysis are not supported yet.',
    }));
    getInstalledModelMock.mockImplementation(async (modelId: string) =>
      modelId === 'whisper-base'
        ? {
            id: 'whisper-base',
            status: 'installed',
          }
        : null
    );

    const { getMeeting, processMeeting } = await import('./meetings');

    await processMeeting('meeting-1');

    const meeting = await getMeeting('meeting-1');
    expect(transcribeAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'local',
      })
    );
    expect(summarizeTranscript).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'openai',
        provider: expect.objectContaining({
          summaryModel: 'gpt-4.1-mini',
        }),
      })
    );
    expect(meeting?.status).toBe('ready');
  });

  test('keeps summary local when iOS local summary support is available', async () => {
    fileSystemGetInfoAsync.mockImplementation(async () => ({ exists: true, size: 128 }));
    fileSystemReadAsStringAsync.mockImplementation(async () => 'YQ==');
    getAppSettingsMock.mockImplementation(async () => ({
      selectedTranscriptionProvider: 'local',
      selectedSummaryProvider: 'local',
      providers: {
        openai: {
          apiKey: 'test-key',
          baseUrl: 'https://api.openai.com/v1',
          transcriptionModel: 'gpt-4o-mini-transcribe',
          summaryModel: 'gpt-4.1-mini',
        },
        openrouter: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        groq: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        anthropic: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        gemini: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        together: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        fireworks: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        deepseek: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        custom: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        local: {
          apiKey: '',
          baseUrl: '',
          transcriptionModel: 'whisper-base',
          summaryModel: 'qwen2.5-1.5b-instruct-q8',
        },
      },
      deleteUploadedAudio: false,
      modelCatalogUrl: '',
    }));
    getLocalDeviceSupportMock.mockImplementation(async () => ({
      platform: 'ios',
      localProcessingAvailable: true,
      supportsSummary: true,
      supportsTranscription: true,
      requiresCustomBuild: true,
      reason: 'iOS local transcription and summary are available in this build.',
    }));
    getInstalledModelMock.mockImplementation(async (modelId: string) =>
      modelId === 'whisper-base' || modelId === 'qwen2.5-1.5b-instruct-q8'
        ? {
            id: modelId,
            status: 'installed',
          }
        : null
    );

    const { getMeeting, processMeeting } = await import('./meetings');

    await processMeeting('meeting-1');

    const meeting = await getMeeting('meeting-1');
    expect(transcribeAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'local',
      })
    );
    expect(summarizeTranscript).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'local',
        provider: expect.objectContaining({
          summaryModel: 'qwen2.5-1.5b-instruct-q8',
        }),
      })
    );
    expect(meeting?.status).toBe('ready');
  });

  test('fails clearly when iOS local summary is unavailable and no cloud summary provider is configured', async () => {
    fileSystemGetInfoAsync.mockImplementation(async () => ({ exists: true, size: 128 }));
    fileSystemReadAsStringAsync.mockImplementation(async () => 'YQ==');
    getAppSettingsMock.mockImplementation(async () => ({
      selectedTranscriptionProvider: 'local',
      selectedSummaryProvider: 'local',
      providers: {
        openai: {
          apiKey: '',
          baseUrl: 'https://api.openai.com/v1',
          transcriptionModel: 'gpt-4o-mini-transcribe',
          summaryModel: 'gpt-4.1-mini',
        },
        openrouter: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        groq: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        anthropic: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        gemini: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        together: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        fireworks: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        deepseek: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        custom: { apiKey: '', baseUrl: '', transcriptionModel: '', summaryModel: '' },
        local: { apiKey: '', baseUrl: '', transcriptionModel: 'whisper-base', summaryModel: 'gemma-3-1b-it-q4' },
      },
      deleteUploadedAudio: false,
      modelCatalogUrl: '',
    }));
    getLocalDeviceSupportMock.mockImplementation(async () => ({
      platform: 'ios',
      localProcessingAvailable: true,
      supportsSummary: false,
      supportsTranscription: true,
      requiresCustomBuild: true,
      reason: 'iOS supports local transcription in this build. Local summary and structured analysis are not supported yet.',
    }));
    getInstalledModelMock.mockImplementation(async (modelId: string) =>
      modelId === 'whisper-base'
        ? {
            id: 'whisper-base',
            status: 'installed',
          }
        : null
    );
    isProviderConfiguredMock.mockImplementation((providerId: string) => providerId === 'local');

    const { processMeeting } = await import('./meetings');

    await expect(processMeeting('meeting-1')).rejects.toThrow(
      'Local summary and structured analysis are not available on iOS in this build, and no cloud summary provider is configured. Keep transcription local, then add a cloud provider like OpenAI for Summary and analysis in Settings.'
    );
  });

  test('repairs stale app audio URIs after an iOS rebuild before processing', async () => {
    const staleAudioUri =
      'file:///var/mobile/Containers/Data/Application/OLD/Documents/audio/rebuild-call.m4a';
    const currentAudioUri = 'file:///documents/audio/rebuild-call.m4a';
    const meeting = meetingState.get('meeting-1');

    if (meeting) {
      meeting.audio_uri = staleAudioUri;
    }

    fileSystemGetInfoAsync.mockImplementation(async (uri?: string) => ({
      exists: uri === currentAudioUri,
      size: uri === currentAudioUri ? 128 : undefined,
    }));
    fileSystemReadAsStringAsync.mockImplementation(async () => 'YQ==');
    const { getMeeting, processMeeting } = await import('./meetings');

    await processMeeting('meeting-1');

    const repairedMeeting = await getMeeting('meeting-1');
    expect(repairedMeeting?.audioUri).toBe(currentAudioUri);
    expect(meetingState.get('meeting-1')?.audio_uri).toBe(currentAudioUri);
    expect(transcribeAudio).toHaveBeenCalledWith(expect.objectContaining({ audioUri: currentAudioUri }));
  });

  test('stores extracted values when a layer is selected', async () => {
    fileSystemGetInfoAsync.mockImplementation(async () => ({ exists: true, size: 128 }));
    fileSystemReadAsStringAsync.mockImplementation(async () => 'YQ==');
    const { getMeeting, processMeeting } = await import('./meetings');

    await processMeeting('meeting-1', { layerId: 'layer-1' });

    const meeting = await getMeeting('meeting-1');
    expect(extractStructuredData).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: [
          { id: 'full_name', title: 'Full name', description: 'Customer name' },
          { id: 'qualification', title: 'Qualification', description: 'Current qualification' },
          { id: 'issue', title: 'Issue', description: 'Pain point' },
        ],
      })
    );
    expect(meeting?.status).toBe('ready');
    expect(meeting?.extractionResult).toMatchObject({
      layerId: 'layer-1',
      layerName: 'Lead intake',
      extractionStatus: 'ready',
      syncStatus: 'not_synced',
      values: {
        full_name: 'Priya',
        qualification: 'B.Com',
        issue: 'Delayed payroll',
      },
    });
  });

  test('keeps transcript + summary ready even when extraction fails', async () => {
    fileSystemGetInfoAsync.mockImplementation(async () => ({ exists: true, size: 128 }));
    fileSystemReadAsStringAsync.mockImplementation(async () => 'YQ==');
    extractStructuredData.mockImplementationOnce(async () => {
      throw new Error('Model returned invalid JSON.');
    });

    const { getMeeting, processMeeting } = await import('./meetings');

    await expect(processMeeting('meeting-1', { layerId: 'layer-1' })).resolves.toBeUndefined();

    const meeting = await getMeeting('meeting-1');
    expect(meeting?.status).toBe('ready');
    expect(meeting?.summaryShort).toBe('Customer shared onboarding details and an issue.');
    expect(meeting?.extractionResult).toMatchObject({
      extractionStatus: 'failed',
      extractionErrorMessage: 'Model returned invalid JSON.',
      syncStatus: 'not_synced',
    });
  });

  test('persists review edits and syncs the row to Google Sheets', async () => {
    fileSystemGetInfoAsync.mockImplementation(async () => ({ exists: true, size: 128 }));
    fileSystemReadAsStringAsync.mockImplementation(async () => 'YQ==');
    const { getMeeting, processMeeting, saveMeetingExtractionValues, syncMeetingExtractionResult } =
      await import('./meetings');

    await processMeeting('meeting-1', { layerId: 'layer-1' });
    await saveMeetingExtractionValues('meeting-1', {
      full_name: 'Priya Sharma',
      qualification: 'B.Com',
      issue: 'Delayed payroll',
    });
    await syncMeetingExtractionResult('meeting-1');

    const meeting = await getMeeting('meeting-1');
    expect(appendExtractionLayerRow).toHaveBeenCalledWith(
      expect.objectContaining({
        values: {
          full_name: 'Priya Sharma',
          qualification: 'B.Com',
          issue: 'Delayed payroll',
        },
      })
    );
    expect(meeting?.extractionResult).toMatchObject({
      syncStatus: 'synced',
      syncedRowId: 'Lead intake!A2:C2',
      values: {
        full_name: 'Priya Sharma',
        qualification: 'B.Com',
        issue: 'Delayed payroll',
      },
    });
  });

  test('retries shortly when the meeting audio is not readable yet', async () => {
    vi.useFakeTimers();
    fileSystemGetInfoAsync.mockImplementation(async () => ({ exists: true, size: 128 }));
    fileSystemReadAsStringAsync
      .mockRejectedValueOnce(new Error('File is not readable yet.'))
      .mockRejectedValueOnce(new Error('File is not readable yet.'))
      .mockResolvedValueOnce('YQ==');

    try {
      const { processMeeting } = await import('./meetings');
      const processing = processMeeting('meeting-1');
      const assertion = expect(processing).resolves.toBeUndefined();

      await vi.runAllTimersAsync();
      await assertion;
      expect(fileSystemReadAsStringAsync).toHaveBeenCalledTimes(3);
      expect(transcribeAudio).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  test('fails early with a clear error when the meeting audio stays unreadable', async () => {
    vi.useFakeTimers();
    fileSystemGetInfoAsync.mockImplementation(async () => ({ exists: true, size: 128 }));
    fileSystemReadAsStringAsync.mockRejectedValue(new Error('File is not readable yet.'));

    try {
      const { processMeeting } = await import('./meetings');
      const processing = processMeeting('meeting-1');
      const assertion = expect(processing).rejects.toThrow(
        'This recording is saved in the app, but the audio file is not readable yet. Please try again in a moment.'
      );

      await vi.runAllTimersAsync();
      await assertion;
      expect(transcribeAudio).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
