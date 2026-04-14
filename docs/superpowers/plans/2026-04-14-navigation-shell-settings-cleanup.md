# Navigation Shell And Settings Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the app to a 3-tab shell so onboarding lands on Meetings, users can always return to the dashboard, and settings reads with a clearer top-down hierarchy.

**Architecture:** Expo Router owns primary navigation through an `(tabs)` route group while onboarding and meeting detail stay in the root stack. Existing route screen implementations are moved into `src/screens` so the new tab routes stay thin, and the settings screen gets a lighter presentation pass without changing provider or local-model behavior.

**Tech Stack:** Expo Router, React Native, TypeScript, Vitest, Expo Vector Icons

---

## File Structure

- Create: `src/navigation/routes.ts`
- Create: `src/navigation/routes.test.ts`
- Create: `src/navigation/tabs.ts`
- Create: `src/navigation/tabs.test.ts`
- Create: `src/screens/MeetingsScreen.tsx`
- Create: `src/screens/RecordScreen.tsx`
- Create: `src/screens/SettingsScreen.tsx`
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/index.tsx`
- Create: `app/(tabs)/record.tsx`
- Create: `app/(tabs)/settings.tsx`
- Modify: `src/onboarding/model.ts`
- Modify: `src/onboarding/model.test.ts`
- Modify: `app/_layout.tsx`
- Modify: `app/meetings/[id].tsx`
- Modify: `src/features/settings/presentation.ts`
- Modify: `src/features/settings/presentation.test.ts`
- Delete after move: `app/index.tsx`
- Delete after move: `app/record.tsx`
- Delete after move: `app/settings.tsx`

## Task 1: Centralize Main Routes And Fix Onboarding Exit

**Files:**
- Create: `src/navigation/routes.ts`
- Test: `src/navigation/routes.test.ts`
- Modify: `src/onboarding/model.ts`
- Test: `src/onboarding/model.test.ts`

- [ ] **Step 1: Write the failing navigation helper and onboarding expectations**

Create `src/navigation/routes.test.ts`:

```ts
import { describe, expect, test } from 'vitest';

import {
  APP_TABS_ROUTE,
  RECORD_TAB_ROUTE,
  SETTINGS_TAB_ROUTE,
  getMeetingDetailRoute,
} from './routes';

describe('navigation routes', () => {
  test('exposes canonical tab routes and meeting detail routes', () => {
    expect(APP_TABS_ROUTE).toBe('/(tabs)');
    expect(RECORD_TAB_ROUTE).toBe('/(tabs)/record');
    expect(SETTINGS_TAB_ROUTE).toBe('/(tabs)/settings');
    expect(getMeetingDetailRoute('meeting-123')).toBe('/meetings/meeting-123');
  });
});
```

Update `src/onboarding/model.test.ts`:

```ts
  test('exposes the onboarding slides', () => {
    expect(ONBOARDING_SLIDES.map((slide) => slide.id)).toEqual([
      'welcome',
      'workflow',
      'privacy',
      'setup',
    ]);
    expect(ONBOARDING_SLIDES[0].title).toBe('Record it. Upload it. Process it later.');
    expect(ONBOARDING_SLIDES[3].title).toBe("You're ready to start.");
    expect(ONBOARDING_SLIDES[3].ctaLabel).toBe('Open app');
    expect(ONBOARDING_SLIDES[3].body).toContain('Settings tab');
    expect(ONBOARDING_SLIDES.every((slide) => slide.showSkip)).toBe(true);
  });
```

And in the helper test:

```ts
    expect(getOnboardingCompletionRoute()).toBe('/(tabs)');
```

- [ ] **Step 2: Run the focused tests to confirm they fail**

Run:

```bash
npx vitest run src/navigation/routes.test.ts src/onboarding/model.test.ts
```

Expected:

- `src/navigation/routes.test.ts` fails because `src/navigation/routes.ts` does not exist yet
- `src/onboarding/model.test.ts` fails because the last onboarding slide still points users to Settings and the completion route is still `/settings`

- [ ] **Step 3: Add the route helper and update onboarding copy**

Create `src/navigation/routes.ts`:

```ts
export const APP_TABS_ROUTE = '/(tabs)' as const;
export const RECORD_TAB_ROUTE = '/(tabs)/record' as const;
export const SETTINGS_TAB_ROUTE = '/(tabs)/settings' as const;

