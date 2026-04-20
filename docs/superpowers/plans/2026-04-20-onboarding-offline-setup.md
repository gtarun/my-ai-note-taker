# Onboarding Offline Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the final onboarding step into an automatic offline-setup flow with bundle choice, persisted download state, Meetings dashboard progress, explicit resume after interruption, and auto-configured local settings when ready.

**Architecture:** Add a persisted offline setup session service above the existing local-model download layer, then wire onboarding, Meetings, and Settings to that single source of truth. Keep bundle resolution and UI copy in small presentation helpers, and absorb the existing `app/account.tsx` footer tweak as a separate tested cleanup task.

**Tech Stack:** Expo Router, React Native, Expo SQLite, expo-file-system legacy, Vitest, existing presentation-helper pattern

---

## File Map

### New files

- `src/services/offlineSetupSession.ts`
- `src/services/offlineSetupSession.test.ts`

### Existing files to modify

- `src/types.ts`
- `src/db.native.ts`
- `src/db.web.ts`
- `src/services/localModels.ts`
- `src/services/settings.ts`
- `src/services/settings.test.ts`
- `src/onboarding/model.ts`
- `src/onboarding/model.test.ts`
- `src/features/onboarding/presentation.ts`
- `src/features/onboarding/presentation.test.ts`
- `app/onboarding.tsx`
- `src/features/dashboard/presentation.ts`
- `src/features/dashboard/presentation.test.ts`
- `src/screens/MeetingsScreen.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/features/account/presentation.ts`
- `src/features/account/presentation.test.ts`
- `app/account.tsx`
- `README.md`

### Responsibilities

- `offlineSetupSession.ts`: bundle resolution, persisted session state, download orchestration, resume/retry entry points, auto-config handoff
- `localModels.ts`: lower-level model download primitives plus resumable metadata support needed by the session layer
- `db.native.ts` / `db.web.ts`: offline setup session storage schema
- onboarding files: turn `setup` into the dedicated offline-setup step and surface bundle/progress UI
- dashboard files: Meetings setup card and state-specific copy
- settings files: reflect the same session state and keep local-model management compatible
- account files: move the version/build footer tweak into a tested presentation helper

### Task 1: Add Offline Setup Session Storage And Types

**Files:**
- Modify: `src/types.ts`
- Modify: `src/db.native.ts`
- Modify: `src/db.web.ts`
- Create: `src/services/offlineSetupSession.test.ts`

- [ ] **Step 1: Write the failing session-type and storage tests**

```ts
import { describe, expect, test, vi } from 'vitest';

const sessionRowState = {
  id: 1,
  bundle_id: '',
  bundle_label: '',
  model_ids_json: '[]',
  status: 'idle',
  bytes_downloaded: 0,
  total_bytes: 0,
  progress: 0,
  estimated_seconds_remaining: null,
  network_policy: 'wifi_or_cellular',
  last_error: null,
  started_at: null,
  updated_at: null,
  auto_configured_at: null,
  is_dismissed: 0,
};

vi.mock('../db', () => ({
  getDatabase: () => ({
    getFirstAsync: vi.fn(async (source: string) => {
      if (source.includes('FROM offline_setup_session')) {
        return sessionRowState;
      }
      return null;
    }),
    runAsync: vi.fn(async (source: string, ...params: unknown[]) => {
      if (source.includes('UPDATE offline_setup_session SET')) {
        sessionRowState.bundle_id = String(params[0]);
        sessionRowState.status = String(params[3]);
      }
    }),
  }),
}));

import { getOfflineSetupSession, saveOfflineSetupSession } from './offlineSetupSession';

describe('offline setup session storage', () => {
  test('hydrates the default idle session', async () => {
    await expect(getOfflineSetupSession()).resolves.toEqual(
      expect.objectContaining({
        bundleId: '',
        status: 'idle',
        progress: 0,
      })
    );
  });

  test('persists session updates as a single app-wide record', async () => {
    await saveOfflineSetupSession({
      bundleId: 'starter',
      bundleLabel: 'Starter',
      modelIds: ['whisper-base'],
      status: 'preparing',
      bytesDownloaded: 0,
      totalBytes: 152 * 1024 * 1024,
      progress: 0,
      estimatedSecondsRemaining: null,
      networkPolicy: 'wifi_or_cellular',
      lastError: null,
      startedAt: '2026-04-20T10:00:00.000Z',
      updatedAt: '2026-04-20T10:00:00.000Z',
      autoConfiguredAt: null,
      isDismissed: false,
    });

    expect(sessionRowState.bundle_id).toBe('starter');
    expect(sessionRowState.status).toBe('preparing');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/offlineSetupSession.test.ts`
