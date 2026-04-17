# Dashboard Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the Meetings dashboard with a compact technical header, a small cloud-status utility card, and denser tappable meeting rows.

**Architecture:** Keep the work centered on `src/screens/MeetingsScreen.tsx`, but move any shortened copy logic into `src/features/dashboard/presentation.ts` so layout and wording stay separated. Reuse existing button/card/chip primitives where they still fit, and replace the oversized `EditorialHero` usage with a more custom compact header directly in the screen.

**Tech Stack:** React Native, Expo Router, TypeScript, Vitest

---

## File Structure

- Modify: `src/features/dashboard/presentation.ts`
  - Add compact cloud-status copy helpers and, if needed, compact header copy helpers.
- Create: `src/features/dashboard/presentation.test.ts`
  - Lock in the new compact copy behavior and signed-in/signed-out states.
- Modify: `src/screens/MeetingsScreen.tsx`
  - Replace the verbose hero/card stack with the compact illustrated header, small cloud card, and denser meeting rows.
- Optional small modify: `src/components/ui/SectionHeading.tsx`
  - Only if a small prop or spacing fix is needed to match the denser list. Avoid this unless truly necessary.

### Task 1: Add Compact Dashboard Copy Helpers

**Files:**
- Modify: `src/features/dashboard/presentation.ts`
- Create: `src/features/dashboard/presentation.test.ts`

- [ ] **Step 1: Write the failing presentation tests**

```ts
import { describe, expect, test } from 'vitest';

import {
  getDashboardCloudStatusCopy,
  getDashboardEmptyStateCopy,
} from './presentation';

describe('dashboard presentation', () => {
  test('returns compact signed-out cloud copy', () => {
    expect(getDashboardCloudStatusCopy(null)).toEqual({
      title: 'Cloud not connected',
      actionLabel: 'Set up account',
    });
  });

  test('returns compact signed-in cloud copy without long explanation text', () => {
    expect(
      getDashboardCloudStatusCopy({
        user: {
          driveConnection: { status: 'connected' },
        },
      } as never)
    ).toEqual({
      title: 'Cloud connected',
      actionLabel: 'Open profile',
    });
  });

  test('keeps the empty state concise', () => {
    expect(getDashboardEmptyStateCopy()).toEqual({
      title: 'No meetings yet',
      body: 'Start a recording or import audio to begin.',
    });
  });
});
```

- [ ] **Step 2: Run the presentation test to verify it fails**

Run: `npm test -- src/features/dashboard/presentation.test.ts`
Expected: FAIL because `getDashboardCloudStatusCopy` does not exist and the empty-state copy is still longer.

- [ ] **Step 3: Implement the minimal compact copy helpers**

```ts
// src/features/dashboard/presentation.ts
import type { AuthSession, MeetingRow } from '../../types';
import type { StatusChipTone } from '../../components/ui';

export function getMeetingStatusMeta(status: MeetingRow['status']): {
  label: string;
  tone: StatusChipTone;
} {
  switch (status) {
    case 'ready':
      return { label: 'Ready', tone: 'secondary' };
    case 'failed':
      return { label: 'Error', tone: 'danger' };
    case 'transcribing_local':
      return { label: 'Local transcript', tone: 'tertiary' };
    case 'summarizing_local':
      return { label: 'Local summary', tone: 'tertiary' };
    case 'transcribing':
      return { label: 'Transcribing', tone: 'secondary' };
    case 'summarizing':
      return { label: 'Summarizing', tone: 'secondary' };
    default:
      return { label: 'Local only', tone: 'tertiary' };
  }
}

export function getDashboardEmptyStateCopy() {
  return {
    title: 'No meetings yet',
    body: 'Start a recording or import audio to begin.',
  };
}

export function getDashboardCloudStatusCopy(session: AuthSession | null) {
  return session?.user.driveConnection.status === 'connected'
    ? { title: 'Cloud connected', actionLabel: 'Open profile' }
    : { title: 'Cloud not connected', actionLabel: 'Set up account' };
}
```

- [ ] **Step 4: Run the presentation test to verify it passes**

Run: `npm test -- src/features/dashboard/presentation.test.ts`
Expected: PASS with 3 passing tests.

- [ ] **Step 5: Commit the copy helper layer**

```bash
git add src/features/dashboard/presentation.ts src/features/dashboard/presentation.test.ts
git commit -m "feat: add compact dashboard copy helpers"
```

### Task 2: Replace The Verbose Hero With A Compact Technical Header

**Files:**
- Modify: `src/screens/MeetingsScreen.tsx`
- Test: `src/features/dashboard/presentation.test.ts`

- [ ] **Step 1: Add a failing presentation test if compact header copy needs a helper**

