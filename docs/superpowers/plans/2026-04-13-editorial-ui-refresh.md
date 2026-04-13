# Editorial UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the dashboard, settings, and onboarding screens so they share the approved editorial design system without changing product behavior.

**Architecture:** Keep the existing Expo Router app structure, but add a small shared UI layer, a semantic theme foundation, and a few tested presentation helpers so the screen rewrites stay focused and maintainable. Visual logic that can be tested moves into small pure modules; screen layout stays inside the existing route files unless a split materially reduces complexity.

**Tech Stack:** Expo Router, React Native, Vitest, TypeScript, `expo-font`, `@expo-google-fonts/inter`, `@expo-google-fonts/manrope`

---

## File Structure

### Create

- `src/theme.test.ts`
  - Verifies the semantic editorial theme contract that the refreshed screens depend on.
- `src/components/ui/EditorialHero.tsx`
  - Shared hero block for dashboard and settings top sections.
- `src/components/ui/PillButton.tsx`
  - Shared primary, secondary, and ghost pill action button.
- `src/components/ui/SectionHeading.tsx`
  - Shared section title/subtitle row with optional action.
- `src/components/ui/StatusChip.tsx`
  - Shared tonal chip for status and capability labels.
- `src/components/ui/SurfaceCard.tsx`
  - Shared white or muted surface wrapper used across the three screens.
- `src/components/ui/index.ts`
  - Barrel export for the shared UI primitives.
- `src/features/dashboard/presentation.ts`
  - Pure helper functions for meeting status labels, chip tones, and empty-state copy.
- `src/features/dashboard/presentation.test.ts`
  - Tests for dashboard presentation helpers.
- `src/features/settings/presentation.ts`
  - Pure helper functions for configured provider lists, summary labels, and local model display text.
- `src/features/settings/presentation.test.ts`
  - Tests for settings presentation helpers.
- `src/features/onboarding/presentation.ts`
  - Pure helper functions for onboarding progress and feature-card metadata keyed by slide id.
- `src/features/onboarding/presentation.test.ts`
  - Tests for onboarding presentation helpers.

### Modify

- `package.json`
  - Add font dependencies required by the approved typography system.
- `package-lock.json`
  - Lock the font dependency install.
- `app/_layout.tsx`
  - Load fonts and apply the updated navigation typography + colors.
- `src/theme.ts`
  - Replace the warm palette with semantic editorial tokens and typography helpers.
- `src/components/ScreenBackground.tsx`
  - Update ambient background color treatment to match the new system.
- `app/index.tsx`
  - Rewrite the dashboard into the approved four-section layout using the new shared primitives.
- `app/settings.tsx`
  - Reorganize settings into summary, task assignment, provider configuration, local models, and advanced controls.
- `app/onboarding.tsx`
  - Redesign onboarding presentation around the approved stacked editorial layout and premium progress treatment.

## Task 1: Build the Editorial Theme Foundation

**Files:**
- Create: `src/theme.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/theme.ts`
- Modify: `src/components/ScreenBackground.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Write the failing theme contract test**

```ts
import { describe, expect, test } from 'vitest';

import { palette, radii, typography } from './theme';

describe('editorial theme contract', () => {
  test('exposes the approved cool-tone palette', () => {
    expect(palette.paper).toBe('#f7fafc');
    expect(palette.card).toBe('#ffffff');
    expect(palette.cardMuted).toBe('#eff4f7');
    expect(palette.cardUtility).toBe('#e8eff2');
    expect(palette.ink).toBe('#2b3437');
    expect(palette.mutedInk).toBe('#576064');
    expect(palette.accent).toBe('#0f57d0');
    expect(palette.accentStrong).toBe('#4e83fe');
    expect(palette.accentSoft).toBe('#d8e3fa');
    expect(palette.tertiary).toBe('#685781');
    expect(palette.tertiarySoft).toBe('#e4ceff');
    expect(palette.line).toBe('#aab3b7');
  });

  test('exposes semantic radius + typography tokens', () => {
    expect(radii.card).toBe(24);
    expect(radii.pill).toBe(999);
    expect(typography.display.fontFamily).toBe('Manrope_800ExtraBold');
    expect(typography.heading.fontFamily).toBe('Manrope_700Bold');
    expect(typography.body.fontFamily).toBe('Inter_400Regular');
    expect(typography.label.fontFamily).toBe('Inter_600SemiBold');
  });
});
```

- [ ] **Step 2: Run the theme test and confirm it fails**

Run: `npx vitest run src/theme.test.ts`

Expected: FAIL because `src/theme.ts` does not yet export `cardMuted`, `cardUtility`, `accentStrong`, `typography`, or `radii.card`.

- [ ] **Step 3: Install the font dependencies**

Run: `npx expo install expo-font @expo-google-fonts/inter @expo-google-fonts/manrope`

Expected: PASS with updated `package.json` and `package-lock.json`.

- [ ] **Step 4: Replace the theme tokens in `src/theme.ts`**

```ts
export const palette = {
  paper: '#f7fafc',
  card: '#ffffff',
  cardMuted: '#eff4f7',
  cardUtility: '#e8eff2',
  ink: '#2b3437',
  mutedInk: '#576064',
  accent: '#0f57d0',
  accentStrong: '#4e83fe',
  accentSoft: '#d8e3fa',
  tertiary: '#685781',
  tertiarySoft: '#e4ceff',
  line: '#aab3b7',
  lineSoft: 'rgba(170, 179, 183, 0.15)',
  danger: '#a83836',
  dangerSoft: '#fde7e6',
  shadow: 'rgba(43, 52, 55, 0.08)',
};

