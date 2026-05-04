import { beforeEach, describe, expect, test, vi } from 'vitest';

const rows: Array<{
  id: string;
  created_at: string;
  level: string;
  scope: string;
  message: string;
  metadata_json: string | null;
}> = [];

const runAsync = vi.fn(async (source: string, ...params: unknown[]) => {
  if (source.includes('INSERT INTO app_logs')) {
    rows.push({
      id: String(params[0]),
      created_at: String(params[1]),
      level: String(params[2]),
      scope: String(params[3]),
      message: String(params[4]),
      metadata_json: params[5] ? String(params[5]) : null,
    });
    return;
  }

  if (source.includes('DELETE FROM app_logs') && source.includes('WHERE id NOT IN')) {
    return;
  }

  if (source.includes('DELETE FROM app_logs')) {
    rows.length = 0;
  }
});

const getAllAsync = vi.fn(async () => [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

vi.mock('../db', () => ({
  getDatabase: () => ({
    runAsync,
    getAllAsync,
  }),
}));

beforeEach(() => {
  rows.length = 0;
  runAsync.mockClear();
  getAllAsync.mockClear();
});

describe('app debug logs', () => {
  test('stores logs with sensitive metadata redacted', async () => {
    const { addAppLog, getAppLogs } = await import('./appLogs');

    await addAppLog({
      scope: 'meeting.process',
      message: 'Loaded settings',
      metadata: {
        providerId: 'openai',
        apiKey: 'sk-secret',
        nested: {
          refreshToken: 'refresh-secret',
        },
      },
    });

    const logs = await getAppLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      level: 'info',
      scope: 'meeting.process',
      message: 'Loaded settings',
      metadata: {
        providerId: 'openai',
        apiKey: '[redacted]',
        nested: {
          refreshToken: '[redacted]',
        },
      },
    });
  });

  test('builds a shareable text bundle', async () => {
    const { addAppLog, buildShareableAppLogs } = await import('./appLogs');

    await addAppLog({
      level: 'error',
      scope: 'meeting.local-analysis',
      message: 'Combined local analysis failed',
      metadata: { modelId: 'qwen2.5-1.5b-instruct-q8' },
    });

    await expect(buildShareableAppLogs()).resolves.toContain('Mu Fathom debug logs');
    await expect(buildShareableAppLogs()).resolves.toContain('meeting.local-analysis');
    await expect(buildShareableAppLogs()).resolves.toContain('qwen2.5-1.5b-instruct-q8');
  });
});
