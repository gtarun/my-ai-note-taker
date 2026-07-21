import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { ExtractionLayerField, ProviderConfig, ProviderId, SummaryPayload } from '../types';
import {
  IOS_LOCAL_TRANSCRIPTION_MODEL_ERROR,
  IOS_LOCAL_TRANSCRIPTION_MODEL_IDS,
  extractLocalStructuredData,
  summarizeAndExtractLocalTranscript,
  summarizeLocalTranscript,
  transcribeLocalAudio,
} from './localInference';
import { splitTranscriptIntoChunks } from '../features/meetings/englishRendering';
import { fetchWithRetry } from './http';
import { providerMap } from './providers';

type TranscribeParams = {
  providerId: ProviderId;
  provider: ProviderConfig;
  audioUri: string;
  /** BCP-47 locale (e.g. "en-US", "hi-IN") for Apple Speech.
   *  Optional; native side defaults to en-US. */
  appleSpeechLocale?: string | null;
  /** ISO 639-1 code (e.g. "en", "hi", "pa") for whisper.cpp.
   *  null/undefined enables whisper auto-detect. */
  whisperLanguage?: string | null;
};

type SummarizeParams = {
  providerId: ProviderId;
  provider: ProviderConfig;
  transcriptText: string;
};

type ExtractParams = {
  providerId: ProviderId;
  provider: ProviderConfig;
  transcriptText: string;
  fields: ExtractionLayerField[];
};

type SummarizeAndExtractParams = ExtractParams;

/** Audio uploads carry whole recordings, so they need far longer than a chat call. */
const TRANSCRIPTION_TIMEOUT_MS = 600_000;

const summaryJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    actionItems: { type: 'array', items: { type: 'string' } },
    decisions: { type: 'array', items: { type: 'string' } },
    followUps: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'actionItems', 'decisions', 'followUps'],
};

export async function transcribeAudio(params: TranscribeParams) {
  const providerDefinition = providerMap[params.providerId];

  if (!providerDefinition.supportsTranscription) {
    throw new Error(`${providerDefinition.label} does not support transcription in this MVP.`);
  }

  if (!params.provider.transcriptionModel.trim()) {
    throw new Error(`Add a transcription model for ${providerDefinition.label} in Settings first.`);
  }

  if (
    params.providerId === 'local' &&
    Platform.OS === 'ios' &&
    !IOS_LOCAL_TRANSCRIPTION_MODEL_IDS.has(params.provider.transcriptionModel.trim())
  ) {
    throw new Error(IOS_LOCAL_TRANSCRIPTION_MODEL_ERROR);
  }

  if (params.providerId === 'local') {
    return transcribeLocalAudio({
      audioUri: params.audioUri,
      modelId: params.provider.transcriptionModel,
      locale: params.appleSpeechLocale ?? undefined,
      language: params.whisperLanguage,
    });
  }

  if (params.providerId === 'openrouter') {
    return transcribeWithOpenRouter(params.provider, params.audioUri);
  }

  if (!providerDefinition.usesOpenAICompatibleApi) {
    throw new Error(`${providerDefinition.label} transcription is not implemented yet.`);
  }

  return transcribeOpenAICompatible(params.provider, params.audioUri);
}

export async function summarizeTranscript(params: SummarizeParams) {
  if (params.providerId === 'local') {
    return summarizeLocalTranscript({
      transcriptText: params.transcriptText,
      modelId: params.provider.summaryModel,
    });
  }

  switch (params.providerId) {
    case 'anthropic':
      return summarizeWithAnthropic(params.provider, params.transcriptText);
    case 'gemini':
      return summarizeWithGemini(params.provider, params.transcriptText);
    default:
      return summarizeWithOpenAICompatible(params.provider, params.transcriptText, params.providerId);
  }
}

export async function extractStructuredData(params: ExtractParams): Promise<Record<string, string>> {
  if (!params.fields.length) {
    return {};
  }

  let rawValues: unknown;

  if (params.providerId === 'local') {
    rawValues = await extractLocalStructuredData({
      transcriptText: params.transcriptText,
      modelId: params.provider.summaryModel,
      fields: params.fields,
    });
  } else {
    switch (params.providerId) {
      case 'anthropic':
        rawValues = await extractWithAnthropic(params.provider, params.transcriptText, params.fields);
        break;
      case 'gemini':
        rawValues = await extractWithGemini(params.provider, params.transcriptText, params.fields);
        break;
      default:
        rawValues = await extractWithOpenAICompatible(
          params.provider,
          params.transcriptText,
          params.providerId,
          params.fields
        );
        break;
    }
  }

  return normalizeExtractedValues(rawValues, params.fields);
}

