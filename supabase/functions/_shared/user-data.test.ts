import { describe, expect, test } from 'vitest';

import { buildBootstrapPayload } from './user-data';

describe('buildBootstrapPayload', () => {
  test('returns defaults when optional rows are missing', () => {
    expect(
      buildBootstrapPayload({
        authUser: {
          id: 'user-1',
          email: 'founder@example.com',
          user_metadata: { name: 'Tarun' },
        },
        profile: null,
        preferences: null,
        providerConfigs: [],
        integrations: [],
        layers: [],
        layerFields: [],
      })
    ).toMatchObject({
      profile: { displayName: 'Tarun' },
      preferences: {
        selectedTranscriptionProvider: 'openai',
        selectedSummaryProvider: 'openai',
        hasSeenOnboarding: false,
      },
      providers: [],
      layers: [],
    });
  });
});