export function getMeetingDetailRoute(meetingId: string) {
  return `/meetings/${meetingId}`;
}
```

Update `src/onboarding/model.ts`:

```ts
import { APP_TABS_ROUTE } from '../navigation/routes';

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: 'welcome',
    eyebrow: 'Local-first meeting companion',
    title: 'Record it. Upload it. Process it later.',
    body:
      'No bots. No auto-join. Just a clean path from meeting audio to transcript, summary, and action items.',
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
    body:
      'Meetings stay local first. Audio only leaves the device when you choose to process it. You are responsible for recording consent.',
    highlights: ['Stored locally first', 'Processing is explicit', 'Consent matters'],
    ctaLabel: 'Next',
    showSkip: true,
  },
  {
    id: 'setup',
    title: "You're ready to start.",
    body:
      'Meetings is your home base. You can configure transcript and summary providers any time from the Settings tab.',
    highlights: ['Meetings home', 'Record anytime', 'Settings tab'],
    ctaLabel: 'Open app',
    showSkip: true,
  },
];

export function getOnboardingCompletionRoute() {
  return APP_TABS_ROUTE;
}
```

- [ ] **Step 4: Re-run the focused tests to confirm the route contract**

Run:

```bash
npx vitest run src/navigation/routes.test.ts src/onboarding/model.test.ts
```

Expected:

- all tests pass
- onboarding now advertises the new landing flow instead of the old Settings dead-end

- [ ] **Step 5: Commit the onboarding and route contract**

Run:

```bash
git add src/navigation/routes.ts src/navigation/routes.test.ts src/onboarding/model.ts src/onboarding/model.test.ts
git commit -m "feat: route onboarding to tab shell"
```

## Task 2: Add The Expo Tab Shell And Move Main Screens Into It

**Files:**
- Create: `src/navigation/tabs.ts`
- Test: `src/navigation/tabs.test.ts`
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/index.tsx`
- Create: `app/(tabs)/record.tsx`
- Create: `app/(tabs)/settings.tsx`
- Create: `src/screens/MeetingsScreen.tsx`
- Create: `src/screens/RecordScreen.tsx`
- Create: `src/screens/SettingsScreen.tsx`
- Modify: `app/_layout.tsx`
- Modify: `app/meetings/[id].tsx`
- Delete after move: `app/index.tsx`
- Delete after move: `app/record.tsx`
- Delete after move: `app/settings.tsx`

- [ ] **Step 1: Write the failing tab metadata test**

Create `src/navigation/tabs.test.ts`:

```ts
import { describe, expect, test } from 'vitest';

import { APP_TABS } from './tabs';

describe('app tabs', () => {
  test('defines the three primary tabs in display order', () => {
    expect(APP_TABS.map((tab) => tab.name)).toEqual(['index', 'record', 'settings']);
    expect(APP_TABS.map((tab) => tab.title)).toEqual(['Meetings', 'New Recording', 'Settings']);
    expect(APP_TABS.map((tab) => tab.label)).toEqual(['Meetings', 'Record', 'Settings']);
  });
});
```

- [ ] **Step 2: Run the tab test to confirm the shell does not exist yet**

Run:

```bash
npx vitest run src/navigation/tabs.test.ts
```

Expected:

- fail because `src/navigation/tabs.ts` does not exist yet

- [ ] **Step 3: Add tab metadata and the tab layout**

Create `src/navigation/tabs.ts`:

```ts
export type AppTabDefinition = {
  name: 'index' | 'record' | 'settings';
  title: string;
  label: string;
  icon: 'home' | 'mic' | 'settings';
};

export const APP_TABS: AppTabDefinition[] = [
  {
    name: 'index',
    title: 'Meetings',
    label: 'Meetings',
    icon: 'home',
  },
  {
    name: 'record',
    title: 'New Recording',
    label: 'Record',
    icon: 'mic',
  },
  {
    name: 'settings',
    title: 'Settings',
    label: 'Settings',
    icon: 'settings',
  },
];
```

Create `app/(tabs)/_layout.tsx`:

```tsx
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { APP_TABS } from '../../src/navigation/tabs';
import { palette, typography } from '../../src/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: palette.paper },
        headerTintColor: palette.ink,
        headerTitleStyle: {
          color: palette.ink,
          fontSize: 18,
          ...typography.heading,
        },
        sceneStyle: { backgroundColor: palette.paper },
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.mutedInk,
        tabBarStyle: {
          backgroundColor: palette.paper,
          borderTopColor: palette.line,
          height: 78,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontFamily: typography.label.fontFamily,
          fontSize: 12,
        },
      }}
    >
      {APP_TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarLabel: tab.label,
            tabBarIcon: ({ color, size }) => <Feather name={tab.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
```

