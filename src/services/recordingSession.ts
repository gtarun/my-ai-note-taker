import {
  AudioModule,
  type AudioRecorder,
  type PermissionResponse,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

import { uploadMeetingRecordingIfConfigured } from './googleDrive';
import { createMeetingFromRecording } from './meetings';
import { getActiveRecordingAudioMode, getIdleRecordingAudioMode } from './recordingAudioMode';

type RecordingPhase = 'idle' | 'recording' | 'saving' | 'error';

type RecordingSessionSnapshot = {
  phase: RecordingPhase;
  titleDraft: string;
  durationMillis: number;
  errorMessage: string | null;
};

type Listener = (snapshot: RecordingSessionSnapshot) => void;

type SaveResult = {
  meetingId: string;
  audioUri: string;
  driveOutcome: 'skipped' | 'uploaded' | 'failed';
};

type RecorderLike = Pick<AudioRecorder, 'currentTime' | 'uri' | 'prepareToRecordAsync' | 'record' | 'stop'> & {
  url?: string | null;
};

type RecordingSessionDeps = {
  requestRecordingPermissionsAsync: () => Promise<PermissionResponse>;
  setAudioModeAsync: (mode: ReturnType<typeof getActiveRecordingAudioMode>) => Promise<void>;
  createRecorder: () => RecorderLike;
  createMeetingFromRecording: typeof createMeetingFromRecording;
  uploadMeetingRecordingIfConfigured: typeof uploadMeetingRecordingIfConfigured;
  setInterval: typeof globalThis.setInterval;
  clearInterval: typeof globalThis.clearInterval;
  now: () => number;
};

export type { RecordingSessionSnapshot, SaveResult };

function getDefaultTitle(now: () => number) {
  const iso = new Date(now()).toISOString().slice(0, 16).replace('T', ' ');
  return `Recording ${iso}`;
}

function createDefaultDeps(): RecordingSessionDeps {
  return {
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    createRecorder: () => new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY),
    createMeetingFromRecording,
    uploadMeetingRecordingIfConfigured,
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
    now: Date.now,
  };
}

function getRecorderFileUri(recorder: RecorderLike) {
  const candidate = recorder.uri ?? recorder.url ?? null;
  const normalized = candidate?.trim();
  return normalized ? normalized : null;
}

export function createRecordingSession(overrides: Partial<RecordingSessionDeps> = {}) {
  const deps = { ...createDefaultDeps(), ...overrides } satisfies RecordingSessionDeps;

  let snapshot: RecordingSessionSnapshot = {
    phase: 'idle',
    titleDraft: '',
    durationMillis: 0,
    errorMessage: null,
  };
  let startInFlight = false;
  let recorder: RecorderLike | null = null;
  let pollHandle: ReturnType<typeof globalThis.setInterval> | null = null;
  const listeners = new Set<Listener>();

  function emit() {
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function updateSnapshot(next: Partial<RecordingSessionSnapshot>) {
    snapshot = { ...snapshot, ...next };
    emit();
  }

  function ensureRecorder() {
    if (!recorder) {
      recorder = deps.createRecorder();
    }

    return recorder;
  }

  function stopPolling() {
    if (pollHandle !== null) {
      deps.clearInterval(pollHandle);
      pollHandle = null;
    }
  }

  function startPolling() {
    stopPolling();
    pollHandle = deps.setInterval(() => {
      if (!recorder) {
        return;
      }

      updateSnapshot({
        durationMillis: Math.max(0, Math.round(recorder.currentTime * 1000)),
      });
    }, 500);
  }

  function getCurrentTitle() {
    return snapshot.titleDraft.trim() || getDefaultTitle(deps.now);
  }

  function ensureStartablePhase() {
    if (snapshot.phase === 'idle' || snapshot.phase === 'error') {
      return;
    }

    const message = `Cannot start a recording while the session is ${snapshot.phase}.`;
    updateSnapshot({
      errorMessage: message,
    });
    throw new Error(message);
  }

  async function transitionToError(error: unknown): Promise<never> {
    stopPolling();
    const message = error instanceof Error ? error.message : 'Unable to save recording.';
    updateSnapshot({
      phase: 'error',
      errorMessage: message,
    });
    throw error instanceof Error ? error : new Error(message);
  }

  async function transitionStartFailure(error: unknown, shouldRestoreIdleMode: boolean): Promise<never> {
    let pendingError = error;
    stopPolling();
    recorder = null;

    if (shouldRestoreIdleMode) {
      try {
        await deps.setAudioModeAsync(getIdleRecordingAudioMode());
      } catch (audioModeError) {
        pendingError ??= audioModeError;
      }
    }

    return transitionToError(pendingError);
  }

  return {
    getSnapshot() {
      return snapshot;
    },

    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    setTitleDraft(title: string) {
      updateSnapshot({
        titleDraft: title,
      });
    },

    async startRecording() {
      if (startInFlight) {
        const message = 'Cannot start a recording while another start is in progress.';
        updateSnapshot({
          errorMessage: message,
        });
        throw new Error(message);
      }

      ensureStartablePhase();
      startInFlight = true;
      let shouldRestoreIdleMode = false;

      try {
        const permission = await deps.requestRecordingPermissionsAsync();

        if (!permission.granted) {
          throw new Error('Microphone permission is required to record audio.');
        }

        const activeRecorder = ensureRecorder();

        await deps.setAudioModeAsync(getActiveRecordingAudioMode());
        shouldRestoreIdleMode = true;
        await activeRecorder.prepareToRecordAsync();
        activeRecorder.record();
        updateSnapshot({
          phase: 'recording',
          durationMillis: 0,
          errorMessage: null,
        });
        startPolling();
      } catch (error) {
        return transitionStartFailure(error, shouldRestoreIdleMode);
      } finally {
        startInFlight = false;
      }
    },

    async stopAndSave(): Promise<SaveResult> {
      if (startInFlight) {
        throw new Error('Cannot stop and save while a recording start is in progress.');
      }

      if (snapshot.phase === 'saving') {
        const message = 'Cannot stop and save while a recording is already being saved.';
        updateSnapshot({
          errorMessage: message,
        });
        throw new Error(message);
      }

      if (!recorder) {
        return transitionToError(new Error('No recording is in progress.'));
      }

      const activeRecorder = recorder;
      stopPolling();
      updateSnapshot({
        phase: 'saving',
        durationMillis: Math.max(0, Math.round(activeRecorder.currentTime * 1000)),
        errorMessage: null,
      });

      let pendingError: unknown = null;

      try {
        await activeRecorder.stop();

        const title = getCurrentTitle();
        const uri = getRecorderFileUri(activeRecorder);

        if (!uri) {
          throw new Error('Recording file was unavailable after stopping.');
        }

        const meeting = await deps.createMeetingFromRecording({
          uri,
          title,
          durationMs: snapshot.durationMillis,
        });
        const driveOutcome = await deps.uploadMeetingRecordingIfConfigured({
          title,
          localAudioUri: meeting.audioUri,
        });

        updateSnapshot({
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
      } catch (error) {
        pendingError = error;
      } finally {
        recorder = null;

        try {
          await deps.setAudioModeAsync(getIdleRecordingAudioMode());
        } catch (audioModeError) {
          pendingError ??= audioModeError;
        }
      }

      return transitionToError(pendingError);
    },
  };
}

export const recordingSession = createRecordingSession();
