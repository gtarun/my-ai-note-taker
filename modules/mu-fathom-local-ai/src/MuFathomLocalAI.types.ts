export type LocalDeviceSupportPayload = {
  platform: 'ios' | 'android' | 'web';
  localProcessingAvailable: boolean;
  supportsSummary: boolean;
  supportsTranscription: boolean;
  requiresCustomBuild: boolean;
  reason: string | null;
};

export type LocalTranscribeParams = {
  audioUri: string;
  modelId: string;
};

export type LocalSummarizeParams = {
  prompt: string;
  modelId: string;
};
