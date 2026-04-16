# Supabase Hybrid User Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move profile, synced settings, unified Google integration state, and extraction layers into Supabase while keeping meetings local-first and preserving local cache/offline behavior.

**Architecture:** Add normalized Supabase tables plus authenticated Edge Functions that hide encrypted secrets and expose one stable user-data API to the app. Keep SQLite as the local mirror for preferences and extraction layers so launch, onboarding, and meeting workflows stay fast, then hydrate that cache during bootstrap whenever the user is signed in.

**Tech Stack:** Supabase Postgres, Supabase Edge Functions, Expo Router, React Native, TypeScript, Expo SQLite, Vitest

---

## File Structure

- Create: `supabase/migrations/20260416_create_hybrid_user_data.sql`
- Create: `supabase/functions/_shared/user-data.ts`
- Create: `supabase/functions/_shared/user-data.test.ts`
- Create: `supabase/functions/_shared/secrets.ts`
- Create: `supabase/functions/_shared/google-integration.ts`
- Create: `supabase/functions/_shared/google-integration.test.ts`
- Create: `supabase/functions/user-data-bootstrap/index.ts`
- Create: `supabase/functions/user-settings-sync/index.ts`
- Create: `supabase/functions/user-extraction-layers-sync/index.ts`
- Modify: `supabase/functions/_shared/drive-access.ts`
- Modify: `supabase/functions/_shared/google-sheets.ts`
- Modify: `supabase/functions/google-drive-connect-url/index.ts`
- Modify: `supabase/functions/google-drive-access-token/index.ts`
- Modify: `supabase/functions/google-drive-save-folder/index.ts`
- Modify: `supabase/functions/google-drive-folder-picker/index.ts`
- Modify: `supabase/functions/google-sheets-browser/index.ts`
- Modify: `supabase/functions/google-sheets-append-row/index.ts`
- Modify: `supabase/functions/google-sheets-ensure-layer-sheet/index.ts`
- Modify: `supabase/config.toml`
- Create: `src/services/cloudUserData.ts`
- Create: `src/services/cloudUserData.test.ts`
- Modify: `src/services/settings.ts`
- Modify: `src/services/settings.test.ts`
- Modify: `src/services/extractionLayers.ts`
- Modify: `src/services/extractionLayers.test.ts`
- Modify: `src/services/bootstrap.ts`
- Modify: `src/services/account.ts`
- Modify: `src/services/account.test.ts`
- Modify: `src/types.ts`

`supabase/functions/_shared/user-data.ts` owns the server-side row-to-payload mapping so bootstrap, settings sync, and layer sync all agree on shape. `src/services/cloudUserData.ts` becomes the app’s only Supabase user-data client and keeps `settings.ts` / `extractionLayers.ts` focused on local-cache semantics instead of HTTP details. Existing Google Drive and Sheets functions keep their URLs and behavior, but switch from `google_drive_connections` to the new `user_integrations` row so one Google connection powers both Drive and Sheets.

### Task 1: Add The Cloud User-Data Schema And Bootstrap Snapshot

**Files:**
- Create: `supabase/migrations/20260416_create_hybrid_user_data.sql`
- Create: `supabase/functions/_shared/user-data.ts`
- Create: `supabase/functions/_shared/user-data.test.ts`
- Create: `supabase/functions/_shared/secrets.ts`
- Create: `supabase/functions/user-data-bootstrap/index.ts`
- Modify: `supabase/config.toml`
- Create: `src/services/cloudUserData.ts`
- Create: `src/services/cloudUserData.test.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Write the failing bootstrap mapping tests**

```ts
import { describe, expect, test } from 'vitest';

import { buildBootstrapPayload } from '../../supabase/functions/_shared/user-data';

