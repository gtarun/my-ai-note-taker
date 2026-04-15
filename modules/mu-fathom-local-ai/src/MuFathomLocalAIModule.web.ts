import { registerWebModule, NativeModule } from 'expo';

import {
  LocalDeviceSupportPayload,
  LocalSummarizeParams,
  LocalTranscribeParams,
} from './MuFathomLocalAI.types';

class MuFathomLocalAIModule extends NativeModule {
  async getDeviceSupport(): Promise<LocalDeviceSupportPayload> {
    return {
      platform: 'web',
      localProcessingAvailable: false,
      supportsSummary: false,
      supportsTranscription: false,
      requiresCustomBuild: false,
      reason: 'Local model runtime is mobile-only.',
    };
  }

  async transcribe(_params: LocalTranscribeParams): Promise<string> {
    throw new Error('Local transcription is not available on web.');
  }

  async summarize(_params: LocalSummarizeParams): Promise<string> {
    throw new Error('Local summary is not available on web.');
  }
}

export default registerWebModule(MuFathomLocalAIModule, 'MuFathomLocalAI');
