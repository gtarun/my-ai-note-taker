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
        icon: 'download-cloud',
        title: 'Offline setup',
        body: 'We can prepare the local bundle now and keep progress visible from Meetings.',
        tone: 'secondary' as const,
      };
  }
}

export function getOfflineSetupStatusCopy(params: {
  status: 'preparing' | 'downloading' | 'paused_offline' | 'failed' | 'ready';
  bundleLabel: string;
  progressPercent: number;
  estimatedMinutes: number | null;
}) {
  if (params.status === 'ready') {
    return {
      title: 'Offline mode is ready',
      body: `${params.bundleLabel} finished downloading and local setup has been applied.`,
      progressLabel: 'Ready',
    };
  }

  if (params.status === 'paused_offline') {
    return {
      title: 'Offline setup paused',
      body: 'Connection was interrupted. You can resume from Meetings when you are ready.',
      progressLabel: `${params.progressPercent}%`,
    };
  }

  if (params.status === 'failed') {
    return {
      title: 'Offline setup needs attention',
      body: 'We could not finish preparing offline mode. You can retry from Meetings.',
      progressLabel: `${params.progressPercent}%`,
    };
  }

  return {
    title: 'Preparing offline mode',
    body: `${params.bundleLabel} is downloading now.${
      params.estimatedMinutes ? ` About ${params.estimatedMinutes} min remaining.` : ''
    }`,
    progressLabel: `${params.progressPercent}%`,
  };
}

export function getOnboardingProgressPercent(activeIndex: number, slideCount: number) {
  if (slideCount <= 0) {
    return 0;
  }

  const boundedIndex = Math.min(Math.max(activeIndex, 0), slideCount - 1);
  return Math.round(((boundedIndex + 1) / slideCount) * 100);
}
