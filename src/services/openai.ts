import { SummaryPayload } from '../types';

type TranscribeParams = {
  audioUri: string;
  apiKey: string;
  baseUrl: string;
  model: string;
};

type SummarizeParams = {
  transcriptText: string;
  apiKey: string;
  baseUrl: string;
  model: string;
};

export async function transcribeAudio(params: TranscribeParams) {
  const fileName = extractFileName(params.audioUri);
  const formData = new FormData();
  formData.append('model', params.model);
  formData.append('file', {
    uri: params.audioUri,
    name: fileName,
    type: getAudioMimeType(fileName),
  } as never);

  const response = await fetch(buildUrl(params.baseUrl, '/audio/transcriptions'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: formData,
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

export async function summarizeTranscript(params: SummarizeParams) {
  const response = await fetch(buildUrl(params.baseUrl, '/chat/completions'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'meeting_summary',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              summary: { type: 'string' },
              actionItems: { type: 'array', items: { type: 'string' } },
              decisions: { type: 'array', items: { type: 'string' } },
              followUps: { type: 'array', items: { type: 'string' } },
            },
            required: ['summary', 'actionItems', 'decisions', 'followUps'],
          },
        },
      },
      messages: [
        {
          role: 'system',
          content:
            'You turn meeting transcripts into short, useful structured notes. Be concrete. Do not invent facts.',
        },
        {
          role: 'user',
          content: `Return JSON only.

Transcript:
${params.transcriptText}`,
        },
      ],
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

  return JSON.parse(content) as SummaryPayload;
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
