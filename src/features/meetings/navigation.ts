import { APP_TABS_ROUTE } from '../../navigation/routes';

export function getMeetingDetailEntryMethod() {
  return 'push' as const;
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
