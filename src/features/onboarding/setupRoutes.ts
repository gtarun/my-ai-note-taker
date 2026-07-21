import type { ProviderId } from '../../types';

/**
 * The onboarding "how should meetings be processed" fork.
 *
 * This slide used to claim it had auto-started a local model download. It had
 * not — nothing called `downloadModel`, so the progress bar sat at 0% forever
 * and a new user's first "Analyze" always failed on an unconfigured summary
 * provider. The honest version asks the user to pick a route and sends them
 * somewhere that can actually complete it.
 */
export type SetupRouteId = 'on-device' | 'cloud';

export type SetupRouteOption = {
  id: SetupRouteId;
  title: string;
  body: string;
  /** Short truthful statement of what the user still has to do. */
  requirement: string;
  icon: string;
  isRecommended: boolean;
  /** Provider the choice selects for transcription. */
  transcriptionProvider: ProviderId;
};

export type SetupRoutePlatform = 'ios' | 'android' | 'web';

/**
 * On-device transcription is real only on iOS today (Apple Speech needs no
 * download; whisper.cpp covers the rest). Android and web have a
 * boundary-only contract, so offering the choice there would be another lie.
 */
export function getSetupRouteOptions(platform: SetupRoutePlatform): SetupRouteOption[] {
  const cloud: SetupRouteOption = {
    id: 'cloud',
    title: 'Use a cloud provider',
    body: 'Your own API key from OpenAI, Anthropic, Gemini, or any OpenAI-compatible endpoint handles transcription and summaries.',
    requirement: 'Needs an API key. Audio and transcripts leave the device when you process a meeting.',
    icon: 'cloud',
    isRecommended: platform !== 'ios',
    transcriptionProvider: 'openai',
  };

  if (platform !== 'ios') {
    return [cloud];
  }

  return [
    {
      id: 'on-device',
      title: 'Transcribe on this iPhone',
      body: 'Apple Speech turns your recordings into text on the device itself. No download and no audio upload.',
      requirement: 'Transcripts are free and private. AI summaries still need an API key.',
      icon: 'smartphone',
      isRecommended: true,
      transcriptionProvider: 'local',
    },
    cloud,
  ];
}

/**
 * Both routes currently end at Settings: summaries need an API key either way,
 * because on-device summarization is not supported yet.
 */
export function getSetupRouteConfirmation(routeId: SetupRouteId): string {
  return routeId === 'on-device'
    ? 'On-device transcription selected. Add an API key for summaries whenever you are ready.'
    : 'Cloud processing selected. Add your API key to finish setup.';
}
