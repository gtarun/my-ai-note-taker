import { describe, expect, test, vi } from 'vitest';

const initializeDatabase = vi.fn(async () => undefined);
const getAppSettings = vi.fn(async () => undefined);
const getInfoAsync = vi.fn(async () => ({ exists: false }));
const makeDirectoryAsync = vi.fn(async () => undefined);
const reconcileInterruptedModelDownloads = vi.fn(async () => 0);

vi.mock('../db', () => ({
  initializeDatabase,
}));

vi.mock('./settings', () => ({
  getAppSettings,
}));

vi.mock('./localModels', () => ({
  reconcileInterruptedModelDownloads,
}));

vi.mock('expo-file-system/legacy', () => ({
  default: {
    documentDirectory: 'file:///mock/',
    getInfoAsync,
    makeDirectoryAsync,
  },
  documentDirectory: 'file:///mock/',
  getInfoAsync,
  makeDirectoryAsync,
}));

describe('bootstrapApp', () => {
  test('refreshes cloud-backed settings before preparing local directories', async () => {
    const { bootstrapApp } = await import('./bootstrap');

    await bootstrapApp();

    expect(initializeDatabase).toHaveBeenCalled();
    expect(getAppSettings).toHaveBeenCalled();
    expect(makeDirectoryAsync).toHaveBeenCalledTimes(2);
  });

  test('clears download rows orphaned by a restart', async () => {
    // No download survives the JS context going away, so a row still marked
    // 'downloading' at boot is always stale and would otherwise be stuck there
    // forever with no way to retry.
    const { bootstrapApp } = await import('./bootstrap');

    await bootstrapApp();

    expect(reconcileInterruptedModelDownloads).toHaveBeenCalled();
  });

  test('does not fail boot when download reconciliation throws', async () => {
    reconcileInterruptedModelDownloads.mockRejectedValueOnce(new Error('db is busy'));
    const { bootstrapApp } = await import('./bootstrap');

    await expect(bootstrapApp()).resolves.toBeUndefined();
  });
});