describe('buildBootstrapPayload', () => {
  test('returns defaults when optional rows are missing', () => {
    expect(
      buildBootstrapPayload({
        authUser: {
          id: 'user-1',
          email: 'founder@example.com',
          user_metadata: { name: 'Tarun' },
        },
        profile: null,
        preferences: null,
        providerConfigs: [],
        integrations: [],
        layers: [],
        layerFields: [],
      })
    ).toMatchObject({
      profile: { displayName: 'Tarun' },
      preferences: {
        selectedTranscriptionProvider: 'openai',
        selectedSummaryProvider: 'openai',
        hasSeenOnboarding: false,
      },
      providers: [],
      layers: [],
    });
  });
});
```

```ts
import { describe, expect, test } from 'vitest';

import { mapBootstrapSnapshotToAppSettings, mapBootstrapSnapshotToLayers } from './cloudUserData';

describe('cloud bootstrap snapshot', () => {
  test('maps preferences and provider configs into AppSettings', () => {
    const snapshot = {
      profile: { displayName: 'Tarun', avatarUrl: null, timezone: 'Asia/Kolkata' },
      preferences: {
        selectedTranscriptionProvider: 'openai',
        selectedSummaryProvider: 'groq',
        deleteUploadedAudio: true,
        modelCatalogUrl: 'https://models.example.com/catalog.json',
        hasSeenOnboarding: true,
      },
      providers: [
        {
          providerId: 'openai',
          apiKey: 'sk-openai',
          baseUrl: 'https://api.openai.com/v1',
          transcriptionModel: 'gpt-4o-mini-transcribe',
          summaryModel: 'gpt-4.1-mini',
        },
      ],
      integrations: [],
      layers: [],
    } as const;

    expect(mapBootstrapSnapshotToAppSettings(snapshot).selectedSummaryProvider).toBe('groq');
    expect(mapBootstrapSnapshotToAppSettings(snapshot).providers.openai.apiKey).toBe('sk-openai');
  });

  test('maps layer rows and ordered fields into ExtractionLayer objects', () => {
    const snapshot = {
      profile: { displayName: null, avatarUrl: null, timezone: null },
      preferences: {
        selectedTranscriptionProvider: 'openai',
        selectedSummaryProvider: 'openai',
        deleteUploadedAudio: false,
        modelCatalogUrl: '',
        hasSeenOnboarding: false,
      },
      providers: [],
      integrations: [],
      layers: [
        {
          id: 'layer-1',
          name: 'Leads',
          spreadsheetId: 'spreadsheet-1',
          spreadsheetTitle: 'Leads tracker',
          sheetTitle: 'Inbound',
          createdAt: '2026-04-16T00:00:00.000Z',
          updatedAt: '2026-04-16T00:00:00.000Z',
          fields: [{ id: 'company', title: 'Company', description: '' }],
        },
      ],
    } as const;

    expect(mapBootstrapSnapshotToLayers(snapshot)).toEqual(snapshot.layers);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/_shared/user-data.test.ts src/services/cloudUserData.test.ts`

Expected: FAIL because the shared bootstrap helper and app bootstrap client do not exist yet.

- [ ] **Step 3: Add the migration, shared payload builder, bootstrap function, and app client**

```sql
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_transcription_provider text not null default 'openai',
  selected_summary_provider text not null default 'openai',
  delete_uploaded_audio boolean not null default false,
  model_catalog_url text not null default '',
  has_seen_onboarding boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.user_provider_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id text not null,
  base_url text not null default '',
  transcription_model text not null default '',
  summary_model text not null default '',
  encrypted_api_key text,
  key_version integer not null default 1,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, provider_id)
);

create table if not exists public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  status text not null default 'not_connected',
  account_email text,
  granted_scopes text[] not null default '{}',
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  needs_reconnect boolean not null default false,
  drive_save_folder_id text,
  drive_save_folder_name text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, provider)
);

