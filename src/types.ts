export type MeetingStatus =
  | 'local_only'
  | 'transcribing'
  | 'transcribing_local'
  | 'summarizing'
  | 'summarizing_local'
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
  | 'custom'
  | 'local';

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
  modelCatalogUrl: string;
};

export type LocalModelKind = 'transcription' | 'summary';

export type LocalModelEngine = 'whisper.cpp' | 'mediapipe-llm' | 'litert-lm';

export type LocalModelPlatform = 'ios' | 'android';

export type LocalModelStatus = 'installed' | 'downloading' | 'failed';

export type ModelCatalogItem = {
  id: string;
  kind: LocalModelKind;
  engine: LocalModelEngine;
  displayName: string;
  version: string;
  downloadUrl: string;
  sha256: string;
  sizeBytes: number;
  platforms: LocalModelPlatform[];
  minFreeSpaceBytes: number;
  recommended: boolean;
  experimental: boolean;
  description: string;
};

export type InstalledModelRow = {
  id: string;
  kind: LocalModelKind;
  engine: LocalModelEngine;
  displayName: string;
  version: string;
  platforms: LocalModelPlatform[];
  fileUri: string | null;
  sizeBytes: number;
  sha256: string;
  status: LocalModelStatus;
  installedAt: string | null;
  downloadUrl: string;
  recommended: boolean;
  experimental: boolean;
  errorMessage: string | null;
};

export type LocalDeviceSupport = {
  platform: 'ios' | 'android' | 'web';
  localProcessingAvailable: boolean;
  supportsSummary: boolean;
  supportsTranscription: boolean;
  requiresCustomBuild: boolean;
  reason: string | null;
};

export type DriveConnection = {
  status: 'not_connected' | 'connected';
  accountEmail: string | null;
  connectedAt: string | null;
  /** Parent folder the user chose in Google Picker; uploads go under mu-fathom/recordings/… inside it. */
  saveFolderId: string | null;
  saveFolderName: string | null;
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
  googleDriveRedirectUri: string;
};
