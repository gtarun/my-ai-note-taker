import { ProviderConfig, ProviderId } from '../types';

export type ProviderDefinition = {
  id: ProviderId;
  label: string;
  description: string;
  supportsTranscription: boolean;
  supportsSummary: boolean;
  usesOpenAICompatibleApi: boolean;
  apiKeyPlaceholder: string;
  baseUrlPlaceholder: string;
  transcriptionModels: string[];
  summaryModels: string[];
};

export const providerDefinitions: ProviderDefinition[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'Best default. Supports both transcription and summary.',
    supportsTranscription: true,
    supportsSummary: true,
    usesOpenAICompatibleApi: true,
    apiKeyPlaceholder: 'sk-...',
    baseUrlPlaceholder: 'https://api.openai.com/v1',
    transcriptionModels: ['gpt-4o-mini-transcribe', 'gpt-4o-transcribe', 'whisper-1'],
    summaryModels: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o'],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'Great for routing models. Supports audio transcription and summary.',
    supportsTranscription: true,
    supportsSummary: true,
    usesOpenAICompatibleApi: true,
    apiKeyPlaceholder: 'sk-or-...',
    baseUrlPlaceholder: 'https://openrouter.ai/api/v1',
    transcriptionModels: ['google/gemini-2.5-flash', 'openai/gpt-4o-mini-transcribe'],
    summaryModels: ['openai/gpt-4.1-mini', 'openai/gpt-4.1', 'anthropic/claude-3.5-haiku'],
  },
  {
    id: 'groq',
    label: 'Groq',
    description: 'Fast. Supports OpenAI-style transcription and summary.',
    supportsTranscription: true,
    supportsSummary: true,
    usesOpenAICompatibleApi: true,
    apiKeyPlaceholder: 'gsk_...',
    baseUrlPlaceholder: 'https://api.groq.com/openai/v1',
    transcriptionModels: ['whisper-large-v3-turbo', 'whisper-large-v3'],
    summaryModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Claude summary support. No transcription here.',
    supportsTranscription: false,
    supportsSummary: true,
    usesOpenAICompatibleApi: false,
    apiKeyPlaceholder: 'sk-ant-...',
    baseUrlPlaceholder: 'https://api.anthropic.com/v1',
    transcriptionModels: [],
    summaryModels: ['claude-3-5-haiku-latest', 'claude-3-7-sonnet-latest'],
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    description: 'Gemini summary support. No transcription here.',
    supportsTranscription: false,
    supportsSummary: true,
    usesOpenAICompatibleApi: false,
    apiKeyPlaceholder: 'AIza...',
    baseUrlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta',
    transcriptionModels: [],
    summaryModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  },
  {
    id: 'together',
    label: 'Together',
    description: 'OpenAI-compatible summary routing.',
    supportsTranscription: false,
    supportsSummary: true,
    usesOpenAICompatibleApi: true,
    apiKeyPlaceholder: '...',
    baseUrlPlaceholder: 'https://api.together.xyz/v1',
    transcriptionModels: [],
    summaryModels: [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    ],
  },
  {
    id: 'fireworks',
    label: 'Fireworks',
    description: 'OpenAI-compatible summary routing.',
    supportsTranscription: false,
    supportsSummary: true,
    usesOpenAICompatibleApi: true,
    apiKeyPlaceholder: 'fw_...',
    baseUrlPlaceholder: 'https://api.fireworks.ai/inference/v1',
    transcriptionModels: [],
    summaryModels: [
      'accounts/fireworks/models/llama-v3p1-70b-instruct',
      'accounts/fireworks/models/qwen3-235b-a22b-instruct-2507',
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    description: 'Cheap summary provider. No transcription here.',
    supportsTranscription: false,
    supportsSummary: true,
    usesOpenAICompatibleApi: true,
    apiKeyPlaceholder: 'sk-...',
    baseUrlPlaceholder: 'https://api.deepseek.com/v1',
    transcriptionModels: [],
    summaryModels: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Bring your own OpenAI-compatible endpoint.',
    supportsTranscription: true,
    supportsSummary: true,
    usesOpenAICompatibleApi: true,
    apiKeyPlaceholder: '...',
    baseUrlPlaceholder: 'https://your-endpoint.example/v1',
    transcriptionModels: ['gpt-4o-mini-transcribe', 'gpt-4o-transcribe', 'whisper-1'],
    summaryModels: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o'],
  },
  {
    id: 'local',
    label: 'Local',
    description: 'Use on-device model downloads for offline transcription and summary.',
    supportsTranscription: true,
    supportsSummary: true,
    usesOpenAICompatibleApi: false,
    apiKeyPlaceholder: '',
    baseUrlPlaceholder: '',
    transcriptionModels: [],
    summaryModels: [],
  },
];

export const providerMap = Object.fromEntries(
  providerDefinitions.map((provider) => [provider.id, provider])
) as Record<ProviderId, ProviderDefinition>;

export const defaultProviderConfigs: Record<ProviderId, ProviderConfig> = {
  openai: {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    transcriptionModel: 'gpt-4o-mini-transcribe',
    summaryModel: 'gpt-4.1-mini',
  },
  openrouter: {
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    transcriptionModel: 'google/gemini-2.5-flash',
    summaryModel: 'openai/gpt-4.1-mini',
  },
  groq: {
    apiKey: '',
    baseUrl: 'https://api.groq.com/openai/v1',
    transcriptionModel: 'whisper-large-v3-turbo',
    summaryModel: 'llama-3.3-70b-versatile',
  },
  anthropic: {
    apiKey: '',
    baseUrl: 'https://api.anthropic.com/v1',
    transcriptionModel: '',
    summaryModel: 'claude-3-5-haiku-latest',
  },
  gemini: {
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    transcriptionModel: '',
    summaryModel: 'gemini-2.5-flash',
  },
  together: {
    apiKey: '',
    baseUrl: 'https://api.together.xyz/v1',
    transcriptionModel: '',
    summaryModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  },
  fireworks: {
    apiKey: '',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    transcriptionModel: '',
    summaryModel: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
  },
  deepseek: {
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    transcriptionModel: '',
    summaryModel: 'deepseek-chat',
  },
  custom: {
    apiKey: '',
    baseUrl: '',
    transcriptionModel: '',
    summaryModel: '',
  },
  local: {
    apiKey: '',
    baseUrl: '',
    transcriptionModel: '',
    summaryModel: '',
  },
};

export function isProviderConfigured(
  providerId: ProviderId,
  provider: ProviderConfig,
  mode: 'transcription' | 'summary'
) {
  if (providerId === 'local') {
    return mode === 'transcription'
      ? Boolean(provider.transcriptionModel.trim())
      : Boolean(provider.summaryModel.trim());
  }

  return Boolean(provider.apiKey.trim());
}
