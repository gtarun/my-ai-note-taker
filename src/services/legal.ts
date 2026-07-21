import Constants from 'expo-constants';

/**
 * Links to the hosted legal documents.
 *
 * App review expects a reachable privacy policy for any app that records audio
 * and sends it to third parties. The URLs live in `app.json` under `extra` so
 * they can differ per build profile without a code change.
 *
 * The source text for these documents is in `docs/privacy-policy.md` and
 * `docs/terms-of-use.md`. They must be hosted somewhere public and the URLs set
 * below before submitting a build — `hasLegalLinks()` reports whether that has
 * been done.
 */

type LegalConfig = {
  privacyPolicyUrl: string;
  termsUrl: string;
};

function readExtra(): Record<string, unknown> {
  return (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
}

function readUrl(key: string): string {
  const value = readExtra()[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function getLegalConfig(): LegalConfig {
  return {
    privacyPolicyUrl: readUrl('privacyPolicyUrl'),
    termsUrl: readUrl('termsUrl'),
  };
}

export function hasPrivacyPolicy(): boolean {
  return getLegalConfig().privacyPolicyUrl.length > 0;
}

export function hasTerms(): boolean {
  return getLegalConfig().termsUrl.length > 0;
}

/** True only when every required legal link is configured. */
export function hasLegalLinks(): boolean {
  return hasPrivacyPolicy() && hasTerms();
}
