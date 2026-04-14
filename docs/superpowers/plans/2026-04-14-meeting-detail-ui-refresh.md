# Meeting Detail UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the meeting detail screen so it uses one clean native back affordance, puts rename inline in the title card, reduces the oversized action wall, and prioritizes summary content over raw recording info.

**Architecture:** Keep behavior and services intact, but introduce a tiny `detailPresentation` helper in `src/features/meetings` so the UI decisions are testable outside the route file. Then update `app/meetings/[id].tsx` to use that helper for inline rename affordance, compact CTA layout, content ordering, and native-header fallback behavior through route-local `Stack.Screen` options.

**Tech Stack:** Expo Router, React Native, TypeScript, Vitest, Expo Vector Icons

---

## File Structure

- Create: `src/features/meetings/detailPresentation.ts`
- Create: `src/features/meetings/detailPresentation.test.ts`
- Modify: `src/features/meetings/navigation.ts`
- Modify: `src/features/meetings/navigation.test.ts`
- Modify: `app/meetings/[id].tsx`

## Task 1: Add A Tested Detail Presentation Helper

**Files:**
- Create: `src/features/meetings/detailPresentation.ts`
- Test: `src/features/meetings/detailPresentation.test.ts`

- [ ] **Step 1: Write the failing presentation tests**

Create `src/features/meetings/detailPresentation.test.ts`:

```ts
import { describe, expect, test } from 'vitest';

import {
  MEETING_DETAIL_SECTION_ORDER,
  getMeetingDetailPrimaryActionLabel,
  getMeetingDetailTitleDraftState,
  getPlaybackActionLabel,
} from './detailPresentation';

describe('meeting detail presentation', () => {
  test('shows the inline title save affordance only when the draft changed', () => {
    expect(getMeetingDetailTitleDraftState('Demo 1', 'Demo 1')).toEqual({
      showSave: false,
      isDisabled: true,
    });

    expect(getMeetingDetailTitleDraftState('  Demo 2  ', 'Demo 1')).toEqual({
      showSave: true,
      isDisabled: false,
    });

    expect(getMeetingDetailTitleDraftState('   ', 'Demo 1')).toEqual({
      showSave: true,
      isDisabled: true,
    });
  });

  test('keeps the meeting output sections in summary-first order', () => {
    expect(MEETING_DETAIL_SECTION_ORDER).toEqual([
      'summary',
      'actionItems',
      'decisions',
      'transcript',
      'recording',
    ]);
  });

  test('builds compact action labels for playback and processing', () => {
    expect(getMeetingDetailPrimaryActionLabel(false)).toBe('Run transcript + summary');
    expect(getMeetingDetailPrimaryActionLabel(true)).toBe('Processing…');
    expect(getPlaybackActionLabel(false)).toBe('Play recording');
    expect(getPlaybackActionLabel(true)).toBe('Pause recording');
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npx vitest run src/features/meetings/detailPresentation.test.ts
```

Expected:

- fail because `src/features/meetings/detailPresentation.ts` does not exist yet

- [ ] **Step 3: Add the minimal presentation helper**

Create `src/features/meetings/detailPresentation.ts`:

```ts
export const MEETING_DETAIL_SECTION_ORDER = [
  'summary',
  'actionItems',
  'decisions',
  'transcript',
  'recording',
] as const;

export function getMeetingDetailTitleDraftState(draftTitle: string, savedTitle: string) {
  const trimmedDraft = draftTitle.trim();
  const hasChanged = trimmedDraft !== savedTitle.trim();

  return {
    showSave: hasChanged,
    isDisabled: !trimmedDraft.length,
  };
}

export function getMeetingDetailPrimaryActionLabel(isBusy: boolean) {
  return isBusy ? 'Processing…' : 'Run transcript + summary';
}

export function getPlaybackActionLabel(isPlaying: boolean) {
  return isPlaying ? 'Pause recording' : 'Play recording';
}
```

- [ ] **Step 4: Re-run the focused presentation test**

Run:

```bash
npx vitest run src/features/meetings/detailPresentation.test.ts
```

