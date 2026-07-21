import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getActiveRecordingAudioMode, getIdleRecordingAudioMode } from './recordingAudioMode';

const { defaultRequestRecordingPermissionsAsync, defaultSetAudioModeAsync } = vi.hoisted(() => ({
  defaultRequestRecordingPermissionsAsync: vi.fn(async () => ({ granted: true })),
  defaultSetAudioModeAsync: vi.fn(async () => undefined),
}));

vi.mock('expo-audio', () => ({
  AudioModule: {
    AudioRecorder: class AudioRecorder {
      currentTime = 0;
      uri = null;
      async prepareToRecordAsync() {}
      record() {}
      async stop() {}
    },
  },
  RecordingPresets: {
    HIGH_QUALITY: {},
  },
  requestRecordingPermissionsAsync: defaultRequestRecordingPermissionsAsync,
  setAudioModeAsync: defaultSetAudioModeAsync,
}));

vi.mock('./meetings', () => ({
  createMeetingFromRecording: vi.fn(),
}));

vi.mock('./googleDrive', () => ({
  uploadMeetingRecordingIfConfigured: vi.fn(),
}));

vi.mock('./localInference', () => ({
  // Default to "no live transcription" so existing tests behave exactly as
  // before. Tests that exercise the live-transcription path can override
  // these via the deps argument to createRecordingSession.
  supportsLiveTranscription: vi.fn(() => false),
  startLiveTranscription: vi.fn(async () => undefined),
  stopLiveTranscription: vi.fn(async () => ''),
  cancelLiveTranscription: vi.fn(async () => undefined),
  addLivePartialTranscriptListener: vi.fn(() => () => undefined),
  resolveTranscriptionPlan: vi.fn(() => ({
    modelId: 'apple-speech-recognizer',
    appleSpeechLocale: 'en-US',
    whisperLanguage: null,
    liveSupported: true,
  })),
}));

vi.mock('./settings', () => ({
  getAppSettings: vi.fn(async () => ({
    selectedTranscriptionProvider: 'local',
    selectedSummaryProvider: 'openai',
    providers: {
      local: { apiKey: '', baseUrl: '', transcriptionModel: 'apple-speech-recognizer', summaryModel: '' },
    },
    transcriptionLocale: 'en-US',
    deleteUploadedAudio: false,
    modelCatalogUrl: '',
  })),
}));

vi.mock('./localModels', () => ({
  getInstalledModels: vi.fn(async () => []),
}));

type RecorderDouble = {
  currentTime: number;
  uri: string | null;
  prepareToRecordAsync: ReturnType<typeof vi.fn>;
  record: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
};

function createRecorderDouble(): RecorderDouble {
  return {
    currentTime: 0,
    uri: 'file:///recordings/session.m4a',
    prepareToRecordAsync: vi.fn(async () => undefined),
    record: vi.fn(() => undefined),
    stop: vi.fn(async function (this: RecorderDouble) {
      this.uri = 'file:///recordings/session.m4a';
    }),
  };
}