Expected: FAIL because `src/services/offlineSetupSession.ts` and the new types do not exist yet.

- [ ] **Step 3: Add the offline setup session types and schema**

```ts
// src/types.ts
export type OfflineSetupStatus =
  | 'idle'
  | 'preparing'
  | 'downloading'
  | 'paused_offline'
  | 'paused_user'
  | 'failed'
  | 'ready';

export type OfflineSetupBundleId = 'starter' | 'full' | '';

export type OfflineSetupSession = {
  bundleId: OfflineSetupBundleId;
  bundleLabel: string;
  modelIds: string[];
  status: OfflineSetupStatus;
  bytesDownloaded: number;
  totalBytes: number;
  progress: number;
  estimatedSecondsRemaining: number | null;
  networkPolicy: 'wifi_or_cellular';
  lastError: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  autoConfiguredAt: string | null;
  isDismissed: boolean;
};
```

```ts
// src/db.native.ts
CREATE TABLE IF NOT EXISTS offline_setup_session (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  bundle_id TEXT NOT NULL DEFAULT '',
  bundle_label TEXT NOT NULL DEFAULT '',
  model_ids_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'idle',
  bytes_downloaded INTEGER NOT NULL DEFAULT 0,
  total_bytes INTEGER NOT NULL DEFAULT 0,
  progress REAL NOT NULL DEFAULT 0,
  estimated_seconds_remaining INTEGER,
  network_policy TEXT NOT NULL DEFAULT 'wifi_or_cellular',
  last_error TEXT,
  started_at TEXT,
  updated_at TEXT,
  auto_configured_at TEXT,
  is_dismissed INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO offline_setup_session (id) VALUES (1);
```

```ts
// src/db.web.ts
type OfflineSetupSessionRow = {
  id: number;
  bundle_id: string;
  bundle_label: string;
  model_ids_json: string;
  status: 'idle' | 'preparing' | 'downloading' | 'paused_offline' | 'paused_user' | 'failed' | 'ready';
  bytes_downloaded: number;
  total_bytes: number;
  progress: number;
  estimated_seconds_remaining: number | null;
  network_policy: string;
  last_error: string | null;
  started_at: string | null;
  updated_at: string | null;
  auto_configured_at: string | null;
  is_dismissed: number;
};
```

- [ ] **Step 4: Add the minimal session persistence module**

