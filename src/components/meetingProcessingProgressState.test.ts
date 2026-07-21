import { describe, expect, test } from 'vitest';

import {
  applyProgressEvent,
  createInitialProgressState,
  markProgressFailed,
} from './meetingProcessingProgressState';

describe('createInitialProgressState', () => {
  test('starts with transcription + summary stages by default', () => {
    const state = createInitialProgressState({ hasLayer: false });
    expect(state.stages.map((stage) => stage.phase)).toEqual(['transcription', 'summary']);
    expect(state.stages.every((stage) => stage.state === 'pending')).toBe(true);
    expect(state.completed).toBe(false);
    expect(state.qualityWarning).toBeNull();
  });

  test('adds an extraction stage when a layer is selected', () => {
    const state = createInitialProgressState({ hasLayer: true });
    expect(state.stages.map((stage) => stage.phase)).toEqual([
      'transcription',
      'summary',
      'extraction',
    ]);
  });
});

describe('applyProgressEvent', () => {
  const initial = createInitialProgressState({ hasLayer: true });

  test('marks transcription active when started', () => {
    const next = applyProgressEvent(
      initial,
      {
        phase: 'transcription',
        state: 'started',
        providerId: 'local',
        modelId: 'whisper-base',
      },
      1000
    );
    expect(next.stages[0].state).toBe('active');
    expect(next.stages[0].startedAt).toBe(1000);
    expect(next.stages[0].detail).toContain('Local');
    expect(next.stages[0].detail).toContain('whisper-base');
  });

  test('captures duration when transcription finishes', () => {
    let state = applyProgressEvent(
      initial,
      {
        phase: 'transcription',
        state: 'started',
        providerId: 'local',
        modelId: 'whisper-base',
      },
      1000
    );
    state = applyProgressEvent(
      state,
      {
        phase: 'transcription',
        state: 'finished',
        durationMs: 26000,
        transcriptLength: 26,
        qualityWarning: 'Transcript looks unusually short for a 32s recording.',
      },
      27000
    );
    expect(state.stages[0].state).toBe('done');
    expect(state.stages[0].finishedDurationMs).toBe(26000);
    expect(state.qualityWarning).toContain('unusually short');
  });

  test('combined summary finishes the extraction stage in one shot', () => {
    let state = applyProgressEvent(initial, {
      phase: 'summary',
      state: 'started',
      providerId: 'local',
      modelId: 'qwen2.5-1.5b-instruct-q8',
      combined: true,
    });
    state = applyProgressEvent(state, {
      phase: 'summary',
      state: 'finished',
      durationMs: 5600,
      combined: true,
    });
    expect(state.stages.find((s) => s.phase === 'summary')?.state).toBe('done');
    expect(state.stages.find((s) => s.phase === 'extraction')?.state).toBe('done');
  });

  test('two-pass extraction marks only the extraction stage on its events', () => {
    let state = applyProgressEvent(initial, {
      phase: 'summary',
      state: 'finished',
      durationMs: 4000,
      combined: false,
    });
    expect(state.stages.find((s) => s.phase === 'extraction')?.state).toBe('pending');

    state = applyProgressEvent(state, {
      phase: 'extraction',
      state: 'started',
      fieldCount: 3,
    });
    const extraction = state.stages.find((s) => s.phase === 'extraction');
    expect(extraction?.state).toBe('active');
    expect(extraction?.detail).toBe('3 fields');

    state = applyProgressEvent(state, { phase: 'extraction', state: 'finished' });
    expect(state.stages.find((s) => s.phase === 'extraction')?.state).toBe('done');
  });

  test('complete event finalizes any still-active stage and flips completed flag', () => {
    let state = applyProgressEvent(initial, {
      phase: 'summary',
      state: 'started',
      providerId: 'openai',
      modelId: 'gpt-4.1-mini',
      combined: false,
    });
    state = applyProgressEvent(state, { phase: 'complete' });
    expect(state.completed).toBe(true);
    expect(state.stages.find((s) => s.phase === 'summary')?.state).toBe('done');
  });
});

describe('markProgressFailed', () => {
  test('flips active stage to failed and stores the message', () => {
    let state = createInitialProgressState({ hasLayer: false });
    state = applyProgressEvent(state, {
      phase: 'transcription',
      state: 'started',
      providerId: 'local',
      modelId: 'whisper-base',
    });

    const next = markProgressFailed(state, 'Local runtime unavailable.');
    expect(next.errorMessage).toBe('Local runtime unavailable.');
    expect(next.stages[0].state).toBe('failed');
  });
});

describe('the English transcript stage', () => {
  /*
   * The screen that builds the initial state cannot tell whether this pass will
   * run — it depends on the resolved summary provider. So the stage is not
   * listed up front; it appears on its first event and never appears at all on
   * a route that skips it.
   */
  it('is absent until it actually starts', () => {
    const state = createInitialProgressState({ hasLayer: false });

    expect(state.stages.map((stage) => stage.phase)).toEqual(['transcription', 'summary']);
  });

  it('appears directly after Summary when it begins', () => {
    const state = applyProgressEvent(createInitialProgressState({ hasLayer: true }), {
      phase: 'english',
      state: 'started',
      chunkCount: 3,
    });

    expect(state.stages.map((stage) => stage.phase)).toEqual([
      'transcription',
      'summary',
      'english',
      'extraction',
    ]);
    const english = state.stages.find((stage) => stage.phase === 'english');
    expect(english?.state).toBe('active');
    expect(english?.detail).toBe('3 parts');
  });

  it('is inserted only once across its start and finish', () => {
    let state = createInitialProgressState({ hasLayer: false });
    state = applyProgressEvent(state, { phase: 'english', state: 'started', chunkCount: 1 });
    state = applyProgressEvent(state, { phase: 'english', state: 'finished' });

    expect(state.stages.filter((stage) => stage.phase === 'english')).toHaveLength(1);
    expect(state.stages.find((stage) => stage.phase === 'english')?.state).toBe('done');
  });

  it('says "1 part" rather than "1 parts" for a short meeting', () => {
    const state = applyProgressEvent(createInitialProgressState({ hasLayer: false }), {
      phase: 'english',
      state: 'started',
      chunkCount: 1,
    });

    expect(state.stages.find((stage) => stage.phase === 'english')?.detail).toBe('1 part');
  });
});
