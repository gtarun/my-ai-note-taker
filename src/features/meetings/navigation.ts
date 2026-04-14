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
      headerBackButtonDisplayMode: 'minimal' as const,
      fallback: null,
    };
  }

  return {
    headerBackVisible: false as const,
    fallback: MEETING_DETAIL_FALLBACK,
  };
}
