export type OnboardingSlideId = 'welcome' | 'workflow' | 'privacy' | 'setup';

export type OnboardingSlide = {
  id: OnboardingSlideId;
  eyebrow?: string;
  title: string;
  body: string;
  highlights?: string[];
  ctaLabel: string;
  showSkip: boolean;
};

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: 'welcome',
    eyebrow: 'Local-first meeting companion',
    title: 'Record it. Upload it. Process it later.',
    body:
      'No bots. No auto-join. Just a clean path from meeting audio to transcript, summary, and action items.',
    highlights: ['Manual', 'Local-first', 'Post-call'],
    ctaLabel: 'Next',
    showSkip: true,
  },
  {
    id: 'workflow',
    title: 'One clean workflow.',
    body: 'Record or import audio, transcribe after the meeting, then review summary and action items.',
    highlights: ['Record or import', 'Transcribe later', 'Review and share'],
    ctaLabel: 'Next',
    showSkip: true,
  },
  {
    id: 'privacy',
    title: 'Private by default. Explicit by design.',
    body:
      'Meetings stay local first. Audio only leaves the device when you choose to process it. You are responsible for recording consent.',
    highlights: ['Stored locally first', 'Processing is explicit', 'Consent matters'],
    ctaLabel: 'Next',
    showSkip: true,
  },
  {
    id: 'setup',
    title: 'Set up your provider first.',
    body: 'Add your API key and choose transcript and summary providers before you start using the app.',
    ctaLabel: 'Go to Settings',
    showSkip: true,
  },
];

export function getNextOnboardingIndex(currentIndex: number, slideCount: number) {
  if (slideCount <= 0) {
    return 0;
  }

  return Math.min(currentIndex + 1, slideCount - 1);
}

export function getPreviousOnboardingIndex(currentIndex: number) {
  return Math.max(currentIndex - 1, 0);
}

export function isLastOnboardingSlide(index: number, slideCount: number) {
  return slideCount > 0 && index >= slideCount - 1;
}

export function getOnboardingProgress(activeIndex: number, slideCount: number): boolean[] {
  if (slideCount <= 0) {
    return [];
  }

  const boundedIndex = Math.min(Math.max(activeIndex, 0), slideCount - 1);
  return Array.from({ length: slideCount }, (_, index) => index === boundedIndex);
}

export function getOnboardingCompletionRoute() {
  return '/settings';
}

export function shouldPresentOnboarding({
  hasSeenOnboarding,
  pathname,
}: {
  hasSeenOnboarding: boolean;
  pathname: string;
}) {
  if (pathname === '/onboarding') {
    return false;
  }

  return !hasSeenOnboarding;
}
