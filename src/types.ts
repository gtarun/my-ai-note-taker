export type MeetingStatus =
  | 'local_only'
  | 'transcribing'
  | 'transcribing_local'
  | 'summarizing'
  | 'summarizing_local'
  | 'ready'
  | 'failed';

export type ExtractionLayerField = {
  id: string;
  title: string;
  description: string;
};

export type ExtractionLayer = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  spreadsheetId: string | null;
  spreadsheetTitle: string | null;
  sheetTitle: string | null;
  fields: ExtractionLayerField[];
};

export type MeetingExtractionStatus = 'extracting' | 'ready' | 'failed';

export type MeetingExtractionSyncStatus = 'not_synced' | 'syncing' | 'synced' | 'sync_failed';

export type MeetingExtractionResult = {
  layerId: string;
  layerName: string;
  fields: ExtractionLayerField[];
  values: Record<string, string>;
  extractionStatus: MeetingExtractionStatus;
  extractionErrorMessage: string | null;
  syncStatus: MeetingExtractionSyncStatus;
  syncErrorMessage: string | null;
  syncedAt: string | null;
  syncedRowId: string | null;
};

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
  extractionResult: MeetingExtractionResult | null;
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

export type CloudUserProfile = {
  displayName: string | null;
  avatarUrl: string | null;
  timezone: string | null;
};

export type CloudUserPreferences = {
  selectedTranscriptionProvider: ProviderId;
  selectedSummaryProvider: ProviderId;
  deleteUploadedAudio: boolean;
  modelCatalogUrl: string;
  hasSeenOnboarding: boolean;
};

export type CloudUserProviderConfig = {
  providerId: ProviderId;
  apiKey: string;
  baseUrl: string;
  transcriptionModel: string;
  summaryModel: string;
};

export type CloudIntegrationProvider = 'google';

export type CloudUserIntegration = {
  provider: CloudIntegrationProvider;
  status: 'not_connected' | 'connected';
  accountEmail: string | null;
  grantedScopes: string[];
  connectedAt: string | null;
  needsReconnect: boolean;
  saveFolderId: string | null;
  saveFolderName: string | null;
};

export type CloudUserDataSnapshot = {
  profile: CloudUserProfile;
  preferences: CloudUserPreferences;
  providers: CloudUserProviderConfig[];
  integrations: CloudUserIntegration[];
  layers: ExtractionLayer[];
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
  sourceUrl?: string;
  sourceLabel?: string;
  requiresExternalSetup?: boolean;
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
  needsReconnect: boolean;
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

export type ExtractionSheetConnection = {
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetTitle: string;
  spreadsheetUrl: string | null;
};

export type ExtractionSheetAppendResult = ExtractionSheetConnection & {
  rowRange: string;
};

export type SpreadsheetBrowserSpreadsheet = {
  id: string;
  title: string;
  modifiedTime: string | null;
};

export type SpreadsheetBrowserResponse = {
  spreadsheets?: SpreadsheetBrowserSpreadsheet[];
  spreadsheetTitle?: string | null;
  tabs?: string[];
  sheetTitle?: string | null;
  headers?: string[];
};