export const radii = {
  md: 12,
  lg: 18,
  xl: 24,
  card: 24,
  pill: 999,
};

export const typography = {
  display: { fontFamily: 'Manrope_800ExtraBold' as const },
  heading: { fontFamily: 'Manrope_700Bold' as const },
  body: { fontFamily: 'Inter_400Regular' as const },
  bodyStrong: { fontFamily: 'Inter_500Medium' as const },
  label: { fontFamily: 'Inter_600SemiBold' as const },
};

export const elevation = {
  card: {
    shadowColor: '#2b3437',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 2,
  },
};
```

- [ ] **Step 5: Update the root layout to load fonts and use the new navigation styling**

```tsx
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';

import { palette, typography } from '../src/theme';

const [fontsLoaded] = useFonts({
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
});

if (!isReady || !fontsLoaded) {
  return (
    <View style={styles.centered}>
      <StatusBar style="dark" />
      <ActivityIndicator size="large" color={palette.accent} />
      <Text style={styles.body}>Preparing local storage…</Text>
    </View>
  );
}

<Stack
  screenOptions={{
    headerStyle: { backgroundColor: palette.paper },
    headerTintColor: palette.ink,
    headerTitleStyle: {
      color: palette.ink,
      fontFamily: typography.heading.fontFamily,
      fontSize: 18,
    },
    contentStyle: { backgroundColor: palette.paper },
  }}
>
```

- [ ] **Step 6: Refresh the ambient background colors**

```tsx
const styles = StyleSheet.create({
  topBlob: {
    position: 'absolute',
    top: -90,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(78, 131, 254, 0.10)',
  },
  sideBlob: {
    position: 'absolute',
    top: 200,
    left: -60,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: 'rgba(104, 87, 129, 0.08)',
  },
  bottomBlob: {
    position: 'absolute',
    bottom: -40,
    right: 20,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 87, 208, 0.05)',
  },
});
```

- [ ] **Step 7: Run the targeted checks**

Run: `npx vitest run src/theme.test.ts`

Expected: PASS

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 8: Commit the theme foundation**

```bash
git add package.json package-lock.json app/_layout.tsx src/theme.ts src/theme.test.ts src/components/ScreenBackground.tsx
git commit -m "feat: add editorial theme foundation"
```

## Task 2: Add Shared UI Primitives and Refresh the Dashboard

**Files:**
- Create: `src/components/ui/EditorialHero.tsx`
- Create: `src/components/ui/PillButton.tsx`
- Create: `src/components/ui/SectionHeading.tsx`
- Create: `src/components/ui/StatusChip.tsx`
- Create: `src/components/ui/SurfaceCard.tsx`
- Create: `src/components/ui/index.ts`
- Create: `src/features/dashboard/presentation.ts`
- Create: `src/features/dashboard/presentation.test.ts`
- Modify: `app/index.tsx`

- [ ] **Step 1: Write the failing dashboard presentation test**

```ts
import { describe, expect, test } from 'vitest';

import { getMeetingStatusMeta, getDashboardEmptyStateCopy } from './presentation';

describe('dashboard presentation', () => {
  test('maps meeting status to readable labels and tones', () => {
    expect(getMeetingStatusMeta('ready')).toEqual({ label: 'Ready', tone: 'secondary' });
    expect(getMeetingStatusMeta('failed')).toEqual({ label: 'Error', tone: 'danger' });
    expect(getMeetingStatusMeta('transcribing')).toEqual({ label: 'Transcribing', tone: 'secondary' });
    expect(getMeetingStatusMeta('transcribing_local')).toEqual({
      label: 'Local transcript',
      tone: 'tertiary',
    });
    expect(getMeetingStatusMeta('summarizing_local')).toEqual({
      label: 'Local summary',
      tone: 'tertiary',
    });
  });

  test('returns concise empty-state copy', () => {
    expect(getDashboardEmptyStateCopy()).toEqual({
      title: 'No meetings yet',
      body: 'Start with a recording or import an existing audio file to process it later.',
    });
  });
});
```

- [ ] **Step 2: Run the dashboard test and confirm it fails**

Run: `npx vitest run src/features/dashboard/presentation.test.ts`

Expected: FAIL because `src/features/dashboard/presentation.ts` does not exist yet.

- [ ] **Step 3: Add the dashboard presentation helper**

```ts
import type { MeetingRow } from '../../types';

type ChipTone = 'secondary' | 'tertiary' | 'danger';

