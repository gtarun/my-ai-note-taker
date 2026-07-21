import { describe, expect, test } from 'vitest';

import { APP_TABS } from './tabs';

describe('app tabs', () => {
  test('defines the three primary tabs in display order', () => {
    expect(APP_TABS.map((tab) => tab.name)).toEqual(['index', 'record', 'settings']);
    expect(APP_TABS.map((tab) => tab.title)).toEqual(['Meetings', 'New Recording', 'Settings']);
    expect(APP_TABS.map((tab) => tab.label)).toEqual(['Meetings', 'Record', 'Settings']);
  });

  test('suppresses the nav title only where the screen renders its own', () => {
    // The meetings screen has a serif masthead. Showing the nav title too
    // printed "Meetings" twice, in two different faces, one above the other.
    const byName = Object.fromEntries(APP_TABS.map((tab) => [tab.name, tab]));

    expect(byName.index.showHeaderTitle).toBe(false);
    expect(byName.record.showHeaderTitle).toBe(true);
    expect(byName.settings.showHeaderTitle).toBe(true);
  });
});
