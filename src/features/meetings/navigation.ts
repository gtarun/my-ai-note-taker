import { APP_TABS_ROUTE } from '../../navigation/routes';

const MEETING_DETAIL_FALLBACK = {
  label: 'Meetings',
  href: APP_TABS_ROUTE,
} as const;

export function getMeetingDetailEntryMethod() {
  return 'push' as const;
}

export function getMeetingDetailHeaderPresentation(canReturnToPreviousScreen: boolean) {
  if (canReturnToPreviousScreen) {
    return {
      headerBackVisible: true as const,
      headerBackButtonDisplayMode: 'minimal' as const,
      showHeaderFallback: false as const,
      fallback: null,
    };
  }

  return {
    headerBackVisible: false as const,
    headerBackButtonDisplayMode: 'default' as const,
    showHeaderFallback: true as const,
    fallback: MEETING_DETAIL_FALLBACK,
  };
}
