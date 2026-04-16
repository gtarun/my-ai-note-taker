export const GOOGLE_INTEGRATION_PROVIDER = 'google' as const;
export const GOOGLE_DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const GOOGLE_DRIVE_METADATA_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly';
export const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

const REQUIRED_GOOGLE_SCOPES = [
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_DRIVE_METADATA_SCOPE,
  GOOGLE_SHEETS_SCOPE,
];

export type GoogleIntegrationSummaryRow = {
  status: string | null;
  account_email: string | null;
  granted_scopes: string[] | null;
  needs_reconnect?: boolean | null;
  drive_save_folder_id: string | null;
  drive_save_folder_name: string | null;
  updated_at: string | null;
};

export function normalizeGrantedScopes(scope: string | string[] | null | undefined) {
  const values = Array.isArray(scope) ? scope : (scope ?? '').split(/\s+/);

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function buildGoogleIntegrationSummary(row: GoogleIntegrationSummaryRow | null) {
  const grantedScopes = normalizeGrantedScopes(row?.granted_scopes ?? []);
  const missingRequiredScopes = REQUIRED_GOOGLE_SCOPES.filter((scope) => !grantedScopes.includes(scope));

  return {
    status: row?.status === 'connected' ? 'connected' : 'not_connected',
    accountEmail: cleanNullable(row?.account_email),
    connectedAt: cleanNullable(row?.updated_at),
    saveFolderId: cleanNullable(row?.drive_save_folder_id),
    saveFolderName: cleanNullable(row?.drive_save_folder_name),
    needsReconnect: Boolean(row?.needs_reconnect) || missingRequiredScopes.length > 0,
    grantedScopes,
  };
}

export function hasGoogleScope(scopes: string[] | null | undefined, requiredScope: string) {
  return normalizeGrantedScopes(scopes).includes(requiredScope);
}

function cleanNullable(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