```ts
test('keeps the dashboard subtitle short', () => {
  const subtitle = 'Capture meetings and process them when you are ready.';
  expect(subtitle.length).toBeLessThan(60);
});
```

- [ ] **Step 2: Run the presentation test suite**

Run: `npm test -- src/features/dashboard/presentation.test.ts`
Expected: PASS or FAIL only if the subtitle helper/copy needs adjustment before the screen work.

- [ ] **Step 3: Replace the `EditorialHero` block with a compact custom header**

```tsx
// src/screens/MeetingsScreen.tsx
import {
  getDashboardCloudStatusCopy,
  getDashboardEmptyStateCopy,
  getMeetingStatusMeta,
} from '../features/dashboard/presentation';
```

```tsx
const cloudStatus = getDashboardCloudStatusCopy(session);
```

```tsx
<FadeInView>
  <SurfaceCard muted style={styles.heroCard}>
    <View style={styles.heroTopRow}>
      <View style={styles.heroCopy}>
        <Text style={styles.heroTitle}>Meetings</Text>
        <Text style={styles.heroSubtitle}>
          Capture meetings and process them when you are ready.
        </Text>
      </View>
      <View style={styles.heroIllustration} pointerEvents="none">
        <View style={styles.heroNodePrimary} />
        <View style={styles.heroNodeSecondary} />
        <View style={styles.heroLineHorizontal} />
        <View style={styles.heroLineVertical} />
        <View style={styles.heroWaveA} />
        <View style={styles.heroWaveB} />
      </View>
    </View>
  </SurfaceCard>
</FadeInView>
```

- [ ] **Step 4: Keep the primary actions directly under the compact header**

```tsx
<FadeInView style={styles.primaryActions} delay={40}>
  <PillButton
    label="New recording"
    icon={<MaterialCommunityIcons name="microphone-outline" size={18} color={palette.card} />}
    onPress={() => router.push(RECORD_TAB_ROUTE)}
  />
  <PillButton
    label={importButtonLabel}
    icon={<Feather name="upload" size={18} color={palette.ink} />}
    onPress={handleImport}
    variant="secondary"
    disabled={isImporting}
  />
</FadeInView>
```

- [ ] **Step 5: Replace the large cloud card with the compact utility card**

```tsx
<FadeInView delay={70}>
  <SurfaceCard muted style={styles.cloudCard}>
    <View style={styles.cloudRow}>
      <View style={styles.cloudCopy}>
        <Text style={styles.cloudEyebrow}>Cloud</Text>
        <Text style={styles.cloudTitle}>{cloudStatus.title}</Text>
      </View>
      <PillButton
        label={cloudStatus.actionLabel}
        onPress={() => router.push('/account')}
        variant="ghost"
      />
    </View>
  </SurfaceCard>
</FadeInView>
```

- [ ] **Step 6: Add the compact header and cloud-card styles**

```ts
heroCard: {
  gap: 12,
  paddingVertical: 16,
},
heroTopRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
},
heroCopy: {
  flex: 1,
  gap: 6,
},
heroTitle: {
  color: palette.ink,
  fontFamily: typography.display.fontFamily,
  fontSize: 26,
},
heroSubtitle: {
  color: palette.mutedInk,
  fontFamily: typography.body.fontFamily,
  fontSize: 14,
  lineHeight: 20,
  maxWidth: 260,
},
heroIllustration: {
  width: 92,
  height: 72,
  borderRadius: 20,
  backgroundColor: palette.paper,
  borderWidth: 1,
  borderColor: palette.lineSoft,
  position: 'relative',
  overflow: 'hidden',
},
heroNodePrimary: {
  position: 'absolute',
  top: 16,
  left: 14,
  width: 10,
  height: 10,
  borderRadius: 999,
  backgroundColor: palette.accent,
},
heroNodeSecondary: {
  position: 'absolute',
  right: 16,
  bottom: 14,
  width: 8,
  height: 8,
  borderRadius: 999,
  backgroundColor: palette.accentStrong,
},
heroLineHorizontal: {
  position: 'absolute',
  top: 20,
  left: 24,
  right: 18,
  height: 1,
  backgroundColor: palette.line,
},
heroLineVertical: {
  position: 'absolute',
  top: 20,
  bottom: 18,
  right: 20,
  width: 1,
  backgroundColor: palette.lineSoft,
},
heroWaveA: {
  position: 'absolute',
  left: 14,
  right: 28,
  bottom: 24,
  height: 12,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: palette.accentSoft,
},
heroWaveB: {
  position: 'absolute',
  left: 26,
  right: 14,
  bottom: 14,
  height: 10,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: palette.accent,
},
cloudCard: {
  paddingVertical: 14,
},
cloudRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
},
cloudCopy: {
  flex: 1,
  gap: 2,
},
cloudEyebrow: {
  color: palette.accent,
  fontFamily: typography.label.fontFamily,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 1,
},
cloudTitle: {
  color: palette.ink,
  fontFamily: typography.heading.fontFamily,
  fontSize: 15,
},
```

