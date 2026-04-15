import { NativeModule, requireNativeModule } from 'expo';

import {
  LocalDeviceSupportPayload,
  LocalSummarizeParams,
  LocalTranscribeParams,
} from './MuFathomLocalAI.types';

declare class MuFathomLocalAIModule extends NativeModule {
  getDeviceSupport(): Promise<LocalDeviceSupportPayload>;
  transcribe(params: LocalTranscribeParams): Promise<string>;
  summarize(params: LocalSummarizeParams): Promise<string>;
}

export default requireNativeModule<MuFathomLocalAIModule>('MuFathomLocalAI');