```ts
// src/services/offlineSetupSession.ts
import { getDatabase } from '../db';
import type { OfflineSetupSession } from '../types';

const DEFAULT_SESSION: OfflineSetupSession = {
  bundleId: '',
  bundleLabel: '',
  modelIds: [],
  status: 'idle',
  bytesDownloaded: 0,
  totalBytes: 0,
  progress: 0,
  estimatedSecondsRemaining: null,
  networkPolicy: 'wifi_or_cellular',
  lastError: null,
  startedAt: null,
  updatedAt: null,
  autoConfiguredAt: null,
  isDismissed: false,
};

export async function getOfflineSetupSession(): Promise<OfflineSetupSession> {
  const db = getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM offline_setup_session WHERE id = 1'
  );

  if (!row) {
    return DEFAULT_SESSION;
  }

  return {
    bundleId: String(row.bundle_id ?? ''),
    bundleLabel: String(row.bundle_label ?? ''),
    modelIds: JSON.parse(String(row.model_ids_json ?? '[]')),
    status: (row.status as OfflineSetupSession['status']) ?? 'idle',
    bytesDownloaded: Number(row.bytes_downloaded ?? 0),
    totalBytes: Number(row.total_bytes ?? 0),
    progress: Number(row.progress ?? 0),
    estimatedSecondsRemaining:
      row.estimated_seconds_remaining == null ? null : Number(row.estimated_seconds_remaining),
    networkPolicy: 'wifi_or_cellular',
    lastError: row.last_error ? String(row.last_error) : null,
    startedAt: row.started_at ? String(row.started_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
    autoConfiguredAt: row.auto_configured_at ? String(row.auto_configured_at) : null,
    isDismissed: Number(row.is_dismissed ?? 0) === 1,
  };
}

export async function saveOfflineSetupSession(session: OfflineSetupSession) {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE offline_setup_session SET
      bundle_id = ?,
      bundle_label = ?,
      model_ids_json = ?,
      status = ?,
      bytes_downloaded = ?,
      total_bytes = ?,
      progress = ?,
      estimated_seconds_remaining = ?,
      network_policy = ?,
      last_error = ?,
      started_at = ?,
      updated_at = ?,
      auto_configured_at = ?,
      is_dismissed = ?
    WHERE id = 1`,
    session.bundleId,
    session.bundleLabel,
    JSON.stringify(session.modelIds),
    session.status,
    session.bytesDownloaded,
    session.totalBytes,
    session.progress,
    session.estimatedSecondsRemaining,
    session.networkPolicy,
    session.lastError,
    session.startedAt,
    session.updatedAt,
    session.autoConfiguredAt,
    session.isDismissed ? 1 : 0
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/services/offlineSetupSession.test.ts`
Expected: PASS with 2 tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/db.native.ts src/db.web.ts src/services/offlineSetupSession.ts src/services/offlineSetupSession.test.ts
git commit -m "feat: persist offline setup sessions"
```

### Task 2: Add Bundle Resolution And Download Orchestration

**Files:**
- Modify: `src/services/localModels.ts`
- Modify: `src/services/localInference.test.ts`
- Create: `src/services/offlineSetupSession.test.ts`
- Modify: `src/services/settings.ts`
- Modify: `src/services/settings.test.ts`

- [ ] **Step 1: Extend the failing tests for bundle resolution and auto-config**

```ts
test('builds a starter bundle for iOS from the supported transcription model only', async () => {
  const module = await import('./offlineSetupSession');

  expect(
    module.resolveOfflineSetupBundles({
      platform: 'ios',
      catalog: [
        {
          id: 'whisper-base',
          kind: 'transcription',
          engine: 'whisper.cpp',
          displayName: 'Whisper Base',
          version: 'ggml',
          downloadUrl: 'https://example.com/whisper-base.bin',
          sha256: '',
          sizeBytes: 152,
          platforms: ['ios'],
          minFreeSpaceBytes: 1,
          recommended: true,
          experimental: false,
          description: 'base',
        },
      ],
    })
  ).toEqual([
    expect.objectContaining({
      id: 'starter',
      modelIds: ['whisper-base'],
      totalBytes: 152,
      isRecommended: true,
    }),
  ]);
});

test('fills empty local transcription config after a ready session', async () => {
  const settings = await getAppSettings();
  settings.providers.local.transcriptionModel = '';

  await applyOfflineSetupAutoConfig({
    bundleId: 'starter',
    modelIds: ['whisper-base'],
    preferredTranscriptionModelId: 'whisper-base',
  });

  await expect(getAppSettings()).resolves.toMatchObject({
    providers: {
      local: expect.objectContaining({
        transcriptionModel: 'whisper-base',
      }),
    },
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/offlineSetupSession.test.ts src/services/settings.test.ts src/services/localInference.test.ts`
Expected: FAIL because bundle resolution and auto-config helpers do not exist yet.

