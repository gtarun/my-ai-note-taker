import { describe, expect, it } from 'vitest';

import { getSetupRouteConfirmation, getSetupRouteOptions } from './setupRoutes';

describe('getSetupRouteOptions', () => {
  it('offers the on-device route first on iOS, where it actually works', () => {
    const options = getSetupRouteOptions('ios');

    expect(options.map((option) => option.id)).toEqual(['on-device', 'cloud']);
    expect(options[0].isRecommended).toBe(true);
    expect(options[0].transcriptionProvider).toBe('local');
  });

  it('offers only the cloud route on platforms without local inference', () => {
    // Android and web have a boundary-only contract — offering an on-device
    // option there would repeat the exact promise this slide used to break.
    for (const platform of ['android', 'web'] as const) {
      const options = getSetupRouteOptions(platform);

      expect(options.map((option) => option.id)).toEqual(['cloud']);
      expect(options[0].isRecommended).toBe(true);
    }
  });

  it('states the remaining requirement for every option', () => {
    for (const platform of ['ios', 'android', 'web'] as const) {
      for (const option of getSetupRouteOptions(platform)) {
        expect(option.requirement.length).toBeGreaterThan(0);
      }
    }
  });

  it('is honest that on-device transcription still needs a key for summaries', () => {
    const [onDevice] = getSetupRouteOptions('ios');

    expect(onDevice.requirement).toMatch(/API key/i);
  });
});

describe('getSetupRouteConfirmation', () => {
  it('tells the user what is left to do for each route', () => {
    expect(getSetupRouteConfirmation('on-device')).toMatch(/API key/i);
    expect(getSetupRouteConfirmation('cloud')).toMatch(/API key/i);
  });
});