- [ ] **Step 7: Run the focused tests and type-check**

Run: `npm test -- src/features/dashboard/presentation.test.ts && npx tsc --noEmit`
Expected: PASS with no type errors from the new compact header layout.

- [ ] **Step 8: Commit the dashboard header cleanup**

```bash
git add src/screens/MeetingsScreen.tsx src/features/dashboard/presentation.test.ts
git commit -m "feat: simplify dashboard header and cloud card"
```

### Task 3: Densify Meeting Rows And Empty State

**Files:**
- Modify: `src/screens/MeetingsScreen.tsx`
- Modify: `src/features/dashboard/presentation.ts`
- Test: `src/features/dashboard/presentation.test.ts`

- [ ] **Step 1: Add a failing empty-state test for the shorter body copy**

```ts
test('uses the compact empty-state body', () => {
  expect(getDashboardEmptyStateCopy().body).toBe('Start a recording or import audio to begin.');
});
```

- [ ] **Step 2: Run the dashboard presentation test suite**

Run: `npm test -- src/features/dashboard/presentation.test.ts`
Expected: PASS if Task 1 already locked this in; otherwise FAIL until aligned.

- [ ] **Step 3: Remove the inline `Open meeting` button and make rows denser**

```tsx
<Pressable onPress={() => router.push(getMeetingDetailRoute(item.id))}>
  <SurfaceCard style={styles.meetingCard}>
    <View style={styles.meetingHeader}>
      <Text numberOfLines={1} style={styles.meetingTitle}>
        {item.title}
      </Text>
      <StatusChip label={statusMeta.label} tone={statusMeta.tone} />
    </View>
    <Text style={styles.meetingMeta}>
      {formatTimestamp(item.createdAt)}
      {item.durationMs ? ` • ${formatDuration(item.durationMs)}` : ''}
    </Text>
    <Text style={styles.meetingSnippet} numberOfLines={1}>
      {item.summaryShort || item.transcriptText?.slice(0, 88) || 'Open this meeting to process it.'}
    </Text>
  </SurfaceCard>
</Pressable>
```

- [ ] **Step 4: Tighten row spacing and reduce visual height**

```ts
listContent: {
  paddingBottom: 28,
  gap: 12,
},
headerContent: {
  gap: 12,
  paddingBottom: 6,
},
meetingCard: {
  gap: 8,
  paddingVertical: 14,
},
meetingTitle: {
  flex: 1,
  color: palette.ink,
  fontFamily: typography.heading.fontFamily,
  fontSize: 16,
},
meetingMeta: {
  color: palette.mutedInk,
  fontFamily: typography.body.fontFamily,
  fontSize: 12,
},
meetingSnippet: {
  color: palette.ink,
  fontFamily: typography.body.fontFamily,
  fontSize: 13,
  lineHeight: 18,
},
```

- [ ] **Step 5: Keep the empty state aligned with the denser screen**

```tsx
<SurfaceCard muted style={styles.emptyState}>
  <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
  <Text style={styles.emptyBody}>{emptyCopy.body}</Text>
  <View style={styles.emptyActions}>
    <PillButton label="New recording" onPress={() => router.push(RECORD_TAB_ROUTE)} />
    <PillButton
      label={importButtonLabel}
      onPress={handleImport}
      variant="secondary"
      disabled={isImporting}
    />
  </View>
</SurfaceCard>
```

```ts
emptyState: {
  alignItems: 'center',
  gap: 8,
  paddingVertical: 24,
},
emptyBody: {
  color: palette.mutedInk,
  fontFamily: typography.body.fontFamily,
  fontSize: 14,
  lineHeight: 20,
  textAlign: 'center',
  maxWidth: 300,
},
```

- [ ] **Step 6: Run the full verification**

Run: `npm test && npx tsc --noEmit`
Expected: PASS across the full suite and TypeScript compile.

- [ ] **Step 7: Perform manual app verification**

Run these checks in the app:
- Open the Meetings tab and confirm the top header is visibly shorter than before.
- Confirm the cloud card shows only one-line status plus one quick action.
- Confirm the meeting rows no longer show `Open meeting` buttons and the full row still opens the detail screen.
- Confirm more meetings fit on screen than before.
- Confirm the empty state still shows both primary actions and shorter copy.

Expected: The dashboard reads as more technical and compact without losing navigation clarity.

- [ ] **Step 8: Commit the denser dashboard list**

```bash
git add src/screens/MeetingsScreen.tsx src/features/dashboard/presentation.ts src/features/dashboard/presentation.test.ts
git commit -m "feat: densify dashboard meeting list"
```