Expected:

- all tests pass

- [ ] **Step 5: Commit the presentation helper**

Run:

```bash
git add src/features/meetings/detailPresentation.ts src/features/meetings/detailPresentation.test.ts
git commit -m "feat: add meeting detail presentation helper"
```

## Task 2: Rebuild The Detail Screen Layout Around The New Hierarchy

**Files:**
- Modify: `app/meetings/[id].tsx`

- [ ] **Step 1: Re-run the focused helper tests before rewriting the screen**

Run:

```bash
npx vitest run src/features/meetings/detailPresentation.test.ts src/features/meetings/navigation.test.ts
```

Expected:

- pass, confirming the helper contract is ready to drive the screen rewrite

- [ ] **Step 2: Replace the in-screen back pill and action wall with the new detail layout**

Update `app/meetings/[id].tsx` imports:

```tsx
import {
  getMeetingDetailPrimaryActionLabel,
  getMeetingDetailTitleDraftState,
  getPlaybackActionLabel,
} from '../../src/features/meetings/detailPresentation';
```

Create the inline title-save state:

```tsx
  const titleDraftState = getMeetingDetailTitleDraftState(draftTitle, meeting.title);
```

Delete the in-body back row entirely:

```tsx
        <FadeInView style={styles.backRow}>
          <Pressable style={styles.backButton} onPress={handleBackPress}>
            <Feather name="arrow-left" size={16} color={palette.ink} />
            <Text style={styles.backButtonText}>{backAction.label}</Text>
          </Pressable>
        </FadeInView>
```

Replace the top card with inline rename affordance, compact meta, and the optional offline badge:

```tsx
        <FadeInView style={styles.headerCard}>
          <View style={styles.titleRow}>
            <TextInput
              style={styles.titleInput}
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder="Meeting title"
              placeholderTextColor={palette.mutedInk}
            />
            {titleDraftState.showSave ? (
              <Pressable
                style={[styles.inlineSaveButton, titleDraftState.isDisabled && styles.inlineSaveButtonDisabled]}
                onPress={handleRename}
                disabled={isSavingTitle || titleDraftState.isDisabled}
              >
                <Feather name={isSavingTitle ? 'loader' : 'check'} size={16} color={palette.card} />
                <Text style={styles.inlineSaveButtonText}>{isSavingTitle ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.meta}>
            {formatTimestamp(meeting.createdAt)}
            {meeting.durationMs ? ` • ${formatDuration(meeting.durationMs)}` : ''}
          </Text>

          <View style={styles.statusWrap}>
            <View style={styles.statusRow}>
              <StatusIcon status={meeting.status} />
              <Text style={styles.status}>Status: {meeting.status.replace('_', ' ')}</Text>
            </View>
            {runsOffline ? (
              <View style={styles.inlineOfflineBadge}>
                <Feather name="smartphone" size={14} color={palette.ink} />
                <Text style={styles.inlineOfflineBadgeText}>Runs fully offline</Text>
              </View>
            ) : null}
          </View>

          {meeting.errorMessage ? <Text style={styles.errorText}>{meeting.errorMessage}</Text> : null}
        </FadeInView>
```

Replace the current two action rows with one primary CTA and one compact secondary row:

```tsx
        <FadeInView style={styles.primaryActionWrap} delay={60}>
          <Pressable style={styles.primaryButton} onPress={handleProcess} disabled={isBusy}>
            <MaterialCommunityIcons name="text-box-search-outline" size={18} color={palette.paper} />
            <Text style={styles.primaryButtonText}>{getMeetingDetailPrimaryActionLabel(isBusy)}</Text>
          </Pressable>
        </FadeInView>

        <FadeInView style={styles.secondaryActions} delay={90}>
          <Pressable style={styles.secondaryButton} onPress={handlePlaybackToggle}>
            <Feather
              name={playerStatus.playing ? 'pause-circle' : 'play-circle'}
              size={17}
              color={palette.ink}
            />
            <Text style={styles.secondaryButtonText}>{getPlaybackActionLabel(playerStatus.playing)}</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={handleShare}>
            <Feather name="share-2" size={17} color={palette.ink} />
            <Text style={styles.secondaryButtonText}>Share</Text>
          </Pressable>
        </FadeInView>
```

