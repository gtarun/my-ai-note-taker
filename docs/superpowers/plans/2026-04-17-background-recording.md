# Background Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make meeting recording continue while `mu-fathom` is backgrounded on iOS and Android, while keeping save/upload behavior intact and explicitly not supporting force-quit continuity.

**Architecture:** Keep native/background capability changes small by enabling `expo-audio` background recording in app config, then move recorder lifecycle out of `RecordScreen` into a module-level recording session service. The screen becomes a subscriber to session state, which lets it reconnect after background/foreground transitions without introducing a larger app-wide provider.

**Tech Stack:** Expo Router, `expo-audio`, React Native, TypeScript, Vitest

---

### Task 1: Enable Background Recording Configuration And Audio Mode Contracts

**Files:**
- Create: `src/services/recordingAudioMode.ts`
- Test: `src/services/recordingAudioMode.test.ts`
- Modify: `app.json`

- [ ] **Step 1: Write the failing audio-mode contract test**

```ts
import { describe, expect, test } from 'vitest';

import {
  getActiveRecordingAudioMode,
  getIdleRecordingAudioMode,
} from './recordingAudioMode';

describe('recordingAudioMode', () => {
  test('enables background-safe recording mode while capture is active', () => {
    expect(getActiveRecordingAudioMode()).toEqual({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      allowsRecording: true,
      shouldPlayInBackground: true,
      allowsBackgroundRecording: true,
      shouldRouteThroughEarpiece: false,
    });
  });

  test('restores non-recording mode after capture stops', () => {
    expect(getIdleRecordingAudioMode()).toEqual({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      allowsRecording: false,
      shouldPlayInBackground: false,
      allowsBackgroundRecording: false,
      shouldRouteThroughEarpiece: false,
    });
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails before implementation exists**

Run: `npx --yes vitest@3.2.4 run src/services/recordingAudioMode.test.ts`
Expected: FAIL with module-not-found or missing export errors for `recordingAudioMode`

- [ ] **Step 3: Implement the minimal recording audio-mode helpers**

```ts
import type { AudioMode } from 'expo-audio';

type RecordingAudioMode = Pick<
  AudioMode,
  | 'playsInSilentMode'
  | 'interruptionMode'
  | 'allowsRecording'
  | 'shouldPlayInBackground'
  | 'allowsBackgroundRecording'
  | 'shouldRouteThroughEarpiece'
>;

export function getActiveRecordingAudioMode(): RecordingAudioMode {
  return {
    playsInSilentMode: true,
    interruptionMode: 'duckOthers',
    allowsRecording: true,
    shouldPlayInBackground: true,
    allowsBackgroundRecording: true,
    shouldRouteThroughEarpiece: false,
  };
}

export function getIdleRecordingAudioMode(): RecordingAudioMode {
  return {
    playsInSilentMode: true,
    interruptionMode: 'duckOthers',
    allowsRecording: false,
    shouldPlayInBackground: false,
    allowsBackgroundRecording: false,
    shouldRouteThroughEarpiece: false,
  };
}
```

- [ ] **Step 4: Re-run the focused test to verify the contract passes**

Run: `npx --yes vitest@3.2.4 run src/services/recordingAudioMode.test.ts`
Expected: PASS

- [ ] **Step 5: Enable background recording in Expo config**

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      "expo-sqlite",
      "expo-secure-store",
      [
        "expo-audio",
        {
          "microphonePermission": "mu-fathom records meeting audio only when you explicitly start recording.",
          "enableBackgroundRecording": true
        }
      ],
      "expo-web-browser"
    ]
  }
}
```

- [ ] **Step 6: Commit the config + audio mode contract**

```bash
git add app.json src/services/recordingAudioMode.ts src/services/recordingAudioMode.test.ts
git commit -m "feat: enable background recording config"
```

### Task 2: Add A Shared Recording Session Service

**Files:**
- Create: `src/services/recordingSession.ts`
- Test: `src/services/recordingSession.test.ts`
- Reuse: `src/services/recordingAudioMode.ts`
- Reuse: `src/services/meetings.ts`
- Reuse: `src/services/googleDrive.ts`

- [ ] **Step 1: Write the failing session-service tests**