- [ ] **Step 3: Add bundle resolution and progress orchestration**

```ts
// src/services/offlineSetupSession.ts
export type OfflineSetupBundle = {
  id: 'starter' | 'full';
  label: string;
  modelIds: string[];
  totalBytes: number;
  estimatedSeconds: number;
  isRecommended: boolean;
  description: string;
};

export function resolveOfflineSetupBundles({
  platform,
  catalog,
}: {
  platform: 'ios' | 'android';
  catalog: ModelCatalogItem[];
}): OfflineSetupBundle[] {
  const visible = catalog.filter((item) => item.platforms.includes(platform));
  const starterModels =
    platform === 'ios'
      ? visible.filter((item) => item.id === 'whisper-base')
      : visible.filter((item) => item.recommended);

  const fullModels =
    platform === 'android' ? visible.filter((item) => item.recommended || !item.experimental) : [];

  const bundles: OfflineSetupBundle[] = [];

  if (starterModels.length) {
    bundles.push({
      id: 'starter',
      label: 'Starter',
      modelIds: starterModels.map((item) => item.id),
      totalBytes: starterModels.reduce((sum, item) => sum + item.sizeBytes, 0),
      estimatedSeconds: Math.max(60, Math.round(starterModels.reduce((sum, item) => sum + item.sizeBytes, 0) / (25 * 1024 * 1024))),
      isRecommended: true,
      description: 'Fastest way to get to a first local result.',
    });
  }

  if (fullModels.length > starterModels.length) {
    bundles.push({
      id: 'full',
      label: 'Full',
      modelIds: fullModels.map((item) => item.id),
      totalBytes: fullModels.reduce((sum, item) => sum + item.sizeBytes, 0),
      estimatedSeconds: Math.max(60, Math.round(fullModels.reduce((sum, item) => sum + item.sizeBytes, 0) / (25 * 1024 * 1024))),
      isRecommended: false,
      description: 'Larger offline bundle for broader local coverage.',
    });
  }

  return bundles;
}
```

```ts
// src/services/settings.ts
export async function applyOfflineSetupAutoConfig(params: {
  bundleId: string;
  modelIds: string[];
  preferredTranscriptionModelId: string | null;
}) {
  const settings = await getAppSettings();

  if (!settings.providers.local.transcriptionModel && params.preferredTranscriptionModelId) {
    settings.providers.local.transcriptionModel = params.preferredTranscriptionModelId;
  }

  if (settings.selectedTranscriptionProvider === 'openai' && params.preferredTranscriptionModelId) {
    settings.selectedTranscriptionProvider = 'local';
  }

  await saveAppSettings(settings);
}
```

- [ ] **Step 4: Add the minimal orchestration path for start, pause-offline, fail, and ready**

```ts
// src/services/offlineSetupSession.ts
export async function startOfflineSetup(bundle: OfflineSetupBundle) {
  const startedAt = new Date().toISOString();

  await saveOfflineSetupSession({
    ...(await getOfflineSetupSession()),
    bundleId: bundle.id,
    bundleLabel: bundle.label,
    modelIds: bundle.modelIds,
    status: 'downloading',
    totalBytes: bundle.totalBytes,
    startedAt,
    updatedAt: startedAt,
    isDismissed: false,
    lastError: null,
  });
}

export async function markOfflineSetupPausedOffline(message: string) {
  const session = await getOfflineSetupSession();
  await saveOfflineSetupSession({
    ...session,
    status: 'paused_offline',
    lastError: message,
    updatedAt: new Date().toISOString(),
  });
}

export async function markOfflineSetupReady(params: {
  preferredTranscriptionModelId: string | null;
}) {
  const session = await getOfflineSetupSession();
  await applyOfflineSetupAutoConfig({
    bundleId: session.bundleId,
    modelIds: session.modelIds,
    preferredTranscriptionModelId: params.preferredTranscriptionModelId,
  });

  await saveOfflineSetupSession({
    ...session,
    status: 'ready',
    progress: 1,
    bytesDownloaded: session.totalBytes,
    autoConfiguredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/services/offlineSetupSession.test.ts src/services/settings.test.ts src/services/localInference.test.ts`
