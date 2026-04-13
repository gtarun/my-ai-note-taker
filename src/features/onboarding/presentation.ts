import type { OnboardingSlideId } from '../../onboarding/model';

export function getOnboardingFeatureCard(slideId: OnboardingSlideId) {
  switch (slideId) {
    case 'welcome':
      return {
        icon: 'mic',
        title: 'Manual capture',
        body: 'Start with a recording or imported file. No bots and no stealth capture.',
        tone: 'secondary' as const,
      };
    case 'workflow':
      return {
        icon: 'layers',
        title: 'One clean flow',
        body: 'Capture audio, transcribe after the meeting, then review summary and action items.',
        tone: 'secondary' as const,
      };
    case 'privacy':
      return {
        icon: 'shield',
        title: 'Consent and control',
        body: 'Audio stays local first and only leaves the device when you choose to process it.',
        tone: 'tertiary' as const,
      };
    case 'setup':
      return {
        icon: 'settings',
        title: 'Configure providers',
        body: 'Add your API key or local model choices before you process your first meeting.',
        tone: 'secondary' as const,
      };
  }
}

export function getOnboardingProgressPercent(activeIndex: number, slideCount: number) {
  if (slideCount <= 0) {
    return 0;
  }

  const boundedIndex = Math.min(Math.max(activeIndex, 0), slideCount - 1);
  return Math.round(((boundedIndex + 1) / slideCount) * 100);
}