```ts
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getActiveRecordingAudioMode, getIdleRecordingAudioMode } from './recordingAudioMode';

const requestRecordingPermissionsAsync = vi.fn();
const setAudioModeAsync = vi.fn(async () => undefined);
const createMeetingFromRecording = vi.fn();
const uploadMeetingRecordingIfConfigured = vi.fn();

function makeRecorder() {
  let status = {
    canRecord: true,
    isRecording: false,
    durationMillis: 0,
    mediaServicesDidReset: false,
    url: 'file:///tmp/live.m4a',
  };

  return {
    uri: 'file:///tmp/live.m4a',
    prepareToRecordAsync: vi.fn(async () => undefined),
    record: vi.fn(() => {
      status = { ...status, isRecording: true };
    }),
    stop: vi.fn(async () => {
      status = { ...status, isRecording: false, durationMillis: 12_000 };
    }),
    getStatus: vi.fn(() => status),
  };
}

describe('recordingSession', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test('starts a background-capable recording session', async () => {
    requestRecordingPermissionsAsync.mockResolvedValue({ granted: true });
    const recorder = makeRecorder();

    const { createRecordingSession } = await import('./recordingSession');
    const session = createRecordingSession({
      requestRecordingPermissionsAsync,
      setAudioModeAsync,
      createRecorder: () => recorder,
      createMeetingFromRecording,
      uploadMeetingRecordingIfConfigured,
    });

    session.setTitleDraft('Founder sync');
    await session.startRecording();

    expect(setAudioModeAsync).toHaveBeenCalledWith(getActiveRecordingAudioMode());
    expect(recorder.prepareToRecordAsync).toHaveBeenCalled();
    expect(recorder.record).toHaveBeenCalled();
    expect(session.getSnapshot()).toMatchObject({
      phase: 'recording',
      titleDraft: 'Founder sync',
    });
  });

  test('stops, saves locally, restores idle audio mode, and returns the meeting id', async () => {
    requestRecordingPermissionsAsync.mockResolvedValue({ granted: true });
    createMeetingFromRecording.mockResolvedValue({ id: 'meeting-42', audioUri: 'file:///app/meeting-42.m4a' });
    uploadMeetingRecordingIfConfigured.mockResolvedValue('skipped');

    const recorder = makeRecorder();

    const { createRecordingSession } = await import('./recordingSession');
    const session = createRecordingSession({
      requestRecordingPermissionsAsync,
      setAudioModeAsync,
      createRecorder: () => recorder,
      createMeetingFromRecording,
      uploadMeetingRecordingIfConfigured,
    });

    session.setTitleDraft('Hiring debrief');
    await session.startRecording();

    await expect(session.stopAndSave()).resolves.toEqual({
      meetingId: 'meeting-42',
      audioUri: 'file:///app/meeting-42.m4a',
      driveOutcome: 'skipped',
    });

    expect(setAudioModeAsync).toHaveBeenLastCalledWith(getIdleRecordingAudioMode());
    expect(createMeetingFromRecording).toHaveBeenCalledWith({
      uri: 'file:///tmp/live.m4a',
      title: 'Hiring debrief',
      durationMs: 12_000,
    });
    expect(session.getSnapshot().phase).toBe('idle');
  });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail before the service exists**

Run: `npx --yes vitest@3.2.4 run src/services/recordingSession.test.ts`
Expected: FAIL with module-not-found or missing export errors for `recordingSession`

- [ ] **Step 3: Implement the minimal recording session service**

```ts
import { AudioModule, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';

import { uploadMeetingRecordingIfConfigured } from './googleDrive';
import { createMeetingFromRecording } from './meetings';
import { getActiveRecordingAudioMode, getIdleRecordingAudioMode } from './recordingAudioMode';

type RecorderLike = {
  uri: string | null;
  prepareToRecordAsync(): Promise<void>;
  record(): void;
  stop(): Promise<void>;
  getStatus(): {
    canRecord: boolean;
    isRecording: boolean;
    durationMillis: number;
    mediaServicesDidReset: boolean;
    url: string | null;
  };
};

export type RecordingSessionSnapshot = {
  phase: 'idle' | 'recording' | 'saving' | 'error';
  titleDraft: string;
  durationMillis: number;
  errorMessage: string | null;
};

type RecordingSessionDeps = {
  requestRecordingPermissionsAsync: typeof requestRecordingPermissionsAsync;
  setAudioModeAsync: typeof setAudioModeAsync;
  createRecorder: () => RecorderLike;
  createMeetingFromRecording: typeof createMeetingFromRecording;
  uploadMeetingRecordingIfConfigured: typeof uploadMeetingRecordingIfConfigured;
};

export function createRecordingSession(deps: RecordingSessionDeps = {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  createRecorder: () => new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY),
  createMeetingFromRecording,
  uploadMeetingRecordingIfConfigured,
}) {
  let recorder: RecorderLike | null = null;
  let pollHandle: ReturnType<typeof setInterval> | null = null;
  let snapshot: RecordingSessionSnapshot = {
    phase: 'idle',
    titleDraft: '',
    durationMillis: 0,
    errorMessage: null,
  };
  const listeners = new Set<() => void>();

  function emit() {
    listeners.forEach((listener) => listener());
  }

  function update(next: Partial<RecordingSessionSnapshot>) {
    snapshot = { ...snapshot, ...next };
    emit();
  }

  function syncFromRecorder() {
    if (!recorder) {
      return;
    }

    const status = recorder.getStatus();
    update({
      durationMillis: status.durationMillis,
      phase: status.isRecording ? 'recording' : snapshot.phase,
    });
  }

  function startPolling() {
    stopPolling();
    pollHandle = setInterval(syncFromRecorder, 500);
  }

  function stopPolling() {
    if (pollHandle) {
      clearInterval(pollHandle);
      pollHandle = null;
    }
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
    setTitleDraft(titleDraft: string) {
      update({ titleDraft });
    },
    async startRecording() {
      const permission = await deps.requestRecordingPermissionsAsync();

      if (!permission.granted) {
        throw new Error('Enable microphone access to record a meeting.');
      }

      recorder ??= deps.createRecorder();

      await deps.setAudioModeAsync(getActiveRecordingAudioMode());
      await recorder.prepareToRecordAsync();
      recorder.record();
      syncFromRecorder();
      startPolling();
      update({ phase: 'recording', errorMessage: null });
    },
    async stopAndSave() {
      if (!recorder) {
        throw new Error('No recording is active.');
      }

      update({ phase: 'saving', errorMessage: null });
      await recorder.stop();
      stopPolling();
      await deps.setAudioModeAsync(getIdleRecordingAudioMode());

      const status = recorder.getStatus();
      const uri = recorder.uri ?? status.url;

      if (!uri) {
        update({ phase: 'error', errorMessage: 'Recording finished but no file was returned.' });
        throw new Error('Recording finished but no file was returned.');
      }

      const meetingTitle = snapshot.titleDraft.trim() || 'Untitled recording';
      const meeting = await deps.createMeetingFromRecording({
        uri,
        title: meetingTitle,
        durationMs: status.durationMillis,
      });
      const driveOutcome = await deps.uploadMeetingRecordingIfConfigured({
        title: meetingTitle,
        localAudioUri: meeting.audioUri,
      });

      recorder = null;
      update({
        phase: 'idle',
        titleDraft: '',
        durationMillis: 0,
        errorMessage: null,
      });

      return {
        meetingId: meeting.id,
        audioUri: meeting.audioUri,
        driveOutcome,
      };
    },
  };
}