- [ ] **Step 4: Move the current route screens into `src/screens` and wire the new wrappers**

Run:

```bash
mkdir -p src/screens "app/(tabs)"
git mv app/index.tsx src/screens/MeetingsScreen.tsx
git mv app/record.tsx src/screens/RecordScreen.tsx
git mv app/settings.tsx src/screens/SettingsScreen.tsx
```

Create `app/(tabs)/index.tsx`:

```tsx
export { default } from '../../src/screens/MeetingsScreen';
```

Create `app/(tabs)/record.tsx`:

```tsx
export { default } from '../../src/screens/RecordScreen';
```

Create `app/(tabs)/settings.tsx`:

```tsx
export { default } from '../../src/screens/SettingsScreen';
```

Update the moved screen imports to point at `src/*` siblings instead of `../src/*`, and switch explicit navigation calls to the route helper:

```tsx
import { router, useFocusEffect } from 'expo-router';

import { RECORD_TAB_ROUTE, SETTINGS_TAB_ROUTE, getMeetingDetailRoute } from '../navigation/routes';
```

In `src/screens/MeetingsScreen.tsx` replace the relevant pushes:

```tsx
onPress={() => router.push(RECORD_TAB_ROUTE)}
onPress={() => router.push(SETTINGS_TAB_ROUTE)}
onPress={() => router.push(getMeetingDetailRoute(item.id))}
```

In `src/screens/RecordScreen.tsx` replace the post-save route:

```tsx
router.replace(getMeetingDetailRoute(meetingId));
```

In `app/meetings/[id].tsx` replace home escapes with the canonical tab route:

```tsx
import { APP_TABS_ROUTE } from '../../src/navigation/routes';

router.replace(APP_TABS_ROUTE);
```

Update `app/_layout.tsx` so the root stack hosts the tabs instead of the old standalone routes:

```tsx
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.paper },
          headerTintColor: palette.ink,
          headerTitleStyle: {
            color: palette.ink,
            fontSize: 18,
            ...resolvedTypography.heading,
          },
          contentStyle: { backgroundColor: palette.paper },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="account" options={{ title: 'Account' }} />
        <Stack.Screen name="meetings/[id]" options={{ title: 'Meeting' }} />
      </Stack>
```

- [ ] **Step 5: Verify the tab shell builds cleanly after the route move**

Run:

```bash
npx vitest run src/navigation/tabs.test.ts
npx tsc --noEmit
```

Expected:

- tab metadata test passes
- TypeScript passes with the tab group, wrappers, and moved screen files

- [ ] **Step 6: Commit the new app shell**

Run:

```bash
git add app/_layout.tsx "app/(tabs)" src/navigation/tabs.ts src/navigation/tabs.test.ts src/screens app/meetings/[id].tsx
git commit -m "feat: add primary tab shell"
```

## Task 3: Simplify Settings Hierarchy Inside The Tab Shell

**Files:**
- Modify: `src/features/settings/presentation.ts`
- Test: `src/features/settings/presentation.test.ts`
- Modify: `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Write a failing test for the compact settings summary rows**

Update `src/features/settings/presentation.test.ts`:

```ts
import { buildSettingsOverviewItems } from './presentation';

  test('builds compact overview rows for the settings header', () => {
    expect(
      buildSettingsOverviewItems({
        transcriptionProviderLabel: 'OpenAI',
        summaryProviderLabel: 'OpenRouter',
        installedTranscriptionCount: 1,
        installedSummaryCount: 2,
      })
    ).toEqual([
      { label: 'Transcription', value: 'OpenAI' },
      { label: 'Summary', value: 'OpenRouter' },
      { label: 'Local models', value: '3 installed' },
    ]);
  });
