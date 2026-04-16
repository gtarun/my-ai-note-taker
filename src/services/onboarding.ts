import { getDatabase } from '../db';
import { saveCloudOnboardingState } from './cloudUserData';

export type OnboardingPreferenceRow = {
  has_seen_onboarding?: number | null;
};

export function mapHasSeenOnboardingValue(value: number | null | undefined) {
  return value === 1;
}

export function buildHasSeenOnboardingValue(hasSeenOnboarding: boolean) {
  return hasSeenOnboarding ? 1 : 0;
}

export async function getHasSeenOnboarding() {
  const db = getDatabase();
  const row = await db.getFirstAsync<OnboardingPreferenceRow>(
    'SELECT has_seen_onboarding FROM app_preferences WHERE id = 1'
  );

  return mapHasSeenOnboardingValue(row?.has_seen_onboarding);
}

export async function markOnboardingSeen() {
  const db = getDatabase();

  await db.runAsync(
    'UPDATE app_preferences SET has_seen_onboarding = ? WHERE id = 1',
    buildHasSeenOnboardingValue(true)
  );

  await saveCloudOnboardingState(true);
}