Expected: PASS with the new bundle and auto-config assertions green.

- [ ] **Step 6: Commit**

```bash
git add src/services/localModels.ts src/services/offlineSetupSession.ts src/services/offlineSetupSession.test.ts src/services/settings.ts src/services/settings.test.ts src/services/localInference.test.ts
git commit -m "feat: add offline setup orchestration"
```

### Task 3: Rebuild The Final Onboarding Step Around Offline Setup

**Files:**
- Modify: `src/onboarding/model.ts`
- Modify: `src/onboarding/model.test.ts`
- Modify: `src/features/onboarding/presentation.ts`
- Modify: `src/features/onboarding/presentation.test.ts`
- Modify: `app/onboarding.tsx`

- [ ] **Step 1: Write the failing onboarding presentation/model tests**

```ts
// src/onboarding/model.test.ts
test('turns setup into the offline setup step', () => {
  expect(ONBOARDING_SLIDES[3].title).toBe('Prepare offline mode');
  expect(ONBOARDING_SLIDES[3].body).toContain('download');
  expect(ONBOARDING_SLIDES[3].ctaLabel).toBe('Open app');
});

// src/features/onboarding/presentation.test.ts
test('returns setup-card copy for downloading and ready states', () => {
  expect(
    getOfflineSetupStatusCopy({
      status: 'downloading',
      bundleLabel: 'Starter',
      progressPercent: 42,
      estimatedMinutes: 6,
    })
  ).toEqual({
    title: 'Preparing offline mode',
    body: 'Starter is downloading now. About 6 min remaining.',
    progressLabel: '42%',
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/onboarding/model.test.ts src/features/onboarding/presentation.test.ts`
Expected: FAIL because the setup slide copy and presentation helpers have not changed yet.

- [ ] **Step 3: Update onboarding model and presentation helpers**

```ts
// src/onboarding/model.ts
{
  id: 'setup',
  title: 'Prepare offline mode',
  body: 'We can start downloading the recommended local bundle now so your first recording is easier to analyze later.',
  highlights: ['Auto-started', 'Skippable', 'Resume later'],
  ctaLabel: 'Open app',
  showSkip: true,
}
```

```ts
// src/features/onboarding/presentation.ts
export function getOfflineSetupStatusCopy(params: {
  status: 'preparing' | 'downloading' | 'paused_offline' | 'failed' | 'ready';
  bundleLabel: string;
  progressPercent: number;
  estimatedMinutes: number | null;
}) {
  if (params.status === 'ready') {
    return {
      title: 'Offline mode is ready',
      body: `${params.bundleLabel} finished downloading and local setup has been applied.`,
      progressLabel: 'Ready',
    };
  }

  if (params.status === 'paused_offline') {
    return {
      title: 'Offline setup paused',
      body: 'Connection was interrupted. You can resume from Meetings when you are ready.',
      progressLabel: `${params.progressPercent}%`,
    };
  }

  return {
    title: 'Preparing offline mode',
    body: `${params.bundleLabel} is downloading now.${params.estimatedMinutes ? ` About ${params.estimatedMinutes} min remaining.` : ''}`,
    progressLabel: `${params.progressPercent}%`,
  };
}
```

- [ ] **Step 4: Replace the last onboarding slide body with bundle choice + auto-started progress**

