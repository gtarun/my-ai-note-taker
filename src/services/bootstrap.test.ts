import { describe, expect, test, vi } from 'vitest';

const initializeDatabase = vi.fn(async () => undefined);
const getAppSettings = vi.fn(async () => undefined);
const getInfoAsync = vi.fn(async () => ({ exists: false }));
const makeDirectoryAsync = vi.fn(async () => undefined);

vi.mock('../db', () => ({
  initializeDatabase,
}));

vi.mock('./settings', () => ({
  getAppSettings,
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
});
