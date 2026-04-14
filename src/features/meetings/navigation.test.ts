import { describe, expect, test } from 'vitest';

import { APP_TABS_ROUTE } from '../../navigation/routes';
import {
  getMeetingDetailBackAction,
  getMeetingDetailEntryMethod,
  getMeetingDetailHeaderFallback,
} from './navigation';

describe('meeting detail navigation', () => {
  test('preserves history when entering a detail screen', () => {
    expect(getMeetingDetailEntryMethod()).toBe('push');
  });

  test('falls back to the tab shell when there is no back stack', () => {
    expect(getMeetingDetailBackAction(true)).toEqual({
      kind: 'history',
      label: 'Back',
    });

    expect(getMeetingDetailBackAction(false)).toEqual({
      kind: 'route',
      label: 'Back to meetings',
      href: APP_TABS_ROUTE,
    });
  });

  test('provides a single header fallback when there is no stack history', () => {
    expect(getMeetingDetailHeaderFallback(true)).toBeNull();

    expect(getMeetingDetailHeaderFallback(false)).toEqual({
      label: 'Meetings',
      href: APP_TABS_ROUTE,
    });
  });
});
