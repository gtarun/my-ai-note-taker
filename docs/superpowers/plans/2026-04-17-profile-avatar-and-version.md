# Profile Avatar And Version Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent profile avatar button in the shared tab header, route account/profile actions through the profile screen, and show a quiet `v1.0.0 (12)` style footer at the bottom of the profile page.

**Architecture:** Keep the existing Expo Router `/account` route as the single profile destination, extend the auth-session mapping to expose avatar metadata, and render the avatar entry from the shared tab layout so every main tab gets the same top-right affordance. Add a small presentation utility for avatar fallback and build-version formatting so the UI logic stays testable.

**Tech Stack:** Expo Router, React Native, Expo Constants, Vitest, TypeScript

---

## File Structure

- Modify: `src/types.ts`
  - Extend the authenticated user model with `avatarUrl` so the session can drive the header and profile screen.
- Modify: `src/services/account.ts`
  - Read avatar metadata from the Supabase user and return it in `getAuthSession()` / `refreshCurrentSession()` mappings.
- Modify: `src/services/account.test.ts`
  - Lock in avatar mapping behavior with failing tests first.
- Create: `src/features/account/presentation.ts`
  - Pure helpers for deriving initials and formatting the app/build version label.
- Create: `src/features/account/presentation.test.ts`
  - Unit tests for initials and version formatting.
- Create: `src/components/ProfileAvatarButton.tsx`
  - Shared top-right header button that renders image, initials, or fallback icon.
- Modify: `app/(tabs)/_layout.tsx`
  - Inject the shared `headerRight` avatar button for tab screens.
- Modify: `app/account.tsx`
  - Restructure the screen into a profile hub with identity summary, account/integration actions, and version footer.
- Modify: `src/screens/MeetingsScreen.tsx`
  - Rename the secondary account CTA so the Meetings screen points to the new profile entry language.

### Task 1: Expose Avatar And Version Helpers

**Files:**
- Modify: `src/types.ts`
- Modify: `src/services/account.ts`
- Test: `src/services/account.test.ts`
- Create: `src/features/account/presentation.ts`
- Test: `src/features/account/presentation.test.ts`

- [ ] **Step 1: Write the failing account/avatar mapping test**

```ts
import { describe, expect, test, vi } from 'vitest';

// inside the existing "google drive auth session wiring" suite

test('maps the Google avatar URL from user metadata when present', async () => {
  getUser.mockResolvedValueOnce({
    data: {
      user: {
        id: 'user-1',
        email: 'owner@example.com',
        user_metadata: {
          name: 'Tarun',
          avatar_url: 'https://example.com/avatar.png',
        },
      },
    },
    error: null,
  });

  const account = await import('./account');

  await expect(account.getAuthSession()).resolves.toMatchObject({
    user: {
      name: 'Tarun',
      avatarUrl: 'https://example.com/avatar.png',
    },
  });
});
```

- [ ] **Step 2: Run the account test to verify it fails**

Run: `npm test -- src/services/account.test.ts`
Expected: FAIL because `avatarUrl` is missing from the mapped session shape.

- [ ] **Step 3: Add the user avatar type and session mapping**

```ts
// src/types.ts
export type UserAccount = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  driveConnection: DriveConnection;
};
```

```ts
// src/services/account.ts
function mapSupabaseSession(accessToken: string, user: User): AuthSession {
  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email ?? '',
      name: readUserName(user),
      avatarUrl: readUserAvatarUrl(user),
      driveConnection: readDriveConnection(user),
    },
  };
}

function readUserAvatarUrl(user: User) {
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const candidates = [metadata?.avatar_url, metadata?.picture, metadata?.photo_url];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}
```

- [ ] **Step 4: Write the failing presentation tests for initials and version formatting**

```ts
import { describe, expect, test } from 'vitest';

import { formatBuildVersion, getProfileInitials } from './presentation';

describe('account presentation helpers', () => {
  test('prefers initials from display name', () => {
    expect(getProfileInitials({ name: 'Tarun Gupta', email: 'owner@example.com' })).toBe('TG');
  });

  test('falls back to email initials when no name exists', () => {
    expect(getProfileInitials({ name: null, email: 'mu@example.com' })).toBe('MU');
  });

  test('formats version with build number', () => {
    expect(formatBuildVersion({ appVersion: '1.0.0', buildNumber: '12' })).toBe('v1.0.0 (12)');
  });

  test('falls back gracefully when build number is missing', () => {
    expect(formatBuildVersion({ appVersion: '1.0.0', buildNumber: null })).toBe('v1.0.0');
  });
});
```