export async function summarizeAndExtractTranscript(params: SummarizeAndExtractParams): Promise<{
  summary: SummaryPayload;
  extractedValues: Record<string, string>;
}> {
  if (!params.fields.length) {
    return {
      summary: await summarizeTranscript(params),
      extractedValues: {},
    };
  }

  if (params.providerId === 'local') {
    return summarizeAndExtractLocalTranscript({
      transcriptText: params.transcriptText,
      modelId: params.provider.summaryModel,
      fields: params.fields,
    });
  }

  // allSettled rather than all: with Promise.all, if both calls reject the
  // second rejection has no handler attached and surfaces as an unhandled
  // rejection.
  const [summaryResult, extractionResult] = await Promise.allSettled([
    summarizeTranscript(params),
    extractStructuredData(params),
  ]);

  if (summaryResult.status === 'rejected') {
    throw summaryResult.reason;
  }

  if (extractionResult.status === 'rejected') {
    throw extractionResult.reason;
  }

  return { summary: summaryResult.value, extractedValues: extractionResult.value };
}

async function transcribeOpenAICompatible(provider: ProviderConfig, audioUri: string) {
  const fileName = extractFileName(audioUri);
  const formData = new FormData();
  formData.append('model', provider.transcriptionModel);
  formData.append('file', {
    uri: audioUri,
    name: fileName,
    type: getAudioMimeType(fileName),
  } as never);

  const response = await fetchWithRetry(buildUrl(provider.baseUrl, '/audio/transcriptions'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: formData,
    // Audio uploads are large and billed per minute of audio on receipt. A
    // long meeting can outlast our deadline while the provider is still
    // processing it, so retrying a timeout would pay for the same transcription
    // twice. Rejections (429/5xx) are still retried — those were never billed.
    timeoutMs: TRANSCRIPTION_TIMEOUT_MS,
    retryOnNetworkError: false,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as { text?: string };

  if (!payload.text) {
    throw new Error('Transcription API returned no text.');
  }

  return payload.text;
}

async function transcribeWithOpenRouter(provider: ProviderConfig, audioUri: string) {
  const fileName = extractFileName(audioUri);
  const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const response = await fetchWithRetry(buildUrl(provider.baseUrl, '/chat/completions'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://mu-fathom.local',
      'X-Title': 'mu-fathom',
    },
    body: JSON.stringify({
      model: provider.transcriptionModel,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please transcribe this audio file. Return only the transcript text.',
            },
            {
              type: 'input_audio',
              input_audio: {
                data: audioBase64,
                format: getAudioFormat(fileName),
              },
            },
          ],
        },
      ],
      stream: false,
    }),
    // Same billing exposure as the OpenAI-compatible upload above: the audio is
    // already on the wire, so a timeout retry can pay for it twice.
    timeoutMs: TRANSCRIPTION_TIMEOUT_MS,
    retryOnNetworkError: false,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  const transcript =
    typeof content === 'string'
      ? content
      : content
          ?.filter((item) => item.type === 'text' && item.text)
          .map((item) => item.text)
          .join('\n');

  if (!transcript?.trim()) {
    throw new Error('OpenRouter returned no transcript text.');
  }

  return transcript.trim();
}

async function summarizeWithOpenAICompatible(
  provider: ProviderConfig,
  transcriptText: string,
  providerId: ProviderId
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${provider.apiKey}`,
    'Content-Type': 'application/json',
  };

  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://mu-fathom.local';
    headers['X-Title'] = 'mu-fathom';
  }

  const response = await fetchWithRetry(buildUrl(provider.baseUrl, '/chat/completions'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: provider.summaryModel,
      temperature: 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'meeting_summary',
          schema: summaryJsonSchema,
        },
      },
      messages: buildSummaryMessages(transcriptText),
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Summary API returned no content.');
  }

  return parseModelJson<SummaryPayload>(content, 'The summary provider');
}

async function summarizeWithAnthropic(provider: ProviderConfig, transcriptText: string) {
  const response = await fetchWithRetry(buildUrl(provider.baseUrl, '/messages'), {
    method: 'POST',
    headers: {
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.summaryModel,
      max_tokens: 1200,
      system:
        'You turn meeting transcripts into short, useful structured notes. Be concrete. Do not invent facts. Return valid JSON only.',
      messages: [
        {
          role: 'user',
          content: `Return JSON with keys summary, actionItems, decisions, followUps.

Transcript:
${transcriptText}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const content = payload.content?.find((item) => item.type === 'text')?.text;

  if (!content) {
    throw new Error('Anthropic returned no content.');
  }

  return parseModelJson<SummaryPayload>(content, 'Anthropic');
}

