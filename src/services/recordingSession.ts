import {
  AudioModule,
  type AudioRecorder,
  type PermissionResponse,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

import { uploadMeetingRecordingIfConfigured } from './googleDrive';
import {
  addLivePartialTranscriptListener,
  cancelLiveTranscription,
  resolveTranscriptionPlan,
  startLiveTranscription,
  stopLiveTranscription,
  supportsLiveTranscription,
} from './localInference';
import { getInstalledModels } from './localModels';
import { createMeetingFromRecording } from './meetings';
import { getActiveRecordingAudioMode, getIdleRecordingAudioMode } from './recordingAudioMode';
import { getAppSettings } from './settings';

type RecordingPhase = 'idle' | 'recording' | 'saving' | 'error';

type RecordingSessionSnapshot = {
  phase: RecordingPhase;
  titleDraft: string;
  durationMillis: number;
  errorMessage: string | null;
  /** Running text from the live recognizer; empty when streaming isn't
   *  available or the session hasn't started. Updated many times per second. */
  liveTranscript: string;
  /** True when the platform supports streaming partials and JS is subscribed.
   *  Used by the UI to decide whether to render the live caption pane. */
  liveTranscriptionEnabled: boolean;
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

type LiveTranscriptionDeps = {
  supportsLiveTranscription: typeof supportsLiveTranscription;
  startLiveTranscription: typeof startLiveTranscription;
  stopLiveTranscription: typeof stopLiveTranscription;
  cancelLiveTranscription: typeof cancelLiveTranscription;
  addLivePartialTranscriptListener: typeof addLivePartialTranscriptListener;
  /** Reads user settings to know the chosen transcription locale + model. */
  getAppSettings: typeof getAppSettings;
  /** Reads installed local models so the plan resolver can pick a viable
   *  whisper variant when the locale demands one. */
  getInstalledModels: typeof getInstalledModels;
};

type RecordingSessionDeps = LiveTranscriptionDeps & {
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
    supportsLiveTranscription,
    startLiveTranscription,
    stopLiveTranscription,
    cancelLiveTranscription,
    addLivePartialTranscriptListener,
    getAppSettings,
    getInstalledModels,
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
    liveTranscript: '',
    liveTranscriptionEnabled: false,
  };
  let startInFlight = false;
  let recorder: RecorderLike | null = null;
  let pollHandle: ReturnType<typeof globalThis.setInterval> | null = null;
  /** Disposes the partial-transcript subscription. Set when live transcription
   *  starts; cleared on stop/cancel/error. */
  let livePartialUnsubscribe: (() => void) | null = null;
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

  /**
   * Best-effort kickoff of the live transcription pipeline. Always swallows
   * errors — recording itself must never fail because the live recognizer
   * couldn't start (permission denied, locale unsupported, audio session
   * conflict, etc.). On failure, post-stop transcription still runs as today.
   */
  async function startLiveTranscriptionIfSupported() {
    if (!deps.supportsLiveTranscription()) {
      updateSnapshot({ liveTranscript: '', liveTranscriptionEnabled: false });
      return;
    }

    // Only kick off Apple Speech streaming when the user's chosen locale is
    // actually offline-supported by Apple Speech. For "Auto / Mixed",
    // Punjabi, or any locale that requires whisper, skip live — whisper
    // doesn't stream, so we wait for post-stop transcription instead.
    let appleSpeechLocale: string | null = null;
    try {
      const [settings, installed] = await Promise.all([
        deps.getAppSettings(),
        deps.getInstalledModels(),
      ]);
      const plan = resolveTranscriptionPlan({
        selectedModelId: settings.providers.local.transcriptionModel,
        locale: settings.transcriptionLocale,
        installedModelIds: installed.map((row) => row.id),
      });
      if (!plan.liveSupported || !plan.appleSpeechLocale) {
        updateSnapshot({ liveTranscript: '', liveTranscriptionEnabled: false });
        return;
      }
      appleSpeechLocale = plan.appleSpeechLocale;
    } catch {
      // If settings can't be read, fall back to defaulting Apple Speech
      // en-US — same behavior as before settings were a thing.
      appleSpeechLocale = 'en-US';
    }

    try {
      livePartialUnsubscribe = deps.addLivePartialTranscriptListener((transcript) => {
        // Only surface partials while the recording is actually active. Late
        // events after stop are ignored so we don't overwrite the final
        // transcript caller code uses.
        if (snapshot.phase === 'recording') {
          updateSnapshot({ liveTranscript: transcript });
        }
      });
      await deps.startLiveTranscription({ locale: appleSpeechLocale });
      updateSnapshot({ liveTranscript: '', liveTranscriptionEnabled: true });
    } catch {
      tearDownLivePartialSubscription();
      updateSnapshot({ liveTranscript: '', liveTranscriptionEnabled: false });
    }
  }

  function tearDownLivePartialSubscription() {
    if (livePartialUnsubscribe) {
      try {
        livePartialUnsubscribe();
      } catch {
        // best-effort
      }
      livePartialUnsubscribe = null;
    }
  }

  /**
   * Stop the live recognizer and return whatever final transcript it
   * produced. Returns an empty string when streaming wasn't running or the
   * recognizer errored mid-stream — callers fall back to post-stop
   * transcription in that case.
   */
  async function stopLiveTranscriptionAndCollect(): Promise<string> {
    if (!snapshot.liveTranscriptionEnabled) {
      return '';
    }

    try {
      const finalTranscript = await deps.stopLiveTranscription();
      return finalTranscript.trim();
    } catch {
      return '';
    } finally {
      tearDownLivePartialSubscription();
    }
  }

  async function cancelLiveTranscriptionSilently() {
    if (!snapshot.liveTranscriptionEnabled && !livePartialUnsubscribe) {
      return;
    }
    try {
      await deps.cancelLiveTranscription();
    } catch {
      // best-effort
    } finally {
      tearDownLivePartialSubscription();
    }
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
    await cancelLiveTranscriptionSilently();
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
          liveTranscript: '',
        });
        startPolling();
        // Kick off streaming after the recorder is rolling — the audio
        // session is fully active by this point so the parallel mic tap
        // has the best chance of attaching cleanly.
        await startLiveTranscriptionIfSupported();
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
      // Snapshot the rolling partial as a fallback in case the recognizer's
      // final-flush errors after audio stops.
      const fallbackLiveTranscript = snapshot.liveTranscript.trim();

      try {
        await activeRecorder.stop();

        // Stop the recognizer right after the recorder. Its resultHandler
        // gets one last fire with isFinal=true once endAudio() drains.
        const finalLiveTranscript = await stopLiveTranscriptionAndCollect();
        const liveTranscript = finalLiveTranscript || fallbackLiveTranscript;

        const title = getCurrentTitle();
        const uri = getRecorderFileUri(activeRecorder);

        if (!uri) {
          throw new Error('Recording file was unavailable after stopping.');
        }

        const meeting = await deps.createMeetingFromRecording({
          uri,
          title,
          durationMs: snapshot.durationMillis,
          // Empty string is meaningful: "live ran but produced no text" vs.
          // "live wasn't supported" — both safely fall back to post-stop
          // transcription. We pass through whatever we got.
          preTranscribedText: liveTranscript || null,
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
          liveTranscript: '',
          liveTranscriptionEnabled: false,
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
        // If anything threw above, the recognizer may still be running —
        // make sure it's torn down before we transition to error.
        await cancelLiveTranscriptionSilently();

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