Reorder the sections:

```tsx
        <Section title="Summary" delay={120}>
          <Text style={styles.bodyText}>{summary?.summary || 'No summary yet.'}</Text>
        </Section>

        <Section title="Action items" delay={150}>
          {summary?.actionItems?.length ? (
            summary.actionItems.map((item) => (
              <Text key={item} style={styles.listText}>
                • {item}
              </Text>
            ))
          ) : (
            <Text style={styles.bodyText}>No action items yet.</Text>
          )}
        </Section>

        <Section title="Decisions" delay={180}>
          {summary?.decisions?.length ? (
            summary.decisions.map((item) => (
              <Text key={item} style={styles.listText}>
                • {item}
              </Text>
            ))
          ) : (
            <Text style={styles.bodyText}>No decisions extracted yet.</Text>
          )}
        </Section>

        <Section title="Transcript" delay={210}>
          <Text style={styles.transcriptText}>{meeting.transcriptText || 'No transcript yet.'}</Text>
        </Section>

        <Section title="Recording" delay={240}>
          <Text style={styles.bodyText}>
            {playerStatus.playing ? 'Playing now.' : 'Ready to play.'}
            {playerStatus.duration ? ` Total length: ${formatDuration(playerStatus.duration * 1000)}` : ''}
          </Text>
          <Text style={styles.bodyText}>
            Current position: {formatDuration(playerStatus.currentTime * 1000)}
          </Text>
        </Section>
```

Add a separated delete row at the bottom:

```tsx
        <FadeInView style={styles.dangerZone} delay={270}>
          <Pressable style={styles.dangerButton} onPress={handleDelete} disabled={isDeleting}>
            <Feather name="trash-2" size={16} color={palette.danger} />
            <Text style={styles.dangerButtonText}>{isDeleting ? 'Deleting…' : 'Delete recording'}</Text>
          </Pressable>
        </FadeInView>
```

Update the related styles to support:

```tsx
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  inlineSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: palette.ink,
  },
  inlineSaveButtonDisabled: {
    opacity: 0.45,
  },
  inlineSaveButtonText: {
    color: palette.card,
    fontWeight: '700',
    fontSize: 13,
  },
  statusWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
  },
  inlineOfflineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
  },
  inlineOfflineBadgeText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '600',
  },
  primaryActionWrap: {
    width: '100%',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  dangerZone: {
    paddingTop: 4,
  },
```

Remove obsolete styles:

```tsx
  backRow
  backButton
  backButtonText
  offlineNotice
  offlineNoticeText
```

- [ ] **Step 3: Remove the now-unused in-screen back logic**

Delete from `app/meetings/[id].tsx`:

```tsx
  const backAction = getMeetingDetailBackAction(router.canGoBack());

  const handleBackPress = () => {
    if (backAction.kind === 'history') {
      router.back();
      return;
    }

    router.replace(backAction.href);
  };
```

And remove this import:

```tsx
import { getMeetingDetailBackAction } from '../../src/features/meetings/navigation';
```

Keep the existing fallback buttons for missing or deleted meetings unchanged.

- [ ] **Step 4: Run typecheck and the focused tests**

Run:

```bash
npx vitest run src/features/meetings/detailPresentation.test.ts src/features/meetings/navigation.test.ts
npx tsc --noEmit
```

Expected:

- presentation tests pass
- navigation tests still pass
- TypeScript passes with the new screen layout

- [ ] **Step 5: Commit the detail layout refresh**

Run:

```bash
git add app/meetings/[id].tsx
git add src/features/meetings/detailPresentation.ts src/features/meetings/detailPresentation.test.ts
git commit -m "feat: refresh meeting detail ui"
```

## Task 3: Clean The Native Header Back Label

