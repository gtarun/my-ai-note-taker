import { describe, expect, test } from 'vitest';

import { APP_TABS } from './tabs';

describe('app tabs', () => {
  test('defines the four primary tabs in display order', () => {
    expect(APP_TABS.map((tab) => tab.name)).toEqual(['index', 'record', 'settings', 'layers']);
    expect(APP_TABS.map((tab) => tab.title)).toEqual(['Meetings', 'New Recording', 'Settings', 'Layers']);
    expect(APP_TABS.map((tab) => tab.label)).toEqual(['Meetings', 'Record', 'Settings', 'Layers']);
  });
});
