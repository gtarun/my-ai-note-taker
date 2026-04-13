# First-Run Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a polished first-run onboarding flow that appears once after install, explains the real MVP clearly, and always sends the user to `Settings` to configure providers before use.

**Architecture:** Add a dedicated Expo Router screen at `app/onboarding.tsx`, a small onboarding model layer for slide content and navigation helpers, and a persistence service backed by the existing `app_preferences` table. Gate the app shell in `app/_layout.tsx` after bootstrap so onboarding appears only once and never deadlocks app startup.

**Tech Stack:** Expo Router, React Native, TypeScript, Expo SQLite, Vitest, existing theme/components

---

## File Structure

### New files

- `vitest.config.ts`
  - Minimal Vitest config for pure TypeScript onboarding tests
- `src/onboarding/model.ts`
  - Slide content, navigation helpers, progress helpers, route helpers
- `src/onboarding/model.test.ts`
  - Test coverage for slide definitions and onboarding flow helpers
- `src/services/onboarding.ts`
  - Persistence helpers for reading/writing `has_seen_onboarding`
- `src/services/onboarding.test.ts`
  - Pure tests for onboarding persistence helper functions
- `app/onboarding.tsx`
  - Full-screen onboarding UI route

### Modified files

- `package.json`
  - Add `test` script and Vitest dev dependency
- `src/db.native.ts`
  - Add `has_seen_onboarding` to `app_preferences`
- `src/db.web.ts`
  - Mirror `has_seen_onboarding` in the web DB shim
- `app/_layout.tsx`
  - Check onboarding state after bootstrap and route accordingly
- `README.md`
  - Mention first-run onboarding behavior briefly in product/use docs

## Task 1: Add Onboarding Model + Test Harness

**Files:**
- Create: `vitest.config.ts`
- Create: `src/onboarding/model.ts`
- Create: `src/onboarding/model.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

Create `src/onboarding/model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_SLIDES,
  getNextOnboardingIndex,
  getPreviousOnboardingIndex,
  getOnboardingProgress,
  getOnboardingCompletionRoute,
  isLastOnboardingSlide,
  shouldPresentOnboarding,
} from './model';