export const recordingSession = createRecordingSession();
```

- [ ] **Step 4: Re-run the focused tests to verify the service passes**

Run: `npx --yes vitest@3.2.4 run src/services/recordingSession.test.ts`
Expected: PASS

- [ ] **Step 5: Add the error-path regression test before handling recorder failures**

```ts
test('returns to error state when the recorder stops without a file url', async () => {
  requestRecordingPermissionsAsync.mockResolvedValue({ granted: true });
  const recorder = makeRecorder();
  recorder.uri = null;
  recorder.getStatus = vi.fn(() => ({
    canRecord: true,
    isRecording: false,
    durationMillis: 12_000,
    mediaServicesDidReset: false,
    url: null,
  }));

  const { createRecordingSession } = await import('./recordingSession');
  const session = createRecordingSession({
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    createRecorder: () => recorder,
    createMeetingFromRecording,
    uploadMeetingRecordingIfConfigured,
  });

  await session.startRecording();

  await expect(session.stopAndSave()).rejects.toThrow('Recording finished but no file was returned.');
  expect(session.getSnapshot()).toMatchObject({
    phase: 'error',
    errorMessage: 'Recording finished but no file was returned.',
  });
});
```

- [ ] **Step 6: Run the focused test to verify it fails before error handling is completed**

Run: `npx --yes vitest@3.2.4 run src/services/recordingSession.test.ts -t "returns to error state when the recorder stops without a file url"`
Expected: FAIL if the service falls back to idle instead of preserving error state

- [ ] **Step 7: Tighten the service so thrown stop/save errors remain visible**

```ts
    async stopAndSave() {
      if (!recorder) {
        throw new Error('No recording is active.');
      }

      update({ phase: 'saving', errorMessage: null });

      try {
        await recorder.stop();
        stopPolling();
        await deps.setAudioModeAsync(getIdleRecordingAudioMode());

        const status = recorder.getStatus();
        const uri = recorder.uri ?? status.url;

        if (!uri) {
          throw new Error('Recording finished but no file was returned.');
        }

        const meetingTitle = snapshot.titleDraft.trim() || 'Untitled recording';
        const meeting = await deps.createMeetingFromRecording({
          uri,
          title: meetingTitle,
          durationMs: status.durationMillis,
        });
        const driveOutcome = await deps.uploadMeetingRecordingIfConfigured({
          title: meetingTitle,
          localAudioUri: meeting.audioUri,
        });

        recorder = null;
        update({ phase: 'idle', titleDraft: '', durationMillis: 0, errorMessage: null });

        return {
          meetingId: meeting.id,
          audioUri: meeting.audioUri,
          driveOutcome,
        };
      } catch (error) {
        update({
          phase: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unable to save recording.',
        });
        throw error;
      }
    },
