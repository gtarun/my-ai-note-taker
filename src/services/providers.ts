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
};