```

- [ ] **Step 2: Run the focused settings test to confirm the helper is missing**

Run:

```bash
npx vitest run src/features/settings/presentation.test.ts
```

Expected:

- fail because `buildSettingsOverviewItems` does not exist yet

- [ ] **Step 3: Add the compact settings summary helper**

Update `src/features/settings/presentation.ts`:

```ts
export function buildSettingsOverviewItems({
  transcriptionProviderLabel,
  summaryProviderLabel,
  installedTranscriptionCount,
  installedSummaryCount,
}: {
  transcriptionProviderLabel: string;
  summaryProviderLabel: string;
  installedTranscriptionCount: number;
  installedSummaryCount: number;
}) {
  const installedCount = installedTranscriptionCount + installedSummaryCount;

  return [
    { label: 'Transcription', value: transcriptionProviderLabel },
    { label: 'Summary', value: summaryProviderLabel },
    {
      label: 'Local models',
      value: installedCount > 0 ? `${installedCount} installed` : 'None installed',
    },
  ];
}
```

- [ ] **Step 4: Rebuild the top of the settings screen around “current setup” first**

Update `src/screens/SettingsScreen.tsx` to remove the oversized hero and lead with a smaller summary section:

```tsx
import {
  buildActiveProviderSummary,
  buildSettingsOverviewItems,
  displayModelLabel,
  formatBytes,
  getConfiguredProviderIds,
  pickInitialProvider,
} from '../features/settings/presentation';
```

Create the overview data:

```tsx
  const overviewItems = buildSettingsOverviewItems({
    transcriptionProviderLabel: transcriptionProvider.label,
    summaryProviderLabel: summaryProvider.label,
    installedTranscriptionCount: installedTranscriptionModels.length,
    installedSummaryCount: installedSummaryModels.length,
  });
```

Replace the top hero block with a compact header and summary card:

```tsx
        <FadeInView>
          <SectionHeading
            title="Current setup"
            subtitle="Choose which provider handles transcription and summary, then save."
          />
        </FadeInView>

        <FadeInView delay={30}>
          <SurfaceCard muted style={styles.summaryCard}>
            <View style={styles.summaryRows}>
              {overviewItems.map((item) => (
                <View key={item.label} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{item.label}</Text>
                  <Text style={styles.summaryValue}>{item.value}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.summaryCopy}>{activeProviderSummary}</Text>
            <PillButton
              label={isSaving ? 'Saving…' : 'Save settings'}
              onPress={() => {
                void handleSave();
              }}
              disabled={isSaving}
            />
          </SurfaceCard>
        </FadeInView>
```

Keep the remaining order explicit:

```tsx
        <SectionHeading
          title="Provider routing"
          subtitle="Pick the provider for each job before editing credentials below."
        />

        <SectionHeading
          title="Configured providers"
          subtitle="Add credentials once, then reuse them across meetings."
        />

        <SectionHeading
          title="Local models"
          subtitle="Manage offline transcription and summary models on this device."
        />

        <SectionHeading
          title="Advanced"
          subtitle="Optional behaviors that change storage or cleanup rules."
        />
```

Add the matching styles:

```tsx
  summaryRows: {
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: {
    color: palette.mutedInk,
    fontFamily: typography.label.fontFamily,
    fontSize: 13,
  },
  summaryValue: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 14,
    flexShrink: 1,
    textAlign: 'right',
  },
  summaryCopy: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    lineHeight: 22,
  },
```

- [ ] **Step 5: Re-run the settings tests and typecheck**

Run:

```bash
npx vitest run src/features/settings/presentation.test.ts
npx tsc --noEmit
```

Expected:

- settings presentation tests pass with the new overview helper
- TypeScript passes with the updated screen structure

- [ ] **Step 6: Commit the settings cleanup**

Run:

```bash
git add src/features/settings/presentation.ts src/features/settings/presentation.test.ts src/screens/SettingsScreen.tsx
git commit -m "feat: simplify settings hierarchy"
```

## Task 4: Verify The Full Flow On Desktop And Device

**Files:**
- Modify only if a verification fix is required; otherwise no file changes are expected in this task

- [ ] **Step 1: Run the full automated test suite**

Run:

```bash
npm test
```

Expected:

- all existing and newly added Vitest suites pass

- [ ] **Step 2: Run the full typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected:

- exit code `0`

- [ ] **Step 3: Run a production-style Expo export for both mobile targets**

Run:

```bash
npx expo export --platform ios --platform android
```

Expected:

- export succeeds
- `dist` is produced without route or bundling errors

- [ ] **Step 4: Manually smoke-test the navigation flow on a device**

Verify on the connected device:

```text
1. Fresh launch shows onboarding.
2. Finishing onboarding lands on Meetings, not Settings.
3. Bottom tabs are visible on Meetings, Record, and Settings.
4. Settings -> Meetings is one tap through the bottom bar.
5. Record -> save -> Meeting detail opens above the tab shell.
6. Meeting detail exits still return the user to the tab shell.
7. Settings save flow still works after the hierarchy cleanup.
```

- [ ] **Step 5: Clean verification artifacts and confirm the worktree**

Run:

```bash
rm -rf dist
git status --short
```

Expected:

- no generated `dist` directory remains
- only intentional source changes are left in the worktree