- [ ] **Step 5: Run the new presentation test to verify it fails**

Run: `npm test -- src/features/account/presentation.test.ts`
Expected: FAIL because `presentation.ts` does not exist yet.

- [ ] **Step 6: Implement the minimal presentation helpers**

```ts
// src/features/account/presentation.ts
export function getProfileInitials({
  name,
  email,
}: {
  name: string | null;
  email: string | null;
}) {
  const source = name?.trim() || email?.split('@')[0]?.trim() || '';
  const parts = source
    .split(/[^A-Za-z0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return '';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function formatBuildVersion({
  appVersion,
  buildNumber,
}: {
  appVersion: string;
  buildNumber: string | null;
}) {
  return buildNumber?.trim() ? `v${appVersion} (${buildNumber.trim()})` : `v${appVersion}`;
}
```

- [ ] **Step 7: Run the focused tests to verify they pass**

Run: `npm test -- src/services/account.test.ts src/features/account/presentation.test.ts`
Expected: PASS with the new avatar/session and formatting helpers covered.

- [ ] **Step 8: Commit the helper layer**

```bash
git add src/types.ts src/services/account.ts src/services/account.test.ts src/features/account/presentation.ts src/features/account/presentation.test.ts
git commit -m "feat: add profile avatar session helpers"
```

### Task 2: Add Shared Header Avatar Navigation

**Files:**
- Create: `src/components/ProfileAvatarButton.tsx`
- Modify: `app/(tabs)/_layout.tsx`
- Test: `src/features/account/presentation.test.ts`

- [ ] **Step 1: Extend the presentation tests for generic fallback behavior**

```ts
test('returns empty initials when no name or email is available', () => {
  expect(getProfileInitials({ name: null, email: null })).toBe('');
});
```

- [ ] **Step 2: Run the helper test to verify the new assertion passes or fails appropriately**

Run: `npm test -- src/features/account/presentation.test.ts`
Expected: If the empty fallback is not handled yet, FAIL; otherwise PASS and continue.

- [ ] **Step 3: Create the shared header avatar component**

```tsx
// src/components/ProfileAvatarButton.tsx
import { Feather } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { getProfileInitials } from '../features/account/presentation';
import { palette, typography } from '../theme';

export function ProfileAvatarButton({
  name,
  email,
  avatarUrl,
  onPress,
}: {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  onPress: () => void;
}) {
  const initials = getProfileInitials({ name, email });

  return (
    <Pressable onPress={onPress} style={styles.button} accessibilityRole="button" accessibilityLabel="Open profile">
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.image} />
      ) : initials ? (
        <View style={styles.fallbackCircle}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
      ) : (
        <View style={styles.fallbackCircle}>
          <Feather name="user" size={18} color={palette.ink} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginRight: 12,
  },
  image: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: palette.line,
  },
  fallbackCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cardStrong,
    borderWidth: 1,
    borderColor: palette.line,
  },
  initials: {
    color: palette.ink,
    fontSize: 12,
    ...typography.label,
  },
});
```

- [ ] **Step 4: Wire the avatar button into the shared tabs header**

```tsx
// app/(tabs)/_layout.tsx
import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';

import { ProfileAvatarButton } from '../../src/components/ProfileAvatarButton';
import { getAuthSession } from '../../src/services/account';
import type { AuthSession } from '../../src/types';

export default function TabLayout() {
  const [session, setSession] = useState<AuthSession | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      void getAuthSession()
        .then((nextSession) => {
          if (!cancelled) {
            setSession(nextSession);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSession(null);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <Tabs
      screenOptions={{
        // existing options
        headerRight: () => (
          <ProfileAvatarButton
            name={session?.user.name ?? null}
            email={session?.user.email ?? null}
            avatarUrl={session?.user.avatarUrl ?? null}
            onPress={() => router.push('/account')}
          />
        ),
      }}
    >
```

- [ ] **Step 5: Run tests and a type-check for the shared header changes**

Run: `npm test -- src/services/account.test.ts src/features/account/presentation.test.ts && npx tsc --noEmit`
Expected: PASS with no type errors from the new shared avatar component.

- [ ] **Step 6: Commit the shared avatar navigation**

```bash
git add src/components/ProfileAvatarButton.tsx "app/(tabs)/_layout.tsx" src/features/account/presentation.test.ts
git commit -m "feat: add shared profile avatar entry"
```

### Task 3: Turn The Account Screen Into A Real Profile Hub

