import Constants from 'expo-constants';

/**
 * Whether developer-facing entries (diagnostic logs, replay onboarding) appear
 * in Settings.
 *
 * These were previously linked unconditionally, so a public build shipped a
 * screen that dumps raw log scopes and `JSON.stringify` metadata with Share and
 * Copy buttons. They are genuinely useful during a TestFlight beta — a tester
 * can export logs when something misbehaves — so this is a build-time switch
 * rather than a deletion:
 *
 * - always on in development;
 * - on in any build where `expo.extra.showDeveloperTools` is true (set this for
 *   internal and preview profiles);
 * - off otherwise, which is what a public App Store build should ship.
 */
export function isDeveloperToolsEnabled(): boolean {
  if (__DEV__) {
    return true;
  }

  return readShowDeveloperToolsFlag(Constants.expoConfig?.extra);
}

/** Exported for testing: the flag must be a real boolean true, not any truthy value. */
export function readShowDeveloperToolsFlag(extra: unknown): boolean {
  if (!extra || typeof extra !== 'object') {
    return false;
  }

  return (extra as Record<string, unknown>).showDeveloperTools === true;
}