export function getMeetingStatusMeta(status: MeetingRow['status']): {
  label: string;
  tone: ChipTone;
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
    body: 'Start with a recording or import an existing audio file to process it later.',
  };
}
```

- [ ] **Step 4: Create the shared UI primitives**

```tsx
// src/components/ui/SurfaceCard.tsx
import type { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { elevation, palette, radii } from '../../theme';

export function SurfaceCard({
  children,
  style,
  muted,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  muted?: boolean;
}) {
  return <View style={[styles.base, muted && styles.muted, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: palette.card,
    borderRadius: radii.card,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.lineSoft,
    ...elevation.card,
  },
  muted: {
    backgroundColor: palette.cardMuted,
  },
});
```

```tsx
// src/components/ui/SectionHeading.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, typography } from '../../theme';

export function SectionHeading({
  title,
  subtitle,
  actionLabel,
  onActionPress,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onActionPress ? (
        <Pressable onPress={onActionPress}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 20,
  },
  subtitle: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
  },
  action: {
    color: palette.accent,
    fontFamily: typography.label.fontFamily,
    fontSize: 13,
  },
});
```

```tsx
// src/components/ui/EditorialHero.tsx
import { StyleSheet, Text, View } from 'react-native';

import { palette, radii, typography } from '../../theme';
import { StatusChip } from './StatusChip';
import { SurfaceCard } from './SurfaceCard';

