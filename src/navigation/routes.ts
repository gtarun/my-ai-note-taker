export const APP_TABS_ROUTE = '/(tabs)' as const;
export const RECORD_TAB_ROUTE = '/(tabs)/record' as const;
export const SETTINGS_TAB_ROUTE = '/(tabs)/settings' as const;

export function getMeetingDetailRoute(meetingId: string) {
  return `/meetings/${meetingId}`;
}