```

- [ ] **Step 8: Re-run the full session test file**

Run: `npx --yes vitest@3.2.4 run src/services/recordingSession.test.ts`
Expected: PASS

- [ ] **Step 9: Commit the recording session service**

```bash
git add src/services/recordingSession.ts src/services/recordingSession.test.ts
git commit -m "feat: add shared recording session service"
```

### Task 3: Rewire Record Screen To The Shared Session And Update Product Copy

**Files:**
- Create: `src/features/recording/presentation.ts`
- Test: `src/features/recording/presentation.test.ts`
- Modify: `src/screens/RecordScreen.tsx`
- Reuse: `src/services/recordingSession.ts`
- Reuse: `src/features/meetings/navigation.ts`
- Reuse: `src/navigation/routes.ts`

- [ ] **Step 1: Write the failing presentation test for the new background-recording copy**

```ts
import { describe, expect, test } from 'vitest';

import {
  getRecordingNoticeBody,
  getRecordingStatusLabel,
  getRecordingSupportLabel,
} from './presentation';

describe('recording presentation', () => {
  test('describes background-safe recording before capture starts', () => {
    expect(getRecordingNoticeBody()).toBe(
      'Recording keeps running while the app is in the background. If you force-quit the app, the session can be lost.'
    );
  });

  test('describes the live state after returning from background', () => {
    expect(getRecordingStatusLabel(true)).toBe('Recording in progress');
    expect(getRecordingSupportLabel()).toBe('Phone mic, background recording enabled');
  });
});
```

- [ ] **Step 2: Run the focused presentation test to verify it fails**

Run: `npx --yes vitest@3.2.4 run src/features/recording/presentation.test.ts`
Expected: FAIL with module-not-found or missing export errors for `presentation`

- [ ] **Step 3: Implement the minimal presentation helper**

```ts
export function getRecordingNoticeBody() {
  return 'Recording keeps running while the app is in the background. If you force-quit the app, the session can be lost.';
}

export function getRecordingStatusLabel(isRecording: boolean) {
  return isRecording ? 'Recording in progress' : 'Ready to record';
}

export function getRecordingSupportLabel() {
  return 'Phone mic, background recording enabled';
}
```

- [ ] **Step 4: Re-run the focused presentation test**

Run: `npx --yes vitest@3.2.4 run src/features/recording/presentation.test.ts`
Expected: PASS

- [ ] **Step 5: Replace screen-local recorder state with the shared recording session**

```tsx
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FadeInView } from '../components/FadeInView';
import { ScreenBackground } from '../components/ScreenBackground';
import {
  getRecordingNoticeBody,
  getRecordingStatusLabel,
  getRecordingSupportLabel,
} from '../features/recording/presentation';
import { getMeetingDetailEntryMethod } from '../features/meetings/navigation';
import { getMeetingDetailRoute } from '../navigation/routes';
import { recordingSession } from '../services/recordingSession';
import { formatDuration } from '../utils/format';
import { elevation, palette } from '../theme';

