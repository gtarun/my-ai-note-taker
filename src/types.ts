export type MeetingStatus =
  | 'local_only'
  | 'transcribing'
  | 'summarizing'
  | 'ready'
  | 'failed';

export type MeetingRow = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  audioUri: string;
  durationMs: number;
  sourceType: 'recording' | 'import';
  status: MeetingStatus;
  transcriptText: string | null;
  summaryJson: string | null;
  summaryShort: string | null;
  errorMessage: string | null;
};

export type SummaryPayload = {
  summary: string;
  actionItems: string[];
  decisions: string[];
  followUps: string[];
};

export type AppSettings = {
  openAIApiKey: string;
  openAIBaseUrl: string;
  transcriptionModel: string;
  summaryModel: string;
  deleteUploadedAudio: boolean;
};
