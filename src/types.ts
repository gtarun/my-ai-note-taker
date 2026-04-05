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

export type ProviderId =
  | 'openai'
  | 'openrouter'
  | 'groq'
  | 'anthropic'
  | 'gemini'
  | 'together'
  | 'fireworks'
  | 'deepseek'
  | 'custom';

export type ProviderConfig = {
  apiKey: string;
  baseUrl: string;
  transcriptionModel: string;
  summaryModel: string;
};

export type AppSettings = {
  selectedTranscriptionProvider: ProviderId;
  selectedSummaryProvider: ProviderId;
  providers: Record<ProviderId, ProviderConfig>;
  deleteUploadedAudio: boolean;
};

export type DriveConnection = {
  status: 'not_connected' | 'connected';
  accountEmail: string | null;
  connectedAt: string | null;
};

export type UserAccount = {
  id: string;
  email: string;
  name: string | null;
  driveConnection: DriveConnection;
};

export type AuthSession = {
  accessToken: string;
  user: UserAccount;
};

export type CloudBackendConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  projectRef: string;
  googleDriveConnectFunctionName: string;
};