```tsx
// app/onboarding.tsx
const [offlineSetup, setOfflineSetup] = useState<OfflineSetupSession | null>(null);
const [bundleOptions, setBundleOptions] = useState<OfflineSetupBundle[]>([]);

useEffect(() => {
  if (slide.id !== 'setup') {
    return;
  }

  let cancelled = false;

  void (async () => {
    const session = await getOfflineSetupSession();
    const bundles = await hydrateOfflineSetupBundles();

    if (cancelled) {
      return;
    }

    setOfflineSetup(session);
    setBundleOptions(bundles);

    if (session.status === 'idle' && bundles[0]) {
      await startOfflineSetup(bundles[0]);
      if (!cancelled) {
        setOfflineSetup(await getOfflineSetupSession());
      }
    }
  })();

  return () => {
    cancelled = true;
  };
}, [slide.id]);
```

```tsx
{slide.id === 'setup' ? (
  <SurfaceCard style={styles.featureCard} muted>
    <Text style={styles.featureTitle}>Choose your offline bundle</Text>
    {bundleOptions.map((bundle) => (
      <Pressable key={bundle.id} style={styles.bundleCard}>
        <Text style={styles.bundleTitle}>{bundle.label}</Text>
        <Text style={styles.bundleMeta}>
          {formatBytes(bundle.totalBytes)} • ~{Math.max(1, Math.round(bundle.estimatedSeconds / 60))} min
        </Text>
      </Pressable>
    ))}
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.round((offlineSetup?.progress ?? 0) * 100)}%` }]} />
    </View>
  </SurfaceCard>
) : (
  <SurfaceCard style={styles.featureCard} muted>{/* existing non-setup card */}</SurfaceCard>
)}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/onboarding/model.test.ts src/features/onboarding/presentation.test.ts`
Expected: PASS with updated slide copy and setup-state presentation coverage.

- [ ] **Step 6: Commit**

```bash
git add src/onboarding/model.ts src/onboarding/model.test.ts src/features/onboarding/presentation.ts src/features/onboarding/presentation.test.ts app/onboarding.tsx
git commit -m "feat: add onboarding offline setup step"
```

### Task 4: Add The Meetings Dashboard Setup Card

**Files:**
- Modify: `src/features/dashboard/presentation.ts`
- Modify: `src/features/dashboard/presentation.test.ts`
- Modify: `src/screens/MeetingsScreen.tsx`

- [ ] **Step 1: Write the failing dashboard presentation tests**

```ts
test('returns dashboard copy for paused offline setup', () => {
  expect(
    getOfflineSetupCardCopy({
      status: 'paused_offline',
      bundleLabel: 'Starter',
      progressPercent: 42,
    })
  ).toEqual({
    title: 'Offline setup paused',
    body: 'Connection was interrupted while Starter was downloading.',
    actionLabel: 'Resume',
    tone: 'tertiary',
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/dashboard/presentation.test.ts`
Expected: FAIL because `getOfflineSetupCardCopy` does not exist yet.

- [ ] **Step 3: Add dashboard card presentation helpers**

```ts
// src/features/dashboard/presentation.ts
export function getOfflineSetupCardCopy(params: {
  status: 'preparing' | 'downloading' | 'paused_offline' | 'failed' | 'ready';
  bundleLabel: string;
  progressPercent: number;
}) {
  switch (params.status) {
    case 'paused_offline':
      return {
        title: 'Offline setup paused',
        body: `Connection was interrupted while ${params.bundleLabel} was downloading.`,
        actionLabel: 'Resume',
        tone: 'tertiary' as const,
      };
    case 'failed':
      return {
        title: 'Offline setup failed',
        body: `We could not finish preparing ${params.bundleLabel}.`,
        actionLabel: 'Try again',
        tone: 'danger' as const,
      };
    case 'ready':
      return {
        title: 'Offline mode ready',
        body: `${params.bundleLabel} finished downloading and is ready to use.`,
        actionLabel: 'Dismiss',
        tone: 'secondary' as const,
      };
    default:
      return {
        title: 'Preparing offline mode',
        body: `${params.bundleLabel} is ${params.progressPercent}% complete.`,
        actionLabel: 'View details',
        tone: 'secondary' as const,
      };
  }
}
```

- [ ] **Step 4: Render the card at the top of Meetings**

```tsx
// src/screens/MeetingsScreen.tsx
const [offlineSetup, setOfflineSetup] = useState<OfflineSetupSession | null>(null);

const loadMeetings = useCallback(async () => {
  const [data, storedSession, setupSession] = await Promise.all([
    listMeetings(),
    getAuthSession().catch(() => null),
    getOfflineSetupSession(),
  ]);

  setMeetings(data);
  setSession(storedSession);
  setOfflineSetup(setupSession);
}, []);
```

```tsx
{offlineSetup && offlineSetup.status !== 'idle' ? (
  <FadeInView delay={55}>
    <SurfaceCard muted style={styles.cloudCard}>
      <View style={styles.cloudRow}>
        <View style={styles.cloudCopy}>
          <Text style={styles.cloudEyebrow}>Offline mode</Text>
          <Text style={styles.cloudTitle}>
            {getOfflineSetupCardCopy({
              status: offlineSetup.status,
              bundleLabel: offlineSetup.bundleLabel || 'Starter',
              progressPercent: Math.round(offlineSetup.progress * 100),
            }).title}
          </Text>
          <Text style={styles.heroSubtitle}>
            {getOfflineSetupCardCopy({
              status: offlineSetup.status,
              bundleLabel: offlineSetup.bundleLabel || 'Starter',
              progressPercent: Math.round(offlineSetup.progress * 100),
            }).body}
          </Text>
        </View>
        <PillButton
          label={
            getOfflineSetupCardCopy({
              status: offlineSetup.status,
              bundleLabel: offlineSetup.bundleLabel || 'Starter',
              progressPercent: Math.round(offlineSetup.progress * 100),
            }).actionLabel
          }
          onPress={() => {
            void resumeOfflineSetupFromDashboard();
          }}
          variant="ghost"
        />
      </View>
    </SurfaceCard>
  </FadeInView>
) : null}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/dashboard/presentation.test.ts`
Expected: PASS with the new offline-setup card assertions.

- [ ] **Step 6: Commit**

```bash
git add src/features/dashboard/presentation.ts src/features/dashboard/presentation.test.ts src/screens/MeetingsScreen.tsx
git commit -m "feat: show offline setup progress on meetings"
```

### Task 5: Reconcile Settings With The Shared Session State

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`
- Modify: `src/services/offlineSetupSession.test.ts`

- [ ] **Step 1: Write the failing integration test for shared progress state**

```ts
test('reports shared offline setup progress instead of screen-local state', async () => {
  await saveOfflineSetupSession({
    ...(await getOfflineSetupSession()),
    bundleId: 'starter',
    bundleLabel: 'Starter',
    status: 'downloading',
    progress: 0.5,
    bytesDownloaded: 76,
    totalBytes: 152,
    updatedAt: '2026-04-20T10:05:00.000Z',
  });

  await expect(getOfflineSetupSession()).resolves.toEqual(
    expect.objectContaining({
      status: 'downloading',
      progress: 0.5,
    })
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/offlineSetupSession.test.ts`
Expected: FAIL because Settings still owns separate `downloadProgress` state and the shared session shape is incomplete.

- [ ] **Step 3: Replace screen-local progress bookkeeping with the session service**

```tsx
// src/screens/SettingsScreen.tsx
const [offlineSetup, setOfflineSetup] = useState<OfflineSetupSession | null>(null);

useEffect(() => {
  void getOfflineSetupSession().then(setOfflineSetup);
}, []);

const handleDownloadModel = async (item: ModelCatalogItem) => {
  await startOfflineSetupForModel(item);
  setOfflineSetup(await getOfflineSetupSession());
  const nextInstalledModels = await getInstalledModels();
  setInstalledModels(nextInstalledModels);
};
```

```tsx
label={
  offlineSetup?.status === 'downloading' && offlineSetup.modelIds.includes(item.id)
    ? `Downloading ${Math.round(offlineSetup.progress * 100)}%`
    : 'Download'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/offlineSetupSession.test.ts src/services/settings.test.ts`
Expected: PASS with the shared-session state remaining coherent.

- [ ] **Step 5: Commit**

```bash
git add src/screens/SettingsScreen.tsx src/services/offlineSetupSession.ts src/services/offlineSetupSession.test.ts src/services/settings.test.ts
git commit -m "refactor: share offline setup state across settings"
```

### Task 6: Fold In The Account Footer Tweak And Finish Verification

**Files:**
- Modify: `src/features/account/presentation.ts`
- Modify: `src/features/account/presentation.test.ts`
- Modify: `app/account.tsx`
- Modify: `README.md`

- [ ] **Step 1: Write the failing account presentation test**

```ts
test('splits app version and build number for footer display', () => {
  expect(
    getBuildFooterParts({
      appVersion: '1.2.3',
      buildNumber: '45',
    })
  ).toEqual({
    appVersionLabel: 'v1.2.3',
    buildNumberLabel: 'Build 45',
    versionLabel: 'v1.2.3 (45)',
  });
});
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `npx vitest run src/features/account/presentation.test.ts`
Expected: FAIL because `getBuildFooterParts` does not exist yet.

- [ ] **Step 3: Add the helper and use it in the account footer**

```ts
// src/features/account/presentation.ts
export function getBuildFooterParts({
  appVersion,
  buildNumber,
}: {
  appVersion: string;
  buildNumber?: string | null;
}) {
  const trimmedBuildNumber = typeof buildNumber === 'string' ? buildNumber.trim() : '';

  return {
    appVersionLabel: `v${appVersion}`,
    buildNumberLabel: trimmedBuildNumber ? `Build ${trimmedBuildNumber}` : '',
    versionLabel: formatBuildVersion({ appVersion, buildNumber: trimmedBuildNumber }),
  };
}
```

```tsx
// app/account.tsx
const buildInfo = useMemo(() => getBuildInfo(), []);

<Text style={styles.footer}>
  Version {buildInfo.appVersionLabel}
  {buildInfo.buildNumberLabel ? `  •  ${buildInfo.buildNumberLabel}` : ''}
</Text>
```

- [ ] **Step 4: Update the README for the new onboarding/download behavior**

```md
## First run

The final onboarding step now prepares offline mode automatically when the device supports it.

- choose a recommended bundle size
- watch progress from onboarding or the Meetings dashboard
- if setup is interrupted, reopen the app and tap `Resume` from Meetings
```

- [ ] **Step 5: Run the focused and full verification suites**

Run: `npx vitest run src/services/offlineSetupSession.test.ts src/services/settings.test.ts src/onboarding/model.test.ts src/features/onboarding/presentation.test.ts src/features/dashboard/presentation.test.ts src/features/account/presentation.test.ts`
Expected: PASS with all new targeted tests green.

Run: `npm test`
Expected: PASS with the full Vitest suite green.

- [ ] **Step 6: Commit**

```bash
git add src/features/account/presentation.ts src/features/account/presentation.test.ts app/account.tsx README.md
git commit -m "feat: finish offline setup flow polish"
```

## Self-Review

- Spec coverage:
  - dedicated final onboarding setup step: Task 3
  - bundle choice with size/time: Tasks 2 and 3
  - persistent Meetings dashboard card: Task 4
  - explicit resume after interruption: Tasks 2 and 4
  - shared session state across screens: Tasks 1 and 5
  - automatic local configuration: Task 2
  - account footer tweak: Task 6
- Placeholder scan:
  - removed vague “handle later” language and attached each requirement to a task
- Type consistency:
  - session states use `idle | preparing | downloading | paused_offline | paused_user | failed | ready` consistently across tasks

