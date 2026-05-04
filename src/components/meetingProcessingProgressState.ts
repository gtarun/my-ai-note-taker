import { providerMap } from '../services/providers';
import type { ProcessMeetingProgressEvent } from '../services/meetings';
import type { ProviderId } from '../types';

export type StagePhase = 'transcription' | 'summary' | 'extraction';

export type StageState = 'pending' | 'active' | 'done' | 'failed';

export type StageInfo = {
  phase: StagePhase;
  label: string;
  state: StageState;
  startedAt: number | null;
  finishedDurationMs: number | null;
  detail: string | null;
};

export type MeetingProcessingProgressState = {
  stages: StageInfo[];
  qualityWarning: string | null;
  errorMessage: string | null;
  completed: boolean;
};

export function createInitialProgressState({
  hasLayer,
}: {
  hasLayer: boolean;
}): MeetingProcessingProgressState {
  const stages: StageInfo[] = [
    { phase: 'transcription', label: 'Transcription', state: 'pending', startedAt: null, finishedDurationMs: null, detail: null },
    { phase: 'summary', label: 'Summary', state: 'pending', startedAt: null, finishedDurationMs: null, detail: null },
  ];
  if (hasLayer) {
    stages.push({
      phase: 'extraction',
      label: 'Structured extraction',
      state: 'pending',
      startedAt: null,
      finishedDurationMs: null,
      detail: null,
    });
  }
  return { stages, qualityWarning: null, errorMessage: null, completed: false };
}

function stageDetailFromProvider(providerId: ProviderId, modelId: string): string {
  const provider = providerMap[providerId]?.label ?? providerId;
  const model = modelId || 'default model';
  return `${provider} · ${model}`;
}

/**
 * Apply a progress event to the current state. Pure for unit-testability.
 * `combined: true` summary events promote the structured-extraction stage to
 * "done" too, since the combined local prompt produces both at once.
 */
export function applyProgressEvent(
  state: MeetingProcessingProgressState,
  event: ProcessMeetingProgressEvent,
  now: number = Date.now()
): MeetingProcessingProgressState {
  if (event.phase === 'preparing') {
    return state;
  }

  if (event.phase === 'complete') {
    return {
      ...state,
      completed: true,
      stages: state.stages.map((stage) =>
        stage.state === 'active' ? { ...stage, state: 'done' } : stage
      ),
    };
  }

  const phase = event.phase;
  const stages = state.stages.map((stage) => {
    if (stage.phase !== phase) return stage;

    if (event.state === 'started') {
      return {
        ...stage,
        state: 'active' as StageState,
        startedAt: now,
        detail:
          event.phase === 'extraction'
            ? `${event.fieldCount} field${event.fieldCount === 1 ? '' : 's'}`
            : stageDetailFromProvider(event.providerId, event.modelId),
      };
    }

    return {
      ...stage,
      state: 'done' as StageState,
      finishedDurationMs:
        event.phase === 'extraction' ? stage.finishedDurationMs : event.durationMs,
    };
  });

  // When the local combined pass finishes, both summary AND extraction land
  // in one shot. Mark extraction done if it was waiting.
  if (event.phase === 'summary' && event.state === 'finished' && event.combined) {
    return {
      ...state,
      stages: stages.map((stage) =>
        stage.phase === 'extraction' && stage.state !== 'done'
          ? { ...stage, state: 'done' as StageState, finishedDurationMs: 0 }
          : stage
      ),
    };
  }

  if (event.phase === 'transcription' && event.state === 'finished') {
    return { ...state, stages, qualityWarning: event.qualityWarning };
  }

  return { ...state, stages };
}

export function markProgressFailed(
  state: MeetingProcessingProgressState,
  errorMessage: string
): MeetingProcessingProgressState {
  return {
    ...state,
    errorMessage,
    stages: state.stages.map((stage) =>
      stage.state === 'active' ? { ...stage, state: 'failed' } : stage
    ),
  };
}
