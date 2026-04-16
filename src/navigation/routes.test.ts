import { describe, expect, test } from 'vitest';

import {
  APP_TABS_ROUTE,
  LAYERS_TAB_ROUTE,
  RECORD_TAB_ROUTE,
  SETTINGS_TAB_ROUTE,
  getMeetingDetailRoute,
} from './routes';

describe('navigation routes', () => {
  test('exposes canonical tab routes and meeting detail routes', () => {
    expect(APP_TABS_ROUTE).toBe('/(tabs)');
    expect(RECORD_TAB_ROUTE).toBe('/(tabs)/record');
    expect(SETTINGS_TAB_ROUTE).toBe('/(tabs)/settings');
    expect(LAYERS_TAB_ROUTE).toBe('/(tabs)/layers');
    expect(getMeetingDetailRoute('meeting-123')).toBe('/meetings/meeting-123');
  });
});