describe('recording session service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('starts a background-capable recording session', async () => {
    const permissionResponse = { granted: true };
    const requestPermission = vi.fn(async () => permissionResponse);
    const setAudioMode = vi.fn(async () => undefined);
    const recorder = createRecorderDouble();
    const createRecorder = vi.fn(() => recorder);

    const { createRecordingSession } = await import('./recordingSession');
    const session = createRecordingSession({
      requestRecordingPermissionsAsync: requestPermission,
      setAudioModeAsync: setAudioMode,
      createRecorder,
      createMeetingFromRecording: vi.fn(),
      uploadMeetingRecordingIfConfigured: vi.fn(),
      now: () => 0,
      setInterval: vi.fn((callback: () => void) => {
        callback();
        return 1;
      }),
      clearInterval: vi.fn(),
    });

    session.setTitleDraft('Field interview');
    const snapshots: ReturnType<typeof session.getSnapshot>[] = [];
    const unsubscribe = session.subscribe((snapshot) => {
      snapshots.push(snapshot);
    });

    await session.startRecording();

    expect(requestPermission).toHaveBeenCalled();
    expect(createRecorder).toHaveBeenCalledTimes(1);
    expect(setAudioMode).toHaveBeenCalledWith(getActiveRecordingAudioMode());
    expect(recorder.prepareToRecordAsync).toHaveBeenCalled();
    expect(recorder.record).toHaveBeenCalled();
    expect(session.getSnapshot()).toMatchObject({
      phase: 'recording',
      titleDraft: 'Field interview',
      durationMillis: 0,
      errorMessage: null,
    });
    expect(snapshots.at(-1)).toEqual(session.getSnapshot());

    unsubscribe();
  });

  test('rejects starting a new recording while already recording', async () => {
    const recorder = createRecorderDouble();
    const requestPermission = vi.fn(async () => ({ granted: true }));

    const { createRecordingSession } = await import('./recordingSession');
    const session = createRecordingSession({
      requestRecordingPermissionsAsync: requestPermission,
      setAudioModeAsync: vi.fn(async () => undefined),
      createRecorder: vi.fn(() => recorder),
      createMeetingFromRecording: vi.fn(),
      uploadMeetingRecordingIfConfigured: vi.fn(),
      now: () => 0,
      setInterval: vi.fn(() => 1),
      clearInterval: vi.fn(),
    });

    await session.startRecording();

    await expect(session.startRecording()).rejects.toThrow(
      'Cannot start a recording while the session is recording.',
    );
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(recorder.prepareToRecordAsync).toHaveBeenCalledTimes(1);
    expect(recorder.record).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot()).toMatchObject({
      phase: 'recording',
      titleDraft: '',
      durationMillis: 0,
      errorMessage: 'Cannot start a recording while the session is recording.',
    });
  });

  test('rejects a second start while the first start is still in flight', async () => {
    let resolveFirstPermission: ((value: { granted: boolean }) => void) | null = null;
    const firstPermission = new Promise<{ granted: boolean }>((resolve) => {
      resolveFirstPermission = resolve;
    });
    const requestPermission = vi.fn(() => firstPermission);
    const setAudioMode = vi.fn(async () => undefined);
    const recorder = createRecorderDouble();
    const createRecorder = vi.fn(() => recorder);

    const { createRecordingSession } = await import('./recordingSession');
    const session = createRecordingSession({
      requestRecordingPermissionsAsync: requestPermission,
      setAudioModeAsync: setAudioMode,
      createRecorder,
      createMeetingFromRecording: vi.fn(),
      uploadMeetingRecordingIfConfigured: vi.fn(),
      now: () => 0,
      setInterval: vi.fn(() => 1),
      clearInterval: vi.fn(),
    });

    const firstStart = session.startRecording();
    await Promise.resolve();

    await expect(session.startRecording()).rejects.toThrow(
      'Cannot start a recording while another start is in progress.',
    );
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(createRecorder).not.toHaveBeenCalled();

    resolveFirstPermission?.({ granted: true });
    await expect(firstStart).resolves.toBeUndefined();

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(createRecorder).toHaveBeenCalledTimes(1);
    expect(recorder.prepareToRecordAsync).toHaveBeenCalledTimes(1);
    expect(recorder.record).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot()).toMatchObject({
      phase: 'recording',
      titleDraft: '',
      durationMillis: 0,
      errorMessage: null,
    });
  });

  test('polls duration from recorder currentTime until the recording is stopped', async () => {
    const recorder = createRecorderDouble();
    const clearInterval = vi.fn(
      (handle: ReturnType<typeof globalThis.setInterval>) => globalThis.clearInterval(handle),
    );

    const { createRecordingSession } = await import('./recordingSession');
    const session = createRecordingSession({
      requestRecordingPermissionsAsync: vi.fn(async () => ({ granted: true })),
      setAudioModeAsync: vi.fn(async () => undefined),
      createRecorder: vi.fn(() => recorder),
      createMeetingFromRecording: vi.fn(async () => ({
        id: 'meeting-1',
        audioUri: 'file:///saved/session.m4a',
      })),
      uploadMeetingRecordingIfConfigured: vi.fn(async () => 'skipped'),
      now: () => 0,
      setInterval: globalThis.setInterval.bind(globalThis),
      clearInterval,
    });

    await session.startRecording();

    recorder.currentTime = 1.234;
    await vi.advanceTimersByTimeAsync(500);
    expect(session.getSnapshot().durationMillis).toBe(1234);

    recorder.currentTime = 2.5;
    await vi.advanceTimersByTimeAsync(500);
    expect(session.getSnapshot().durationMillis).toBe(2500);

    await session.stopAndSave();
    expect(clearInterval).toHaveBeenCalledTimes(1);
  });

  test('stops, saves locally, restores idle mode, and returns meeting info', async () => {
    const recorder = createRecorderDouble();
    recorder.currentTime = 12.345;
    const createMeetingFromRecording = vi.fn(async (input) => ({
      id: 'meeting-1',
      audioUri: `file:///saved/${input.title}.m4a`,
    }));
    const uploadMeetingRecordingIfConfigured = vi.fn(async () => 'uploaded');
    const setAudioMode = vi.fn(async () => undefined);

    const { createRecordingSession } = await import('./recordingSession');
    const session = createRecordingSession({
      requestRecordingPermissionsAsync: vi.fn(async () => ({ granted: true })),
      setAudioModeAsync: setAudioMode,
      createRecorder: vi.fn(() => recorder),
      createMeetingFromRecording,
      uploadMeetingRecordingIfConfigured,
      now: () => 0,
      setInterval: vi.fn(() => 1),
      clearInterval: vi.fn(),
    });

    session.setTitleDraft('Weekly sync');
    await session.startRecording();

    const savePromise = session.stopAndSave();
    expect(session.getSnapshot()).toMatchObject({
      phase: 'saving',
      titleDraft: 'Weekly sync',
      durationMillis: 12345,
      errorMessage: null,
    });

    await expect(savePromise).resolves.toEqual({
      meetingId: 'meeting-1',
      audioUri: 'file:///saved/Weekly sync.m4a',
      driveOutcome: 'uploaded',
    });

    expect(recorder.stop).toHaveBeenCalled();
    expect(setAudioMode).toHaveBeenNthCalledWith(2, getIdleRecordingAudioMode());
    expect(createMeetingFromRecording).toHaveBeenCalledWith({
      uri: 'file:///recordings/session.m4a',
      title: 'Weekly sync',
      durationMs: 12345,
      preTranscribedText: null,
    });
    expect(uploadMeetingRecordingIfConfigured).toHaveBeenCalledWith({
      title: 'Weekly sync',
      localAudioUri: 'file:///saved/Weekly sync.m4a',
    });
    expect(session.getSnapshot()).toMatchObject({
      phase: 'idle',
      titleDraft: '',
      durationMillis: 0,
      errorMessage: null,
    });
  });

  test('returns to error state when the recorder stops without a file url', async () => {
    const recorder = createRecorderDouble();
    recorder.stop.mockImplementationOnce(async function (this: RecorderDouble) {
      this.uri = '   ';
    });

    const { createRecordingSession } = await import('./recordingSession');
    const session = createRecordingSession({
      requestRecordingPermissionsAsync: vi.fn(async () => ({ granted: true })),
      setAudioModeAsync: vi.fn(async () => undefined),
      createRecorder: vi.fn(() => recorder),
      createMeetingFromRecording: vi.fn(),
      uploadMeetingRecordingIfConfigured: vi.fn(),
      now: () => 0,
      setInterval: vi.fn(() => 1),
      clearInterval: vi.fn(),
    });

    await session.startRecording();

    await expect(session.stopAndSave()).rejects.toThrow('Recording file was unavailable after stopping.');
    expect(session.getSnapshot()).toMatchObject({
      phase: 'error',
      titleDraft: '',
      durationMillis: 0,
      errorMessage: 'Recording file was unavailable after stopping.',
    });
  });

  test('restores idle mode and creates a fresh recorder after stop failure', async () => {
    const firstRecorder = createRecorderDouble();
    const secondRecorder = createRecorderDouble();
    firstRecorder.stop.mockRejectedValueOnce(new Error('Stop failed.'));

    const setAudioMode = vi.fn(async () => undefined);
    const createRecorder = vi
      .fn<() => RecorderDouble>()
      .mockReturnValueOnce(firstRecorder)
      .mockReturnValueOnce(secondRecorder);

    const { createRecordingSession } = await import('./recordingSession');
    const session = createRecordingSession({
      requestRecordingPermissionsAsync: vi.fn(async () => ({ granted: true })),
      setAudioModeAsync: setAudioMode,
      createRecorder,
      createMeetingFromRecording: vi.fn(async () => ({
        id: 'meeting-2',
        audioUri: 'file:///saved/retry.m4a',
      })),
      uploadMeetingRecordingIfConfigured: vi.fn(async () => 'skipped'),
      now: () => 0,
      setInterval: vi.fn(() => 7),
      clearInterval: vi.fn(),
    });

    await session.startRecording();

    await expect(session.stopAndSave()).rejects.toThrow('Stop failed.');
    expect(setAudioMode).toHaveBeenNthCalledWith(2, getIdleRecordingAudioMode());
    expect(session.getSnapshot()).toMatchObject({
      phase: 'error',
      titleDraft: '',
      durationMillis: 0,
      errorMessage: 'Stop failed.',
    });

    await session.startRecording();

    expect(createRecorder).toHaveBeenCalledTimes(2);
    expect(secondRecorder.prepareToRecordAsync).toHaveBeenCalledTimes(1);
    expect(secondRecorder.record).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot()).toMatchObject({
      phase: 'recording',
      titleDraft: '',
      durationMillis: 0,
      errorMessage: null,
    });
  });

  test.each([
    ['setAudioModeAsync', 'Audio mode failed.'],
    ['prepareToRecordAsync', 'Prepare failed.'],
    ['record', 'Record failed.'],
  ] as const)(
    'moves to error, restores idle mode, and allows retry when %s fails during start',
    async (failingStep, failureMessage) => {
      const firstRecorder = createRecorderDouble();
      const secondRecorder = createRecorderDouble();
      const setAudioMode = vi.fn(async () => undefined);
      const createRecorder = vi
        .fn<() => RecorderDouble>()
        .mockReturnValueOnce(firstRecorder)
        .mockReturnValueOnce(secondRecorder);

      if (failingStep === 'setAudioModeAsync') {
        setAudioMode.mockRejectedValueOnce(new Error(failureMessage));
      } else if (failingStep === 'prepareToRecordAsync') {
        firstRecorder.prepareToRecordAsync.mockRejectedValueOnce(new Error(failureMessage));
      } else {
        firstRecorder.record.mockImplementationOnce(() => {
          throw new Error(failureMessage);
        });
      }

      const { createRecordingSession } = await import('./recordingSession');
      const session = createRecordingSession({
        requestRecordingPermissionsAsync: vi.fn(async () => ({ granted: true })),
        setAudioModeAsync: setAudioMode,
        createRecorder,
        createMeetingFromRecording: vi.fn(),
        uploadMeetingRecordingIfConfigured: vi.fn(),
        now: () => 0,
        setInterval: vi.fn(() => 1),
        clearInterval: vi.fn(),
      });

      await expect(session.startRecording()).rejects.toThrow(failureMessage);
      expect(session.getSnapshot()).toMatchObject({
        phase: 'error',
        titleDraft: '',
        durationMillis: 0,
        errorMessage: failureMessage,
      });
      expect(setAudioMode).toHaveBeenCalledWith(getActiveRecordingAudioMode());
      if (failingStep === 'setAudioModeAsync') {
        expect(setAudioMode).toHaveBeenCalledTimes(1);
      } else {
        expect(setAudioMode).toHaveBeenLastCalledWith(getIdleRecordingAudioMode());
      }

      await session.startRecording();

      expect(createRecorder).toHaveBeenCalledTimes(2);
      expect(secondRecorder.prepareToRecordAsync).toHaveBeenCalledTimes(1);
      expect(secondRecorder.record).toHaveBeenCalledTimes(1);
      expect(session.getSnapshot()).toMatchObject({
        phase: 'recording',
        titleDraft: '',
        durationMillis: 0,
        errorMessage: null,
      });
    },
  );

  test('rejects starting a recording while the session is saving', async () => {
    let resolveStop: (() => void) | null = null;
    const recorder = createRecorderDouble();
    recorder.stop.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveStop = resolve;
        }),
    );

    const { createRecordingSession } = await import('./recordingSession');
    const session = createRecordingSession({
      requestRecordingPermissionsAsync: vi.fn(async () => ({ granted: true })),
      setAudioModeAsync: vi.fn(async () => undefined),
      createRecorder: vi.fn(() => recorder),
      createMeetingFromRecording: vi.fn(async () => ({
        id: 'meeting-1',
        audioUri: 'file:///saved/session.m4a',
      })),
      uploadMeetingRecordingIfConfigured: vi.fn(async () => 'skipped'),
      now: () => 0,
      setInterval: vi.fn(() => 1),
      clearInterval: vi.fn(),
    });

    await session.startRecording();

    const stopPromise = session.stopAndSave();
    await Promise.resolve();

    await expect(session.startRecording()).rejects.toThrow(
      'Cannot start a recording while the session is saving.',
    );
    expect(session.getSnapshot()).toMatchObject({
      phase: 'saving',
      titleDraft: '',
      durationMillis: 0,
      errorMessage: 'Cannot start a recording while the session is saving.',
    });

    resolveStop?.();
    await expect(stopPromise).resolves.toEqual({
      meetingId: 'meeting-1',
      audioUri: 'file:///saved/session.m4a',
      driveOutcome: 'skipped',
    });
  });

  test('rejects a second stopAndSave call while the first save is in flight', async () => {
    let resolveStop: (() => void) | null = null;
    const recorder = createRecorderDouble();
    recorder.stop.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveStop = resolve;
        }),
    );

    const createMeetingFromRecording = vi.fn(async () => ({
      id: 'meeting-1',
      audioUri: 'file:///saved/session.m4a',
    }));
    const uploadMeetingRecordingIfConfigured = vi.fn(async () => 'uploaded');

    const { createRecordingSession } = await import('./recordingSession');
    const session = createRecordingSession({
      requestRecordingPermissionsAsync: vi.fn(async () => ({ granted: true })),
      setAudioModeAsync: vi.fn(async () => undefined),
      createRecorder: vi.fn(() => recorder),
      createMeetingFromRecording,
      uploadMeetingRecordingIfConfigured,
      now: () => 0,
      setInterval: vi.fn(() => 1),
      clearInterval: vi.fn(),
    });

    await session.startRecording();

    const firstStop = session.stopAndSave();
    await Promise.resolve();

    await expect(session.stopAndSave()).rejects.toThrow(
      'Cannot stop and save while a recording is already being saved.',
    );
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(createMeetingFromRecording).not.toHaveBeenCalled();
    expect(uploadMeetingRecordingIfConfigured).not.toHaveBeenCalled();

    resolveStop?.();
    await expect(firstStop).resolves.toEqual({
      meetingId: 'meeting-1',
      audioUri: 'file:///saved/session.m4a',
      driveOutcome: 'uploaded',
    });
    expect(createMeetingFromRecording).toHaveBeenCalledTimes(1);
    expect(uploadMeetingRecordingIfConfigured).toHaveBeenCalledTimes(1);
  });

  test('rejects stopAndSave while startRecording is still in flight', async () => {
    let resolvePermission: ((value: { granted: boolean }) => void) | null = null;
    const permission = new Promise<{ granted: boolean }>((resolve) => {
      resolvePermission = resolve;
    });
    const requestPermission = vi.fn(() => permission);
    const recorder = createRecorderDouble();
    const createRecorder = vi.fn(() => recorder);

    const { createRecordingSession } = await import('./recordingSession');
    const session = createRecordingSession({
      requestRecordingPermissionsAsync: requestPermission,
      setAudioModeAsync: vi.fn(async () => undefined),
      createRecorder,
      createMeetingFromRecording: vi.fn(),
      uploadMeetingRecordingIfConfigured: vi.fn(),
      now: () => 0,
      setInterval: vi.fn(() => 1),
      clearInterval: vi.fn(),
    });

    const startPromise = session.startRecording();
    await Promise.resolve();

    await expect(session.stopAndSave()).rejects.toThrow(
      'Cannot stop and save while a recording start is in progress.',
    );
    expect(session.getSnapshot()).toMatchObject({
      phase: 'idle',
      titleDraft: '',
      durationMillis: 0,
      errorMessage: null,
    });
    expect(createRecorder).not.toHaveBeenCalled();
    expect(recorder.stop).not.toHaveBeenCalled();

    resolvePermission?.({ granted: true });
    await expect(startPromise).resolves.toBeUndefined();
    expect(session.getSnapshot()).toMatchObject({
      phase: 'recording',
      titleDraft: '',
      durationMillis: 0,
      errorMessage: null,
    });
  });

  test('streams live partial transcripts and forwards the final to createMeetingFromRecording', async () => {
    const recorder = createRecorderDouble();
    const createMeetingFromRecording = vi.fn(async () => ({
      id: 'm-1',
      audioUri: 'file:///saved/m-1.m4a',
    }));

    let partialHandler: ((transcript: string) => void) | null = null;
    const supportsLive = vi.fn(() => true);
    const startLive = vi.fn(async () => undefined);
    const stopLive = vi.fn(async () => 'Hello, this is the final transcript.');
    const cancelLive = vi.fn(async () => undefined);
    const addLiveListener = vi.fn((handler: (text: string) => void) => {
      partialHandler = handler;
      return () => {
        partialHandler = null;
      };
    });

    const { createRecordingSession } = await import('./recordingSession');
    const session = createRecordingSession({
      requestRecordingPermissionsAsync: vi.fn(async () => ({ granted: true })),
      setAudioModeAsync: vi.fn(async () => undefined),
      createRecorder: vi.fn(() => recorder),
      createMeetingFromRecording,
      uploadMeetingRecordingIfConfigured: vi.fn(async () => 'skipped' as const),
      supportsLiveTranscription: supportsLive,
      startLiveTranscription: startLive,
      stopLiveTranscription: stopLive,
      cancelLiveTranscription: cancelLive,
      addLivePartialTranscriptListener: addLiveListener,
      now: () => 0,
      setInterval: vi.fn(() => 1),
      clearInterval: vi.fn(),
    });

    await session.startRecording();

    // Streaming should be marked enabled and the listener subscribed.
    expect(supportsLive).toHaveBeenCalled();
    expect(startLive).toHaveBeenCalledWith({ locale: 'en-US' });
    expect(addLiveListener).toHaveBeenCalled();
    expect(session.getSnapshot()).toMatchObject({
      phase: 'recording',
      liveTranscriptionEnabled: true,
      liveTranscript: '',
    });

    // Simulate the recognizer emitting partials mid-recording.
    partialHandler?.('Hello,');
    expect(session.getSnapshot().liveTranscript).toBe('Hello,');
    partialHandler?.('Hello, this is');
    expect(session.getSnapshot().liveTranscript).toBe('Hello, this is');

    recorder.currentTime = 12;
    const result = await session.stopAndSave();

    expect(stopLive).toHaveBeenCalled();
    expect(result.meetingId).toBe('m-1');
    expect(createMeetingFromRecording).toHaveBeenCalledWith({
      uri: 'file:///recordings/session.m4a',
      title: expect.any(String),
      durationMs: expect.any(Number),
      preTranscribedText: 'Hello, this is the final transcript.',
    });
    expect(session.getSnapshot()).toMatchObject({
      phase: 'idle',
      liveTranscriptionEnabled: false,
      liveTranscript: '',
    });
  });

  test('falls back gracefully when starting live transcription throws', async () => {
    const recorder = createRecorderDouble();
    const supportsLive = vi.fn(() => true);
    const startLive = vi.fn(async () => {
      throw new Error('Permission denied.');
    });
    const stopLive = vi.fn(async () => '');
    const cancelLive = vi.fn(async () => undefined);
    const addLiveListener = vi.fn(() => () => undefined);

    const { createRecordingSession } = await import('./recordingSession');
    const session = createRecordingSession({
      requestRecordingPermissionsAsync: vi.fn(async () => ({ granted: true })),
      setAudioModeAsync: vi.fn(async () => undefined),
      createRecorder: vi.fn(() => recorder),
      createMeetingFromRecording: vi.fn(),
      uploadMeetingRecordingIfConfigured: vi.fn(),
      supportsLiveTranscription: supportsLive,
      startLiveTranscription: startLive,
      stopLiveTranscription: stopLive,
      cancelLiveTranscription: cancelLive,
      addLivePartialTranscriptListener: addLiveListener,
      now: () => 0,
      setInterval: vi.fn(() => 1),
      clearInterval: vi.fn(),
    });

    // The recording itself must not fail just because the live recognizer
    // couldn't start — that's the entire point of best-effort streaming.
    await expect(session.startRecording()).resolves.toBeUndefined();
    expect(session.getSnapshot()).toMatchObject({
      phase: 'recording',
      liveTranscriptionEnabled: false,
      errorMessage: null,
    });
  });
});

