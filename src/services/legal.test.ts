import { afterEach, describe, expect, it, vi } from 'vitest';

const { extraState } = vi.hoisted(() => ({
  extraState: { value: {} as Record<string, unknown> },
}));

vi.mock('expo-constants', () => ({
  default: {
    get expoConfig() {
      return { extra: extraState.value };
    },
  },
}));

afterEach(() => {
  extraState.value = {};
});

describe('legal links', () => {
  it('reports missing links when nothing is configured', async () => {
    const { hasLegalLinks, hasPrivacyPolicy, hasTerms } = await import('./legal');

    expect(hasPrivacyPolicy()).toBe(false);
    expect(hasTerms()).toBe(false);
    expect(hasLegalLinks()).toBe(false);
  });

  it('treats a whitespace-only URL as missing', async () => {
    // A blank placeholder left in app.json must not read as configured — that
    // would ship a link to nowhere on the sign-in screen.
    extraState.value = { privacyPolicyUrl: '   ', termsUrl: '\n' };
    const { hasLegalLinks } = await import('./legal');

    expect(hasLegalLinks()).toBe(false);
  });

  it('requires both documents before reporting complete', async () => {
    extraState.value = { privacyPolicyUrl: 'https://example.test/privacy' };
    const { hasLegalLinks, hasPrivacyPolicy } = await import('./legal');

    expect(hasPrivacyPolicy()).toBe(true);
    expect(hasLegalLinks()).toBe(false);
  });

  it('returns trimmed URLs when configured', async () => {
    extraState.value = {
      privacyPolicyUrl: ' https://example.test/privacy ',
      termsUrl: 'https://example.test/terms',
    };
    const { getLegalConfig, hasLegalLinks } = await import('./legal');

    expect(getLegalConfig()).toEqual({
      privacyPolicyUrl: 'https://example.test/privacy',
      termsUrl: 'https://example.test/terms',
    });
    expect(hasLegalLinks()).toBe(true);
  });
});