export function EditorialHero({
  eyebrow,
  title,
  body,
  pillLabel,
  chips = [],
}: {
  eyebrow: string;
  title: string;
  body: string;
  pillLabel?: string;
  chips?: string[];
}) {
  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        {pillLabel ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{pillLabel}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {!!chips.length && (
        <View style={styles.chips}>
          {chips.map((chip) => (
            <StatusChip key={chip} label={chip} tone="secondary" />
          ))}
        </View>
      )}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  eyebrow: {
    color: palette.accent,
    fontFamily: typography.label.fontFamily,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: palette.cardMuted,
  },
  pillText: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 12,
  },
  title: {
    color: palette.ink,
    fontFamily: typography.display.fontFamily,
    fontSize: 30,
    lineHeight: 34,
  },
  body: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    lineHeight: 22,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
```

```tsx
// src/components/ui/StatusChip.tsx
import { StyleSheet, Text, View } from 'react-native';

import { palette, radii, typography } from '../../theme';

const tones = {
  secondary: { backgroundColor: palette.accentSoft, color: palette.ink },
  tertiary: { backgroundColor: palette.tertiarySoft, color: palette.tertiary },
  danger: { backgroundColor: palette.dangerSoft, color: palette.danger },
};

export function StatusChip({
  label,
  tone = 'secondary',
}: {
  label: string;
  tone?: keyof typeof tones;
}) {
  return (
    <View style={[styles.base, { backgroundColor: tones[tone].backgroundColor }]}>
      <Text style={[styles.label, { color: tones[tone].color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  label: {
    fontSize: 12,
    fontFamily: typography.label.fontFamily,
  },
});
```

```tsx
// src/components/ui/PillButton.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { palette, radii, typography } from '../../theme';

export function PillButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={[
          styles.label,
          variant === 'primary' && styles.primaryLabel,
          variant !== 'primary' && styles.secondaryLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primary: { backgroundColor: palette.accent },
  secondary: { backgroundColor: palette.cardMuted },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.45 },
  icon: { alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: typography.label.fontFamily, fontSize: 15 },
  primaryLabel: { color: palette.card },
  secondaryLabel: { color: palette.ink },
});
```

```ts
// src/components/ui/index.ts
export * from './EditorialHero';
export * from './PillButton';
export * from './SectionHeading';
export * from './StatusChip';
export * from './SurfaceCard';
```

- [ ] **Step 5: Rewrite the dashboard layout around the four approved sections**

```tsx
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { FadeInView } from '../src/components/FadeInView';
import { ScreenBackground } from '../src/components/ScreenBackground';
import {
  EditorialHero,
  PillButton,
  SectionHeading,
  StatusChip,
  SurfaceCard,
} from '../src/components/ui';
import {
  getDashboardEmptyStateCopy,
  getMeetingStatusMeta,
} from '../src/features/dashboard/presentation';
import { elevation, palette, radii, typography } from '../src/theme';

const emptyCopy = getDashboardEmptyStateCopy();

<FlatList
  data={meetings}
  keyExtractor={(item) => item.id}
  contentContainerStyle={styles.listContent}
  ListHeaderComponent={
    <View style={styles.headerContent}>
      <FadeInView>
        <EditorialHero
          eyebrow="Local-first meeting companion"
          title="Record it. Upload it. Process it later."
          body="No bots. No calendar magic. Just a clean path from audio to transcript and action items."
          pillLabel={`${meetings.length} saved`}
          chips={['Local-first', 'Manual capture', 'Post-call AI']}
        />
      </FadeInView>

      <FadeInView style={styles.primaryActions} delay={60}>
        <PillButton
          label="New recording"
          icon={<MaterialCommunityIcons name="microphone-outline" size={18} color={palette.card} />}
          onPress={() => router.push('/record')}
        />
        <PillButton
          label={isImporting ? 'Importing…' : 'Import audio'}
          icon={<Feather name="upload" size={18} color={palette.ink} />}
          onPress={handleImport}
          variant="secondary"
          disabled={isImporting}
        />
      </FadeInView>

      <FadeInView delay={90}>
        <SurfaceCard muted style={styles.accountCard}>
          <Text style={styles.accountEyebrow}>Cloud status</Text>
          <Text style={styles.accountTitle}>
            {session ? `Signed in as ${session.user.email}` : 'Cloud account not connected'}
          </Text>
          <Text style={styles.accountBody}>
            {session
              ? session.user.driveConnection.status === 'connected'
                ? 'Google Drive is linked for optional sync and backup.'
                : 'Finish linking Google Drive when you are ready for optional cloud storage.'
              : 'This app works locally first. Connect an account only if you want cloud storage later.'}
          </Text>
          <View style={styles.accountActions}>
            <PillButton
              label={session ? 'Manage account' : 'Set up account'}
              onPress={() => router.push('/account')}
              variant="ghost"
            />
            <PillButton label="Settings" onPress={() => router.push('/settings')} variant="ghost" />
          </View>
        </SurfaceCard>
      </FadeInView>

      <SectionHeading
        title="Recent meetings"
        subtitle={`${meetings.length} stored on this device`}
      />
    </View>
  }
  renderItem={({ item }) => {
    const statusMeta = getMeetingStatusMeta(item.status);
    return (
      <SurfaceCard style={styles.meetingCard}>
        <View style={styles.meetingHeader}>
          <Text style={styles.meetingTitle}>{item.title}</Text>
          <StatusChip label={statusMeta.label} tone={statusMeta.tone} />
        </View>
        <Text style={styles.meetingMeta}>
          {formatTimestamp(item.createdAt)}
          {item.durationMs ? ` • ${formatDuration(item.durationMs)}` : ''}
        </Text>
        <Text style={styles.meetingSnippet} numberOfLines={2}>
          {item.summaryShort || item.transcriptText?.slice(0, 120) || 'Open this meeting to process it.'}
        </Text>
        <PillButton label="Open meeting" onPress={() => router.push(`/meetings/${item.id}`)} variant="ghost" />
      </SurfaceCard>
    );
  }}
  ListEmptyComponent={
    <SurfaceCard muted style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
      <Text style={styles.emptyBody}>{emptyCopy.body}</Text>
      <View style={styles.emptyActions}>
        <PillButton label="New recording" onPress={() => router.push('/record')} />
        <PillButton label="Import audio" onPress={handleImport} variant="secondary" />
      </View>
    </SurfaceCard>
  }
/>
```

- [ ] **Step 6: Run the dashboard checks**

Run: `npx vitest run src/features/dashboard/presentation.test.ts`

Expected: PASS

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 7: Commit the dashboard refresh**

```bash
git add src/components/ui src/features/dashboard/presentation.ts src/features/dashboard/presentation.test.ts app/index.tsx
git commit -m "feat: refresh dashboard with editorial ui"
```

## Task 3: Reorganize the Settings Screen Around Provider Selection vs Provider Configuration

**Files:**
- Create: `src/features/settings/presentation.ts`
- Create: `src/features/settings/presentation.test.ts`
- Modify: `app/settings.tsx`

- [ ] **Step 1: Write the failing settings presentation test**

```ts
import { describe, expect, test } from 'vitest';

import { defaultProviderConfigs } from '../../services/providers';
import type { InstalledModelRow, ProviderConfig, ProviderId } from '../../types';
import {
  buildActiveProviderSummary,
  displayModelLabel,
  formatBytes,
  getConfiguredProviderIds,
  pickInitialProvider,
} from './presentation';

function buildProviders(): Record<ProviderId, ProviderConfig> {
  return structuredClone(defaultProviderConfigs);
}

describe('settings presentation', () => {
  test('lists configured providers by mode', () => {
    const providers = buildProviders();
    providers.openai.apiKey = 'sk-live';
    providers.openrouter.apiKey = 'sk-or-live';
    providers.local.transcriptionModel = 'whisper-base';

    expect(getConfiguredProviderIds(providers)).toEqual(['openai', 'openrouter', 'local']);
    expect(getConfiguredProviderIds(providers, 'transcription')).toEqual(['openai', 'openrouter', 'local']);
    expect(getConfiguredProviderIds(providers, 'summary')).toEqual(['openai', 'openrouter']);
  });

  test('builds the active provider summary copy', () => {
    expect(
      buildActiveProviderSummary({
        transcriptionProviderLabel: 'Local',
        summaryProviderLabel: 'OpenRouter',
        transcriptionModelLabel: 'Whisper Base',
        summaryModelLabel: 'google/gemini-2.5-flash',
      })
    ).toBe('Transcript uses Local (Whisper Base). Summary uses OpenRouter (google/gemini-2.5-flash).');
  });

  test('formats bytes and display labels predictably', () => {
    const models: InstalledModelRow[] = [
      {
        id: 'gemma-small',
        kind: 'summary',
        engine: 'mediapipe',
        displayName: 'Gemma Small',
        version: '1',
        platforms: ['ios'],
        fileUri: 'file:///models/gemma-small',
        sizeBytes: 104857600,
        sha256: 'abc',
        status: 'installed',
        installedAt: '2026-04-13T10:00:00.000Z',
      },
    ];

    expect(displayModelLabel(models, 'gemma-small')).toBe('Gemma Small');
    expect(formatBytes(104857600)).toBe('100 MB');
  });

  test('picks a sensible initial provider', () => {
    const providers = buildProviders();
    providers.openrouter.apiKey = 'sk-or-live';

    expect(
      pickInitialProvider({
        selectedSummaryProvider: 'openai',
        selectedTranscriptionProvider: 'openai',
        providers,
        deleteUploadedAudio: false,
        modelCatalogUrl: '',
      })
    ).toBe('openrouter');
  });
});
```

- [ ] **Step 2: Run the settings test and confirm it fails**

Run: `npx vitest run src/features/settings/presentation.test.ts`

Expected: FAIL because `src/features/settings/presentation.ts` does not exist yet.

- [ ] **Step 3: Extract the settings presentation helpers**

```ts
import { isProviderConfigured, providerDefinitions } from '../../services/providers';
import type { AppSettings, InstalledModelRow, ProviderConfig, ProviderId } from '../../types';

export function getConfiguredProviderIds(
  providers: Record<ProviderId, ProviderConfig>,
  mode?: 'transcription' | 'summary'
) {
  return providerDefinitions
    .filter((definition) => {
      if (mode === 'transcription' && !definition.supportsTranscription) {
        return false;
      }

      if (mode === 'summary' && !definition.supportsSummary) {
        return false;
      }

      return isProviderConfigured(definition.id, providers[definition.id], mode);
    })
    .map((definition) => definition.id);
}

export function pickInitialProvider(settings: AppSettings) {
  const configured = getConfiguredProviderIds(settings.providers);
  return configured[0] ?? settings.selectedSummaryProvider ?? settings.selectedTranscriptionProvider ?? 'openai';
}

export function displayModelLabel(models: InstalledModelRow[], modelId: string) {
  return models.find((model) => model.id === modelId)?.displayName ?? modelId;
}

export function formatBytes(value: number) {
  if (!value) {
    return 'size unknown';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 || unitIndex === 0 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`;
}

export function buildActiveProviderSummary({
  transcriptionProviderLabel,
  summaryProviderLabel,
  transcriptionModelLabel,
  summaryModelLabel,
}: {
  transcriptionProviderLabel: string;
  summaryProviderLabel: string;
  transcriptionModelLabel: string;
  summaryModelLabel: string;
}) {
  return `Transcript uses ${transcriptionProviderLabel} (${transcriptionModelLabel}). Summary uses ${summaryProviderLabel} (${summaryModelLabel}).`;
}
```

- [ ] **Step 4: Rebuild the top half of `app/settings.tsx` around clarity-first grouping**

```tsx
import {
  buildActiveProviderSummary,
  displayModelLabel,
  formatBytes,
  getConfiguredProviderIds,
  pickInitialProvider,
} from '../src/features/settings/presentation';
import { EditorialHero, PillButton, SectionHeading, SurfaceCard } from '../src/components/ui';

const transcriptionModelLabel =
  sanitizedForm.selectedTranscriptionProvider === 'local'
    ? displayModelLabel(
        installedTranscriptionModels,
        sanitizedForm.providers.local.transcriptionModel || 'No model selected yet'
      )
    : sanitizedForm.providers[sanitizedForm.selectedTranscriptionProvider].transcriptionModel ||
      'No model selected yet';

const summaryModelLabel =
  sanitizedForm.selectedSummaryProvider === 'local'
    ? displayModelLabel(
        installedSummaryModels,
        sanitizedForm.providers.local.summaryModel || 'No model selected yet'
      )
    : sanitizedForm.providers[sanitizedForm.selectedSummaryProvider].summaryModel ||
      'No model selected yet';

const currentRoutingCopy = buildActiveProviderSummary({
  transcriptionProviderLabel: transcriptionProvider.label,
  summaryProviderLabel: summaryProvider.label,
  transcriptionModelLabel,
  summaryModelLabel,
});

<ScrollView contentContainerStyle={styles.container}>
  <FadeInView>
    <EditorialHero
      eyebrow="Provider control"
      title="Configure once. Choose what each task uses."
      body="Set up providers, manage local models, and route transcript and summary without repeating API setup."
      chips={[
        `${configuredProviderIds.length} configured`,
        `${installedModels.length} local models`,
      ]}
    />
  </FadeInView>

  <FadeInView delay={40}>
    <SurfaceCard style={styles.summaryCard}>
      <SectionHeading
        title="Current routing"
        subtitle="What powers transcript and summary right now"
      />
      <View style={styles.summaryGrid}>
        <View style={styles.summaryBlock}>
          <Text style={styles.summaryLabel}>Transcription provider</Text>
          <Text style={styles.summaryValue}>{transcriptionProvider.label}</Text>
          <Text style={styles.summaryHint}>{transcriptionModelLabel}</Text>
        </View>
        <View style={styles.summaryBlock}>
          <Text style={styles.summaryLabel}>Summary provider</Text>
          <Text style={styles.summaryValue}>{summaryProvider.label}</Text>
          <Text style={styles.summaryHint}>{summaryModelLabel}</Text>
        </View>
      </View>
      <Text style={styles.rowBody}>{currentRoutingCopy}</Text>
      <PillButton
        label={isSaving ? 'Saving…' : 'Save settings'}
        onPress={handleSave}
        disabled={isSaving}
      />
    </SurfaceCard>
  </FadeInView>

  <AssignmentSection
    delay={80}
    title="Transcription provider"
    subtitle="Choose which configured provider turns audio into text."
    icon={<Feather name="mic" size={18} color={palette.accent} />}
    mode="transcription"
    selectedProviderId={sanitizedForm.selectedTranscriptionProvider}
    providerIds={transcriptionProviderIds}
    providers={sanitizedForm.providers}
    onSelect={(providerId) => updateForm('selectedTranscriptionProvider', providerId)}
    localModelOptions={localTranscriptionOptions}
  />

  <AssignmentSection
    delay={110}
    title="Summary provider"
    subtitle="Choose which configured provider writes summary, action items, and decisions."
    icon={<Feather name="file-text" size={18} color={palette.accent} />}
    mode="summary"
    selectedProviderId={sanitizedForm.selectedSummaryProvider}
    providerIds={summaryProviderIds}
    providers={sanitizedForm.providers}
    onSelect={(providerId) => updateForm('selectedSummaryProvider', providerId)}
    localModelOptions={localSummaryOptions}
  />

  <FadeInView delay={120}>
    <SurfaceCard style={styles.card}>
      <SectionHeading
        title="Configured providers"
        subtitle="Add credentials once, then reuse them in the routing controls above."
      />
      <Text style={styles.rowBody}>
        Each provider stores its own API key and model defaults. Local uses downloaded models instead of a remote key.
      </Text>

      <View style={styles.providerChipGrid}>
        {providerDefinitions.map((definition) => (
          <ProviderPickerChip
            key={definition.id}
            providerId={definition.id}
            label={definition.label}
            selected={editingProviderId === definition.id}
            configured={configuredProviderIds.includes(definition.id)}
            onPress={() => setEditingProviderId(definition.id)}
          />
        ))}
      </View>

      <View style={styles.selectedProviderCard}>
        <View style={styles.providerHeader}>
          <View style={styles.providerTitleRow}>
            <ProviderIcon providerId={editingProviderId} />
            <Text style={styles.selectedProviderTitle}>{editingProvider.label}</Text>
          </View>
          <Text
            style={[
              styles.statusBadge,
              configuredProviderIds.includes(editingProviderId)
                ? styles.statusBadgeConfigured
                : styles.statusBadgeIdle,
            ]}
          >
            {configuredProviderIds.includes(editingProviderId) ? 'Configured' : 'Not configured'}
          </Text>
        </View>

        <Text style={styles.rowBody}>{editingProvider.description}</Text>

        {editingProviderId === 'local' ? (
          <>
            <ModelDropdown
              label="Active transcription model"
              value={editingConfig.transcriptionModel}
              options={localTranscriptionOptions}
              onSelect={(value) => updateProvider('local', 'transcriptionModel', value)}
              emptyText="Download a local transcription model before selecting Local here."
            />
            <ModelDropdown
              label="Active summary model"
              value={editingConfig.summaryModel}
              options={localSummaryOptions}
              onSelect={(value) => updateProvider('local', 'summaryModel', value)}
              emptyText="Download a local summary model before selecting Local here."
            />
          </>
        ) : (
          <>
            <Label text="API key" />
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={editingProvider.apiKeyPlaceholder}
              placeholderTextColor={palette.mutedInk}
              secureTextEntry
              value={editingConfig.apiKey}
              onChangeText={(value) => updateProvider(editingProviderId, 'apiKey', value)}
            />
            <Label text={editingProviderId === 'custom' ? 'Base URL' : 'Base URL override'} />
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={editingProvider.baseUrlPlaceholder}
              placeholderTextColor={palette.mutedInk}
              value={editingConfig.baseUrl}
              onChangeText={(value) => updateProvider(editingProviderId, 'baseUrl', value)}
            />
          </>
        )}
      </View>
    </SurfaceCard>
  </FadeInView>

  <FadeInView delay={160}>
    <SurfaceCard style={styles.card}>
      <SectionHeading
        title="Local models"
        subtitle="Download and manage on-device models separately from API-based providers."
      />
      <View style={styles.runtimeCard}>
        <Text style={styles.runtimeTitle}>Runtime status</Text>
        <Text style={styles.rowBody}>
          {deviceSupport?.reason ?? 'Checking device support for the local runtime.'}
        </Text>
      </View>

      <Label text="Optional custom model catalog URL" />
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="https://your-hosted-catalog.example/catalog.json"
        placeholderTextColor={palette.mutedInk}
        value={form.modelCatalogUrl}
        onChangeText={(value) => updateForm('modelCatalogUrl', value)}
      />

      <ModelCatalogSection
        title="Transcription models"
        items={visibleCatalog.filter((item) => item.kind === 'transcription')}
        installedModels={installedTranscriptionModels}
        activeModelId={form.providers.local.transcriptionModel}
        downloadProgress={downloadProgress}
        onDownload={handleDownloadModel}
        onDelete={handleDeleteModel}
        onOpenSource={handleOpenModelSource}
        onSelectActive={(modelId) => updateProvider('local', 'transcriptionModel', modelId)}
        allowDownload={deviceSupport ? deviceSupport.platform !== 'web' : false}
      />

      <ModelCatalogSection
        title="Summary models"
        items={visibleCatalog.filter((item) => item.kind === 'summary')}
        installedModels={installedSummaryModels}
        activeModelId={form.providers.local.summaryModel}
        downloadProgress={downloadProgress}
        onDownload={handleDownloadModel}
        onDelete={handleDeleteModel}
        onOpenSource={handleOpenModelSource}
        onSelectActive={(modelId) => updateProvider('local', 'summaryModel', modelId)}
        allowDownload={deviceSupport ? deviceSupport.platform !== 'web' : false}
      />
    </SurfaceCard>
  </FadeInView>

  <FadeInView delay={200}>
    <SurfaceCard muted style={styles.card}>
      <SectionHeading
        title="Advanced controls"
        subtitle="Optional defaults that should not compete with the main provider setup flow."
      />
      <View style={styles.row}>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>Delete remote audio after processing</Text>
          <Text style={styles.rowBody}>
            Only applies if your selected remote provider supports deleting uploaded audio.
          </Text>
        </View>
        <Switch
          value={form.deleteUploadedAudio}
          onValueChange={(value) => updateForm('deleteUploadedAudio', value)}
        />
      </View>
    </SurfaceCard>
  </FadeInView>
</ScrollView>
```

- [ ] **Step 5: Retune the settings visuals to the new system**

```ts
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 16,
  },
  summaryCard: {
    gap: 16,
  },
  summaryGrid: {
    gap: 12,
  },
  summaryBlock: {
    backgroundColor: palette.cardMuted,
    borderRadius: radii.xl,
    padding: 16,
    gap: 4,
  },
  summaryLabel: {
    color: palette.mutedInk,
    fontFamily: typography.label.fontFamily,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  summaryValue: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 18,
  },
  summaryHint: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
  },
  input: {
    backgroundColor: palette.cardUtility,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: palette.ink,
    borderWidth: 0,
  },
  providerPickerChipSelected: {
    backgroundColor: palette.card,
    borderColor: palette.accent,
  },
  card: {
    gap: 14,
  },
});
```

- [ ] **Step 6: Run the settings checks**

Run: `npx vitest run src/features/settings/presentation.test.ts`

Expected: PASS

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 7: Commit the settings refresh**

```bash
git add src/features/settings/presentation.ts src/features/settings/presentation.test.ts app/settings.tsx
git commit -m "feat: reorganize settings ui"
```

## Task 4: Redesign Onboarding Into a Mobile Editorial Flow

**Files:**
- Create: `src/features/onboarding/presentation.ts`
- Create: `src/features/onboarding/presentation.test.ts`
- Modify: `app/onboarding.tsx`

- [ ] **Step 1: Write the failing onboarding presentation test**

```ts
import { describe, expect, test } from 'vitest';

import { getOnboardingFeatureCard, getOnboardingProgressPercent } from './presentation';

describe('onboarding presentation', () => {
  test('maps each slide to a feature card', () => {
    expect(getOnboardingFeatureCard('welcome')).toEqual({
      icon: 'mic',
      title: 'Manual capture',
      body: 'Start with a recording or imported file. No bots and no stealth capture.',
      tone: 'secondary',
    });
    expect(getOnboardingFeatureCard('privacy')).toEqual({
      icon: 'shield',
      title: 'Consent and control',
      body: 'Audio stays local first and only leaves the device when you choose to process it.',
      tone: 'tertiary',
    });
  });

  test('builds a stable progress percentage', () => {
    expect(getOnboardingProgressPercent(0, 4)).toBe(25);
    expect(getOnboardingProgressPercent(1, 4)).toBe(50);
    expect(getOnboardingProgressPercent(3, 4)).toBe(100);
  });
});
```

- [ ] **Step 2: Run the onboarding test and confirm it fails**

Run: `npx vitest run src/features/onboarding/presentation.test.ts`

Expected: FAIL because `src/features/onboarding/presentation.ts` does not exist yet.

- [ ] **Step 3: Add the onboarding presentation helper**

```ts
import type { OnboardingSlideId } from '../../onboarding/model';

export function getOnboardingFeatureCard(slideId: OnboardingSlideId) {
  switch (slideId) {
    case 'welcome':
      return {
        icon: 'mic',
        title: 'Manual capture',
        body: 'Start with a recording or imported file. No bots and no stealth capture.',
        tone: 'secondary' as const,
      };
    case 'workflow':
      return {
        icon: 'layers',
        title: 'One clean flow',
        body: 'Capture audio, transcribe after the meeting, then review summary and action items.',
        tone: 'secondary' as const,
      };
    case 'privacy':
      return {
        icon: 'shield',
        title: 'Consent and control',
        body: 'Audio stays local first and only leaves the device when you choose to process it.',
        tone: 'tertiary' as const,
      };
    case 'setup':
      return {
        icon: 'settings',
        title: 'Configure providers',
        body: 'Add your API key or local model choices before you process your first meeting.',
        tone: 'secondary' as const,
      };
  }
}

export function getOnboardingProgressPercent(activeIndex: number, slideCount: number) {
  if (slideCount <= 0) {
    return 0;
  }

  const boundedIndex = Math.min(Math.max(activeIndex, 0), slideCount - 1);
  return Math.round(((boundedIndex + 1) / slideCount) * 100);
}
```

- [ ] **Step 4: Rewrite `app/onboarding.tsx` around the approved stacked editorial layout**

```tsx
import { Feather } from '@expo/vector-icons';

import { getOnboardingFeatureCard, getOnboardingProgressPercent } from '../src/features/onboarding/presentation';
import { PillButton, StatusChip, SurfaceCard } from '../src/components/ui';
import { palette, radii, typography } from '../src/theme';

const feature = getOnboardingFeatureCard(slide.id);
const progressPercent = getOnboardingProgressPercent(activeIndex, ONBOARDING_SLIDES.length);

<ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
  <FadeInView style={styles.shell}>
    <View style={styles.headerRow}>
      <View style={styles.headerCopy}>
        <Text style={styles.phaseLabel}>Phase 01 — Setup</Text>
        <Text style={styles.stepText}>
          Step {activeIndex + 1} of {ONBOARDING_SLIDES.length}
        </Text>
      </View>
      {slide.showSkip ? <PillButton label="Skip" onPress={finish} variant="ghost" /> : null}
    </View>

    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
    </View>

    <View style={styles.copyBlock}>
      <Text style={styles.eyebrow}>{slide.eyebrow ?? 'Getting started'}</Text>
      <Text style={styles.title}>{slide.title}</Text>
      <Text style={styles.body}>{slide.body}</Text>
    </View>

    <SurfaceCard style={styles.featureCard}>
      <View style={[styles.featureIconWrap, feature.tone === 'tertiary' && styles.featureIconWrapTertiary]}>
        <Feather name={feature.icon} size={18} color={feature.tone === 'tertiary' ? palette.tertiary : palette.accent} />
      </View>
      <Text style={styles.featureTitle}>{feature.title}</Text>
      <Text style={styles.featureBody}>{feature.body}</Text>
    </SurfaceCard>

    {slide.highlights?.length ? (
      <View style={styles.highlightRow}>
        {slide.highlights.map((highlight) => (
          <StatusChip key={highlight} label={highlight} tone="secondary" />
        ))}
      </View>
    ) : null}

    <View style={styles.buttonRow}>
      {canGoBack ? (
        <PillButton label="Back" onPress={() => setActiveIndex((current) => Math.max(current - 1, 0))} variant="secondary" />
      ) : (
        <View style={styles.buttonSpacer} />
      )}
      <PillButton label={slide.ctaLabel} onPress={handlePrimary} />
    </View>
  </FadeInView>
</ScrollView>
```

- [ ] **Step 5: Apply the updated onboarding styling**

```ts
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  shell: {
    flex: 1,
    gap: 18,
    justifyContent: 'space-between',
  },
  phaseLabel: {
    color: palette.accent,
    fontFamily: typography.label.fontFamily,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  progressTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: palette.cardUtility,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: palette.accent,
  },
  title: {
    color: palette.ink,
    fontFamily: typography.display.fontFamily,
    fontSize: 34,
    lineHeight: 38,
  },
  featureCard: {
    gap: 10,
  },
  featureIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconWrapTertiary: {
    backgroundColor: palette.tertiarySoft,
  },
});
```

- [ ] **Step 6: Run the onboarding checks**

Run: `npx vitest run src/features/onboarding/presentation.test.ts`

Expected: PASS

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 7: Commit the onboarding refresh**

```bash
git add src/features/onboarding/presentation.ts src/features/onboarding/presentation.test.ts app/onboarding.tsx
git commit -m "feat: refresh onboarding ui"
```

## Task 5: Run Full Verification and Cross-Screen Smoke Checks

**Files:**
- Modify: `app/index.tsx`
- Modify: `app/settings.tsx`
- Modify: `app/onboarding.tsx`
- Modify: `src/theme.ts`
- Modify: `src/components/ScreenBackground.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Run the full unit test suite**

Run: `npm test`

Expected: PASS with the existing settings/onboarding tests plus the new theme, dashboard, settings, and onboarding presentation tests.

- [ ] **Step 2: Run the full typecheck**

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 3: Verify that Expo can bundle both native targets**

Run: `npx expo export --platform ios --platform android`

Expected: PASS with `dist/` output updated and no bundling errors.

- [ ] **Step 4: Do the iOS and Android manual smoke pass**

Run: `npx expo start --clear`

Manual checklist:

- Dashboard hero reads clearly and does not feel crowded on a smaller phone
- Dashboard primary actions are only `New recording` and `Import audio`
- Settings shows routing summary before provider setup details
- Local model controls are visually separate from API setup
- Onboarding progress bar advances correctly across all slides
- `Skip`, `Back`, and final CTA still navigate correctly
- Text wraps cleanly without clipping on a narrow device

Expected: PASS on at least one iPhone-size simulator/device and one Android phone-size simulator/device.

- [ ] **Step 5: Commit any final spacing or copy polish from smoke testing**

```bash
git add app/index.tsx app/settings.tsx app/onboarding.tsx src/theme.ts src/components/ScreenBackground.tsx app/_layout.tsx
git commit -m "chore: polish editorial ui refresh"
```