**Files:**
- Modify: `src/features/meetings/navigation.ts`
- Modify: `src/features/meetings/navigation.test.ts`
- Modify: `app/meetings/[id].tsx`

- [ ] **Step 1: Write the failing route header expectation**

Update `src/features/meetings/navigation.test.ts` with:

```ts
import { getMeetingDetailHeaderPresentation } from './navigation';

  test('uses a minimal native back button for meeting detail', () => {
    expect(getMeetingDetailHeaderPresentation(true)).toEqual({
      title: 'Meeting',
      headerBackButtonDisplayMode: 'minimal',
      showTabsFallback: false,
      fallbackLabel: 'Meetings',
    });

    expect(getMeetingDetailHeaderPresentation(false)).toEqual({
      title: 'Meeting',
      headerBackButtonDisplayMode: 'minimal',
      showTabsFallback: true,
      fallbackLabel: 'Meetings',
    });
  });
```

- [ ] **Step 2: Run the focused navigation test to verify it fails**

Run:

```bash
npx vitest run src/features/meetings/navigation.test.ts
```

Expected:

- fail because `getMeetingDetailHeaderPresentation` does not exist yet

- [ ] **Step 3: Add the header presentation helper and apply it inside the detail route**

Update `src/features/meetings/navigation.ts`:

```ts
export function getMeetingDetailHeaderPresentation(canReturnToPreviousScreen: boolean) {
  return {
    title: 'Meeting' as const,
    headerBackButtonDisplayMode: 'minimal' as const,
    showTabsFallback: !canReturnToPreviousScreen,
    fallbackLabel: 'Meetings' as const,
  };
}
```

Update `app/meetings/[id].tsx` imports:

```tsx
import { Stack, useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { getMeetingDetailHeaderPresentation } from '../../src/features/meetings/navigation';
```

Create the header presentation state:

```tsx
  const headerPresentation = getMeetingDetailHeaderPresentation(router.canGoBack());
```

Render the header config inside the screen so it can switch between native back and tab fallback:

```tsx
      <Stack.Screen
        options={{
          title: headerPresentation.title,
          headerBackButtonDisplayMode: headerPresentation.headerBackButtonDisplayMode,
          headerBackVisible: !headerPresentation.showTabsFallback,
          headerLeft: headerPresentation.showTabsFallback
            ? () => (
                <Pressable style={styles.headerFallbackButton} onPress={() => router.replace(APP_TABS_ROUTE)}>
                  <Feather name="chevron-left" size={18} color={palette.ink} />
                  <Text style={styles.headerFallbackText}>{headerPresentation.fallbackLabel}</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
```

Add the matching styles:

```tsx
  headerFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  headerFallbackText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '600',
  },
```

- [ ] **Step 4: Re-run the focused navigation test and full typecheck**

Run:

```bash
npx vitest run src/features/meetings/navigation.test.ts
npx tsc --noEmit
```

Expected:

- navigation tests pass
- TypeScript passes

- [ ] **Step 5: Commit the header cleanup**

Run:

```bash
git add src/features/meetings/navigation.ts src/features/meetings/navigation.test.ts "app/meetings/[id].tsx"
git commit -m "fix: simplify meeting detail header"
```

## Task 4: Verify The Full Flow

**Files:**
- No source changes expected unless verification reveals a bug

- [ ] **Step 1: Run the full automated test suite**

Run:

```bash
npm test
```

Expected:

- all Vitest suites pass

- [ ] **Step 2: Run the full typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected:

- exit code `0`

- [ ] **Step 3: Smoke-test on device**

Verify:

```text
1. Open a meeting from the Meetings tab.
2. The screen shows only the native back affordance.
3. The native back label no longer shows .(tabs).
4. Edit the title and confirm Save only appears after a change.
5. Save the title and confirm the update persists.
6. The screen shows one primary processing CTA.
7. Play and Share appear as compact secondary actions.
8. Delete recording is separated at the bottom.
9. Summary appears before Recording.
```

- [ ] **Step 4: Confirm worktree state**

Run:

```bash
git status --short
```

Expected:

- only intentional source changes are present