async function summarizeWithGemini(provider: ProviderConfig, transcriptText: string) {
  const baseUrl = provider.baseUrl.replace(/\/$/, '');
  const response = await fetchWithRetry(
    `${baseUrl}/models/${provider.summaryModel}:generateContent?key=${encodeURIComponent(provider.apiKey)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  'You turn meeting transcripts into short, useful structured notes. Be concrete. Do not invent facts.',
              },
              {
                text: `Return JSON only.\n\nTranscript:\n${transcriptText}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: summaryJsonSchema,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error('Gemini returned no content.');
  }

  return parseModelJson<SummaryPayload>(content, 'Gemini');
}

async function extractWithOpenAICompatible(
  provider: ProviderConfig,
  transcriptText: string,
  providerId: ProviderId,
  fields: ExtractionLayerField[]
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${provider.apiKey}`,
    'Content-Type': 'application/json',
  };

  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://mu-fathom.local';
    headers['X-Title'] = 'mu-fathom';
  }

  const response = await fetchWithRetry(buildUrl(provider.baseUrl, '/chat/completions'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: provider.summaryModel,
      temperature: 0,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'meeting_extraction',
          schema: buildExtractionJsonSchema(fields),
        },
      },
      messages: buildExtractionMessages(transcriptText, fields),
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Extraction API returned no content.');
  }

  return parseModelJson<Record<string, unknown>>(content, 'The extraction provider');
}

async function extractWithAnthropic(
  provider: ProviderConfig,
  transcriptText: string,
  fields: ExtractionLayerField[]
) {
  const response = await fetchWithRetry(buildUrl(provider.baseUrl, '/messages'), {
    method: 'POST',
    headers: {
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.summaryModel,
      max_tokens: 1200,
      system:
        'You extract structured meeting data from transcripts. Return valid JSON only. Use empty strings for missing values.',
      messages: [
        {
          role: 'user',
          content: buildExtractionPrompt(transcriptText, fields),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const content = payload.content?.find((item) => item.type === 'text')?.text;

  if (!content) {
    throw new Error('Anthropic returned no extraction content.');
  }

  return parseModelJson<Record<string, unknown>>(content, 'Anthropic');
}

async function extractWithGemini(
  provider: ProviderConfig,
  transcriptText: string,
  fields: ExtractionLayerField[]
) {
  const baseUrl = provider.baseUrl.replace(/\/$/, '');
  const response = await fetchWithRetry(
    `${baseUrl}/models/${provider.summaryModel}:generateContent?key=${encodeURIComponent(provider.apiKey)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  'You extract structured meeting data from transcripts. Return valid JSON only. Use empty strings for missing values.',
              },
              {
                text: buildExtractionPrompt(transcriptText, fields),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: buildExtractionJsonSchema(fields),
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };
  const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error('Gemini returned no extraction content.');
  }

  return parseModelJson<Record<string, unknown>>(content, 'Gemini');
}

function buildSummaryMessages(transcriptText: string) {
  return [
    {
      role: 'system',
      /*
       * The output language used to go unmentioned, so a Hindi or Punjabi
       * meeting produced a summary in whichever language the model preferred
       * that run — sometimes English, sometimes not, sometimes a mix inside one
       * bullet. Saying it plainly is the whole fix.
       */
      content:
        'You turn meeting transcripts into short, useful structured notes. Be concrete. Do not invent facts. Always write the notes in English, even when the transcript is in another language; translate names of things but leave people\'s names as spoken.',
    },
    {
      role: 'user',
      content: `Return JSON only.

Transcript:
${transcriptText}`,
    },
  ];
}

const TRANSLATION_SYSTEM_PROMPT =
  'You produce a clean English reading version of a meeting transcript. Translate everything into natural English, including Hindi, Punjabi, and code-mixed speech. Remove filler words, stutters, and false starts, and fix obvious transcription noise. Do not summarise, do not skip anything anyone said, and do not invent content. Keep speaker labels if the transcript has them. Reply with the transcript text only — no preamble, no commentary, no markdown fences.';

/**
 * Render a transcript as clean English, one chunk at a time.
 *
 * Chunked because a translation's output is about as long as its input, so a
 * full meeting would run into the response ceiling long before the context
 * limit — and a response cut off at the ceiling looks like a transcript that
 * simply ends mid-sentence, which is worse than a visible failure.
 *
 * Chunks run in sequence rather than in parallel: providers rate-limit, and a
 * 429 partway through a parallel fan-out would leave a hole in the middle of
 * the transcript.
 */
export async function translateTranscriptToEnglish(params: SummarizeParams): Promise<string> {
  const chunks = splitTranscriptIntoChunks(params.transcriptText);

  if (!chunks.length) {
    return '';
  }

  const rendered: string[] = [];

  for (const chunk of chunks) {
    rendered.push(await translateChunk(params, chunk));
  }

  return rendered.join('\n\n').trim();
}