export default function RecordScreen() {
  const [session, setSession] = useState(recordingSession.getSnapshot());

  useEffect(() => {
    return recordingSession.subscribe(() => {
      setSession(recordingSession.getSnapshot());
    });
  }, []);

  const handleRecordToggle = async () => {
    if (session.phase === 'recording') {
      try {
        const result = await recordingSession.stopAndSave();

        if (result.driveOutcome === 'failed') {
          Alert.alert(
            'Google Drive',
            'The recording is saved on this device, but uploading to Google Drive failed. Check your connection and folder settings on the Account screen.'
          );
        }

        const detailRoute = getMeetingDetailRoute(result.meetingId);
        if (getMeetingDetailEntryMethod() === 'push') {
          router.push(detailRoute);
        } else {
          router.replace(detailRoute);
        }
      } catch (error) {
        Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save recording.');
      }

      return;
    }

    try {
      await recordingSession.startRecording();
    } catch (error) {
      Alert.alert('Recording failed', error instanceof Error ? error.message : 'Unable to start recording.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <FadeInView style={styles.notice}>
          <View style={styles.noticeHeader}>
            <Feather name="shield" size={16} color={palette.ink} />
            <Text style={styles.noticeTitle}>Recording behavior</Text>
          </View>
          <Text style={styles.noticeBody}>{getRecordingNoticeBody()}</Text>
        </FadeInView>

        <FadeInView style={styles.card} delay={70}>
          <Text style={styles.label}>Meeting title</Text>
          <TextInput
            style={styles.input}
            placeholder="Founder sync, user interview, standup..."
            placeholderTextColor={palette.mutedInk}
            value={session.titleDraft}
            onChangeText={(value) => recordingSession.setTitleDraft(value)}
          />

          <View style={styles.timerWrap}>
            <View style={styles.liveChip}>
              {session.phase === 'recording' ? (
                <MaterialCommunityIcons name="record-circle" size={14} color={palette.danger} />
              ) : (
                <Feather name="mic" size={13} color={palette.lineStrong} />
              )}
              <Text style={styles.liveChipText}>{getRecordingStatusLabel(session.phase === 'recording')}</Text>
            </View>
            <Text style={styles.timerValue}>{formatDuration(session.durationMillis)}</Text>
            <Text style={styles.timerLabel}>{getRecordingSupportLabel()}</Text>
          </View>

          <Pressable
            style={[styles.recordButton, session.phase === 'recording' && styles.recordButtonActive]}
            onPress={handleRecordToggle}
            disabled={session.phase === 'saving'}
          >
            <MaterialCommunityIcons
              name={session.phase === 'recording' ? 'stop-circle-outline' : 'microphone-outline'}
              size={20}
              color={palette.paper}
            />
            <Text style={styles.recordButtonText}>
              {session.phase === 'saving' ? 'Saving...' : session.phase === 'recording' ? 'Stop and save' : 'Start recording'}
            </Text>
          </Pressable>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 6: Run the affected tests after the screen integration**

Run: `npx --yes vitest@3.2.4 run src/services/recordingAudioMode.test.ts src/services/recordingSession.test.ts src/features/recording/presentation.test.ts`
Expected: PASS

- [ ] **Step 7: Run the full test suite for regression coverage**

Run: `npx --yes vitest@3.2.4 run`
Expected: PASS

- [ ] **Step 8: Commit the screen integration**

```bash
git add src/features/recording/presentation.ts src/features/recording/presentation.test.ts src/screens/RecordScreen.tsx
git commit -m "feat: keep recordings running in background"
```

### Task 4: Native Build And Device Verification

**Files:**
- Reuse: `app.json`
- Reuse: `ios/Podfile`
- Reuse: Android generated project from Expo prebuild/run commands

- [ ] **Step 1: Refresh native projects after enabling the Expo audio plugin options**

Run: `npx expo prebuild --platform ios --platform android`
Expected: SUCCESS with regenerated native config reflecting background-audio capability and Android microphone foreground-service permissions

- [ ] **Step 2: Build the iOS app locally**

Run: `npx expo run:ios`
Expected: App builds and launches without `expo-audio` config/plugin errors

- [ ] **Step 3: Build the Android app locally**

Run: `npx expo run:android`
Expected: App builds and launches without foreground-service permission errors

- [ ] **Step 4: Verify the background recording flow on a real iPhone**

Manual check:

1. Start a recording
2. Lock the device and wait at least 15 seconds
3. Unlock and confirm the duration advanced
4. Switch to another app
5. Return and confirm the recording is still active
6. Stop and confirm the meeting saves

Expected: recording survives backgrounding while the app remains alive

- [ ] **Step 5: Verify the background recording flow on a real Android device**

Manual check:

1. Start a recording
2. Background the app and confirm the persistent recording notification appears
3. Wait at least 15 seconds with the screen off
4. Return to the app and confirm the duration advanced
5. Stop and confirm the meeting saves

Expected: recording survives backgrounding and Android shows the required ongoing notification

- [ ] **Step 6: Verify the explicit out-of-scope behavior**

Manual check:

1. Start a recording
2. Force-quit/swipe away the app
3. Reopen the app

Expected: no continuity guarantee; the product does not pretend the old session survived process death
