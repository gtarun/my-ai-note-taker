import { Platform } from 'react-native';

import { getDatabase } from '../db';

export type AppLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type AppLogEntry = {
  id: string;
  createdAt: string;
  level: AppLogLevel;
  scope: string;
  message: string;
  metadata: Record<string, unknown> | null;
};

type AppLogRow = {
  id: string;
  created_at: string;
  level: AppLogLevel;
  scope: string;
  message: string;
  metadata_json: string | null;
};

const MAX_STORED_LOGS = 400;
const DEFAULT_LOG_LIMIT = 200;
const REDACTED = '[redacted]';
const SENSITIVE_KEY_PATTERN = /(api[_-]?key|authorization|bearer|secret|password|token|credential)/i;

export async function addAppLog(input: {
  level?: AppLogLevel;
  scope: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const db = getDatabase();
    const createdAt = new Date().toISOString();
    const metadata = input.metadata ? redactSensitiveValues(input.metadata) : null;

    await db.runAsync(
      `INSERT INTO app_logs (id, created_at, level, scope, message, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      createLogId(),
      createdAt,
      input.level ?? 'info',
      input.scope,
      input.message,
      metadata ? JSON.stringify(metadata) : null
    );
    await db.runAsync(
      `DELETE FROM app_logs
       WHERE id NOT IN (
         SELECT id FROM app_logs ORDER BY created_at DESC LIMIT ?
       )`,
      MAX_STORED_LOGS
    );
  } catch {
    // Logging must never break the user flow we are trying to debug.
  }
}

export async function runLoggedStep<T>(
  input: {
    scope: string;
    message: string;
    metadata?: Record<string, unknown>;
    successMessage?: string;
  },
  operation: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  await addAppLog({
    level: 'info',
    scope: input.scope,
    message: `${input.message} started`,
    metadata: input.metadata,
  });

  try {
    const result = await operation();
    await addAppLog({
      level: 'info',
      scope: input.scope,
      message: input.successMessage ?? `${input.message} finished`,
      metadata: {
        ...input.metadata,
        durationMs: Date.now() - startedAt,
      },
    });
    return result;
  } catch (error) {
    await addAppLog({
      level: 'error',
      scope: input.scope,
      message: `${input.message} failed`,
      metadata: {
        ...input.metadata,
        durationMs: Date.now() - startedAt,
        error: formatErrorForMetadata(error),
      },
    });
    throw error;
  }
}

export async function getAppLogs(limit = DEFAULT_LOG_LIMIT): Promise<AppLogEntry[]> {
  const rows = await getDatabase().getAllAsync<AppLogRow>(
    `SELECT id, created_at, level, scope, message, metadata_json
     FROM app_logs
     ORDER BY created_at DESC
     LIMIT ?`,
    limit
  );

  return rows.map(mapAppLogRow);
}

export async function clearAppLogs() {
  await getDatabase().runAsync('DELETE FROM app_logs');
}

export async function buildShareableAppLogs(limit = DEFAULT_LOG_LIMIT) {
  const logs = await getAppLogs(limit);

  return [
    'Mu Fathom debug logs',
    `Generated: ${new Date().toISOString()}`,
    `Platform: ${Platform.OS}`,
    `Entries: ${logs.length}`,
    '',
    ...logs.map(formatLogEntry),
  ].join('\n');
}

export function formatLogEntry(entry: AppLogEntry) {
  const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
  return `[${entry.createdAt}] ${entry.level.toUpperCase()} ${entry.scope}: ${entry.message}${metadata}`;
}

function mapAppLogRow(row: AppLogRow): AppLogEntry {
  return {
    id: row.id,
    createdAt: row.created_at,
    level: row.level,
    scope: row.scope,
    message: row.message,
    metadata: parseMetadata(row.metadata_json),
  };
}

function parseMetadata(raw: string | null) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function redactSensitiveValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveValues);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactSensitiveValues(nestedValue),
    ])
  );
}

function formatErrorForMetadata(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return String(error);
}

function createLogId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