**Files:**
- Modify: `app/account.tsx`
- Modify: `src/services/account.ts` (only if a small helper export is needed)
- Test: `src/features/account/presentation.test.ts`

- [ ] **Step 1: Add a failing test for compact version formatting if needed**

```ts
test('preserves numeric-looking build numbers as strings', () => {
  expect(formatBuildVersion({ appVersion: '1.0.0', buildNumber: '12' })).toBe('v1.0.0 (12)');
});
```

- [ ] **Step 2: Run the presentation test suite**

Run: `npm test -- src/features/account/presentation.test.ts`
Expected: PASS or FAIL only if version formatting regressed while preparing the profile screen work.

- [ ] **Step 3: Read Expo version/build metadata in the profile screen and redesign the top summary**

```tsx
// app/account.tsx
import Constants from 'expo-constants';
import { Image } from 'react-native';

import { formatBuildVersion, getProfileInitials } from '../src/features/account/presentation';

const expoVersion = Constants.expoConfig?.version ?? '1.0.0';
const nativeBuildNumber =
  typeof Constants.expoConfig?.ios?.buildNumber === 'string'
    ? Constants.expoConfig.ios.buildNumber
    : typeof Constants.expoConfig?.android?.versionCode === 'number'
      ? String(Constants.expoConfig.android.versionCode)
      : Constants.nativeBuildVersion ?? null;

const versionLabel = formatBuildVersion({
  appVersion: expoVersion,
  buildNumber: nativeBuildNumber,
});
```

```tsx
<View style={styles.profileCard}>
  {session?.user.avatarUrl ? (
    <Image source={{ uri: session.user.avatarUrl }} style={styles.profileImage} />
  ) : (
    <View style={styles.profileFallback}>
      {getProfileInitials({ name: session?.user.name ?? null, email: session?.user.email ?? null }) ? (
        <Text style={styles.profileInitials}>
          {getProfileInitials({ name: session?.user.name ?? null, email: session?.user.email ?? null })}
        </Text>
      ) : (
        <Feather name="user" size={28} color={palette.ink} />
      )}
    </View>
  )}
  <Text style={styles.profileTitle}>{session ? session.user.name || 'Google account' : 'Profile'}</Text>
  <Text style={styles.profileBody}>{session ? session.user.email : 'Sign in to sync settings, layers, and Google integrations.'}</Text>
</View>
```

- [ ] **Step 4: Keep the integration actions on the profile page and add the footer label**

```tsx
<Text style={styles.versionFooter}>{versionLabel}</Text>
```

```ts
versionFooter: {
  color: palette.mutedInk,
  textAlign: 'center',
  fontSize: 12,
  paddingTop: 12,
  paddingBottom: 4,
},
```

- [ ] **Step 5: Run the focused tests and a type-check**

Run: `npm test -- src/services/account.test.ts src/features/account/presentation.test.ts && npx tsc --noEmit`
Expected: PASS and no type errors from the account screen refactor.

- [ ] **Step 6: Commit the profile hub UI**

```bash
git add app/account.tsx src/features/account/presentation.ts src/features/account/presentation.test.ts
git commit -m "feat: redesign profile page with version footer"
```

### Task 4: Align Meetings Copy And Verify On Device

**Files:**
- Modify: `src/screens/MeetingsScreen.tsx`

- [ ] **Step 1: Update the Meetings account CTA to match the new profile language**

```tsx
// src/screens/MeetingsScreen.tsx
<View style={styles.accountActions}>
  <PillButton
    label={session ? 'Open profile' : 'Set up account'}
    onPress={() => router.push('/account')}
    variant="ghost"
  />
  <PillButton
    label="Settings"
    onPress={() => router.push(SETTINGS_TAB_ROUTE)}
    variant="ghost"
  />
</View>
```

- [ ] **Step 2: Run the full automated verification**

Run: `npm test && npx tsc --noEmit`
Expected: PASS across the existing Vitest suite and TypeScript compile.

- [ ] **Step 3: Perform manual device/simulator verification**

Run these checks in the app:
- Open each tab and confirm the avatar appears in the top-right.
- Tap the avatar while signed out and confirm the profile page opens.
- Sign in and confirm the avatar updates to photo or initials.
- Open the profile page and confirm Google/Drive actions still work.
- Confirm the footer shows `v1.0.0 (12)` on a native build or `v1.0.0` gracefully when build metadata is absent.

Expected: All flows work without losing current Google integration behavior.

- [ ] **Step 4: Commit the final navigation polish**

```bash
git add src/screens/MeetingsScreen.tsx
git commit -m "chore: polish profile entry points"
```
