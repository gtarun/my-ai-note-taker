import { describe, expect, test } from 'vitest';

import { APP_TABS_ROUTE } from '../../navigation/routes';
import {
  getMeetingDetailEntryMethod,
  getMeetingDetailHeaderPresentation,
} from './navigation';

describe('meeting detail navigation', () => {
  test('preserves history when entering a detail screen', () => {
    expect(getMeetingDetailEntryMethod()).toBe('push');
  });

  test('uses the native back affordance without a route-group label when history exists', () => {
    expect(getMeetingDetailHeaderPresentation(true)).toEqual({
      headerBackButtonDisplayMode: 'minimal',
      fallback: null,
    });
  });

  test('provides a single Meetings header fallback when there is no stack history', () => {
    expect(getMeetingDetailHeaderPresentation(false)).toEqual({
      headerBackVisible: false,
      fallback: {
        label: 'Meetings',
        href: APP_TABS_ROUTE,
      },
    });
  });
});