describe('meteringToLevel', () => {
  test('treats missing or non-finite metering as silence', async () => {
    const { meteringToLevel } = await import('./recordingSession');

    expect(meteringToLevel(null)).toBe(0);
    expect(meteringToLevel(undefined)).toBe(0);
    expect(meteringToLevel(Number.NaN)).toBe(0);
  });

  test('maps the dBFS floor to silence and 0 dB to full scale', async () => {
    const { meteringToLevel } = await import('./recordingSession');

    expect(meteringToLevel(-50)).toBe(0);
    expect(meteringToLevel(-160)).toBe(0);
    expect(meteringToLevel(0)).toBe(1);
  });

  test('rises monotonically between the floor and full scale', async () => {
    const { meteringToLevel } = await import('./recordingSession');
    const samples = [-50, -40, -30, -20, -10, 0].map(meteringToLevel);

    expect(samples).toEqual([...samples].sort((a, b) => a - b));
    expect(new Set(samples).size).toBe(samples.length);
  });

  test('keeps every value inside 0 and 1', async () => {
    const { meteringToLevel } = await import('./recordingSession');

    for (const db of [-200, -50, -25, -5, 0, 12]) {
      const level = meteringToLevel(db);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    }
  });

  test('leaves conversational levels visible rather than flat', async () => {
    // Speech sits high in the dBFS range, so a linear mapping would leave the
    // meter barely moving. Normal talking should use a real part of the height.
    const { meteringToLevel } = await import('./recordingSession');

    expect(meteringToLevel(-20)).toBeGreaterThan(0.3);
  });
});
