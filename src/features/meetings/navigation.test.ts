import { describe, expect, test } from 'vitest';

import { APP_TABS_ROUTE } from '../../navigation/routes';
import {
  getMeetingDetailBackAction,
  getMeetingDetailEntryMethod,
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
});