describe('onboarding model', () => {
  it('defines the approved 4-slide first-run flow', () => {
    expect(ONBOARDING_SLIDES.map((slide) => slide.id)).toEqual([
      'welcome',
      'workflow',
      'privacy',
      'setup',
    ]);
    expect(ONBOARDING_SLIDES[0].title).toBe('Record it. Upload it. Process it later.');
    expect(ONBOARDING_SLIDES[3].ctaLabel).toBe('Go to Settings');
    expect(ONBOARDING_SLIDES.every((slide) => slide.showSkip)).toBe(true);
  });

  it('bounds onboarding navigation and progress correctly', () => {
    expect(getPreviousOnboardingIndex(0)).toBe(0);
    expect(getNextOnboardingIndex(0, ONBOARDING_SLIDES.length)).toBe(1);
    expect(getNextOnboardingIndex(3, ONBOARDING_SLIDES.length)).toBe(3);
    expect(isLastOnboardingSlide(3, ONBOARDING_SLIDES.length)).toBe(true);
    expect(getOnboardingProgress(1, ONBOARDING_SLIDES.length)).toEqual([false, true, false, false]);
  });

  it('always exits onboarding into settings and never reopens while already on onboarding', () => {
    expect(getOnboardingCompletionRoute()).toBe('/settings');
    expect(shouldPresentOnboarding({ hasSeenOnboarding: false, pathname: '/' })).toBe(true);
    expect(shouldPresentOnboarding({ hasSeenOnboarding: true, pathname: '/' })).toBe(false);
    expect(shouldPresentOnboarding({ hasSeenOnboarding: false, pathname: '/onboarding' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/onboarding/model.test.ts
```

Expected:
- FAIL with `Cannot find module './model'`

- [ ] **Step 3: Add Vitest config and package script**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
});
```

Modify `package.json`:

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "test": "vitest run"
  },
  "devDependencies": {
    "@types/react": "~19.1.0",
    "typescript": "~5.9.2",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 4: Write minimal onboarding model implementation**

Create `src/onboarding/model.ts`:

```ts
export type OnboardingSlide = {
  id: 'welcome' | 'workflow' | 'privacy' | 'setup';
  eyebrow?: string;
  title: string;
  body: string;
  highlights?: string[];
  ctaLabel: string;
  showSkip: boolean;
};

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: 'welcome',
    eyebrow: 'Local-first meeting companion',
    title: 'Record it. Upload it. Process it later.',
    body: 'No bots. No auto-join. Just a clean path from meeting audio to transcript, summary, and action items.',
    highlights: ['Manual', 'Local-first', 'Post-call'],
    ctaLabel: 'Next',
    showSkip: true,
  },
  {
    id: 'workflow',
    title: 'One clean workflow.',
    body: 'Record or import audio, transcribe after the meeting, then review summary and action items.',
    highlights: ['Record or import', 'Transcribe later', 'Review and share'],
    ctaLabel: 'Next',
    showSkip: true,
  },
  {
    id: 'privacy',
    title: 'Private by default. Explicit by design.',
    body: 'Meetings stay local first. Audio only leaves the device when you choose to process it. You are responsible for recording consent.',
    highlights: ['Stored locally first', 'Processing is explicit', 'Consent matters'],
    ctaLabel: 'Next',
    showSkip: true,
  },
  {
    id: 'setup',
    title: 'Set up your provider first.',
    body: 'Add your API key and choose transcript and summary providers before you start using the app.',
    ctaLabel: 'Go to Settings',
    showSkip: true,
  },
];

export function getNextOnboardingIndex(currentIndex: number, slideCount: number) {
  return Math.min(currentIndex + 1, Math.max(0, slideCount - 1));
}

export function getPreviousOnboardingIndex(currentIndex: number) {
  return Math.max(0, currentIndex - 1);
}

export function isLastOnboardingSlide(index: number, slideCount: number) {
  return index >= slideCount - 1;
}

export function getOnboardingProgress(activeIndex: number, slideCount: number) {
  return Array.from({ length: slideCount }, (_, index) => index === activeIndex);
}

export function getOnboardingCompletionRoute() {
  return '/settings';
}

export function shouldPresentOnboarding(params: { hasSeenOnboarding: boolean; pathname: string }) {
  if (params.pathname === '/onboarding') {
    return false;
  }

  return !params.hasSeenOnboarding;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
npx vitest run src/onboarding/model.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add package.json vitest.config.ts src/onboarding/model.ts src/onboarding/model.test.ts
git commit -m "test: add onboarding model coverage"
```

## Task 2: Add Onboarding Persistence + DB Support

**Files:**
- Create: `src/services/onboarding.ts`
- Create: `src/services/onboarding.test.ts`
- Modify: `src/db.native.ts`
- Modify: `src/db.web.ts`

- [ ] **Step 1: Write the failing test**

Create `src/services/onboarding.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildHasSeenOnboardingValue,
  mapHasSeenOnboardingValue,
} from './onboarding';

describe('onboarding persistence helpers', () => {
  it('maps sqlite values to booleans safely', () => {
    expect(mapHasSeenOnboardingValue(1)).toBe(true);
    expect(mapHasSeenOnboardingValue(0)).toBe(false);
    expect(mapHasSeenOnboardingValue(null)).toBe(false);
    expect(mapHasSeenOnboardingValue(undefined)).toBe(false);
  });

  it('builds sqlite-friendly integer values', () => {
    expect(buildHasSeenOnboardingValue(true)).toBe(1);
    expect(buildHasSeenOnboardingValue(false)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/services/onboarding.test.ts
```

Expected:
- FAIL with `Cannot find module './onboarding'`

- [ ] **Step 3: Add DB schema support**

Modify `src/db.native.ts` inside `CREATE TABLE IF NOT EXISTS app_preferences`:

```sql
CREATE TABLE IF NOT EXISTS app_preferences (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  selected_transcription_provider TEXT NOT NULL,
  selected_summary_provider TEXT NOT NULL,
  delete_uploaded_audio INTEGER NOT NULL DEFAULT 0,
  model_catalog_url TEXT NOT NULL DEFAULT '',
  has_seen_onboarding INTEGER NOT NULL DEFAULT 0
);
```

Also add a compatibility migration after existing `PRAGMA table_info(app_preferences)` checks:

```ts
if (!appPreferenceColumns.some((column) => column.name === 'has_seen_onboarding')) {
  await db.execAsync("ALTER TABLE app_preferences ADD COLUMN has_seen_onboarding INTEGER NOT NULL DEFAULT 0;");
}
```

Modify `src/db.web.ts` default state and row type:

```ts
type AppPreferencesRow = {
  id: number;
  selected_transcription_provider: string;
  selected_summary_provider: string;
  delete_uploaded_audio: number;
  model_catalog_url: string;
  has_seen_onboarding: number;
};
```

Default state:

```ts
appPreferences: {
  id: 1,
  selected_transcription_provider: 'openai',
  selected_summary_provider: 'openai',
  delete_uploaded_audio: 0,
  model_catalog_url: '',
  has_seen_onboarding: 0,
},
```

And preserve `has_seen_onboarding` in the `INSERT OR REPLACE INTO app_preferences` shim branch.

- [ ] **Step 4: Implement onboarding persistence service**

Create `src/services/onboarding.ts`:

```ts
import { getDatabase } from '../db';

type OnboardingPreferenceRow = {
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
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
npx vitest run src/services/onboarding.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Run typecheck to verify DB/service changes**

Run:

```bash
npx tsc --noEmit
```

Expected:
- PASS

- [ ] **Step 7: Commit**

```bash
git add src/db.native.ts src/db.web.ts src/services/onboarding.ts src/services/onboarding.test.ts
git commit -m "feat: persist onboarding completion locally"
```

## Task 3: Build The Onboarding Route UI

**Files:**
- Create: `app/onboarding.tsx`
- Modify: `src/onboarding/model.ts`
- Modify: `src/onboarding/model.test.ts`

- [ ] **Step 1: Extend the failing test for UI-facing model output**

Append to `src/onboarding/model.test.ts`:

```ts
it('provides progress dot state and back-button state for the UI', () => {
  expect(getOnboardingProgress(0, ONBOARDING_SLIDES.length)).toEqual([true, false, false, false]);
  expect(getOnboardingProgress(3, ONBOARDING_SLIDES.length)).toEqual([false, false, false, true]);
  expect(canGoBackOnOnboarding(0)).toBe(false);
  expect(canGoBackOnOnboarding(2)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/onboarding/model.test.ts
```

Expected:
- FAIL with `canGoBackOnOnboarding is not defined`

- [ ] **Step 3: Add the missing UI helper**

Modify `src/onboarding/model.ts`:

```ts
export function canGoBackOnOnboarding(index: number) {
  return index > 0;
}
```

- [ ] **Step 4: Implement the onboarding screen**

Create `app/onboarding.tsx`:

```tsx
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { ScreenBackground } from '../src/components/ScreenBackground';
import { FadeInView } from '../src/components/FadeInView';
import {
  ONBOARDING_SLIDES,
  canGoBackOnOnboarding,
  getNextOnboardingIndex,
  getOnboardingCompletionRoute,
  getOnboardingProgress,
  isLastOnboardingSlide,
} from '../src/onboarding/model';
import { markOnboardingSeen } from '../src/services/onboarding';
import { palette, elevation } from '../src/theme';

export default function OnboardingScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const slide = ONBOARDING_SLIDES[activeIndex];
  const progress = getOnboardingProgress(activeIndex, ONBOARDING_SLIDES.length);

  const finish = async () => {
    try {
      await markOnboardingSeen();
    } finally {
      router.replace(getOnboardingCompletionRoute());
    }
  };

  const handleNext = async () => {
    if (isLastOnboardingSlide(activeIndex, ONBOARDING_SLIDES.length)) {
      await finish();
      return;
    }

    setActiveIndex((current) => getNextOnboardingIndex(current, ONBOARDING_SLIDES.length));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Text style={styles.skipText} onPress={() => void finish()}>
            Skip
          </Text>
          <Text style={styles.stepText}>{activeIndex + 1} / {ONBOARDING_SLIDES.length}</Text>
        </View>

        <FadeInView style={styles.card} key={slide.id}>
          {slide.eyebrow ? <Text style={styles.eyebrow}>{slide.eyebrow}</Text> : null}
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.body}>{slide.body}</Text>

          {slide.highlights?.length ? (
            <View style={styles.highlightList}>
              {slide.highlights.map((item) => (
                <View key={item} style={styles.highlightChip}>
                  <Text style={styles.highlightChipText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.footer}>
            <View style={styles.dots}>
              {progress.map((isActive, index) => (
                <View key={index} style={[styles.dot, isActive && styles.dotActive]} />
              ))}
            </View>

            {canGoBackOnOnboarding(activeIndex) ? (
              <Pressable style={styles.backButton} onPress={() => setActiveIndex((current) => current - 1)}>
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
            ) : <View />}
          </View>

          <Pressable style={styles.primaryButton} onPress={() => void handleNext()}>
            <Text style={styles.primaryButtonText}>{slide.ctaLabel}</Text>
          </Pressable>
        </FadeInView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.paper },
  container: { flex: 1, padding: 20, gap: 16 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skipText: { color: palette.mutedInk, fontWeight: '700' },
  stepText: { color: palette.mutedInk, fontSize: 13 },
  card: {
    flex: 1,
    backgroundColor: palette.cardStrong,
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 14,
    ...elevation.card,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    color: palette.accent,
    backgroundColor: palette.accentMist,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    fontWeight: '800',
    fontSize: 12,
  },
  title: { color: palette.ink, fontSize: 34, lineHeight: 36, fontWeight: '900' },
  body: { color: palette.mutedInk, fontSize: 16, lineHeight: 24 },
  highlightList: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  highlightChip: {
    borderRadius: 999,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  highlightChipText: { color: palette.ink, fontWeight: '700', fontSize: 12 },
  footer: { marginTop: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: '#d1c4ae' },
  dotActive: { width: 24, backgroundColor: palette.ink },
  backButton: { paddingVertical: 8, paddingHorizontal: 10 },
  backButtonText: { color: palette.mutedInk, fontWeight: '700' },
  primaryButton: {
    backgroundColor: palette.ink,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: palette.paper, fontWeight: '800', fontSize: 15 },
});
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
npx vitest run src/onboarding/model.test.ts
npx tsc --noEmit
```

Expected:
- PASS
- PASS

- [ ] **Step 6: Commit**

```bash
git add app/onboarding.tsx src/onboarding/model.ts src/onboarding/model.test.ts
git commit -m "feat: add first-run onboarding screen"
```

## Task 4: Gate App Launch And Document The Flow

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `README.md`

- [ ] **Step 1: Extend the failing test for launch gating**

Append to `src/onboarding/model.test.ts`:

```ts
it('only asks layout to redirect when onboarding has not been seen and route is not onboarding', () => {
  expect(shouldPresentOnboarding({ hasSeenOnboarding: false, pathname: '/settings' })).toBe(true);
  expect(shouldPresentOnboarding({ hasSeenOnboarding: true, pathname: '/settings' })).toBe(false);
  expect(shouldPresentOnboarding({ hasSeenOnboarding: false, pathname: '/onboarding' })).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it still covers the launch gate**

Run:

```bash
npx vitest run src/onboarding/model.test.ts
```

Expected:
- PASS

- [ ] **Step 3: Integrate onboarding gate in layout**

Modify `app/_layout.tsx`:

```tsx
import { Stack, usePathname, router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { bootstrapApp } from '../src/services/bootstrap';
import { getHasSeenOnboarding } from '../src/services/onboarding';
import { shouldPresentOnboarding } from '../src/onboarding/model';
import { palette } from '../src/theme';

export default function RootLayout() {
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    bootstrapApp()
      .then(async () => {
        const hasSeenOnboarding = await getHasSeenOnboarding().catch(() => true);

        if (!cancelled && shouldPresentOnboarding({ hasSeenOnboarding, pathname })) {
          router.replace('/onboarding');
        }

        if (!cancelled) {
          setIsReady(true);
        }
      })
      .catch((bootstrapError: Error) => {
        if (!cancelled) {
          setError(bootstrapError.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // keep existing error/loading/UI return blocks unchanged, but add:
  // <Stack.Screen name="onboarding" options={{ headerShown: false }} />
}
```

- [ ] **Step 4: Register the onboarding route in the stack**

Add this screen in the returned stack inside `app/_layout.tsx`:

```tsx
<Stack.Screen name="onboarding" options={{ headerShown: false }} />
```

- [ ] **Step 5: Update the README**

Add a short note to `README.md` under product/use docs:

```md
- first launch now includes a short onboarding flow and routes to Settings for provider setup
```

- [ ] **Step 6: Run verification**

Run:

```bash
npx vitest run src/onboarding/model.test.ts src/services/onboarding.test.ts
npx tsc --noEmit
npx expo export --platform ios --platform android
```

Expected:
- PASS
- PASS
- Expo export completes successfully

- [ ] **Step 7: Manual smoke test on device**

Run:

```bash
npx expo start --lan --clear
```

Verify:
- fresh install or cleared storage shows onboarding first
- `Skip` lands on `Settings`
- finishing onboarding lands on `Settings`
- relaunch does not show onboarding again
- home screen still works after setup

- [ ] **Step 8: Commit**

```bash
git add app/_layout.tsx README.md
git commit -m "feat: gate first launch with onboarding"
```
