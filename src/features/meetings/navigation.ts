import { APP_TABS_ROUTE } from '../../navigation/routes';

export function getMeetingDetailEntryMethod() {
  return 'push' as const;
}

export function getMeetingDetailHeaderFallback(canReturnToPreviousScreen: boolean) {
  if (canReturnToPreviousScreen) {
    return null;
  }

  return {
    label: 'Meetings',
    href: APP_TABS_ROUTE,
  };
}

export function getMeetingDetailBackAction(canReturnToPreviousScreen: boolean) {
  if (canReturnToPreviousScreen) {
    return {
      kind: 'history' as const,
      label: 'Back',
    };
  }

  return {
    kind: 'route' as const,
    label: 'Back to meetings',
    href: APP_TABS_ROUTE,
  };
}