create table if not exists public.user_extraction_layers (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  spreadsheet_id text,
  spreadsheet_title text,
  sheet_title text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.user_extraction_layer_fields (
  id uuid primary key default gen_random_uuid(),
  layer_id uuid not null references public.user_extraction_layers(id) on delete cascade,
  field_id text not null,
  title text not null,
  description text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (layer_id, field_id)
);
```

Continue the same migration file by:
- enabling RLS on `profiles`, `user_preferences`, `user_provider_configs`, `user_integrations`, `user_extraction_layers`, and `user_extraction_layer_fields`
- adding authenticated ownership policies on `user_id`
- adding `user_id` / `updated_at desc` indexes for preferences, provider configs, integrations, and layers
- backfilling `user_integrations(provider = 'google')` from existing `google_drive_connections` rows so current users keep their Drive folder and token state during rollout

```ts
export function buildBootstrapPayload(input: BuildBootstrapPayloadInput): CloudUserDataSnapshot {
  const profile = input.profile ?? {
    display_name:
      typeof input.authUser.user_metadata?.name === 'string' ? input.authUser.user_metadata.name : null,
    avatar_url: null,
    timezone: null,
  };

  return {
    profile: {
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      timezone: profile.timezone,
    },
    preferences: {
      selectedTranscriptionProvider: input.preferences?.selected_transcription_provider ?? 'openai',
      selectedSummaryProvider: input.preferences?.selected_summary_provider ?? 'openai',
      deleteUploadedAudio: input.preferences?.delete_uploaded_audio ?? false,
      modelCatalogUrl: input.preferences?.model_catalog_url ?? '',
      hasSeenOnboarding: input.preferences?.has_seen_onboarding ?? false,
    },
    providers: input.providerConfigs.map((row) => ({
      providerId: row.provider_id,
      apiKey: row.api_key,
      baseUrl: row.base_url,
      transcriptionModel: row.transcription_model,
      summaryModel: row.summary_model,
    })),
    integrations: input.integrations,
    layers: hydrateLayers(input.layers, input.layerFields),
  };
}
```

```ts
export async function fetchCloudUserDataSnapshot() {
  return invokeAuthenticatedFunction<CloudUserDataSnapshot>('user-data-bootstrap', {});
}

export function mapBootstrapSnapshotToAppSettings(snapshot: CloudUserDataSnapshot): AppSettings {
  return sanitizeAppSettings({
    selectedTranscriptionProvider: snapshot.preferences.selectedTranscriptionProvider,
    selectedSummaryProvider: snapshot.preferences.selectedSummaryProvider,
    deleteUploadedAudio: snapshot.preferences.deleteUploadedAudio,
    modelCatalogUrl: snapshot.preferences.modelCatalogUrl,
    providers: buildProviderMapFromSnapshot(snapshot.providers),
  });
}

export function mapBootstrapSnapshotToLayers(snapshot: CloudUserDataSnapshot): ExtractionLayer[] {
  return snapshot.layers;
}
```

```toml
[functions.user-data-bootstrap]
verify_jwt = false
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/_shared/user-data.test.ts src/services/cloudUserData.test.ts`

Expected: PASS with the bootstrap helpers returning defaulted profile/preferences rows and hydrated layers.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260416_create_hybrid_user_data.sql supabase/functions/_shared/user-data.ts supabase/functions/_shared/user-data.test.ts supabase/functions/_shared/secrets.ts supabase/functions/user-data-bootstrap/index.ts supabase/config.toml src/services/cloudUserData.ts src/services/cloudUserData.test.ts src/types.ts
git commit -m "feat: add supabase user data bootstrap"
```

### Task 2: Move Google Drive And Sheets To One Unified Integration Row

**Files:**
- Create: `supabase/functions/_shared/google-integration.ts`
- Create: `supabase/functions/_shared/google-integration.test.ts`
- Modify: `supabase/functions/_shared/drive-access.ts`
- Modify: `supabase/functions/_shared/google-sheets.ts`
- Modify: `supabase/functions/google-drive-connect-url/index.ts`
- Modify: `supabase/functions/google-drive-access-token/index.ts`
- Modify: `supabase/functions/google-drive-save-folder/index.ts`
- Modify: `supabase/functions/google-drive-folder-picker/index.ts`
- Modify: `supabase/functions/google-sheets-browser/index.ts`
- Modify: `supabase/functions/google-sheets-append-row/index.ts`
- Modify: `supabase/functions/google-sheets-ensure-layer-sheet/index.ts`
- Modify: `src/services/account.test.ts`

- [ ] **Step 1: Write the failing integration helper tests**

```ts
import { describe, expect, test } from 'vitest';

import { buildGoogleIntegrationSummary, normalizeGrantedScopes } from './google-integration';

describe('google integration helpers', () => {
  test('marks reconnect when sheets scope is missing', () => {
    expect(
      buildGoogleIntegrationSummary({
        status: 'connected',
        account_email: 'owner@example.com',
        granted_scopes: ['https://www.googleapis.com/auth/drive.file'],
        drive_save_folder_id: 'folder-1',
        drive_save_folder_name: 'Recordings',
      }).needsReconnect
    ).toBe(true);
  });

  test('normalizes the oauth scope string into a stable list', () => {
    expect(
      normalizeGrantedScopes('openid https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets')
    ).toEqual([
      'openid',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/spreadsheets',
    ]);
  });
});
```

```ts
test('still passes the app redirect URL to the Google connect function', async () => {
  const account = await import('./account');

  await account.getGoogleDriveConnectUrl();

  expect(invoke).toHaveBeenCalledWith(
    'google-drive-connect-url',
    expect.objectContaining({
      body: {
        redirectBase: 'mufathom://account',
      },
    })
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/_shared/google-integration.test.ts src/services/account.test.ts`

Expected: FAIL because the shared integration helper does not exist yet.

- [ ] **Step 3: Replace `google_drive_connections` reads and writes with `user_integrations`**

```ts
export function normalizeGrantedScopes(scope: string | null | undefined) {
  return (scope ?? '')
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function buildGoogleIntegrationSummary(row: GoogleIntegrationRow | null) {
  const scopes = row?.granted_scopes ?? [];
  const hasSheetsScope = scopes.includes('https://www.googleapis.com/auth/spreadsheets');

  return {
    status: row?.status === 'connected' ? 'connected' : 'not_connected',
    accountEmail: row?.account_email ?? null,
    connectedAt: row?.updated_at ?? null,
    saveFolderId: row?.drive_save_folder_id ?? null,
    saveFolderName: row?.drive_save_folder_name ?? null,
    needsReconnect: Boolean(row?.needs_reconnect) || !hasSheetsScope,
  };
}
```

```ts
const { error: upsertError } = await adminClient.from('user_integrations').upsert(
  {
    user_id: statePayload.userId,
    provider: 'google',
    status: 'connected',
    account_email: profile.email,
    granted_scopes: normalizeGrantedScopes(tokens.scope ?? env.googleDriveScope),
    encrypted_access_token: await encryptSecret(tokens.access_token, env.encryptionKey),
    encrypted_refresh_token: tokens.refresh_token
      ? await encryptSecret(tokens.refresh_token, env.encryptionKey)
      : existing?.encrypted_refresh_token ?? null,
    token_expires_at: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null,
    needs_reconnect: false,
    updated_at: new Date().toISOString(),
  },
  { onConflict: 'user_id,provider' }
);
```

```ts
const { data: integration } = await adminClient
  .from('user_integrations')
  .select('*')
  .eq('user_id', user.id)
  .eq('provider', 'google')
  .maybeSingle();

const summary = buildGoogleIntegrationSummary(integration);

await adminClient.auth.admin.updateUserById(user.id, {
  user_metadata: {
    ...(targetUser.user.user_metadata ?? {}),
    driveConnection: summary,
  },
});
```

Keep the shadow `user_metadata.driveConnection` write so `getAuthSession()` still shows connection state immediately after OAuth, but treat `user_integrations` as the source of truth for all Drive/Sheets tokens and folder state.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/_shared/google-integration.test.ts src/services/account.test.ts`

Expected: PASS with stable scope normalization and no client regression in the Google connect flow.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/google-integration.ts supabase/functions/_shared/google-integration.test.ts supabase/functions/_shared/drive-access.ts supabase/functions/_shared/google-sheets.ts supabase/functions/google-drive-connect-url/index.ts supabase/functions/google-drive-access-token/index.ts supabase/functions/google-drive-save-folder/index.ts supabase/functions/google-drive-folder-picker/index.ts supabase/functions/google-sheets-browser/index.ts supabase/functions/google-sheets-append-row/index.ts supabase/functions/google-sheets-ensure-layer-sheet/index.ts src/services/account.test.ts
git commit -m "feat: unify google integration storage"
```

### Task 3: Sync Preferences, Provider Configs, And Onboarding Through Cloud

**Files:**
- Create: `supabase/functions/user-settings-sync/index.ts`
- Modify: `supabase/config.toml`
- Modify: `src/services/settings.ts`
- Modify: `src/services/settings.test.ts`
- Modify: `src/services/bootstrap.ts`

- [ ] **Step 1: Write the failing settings-sync tests**

```ts
import { describe, expect, test, vi } from 'vitest';

vi.mock('./account', () => ({
  getAuthSession: vi.fn(async () => ({ accessToken: 'token', user: { id: 'user-1' } })),
}));

vi.mock('./cloudUserData', () => ({
  fetchCloudUserDataSnapshot: vi.fn(async () => ({
    profile: { displayName: 'Tarun', avatarUrl: null, timezone: null },
    preferences: {
      selectedTranscriptionProvider: 'openai',
      selectedSummaryProvider: 'groq',
      deleteUploadedAudio: true,
      modelCatalogUrl: '',
      hasSeenOnboarding: true,
    },
    providers: [
      {
        providerId: 'groq',
        apiKey: 'groq-key',
        baseUrl: 'https://api.groq.com/openai/v1',
        transcriptionModel: 'whisper-large-v3',
        summaryModel: 'llama-3.3-70b',
      },
    ],
    integrations: [],
    layers: [],
  })),
  saveCloudSettings: vi.fn(),
}));

test('hydrates local settings from cloud when the user is signed in', async () => {
  const { getAppSettings } = await import('./settings');

  await expect(getAppSettings()).resolves.toMatchObject({
    selectedSummaryProvider: 'groq',
    providers: {
      groq: expect.objectContaining({ apiKey: 'groq-key' }),
    },
  });
});
```

```ts
test('bootstrap refreshes cloud-backed preferences before onboarding is checked', async () => {
  const cloudSync = await import('./cloudUserData');
  const bootstrap = await import('./bootstrap');

  await bootstrap.bootstrapApp();

  expect(cloudSync.syncCloudUserDataCache).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/settings.test.ts`

Expected: FAIL because settings still read/write SQLite only and bootstrap never refreshes cloud-backed preferences.

- [ ] **Step 3: Add the settings-sync function and local-cache hydration**

```ts
export async function syncCloudUserDataCache() {
  const session = await getAuthSession();

  if (!session) {
    return null;
  }

  const snapshot = await fetchCloudUserDataSnapshot();
  await saveAppSettingsToLocalCache(mapBootstrapSnapshotToAppSettings(snapshot), {
    hasSeenOnboarding: snapshot.preferences.hasSeenOnboarding,
  });
  await replaceLocalExtractionLayers(mapBootstrapSnapshotToLayers(snapshot));
  return snapshot;
}
```

```ts
export async function getAppSettings(): Promise<AppSettings> {
  const cached = await getLocalAppSettings();

  try {
    const session = await getAuthSession();

    if (!session) {
      return cached;
    }

    const snapshot = await fetchCloudUserDataSnapshot();
    const next = mapBootstrapSnapshotToAppSettings(snapshot);
    await saveAppSettingsToLocalCache(next, {
      hasSeenOnboarding: snapshot.preferences.hasSeenOnboarding,
    });
    return next;
  } catch {
    return cached;
  }
}

export async function saveAppSettings(settings: AppSettings) {
  const sanitized = sanitizeAppSettings(settings);
  await saveAppSettingsToLocalCache(sanitized);

  const session = await getAuthSession();
  if (!session) {
    return;
  }

  await saveCloudSettings({
    selectedTranscriptionProvider: sanitized.selectedTranscriptionProvider,
    selectedSummaryProvider: sanitized.selectedSummaryProvider,
    deleteUploadedAudio: sanitized.deleteUploadedAudio,
    modelCatalogUrl: sanitized.modelCatalogUrl,
    providers: sanitized.providers,
  });
}
```

```ts
// src/services/bootstrap.ts
export async function bootstrapApp() {
  await initializeDatabase();
  await syncCloudUserDataCache();
  for (const directory of [AUDIO_DIR, MODEL_DIR]) {
    const info = await FileSystem.getInfoAsync(directory);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    }
  }
}
```

```toml
[functions.user-settings-sync]
verify_jwt = false
```

The `user-settings-sync` function should:
- resolve the authenticated user
- upsert `profiles` and `user_preferences`
- upsert one `user_provider_configs` row per provider
- encrypt `apiKey` into `encrypted_api_key`
- return the canonical saved provider rows with decrypted `apiKey` values so the client cache stays normalized

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/settings.test.ts`

Expected: PASS with cloud hydration winning when signed in and bootstrap refreshing onboarding state before the root layout checks it.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/user-settings-sync/index.ts supabase/config.toml src/services/settings.ts src/services/settings.test.ts src/services/bootstrap.ts
git commit -m "feat: sync app settings through supabase"
```

### Task 4: Sync Extraction Layers Through Supabase While Keeping SQLite As Cache

**Files:**
- Create: `supabase/functions/user-extraction-layers-sync/index.ts`
- Modify: `supabase/config.toml`
- Modify: `src/services/extractionLayers.ts`
- Modify: `src/services/extractionLayers.test.ts`
- Modify: `src/services/cloudUserData.ts`

- [ ] **Step 1: Write the failing extraction-layer sync tests**

```ts
import { describe, expect, test, vi } from 'vitest';

vi.mock('./account', () => ({
  getAuthSession: vi.fn(async () => ({ accessToken: 'token', user: { id: 'user-1' } })),
}));

vi.mock('./cloudUserData', () => ({
  listCloudExtractionLayers: vi.fn(async () => [
    {
      id: 'layer-1',
      name: 'Leads',
      spreadsheetId: 'spreadsheet-1',
      spreadsheetTitle: 'Leads tracker',
      sheetTitle: 'Inbound',
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z',
      fields: [{ id: 'company', title: 'Company', description: '' }],
    },
  ]),
  saveCloudExtractionLayer: vi.fn(async (layer) => layer),
  deleteCloudExtractionLayer: vi.fn(async () => undefined),
}));

test('lists cloud layers first when the user is signed in', async () => {
  const { listExtractionLayers } = await import('./extractionLayers');

  await expect(listExtractionLayers()).resolves.toMatchObject([
    { id: 'layer-1', spreadsheetId: 'spreadsheet-1', sheetTitle: 'Inbound' },
  ]);
});

test('keeps an existing sheet connection when editing a synced layer', async () => {
  const { saveExtractionLayer } = await import('./extractionLayers');

  await expect(
    saveExtractionLayer({
      id: 'layer-1',
      name: 'Leads',
      spreadsheetId: 'spreadsheet-1',
      spreadsheetTitle: 'Leads tracker',
      sheetTitle: 'Inbound',
      fields: [{ id: 'company', title: 'Company', description: '' }],
    })
  ).resolves.toMatchObject({
    spreadsheetId: 'spreadsheet-1',
    sheetTitle: 'Inbound',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/extractionLayers.test.ts`

Expected: FAIL because extraction layers still read/write local SQLite only.

- [ ] **Step 3: Add the cloud layer sync function and cache replacement helpers**

```ts
export async function listExtractionLayers(): Promise<ExtractionLayer[]> {
  const cached = await listLocalExtractionLayers();

  try {
    const session = await getAuthSession();
    if (!session) {
      return cached;
    }

    const cloudLayers = await listCloudExtractionLayers();
    await replaceLocalExtractionLayers(cloudLayers);
    return cloudLayers;
  } catch {
    return cached;
  }
}

export async function saveExtractionLayer(input: SaveExtractionLayerInput): Promise<ExtractionLayer> {
  const localSaved = await saveExtractionLayerToLocalCache(input);
  const session = await getAuthSession();

  if (!session) {
    return localSaved;
  }

  const cloudSaved = await saveCloudExtractionLayer(localSaved);
  await replaceLocalExtractionLayers([cloudSaved], { merge: true });
  return cloudSaved;
}

export async function deleteExtractionLayer(id: string) {
  await deleteExtractionLayerFromLocalCache(id);

  const session = await getAuthSession();
  if (!session) {
    return;
  }

  await deleteCloudExtractionLayer(id);
}
```

```ts
// supabase/functions/user-extraction-layers-sync/index.ts
if (request.method === 'GET') {
  return jsonResponse({ layers: await readUserLayers(adminClient, user.id) });
}

if (request.method === 'POST') {
  const body = (await request.json()) as SaveLayerPayload;
  await upsertUserLayer(adminClient, user.id, body);
  return jsonResponse({ layer: await readUserLayer(adminClient, user.id, body.id) });
}

if (request.method === 'DELETE') {
  const { layerId } = (await request.json()) as { layerId: string };
  await deleteUserLayer(adminClient, user.id, layerId);
  return jsonResponse({ ok: true });
}
```

```toml
[functions.user-extraction-layers-sync]
verify_jwt = false
```

Make sure `POST` fully rewrites the ordered field list for the target layer so the saved cloud copy exactly matches the editor’s field order and connected spreadsheet metadata.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/extractionLayers.test.ts`

Expected: PASS with signed-in reads preferring cloud data and updates preserving spreadsheet metadata.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/user-extraction-layers-sync/index.ts supabase/config.toml src/services/extractionLayers.ts src/services/extractionLayers.test.ts src/services/cloudUserData.ts
git commit -m "feat: sync extraction layers through supabase"
```

### Task 5: Verify The Whole Hybrid Sync Surface

**Files:**
- Modify: `src/services/account.ts`
- Modify: `src/services/account.test.ts`

- [ ] **Step 1: Add the final account/session regression test**

```ts
test('maps drive connection metadata without requiring legacy google_drive_connections rows', async () => {
  const account = await import('./account');

  await expect(account.getAuthSession()).resolves.toMatchObject({
    user: {
      driveConnection: expect.objectContaining({
        status: expect.stringMatching(/connected|not_connected/),
      }),
    },
  });
});
```

- [ ] **Step 2: Run the targeted regression suite**

Run: `npx vitest run src/services/account.test.ts src/services/settings.test.ts src/services/extractionLayers.test.ts supabase/functions/_shared/user-data.test.ts supabase/functions/_shared/google-integration.test.ts`

Expected: FAIL or PARTIAL PASS until the account session helper is updated to treat `driveConnection` as a shadow of `user_integrations`, not a sign that the old `google_drive_connections` table still matters.

- [ ] **Step 3: Tighten the account-session helper around the new source of truth**

```ts
function readDriveConnection(user: User): DriveConnection {
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const rawDriveConnection = metadata?.driveConnection;

  if (!rawDriveConnection || typeof rawDriveConnection !== 'object') {
    return {
      status: 'not_connected',
      accountEmail: null,
      connectedAt: null,
      saveFolderId: null,
      saveFolderName: null,
      needsReconnect: false,
    };
  }

  const connection = rawDriveConnection as Record<string, unknown>;

  return {
    status: connection.status === 'connected' ? 'connected' : 'not_connected',
    accountEmail: typeof connection.accountEmail === 'string' ? connection.accountEmail : null,
    connectedAt: typeof connection.connectedAt === 'string' ? connection.connectedAt : null,
    saveFolderId: typeof connection.saveFolderId === 'string' ? connection.saveFolderId : null,
    saveFolderName: typeof connection.saveFolderName === 'string' ? connection.saveFolderName : null,
    needsReconnect: connection.needsReconnect === true,
  };
}
```

Update the surrounding account-service comments to say the metadata copy is a convenience mirror of `user_integrations` instead of implying that Drive connection state lives primarily in Auth metadata.

- [ ] **Step 4: Run the full verification commands**

Run: `npm test`
Expected: PASS with the full Vitest suite green.

Run: `npx tsc --noEmit`
Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/services/account.ts src/services/account.test.ts
git commit -m "test: verify hybrid user data sync"
```
