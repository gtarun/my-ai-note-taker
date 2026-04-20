# Provider Catalog

## Supported Providers

| Provider    | ID           | Transcription | Summary | API Style          | Default Base URL                                      |
|-------------|--------------|---------------|---------|--------------------|---------------------------------------------------------|
| OpenAI      | `openai`     | Yes           | Yes     | OpenAI-compatible  | `https://api.openai.com/v1`                            |
| OpenRouter  | `openrouter` | Yes           | Yes     | OpenAI-compatible  | `https://openrouter.ai/api/v1`                         |
| Groq        | `groq`       | Yes           | Yes     | OpenAI-compatible  | `https://api.groq.com/openai/v1`                       |
| Anthropic   | `anthropic`  | No            | Yes     | Anthropic native   | `https://api.anthropic.com/v1`                         |
| Gemini      | `gemini`     | No            | Yes     | Gemini native      | `https://generativelanguage.googleapis.com/v1beta`     |
| Together    | `together`   | No            | Yes     | OpenAI-compatible  | `https://api.together.xyz/v1`                          |
| Fireworks   | `fireworks`  | No            | Yes     | OpenAI-compatible  | `https://api.fireworks.ai/inference/v1`                |
| DeepSeek    | `deepseek`   | No            | Yes     | OpenAI-compatible  | `https://api.deepseek.com/v1`                          |
| Custom      | `custom`     | Yes           | Yes     | OpenAI-compatible  | User-provided                                          |
| Local       | `local`      | Yes           | No      | Native module      | N/A                                                    |

## Default Models

### Transcription
- OpenAI: `gpt-4o-mini-transcribe`
- OpenRouter: `google/gemini-2.5-flash`
- Groq: `whisper-large-v3-turbo`

### Summary
- OpenAI: `gpt-4.1-mini`
- OpenRouter: `openai/gpt-4.1-mini`
- Groq: `llama-3.3-70b-versatile`
- Anthropic: `claude-3-5-haiku-latest`
- Gemini: `gemini-2.5-flash`
- Together: `meta-llama/Llama-3.3-70B-Instruct-Turbo`
- Fireworks: `accounts/fireworks/models/llama-v3p1-70b-instruct`
- DeepSeek: `deepseek-chat`

## API Implementation Notes

- OpenAI-compatible providers use the standard `/audio/transcriptions` and `/chat/completions` endpoints
- OpenRouter transcription uses a special multipart flow with base64 audio in chat completions
- Anthropic uses the Messages API with `anthropic-version: 2023-06-01` header
- Gemini uses the `generateContent` endpoint with inline text
- Summary output is structured JSON: `{ summary, actionItems[], decisions[], followUps[] }`
- Extraction uses the same providers but with a structured extraction prompt and JSON schema

## Local Model Catalog

Built-in starter models:
- Transcription: `whisper-base`, `whisper-small` (engine: whisper.cpp)
- Summary: `gemma-3n-e2b-preview`, `gemma-3n-e4b-preview`, `gemma-3-1b-it-q4`, `qwen2.5-1.5b-instruct-q8`

Only `whisper-base` transcription works on iOS native builds today. Everything else is catalog-only.
