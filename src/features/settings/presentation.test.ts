import { describe, expect, test } from 'vitest';

import { defaultProviderConfigs } from '../../services/providers';
import type { InstalledModelRow, ProviderConfig, ProviderId } from '../../types';
import {
  buildActiveProviderSummary,
  buildConfiguredProviderMeta,
  buildProviderEditorSelection,
  buildProcessingModeDetails,
  buildProviderPickerOptionCopy,
  buildSettingsOverviewItems,
  displayModelLabel,
  formatBytes,
  getConfiguredProviderIds,
  getSettingsProcessingMode,
  pickInitialProvider,
} from './presentation';

function buildProviders(): Record<ProviderId, ProviderConfig> {
  return structuredClone(defaultProviderConfigs);
}

describe('settings presentation', () => {
  test('lists configured providers by mode', () => {
    const providers = buildProviders();
    providers.openai.apiKey = 'sk-live';
    providers.openrouter.apiKey = 'sk-or-live';
    providers.local.transcriptionModel = 'whisper-base';
    providers.local.summaryModel = 'gemma-3n-e2b-preview';

    expect(getConfiguredProviderIds(providers)).toEqual(['openai', 'openrouter', 'local']);
    expect(getConfiguredProviderIds(providers, 'transcription')).toEqual(['openai', 'openrouter', 'local']);
    expect(getConfiguredProviderIds(providers, 'summary')).toEqual(['openai', 'openrouter']);
  });

  test('builds the active provider summary copy', () => {
    expect(
      buildActiveProviderSummary({
        transcriptionProviderLabel: 'Local',
        summaryProviderLabel: 'OpenRouter',
        transcriptionModelLabel: 'Whisper Base',
        summaryModelLabel: 'google/gemini-2.5-flash',
      })
    ).toBe('Transcript uses Local (Whisper Base). Summary uses OpenRouter (google/gemini-2.5-flash).');
  });

  test('formats bytes and display labels predictably', () => {
    const models: InstalledModelRow[] = [
      {
        id: 'gemma-small',
        kind: 'summary',
        engine: 'mediapipe-llm',
        displayName: 'Gemma Small',
        version: '1',
        platforms: ['ios'],
        fileUri: 'file:///models/gemma-small',
        sizeBytes: 104857600,
        sha256: 'abc',
        status: 'installed',
        installedAt: '2026-04-13T10:00:00.000Z',
        downloadUrl: 'https://example.com/gemma-small',
        recommended: false,
        experimental: false,
        errorMessage: null,
      },
    ];

    expect(displayModelLabel(models, 'gemma-small')).toBe('Gemma Small');
    expect(formatBytes(104857600)).toBe('100 MB');
  });

  test('picks a sensible initial provider', () => {
    const providers = buildProviders();
    providers.openrouter.apiKey = 'sk-or-live';

    expect(
      pickInitialProvider({
        selectedSummaryProvider: 'openai',
        selectedTranscriptionProvider: 'openai',
        providers,
        deleteUploadedAudio: false,
        modelCatalogUrl: '',
      })
    ).toBe('openrouter');
  });

  test('builds compact overview rows for the settings header', () => {
    expect(
      buildSettingsOverviewItems({
        transcriptionProviderLabel: 'OpenAI',
        installedTranscriptionCount: 1,
      })
    ).toEqual([
      { label: 'Transcription', value: 'OpenAI' },
      { label: 'Local transcription', value: '1 installed' },
    ]);
  });

  test('derives processing mode from the raw selected transcription provider', () => {
    expect(getSettingsProcessingMode('local')).toBe('offline');
    expect(getSettingsProcessingMode('openai')).toBe('cloud');
  });

  test('explains what changes between cloud and offline processing modes', () => {
    expect(buildProcessingModeDetails({ processingMode: 'cloud', summaryProviderLabel: 'OpenAI' })).toEqual({
      title: 'Cloud transcription and summaries',
      body: 'Transcription and summaries both run through your selected API providers.',
    });

    expect(buildProcessingModeDetails({ processingMode: 'offline', summaryProviderLabel: 'OpenAI' })).toEqual({
      title: 'Offline transcription on this device',
      body: 'Transcription runs on-device with a downloaded local model. Summaries still use OpenAI in the cloud.',
    });
  });

  test('builds provider picker copy with an explicit provider title and status line', () => {
    expect(
      buildProviderPickerOptionCopy({
        providerLabel: 'OpenAI',
        providerDescription: 'Best default. Supports both transcription and summary.',
        configured: false,
      })
    ).toEqual({
      title: 'OpenAI',
      statusLine: 'Needs setup',
      description: 'Best default. Supports both transcription and summary.',
    });
  });

  test('builds configured provider meta text predictably', () => {
    expect(buildConfiguredProviderMeta({ configured: false, active: true })).toBe('Needs setup • Active');
    expect(buildConfiguredProviderMeta({ configured: true, active: false })).toBe('Credentials saved');
  });

  test('routes gear actions to the inline provider editor instead of a popup', () => {
    expect(buildProviderEditorSelection('local')).toEqual({
      editingProviderId: 'local',
      revealInlinePanel: true,
    });
  });
});
