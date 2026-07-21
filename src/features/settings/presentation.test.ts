import { describe, expect, test } from 'vitest';

import { defaultProviderConfigs } from '../../services/providers';
import type { InstalledModelRow, ProviderConfig, ProviderId } from '../../types';
import {
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
    expect(getConfiguredProviderIds(providers, 'summary')).toEqual(['openai', 'openrouter', 'local']);
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
        transcriptionLocale: 'en-US',
        deleteUploadedAudio: false,
        modelCatalogUrl: '',
      })
    ).toBe('openrouter');
  });

  test('builds compact overview rows for the settings header', () => {
    expect(
      buildSettingsOverviewItems({
        processingMode: 'offline',
        transcriptionProviderLabel: 'OpenAI',
        summaryProviderLabel: 'Local',
        installedTranscriptionCount: 1,
        installedSummaryCount: 1,
      })
    ).toEqual([
      { label: 'Mode', value: 'Local first' },
      { label: 'Transcript', value: 'OpenAI' },
      { label: 'Summary', value: 'Local' },
      { label: 'Local models', value: '2 installed' },
    ]);
  });

  test('derives processing mode from the raw selected transcription provider', () => {
    expect(getSettingsProcessingMode('local')).toBe('offline');
    expect(getSettingsProcessingMode('openai')).toBe('cloud');
  });

  test('explains what changes between cloud and offline processing modes', () => {
    expect(buildProcessingModeDetails({ processingMode: 'cloud', summaryProviderLabel: 'OpenAI' })).toEqual({
      title: 'Cloud API processing',
      body: 'Transcription and summaries use the providers you choose below.',
    });

    expect(buildProcessingModeDetails({ processingMode: 'offline', summaryProviderLabel: 'Local' })).toEqual({
      title: 'Device-only processing',
      body: 'Transcription, summaries, and structured analysis use local models.',
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

  test('routes gear actions to the inline provider editor instead of a popup', () => {
    expect(buildProviderEditorSelection('local')).toEqual({
      editingProviderId: 'local',
      revealInlinePanel: true,
    });
  });
});