async function translateChunk(params: SummarizeParams, chunk: string): Promise<string> {
  const definition = providerMap[params.providerId];

  if (params.providerId === 'anthropic') {
    return callAnthropicText(params.provider, TRANSLATION_SYSTEM_PROMPT, chunk);
  }

  if (params.providerId === 'gemini') {
    return callGeminiText(params.provider, TRANSLATION_SYSTEM_PROMPT, chunk);
  }

  if (!definition.supportsSummary) {
    throw new Error(`${definition.label} cannot produce an English transcript.`);
  }

  return callOpenAICompatibleText(
    params.provider,
    params.providerId,
    TRANSLATION_SYSTEM_PROMPT,
    chunk
  );
}

async function callOpenAICompatibleText(
  provider: ProviderConfig,
  providerId: ProviderId,
  systemPrompt: string,
  userContent: string
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${provider.apiKey}`,
    'Content-Type': 'application/json',
  };

  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://mu-fathom.local';
    headers['X-Title'] = 'mu-fathom';
  }

  const response = await fetchWithRetry(buildUrl(provider.baseUrl, '/chat/completions'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: provider.summaryModel,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('The summary provider returned no English transcript.');
  }

  return content.trim();
}

async function callAnthropicText(
  provider: ProviderConfig,
  systemPrompt: string,
  userContent: string
) {
  const response = await fetchWithRetry(buildUrl(provider.baseUrl, '/messages'), {
    method: 'POST',
    headers: {
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.summaryModel,
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as { content?: Array<{ text?: string }> };
  const content = payload.content?.map((part) => part.text ?? '').join('').trim();

  if (!content) {
    throw new Error('Anthropic returned no English transcript.');
  }

  return content;
}

async function callGeminiText(
  provider: ProviderConfig,
  systemPrompt: string,
  userContent: string
) {
  const response = await fetchWithRetry(
    `${buildUrl(provider.baseUrl, '')}/models/${provider.summaryModel}:generateContent?key=${encodeURIComponent(provider.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();

  if (!content) {
    throw new Error('Gemini returned no English transcript.');
  }

  return content;
}

function buildExtractionMessages(transcriptText: string, fields: ExtractionLayerField[]) {
  return [
    {
      role: 'system',
      content:
        'You extract structured meeting data from transcripts. Return valid JSON only. Use empty strings for missing values and never invent facts.',
    },
    {
      role: 'user',
      content: buildExtractionPrompt(transcriptText, fields),
    },
  ];
}

function buildExtractionPrompt(transcriptText: string, fields: ExtractionLayerField[]) {
  const fieldInstructions = fields
    .map((field) => `- ${field.id}: ${field.title}. ${field.description || 'Extract this value from the transcript.'}`)
    .join('\n');

  return `Return JSON only. Use each field id as the JSON key. If a value is missing or uncertain, return an empty string.

Fields:
${fieldInstructions}

Transcript:
${transcriptText}`;
}

function buildExtractionJsonSchema(fields: ExtractionLayerField[]) {
  const properties = Object.fromEntries(
    fields.map((field) => [
      field.id,
      {
        type: 'string',
        description: field.description || field.title,
      },
    ])
  );

  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: fields.map((field) => field.id),
  };
}

function normalizeExtractedValues(value: unknown, fields: ExtractionLayerField[]) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  return Object.fromEntries(
    fields.map((field) => {
      const candidate = (raw as Record<string, unknown>)[field.id];
      return [field.id, typeof candidate === 'string' ? candidate.trim() : ''];
    })
  );
}

function buildUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  return `${normalizedBase}${path}`;
}

function extractFileName(uri: string) {
  return uri.split('/').pop() || 'meeting-audio.m4a';
}

function getAudioMimeType(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'mp4':
    case 'm4a':
      return 'audio/mp4';
    case 'webm':
      return 'audio/webm';
    case 'mpeg':
      return 'audio/mpeg';
    default:
      return 'audio/*';
  }
}

function getAudioFormat(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'aac':
    case 'aiff':
    case 'flac':
    case 'm4a':
    case 'mp3':
    case 'ogg':
    case 'wav':
      return extension;
    default:
      return 'wav';
  }
}

function extractJson(content: string) {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  return jsonMatch?.[0] ?? trimmed;
}

/**
 * Parses a model's JSON response defensively.
 *
 * Even with structured-output schemas requested, providers sometimes wrap JSON
 * in a markdown fence or prepend prose. A bare JSON.parse surfaced the raw
 * `SyntaxError: Unexpected token` straight into an Alert, which tells the user
 * nothing actionable. This falls back to extracting the JSON body and, failing
 * that, reports which provider misbehaved.
 */
function parseModelJson<T>(content: string, label: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    try {
      return JSON.parse(extractJson(content)) as T;
    } catch {
      throw new Error(
        `${label} returned a response that was not valid JSON. Try again, or switch to a different model for this meeting.`
      );
    }
  }
}
