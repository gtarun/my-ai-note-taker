import { describe, expect, test, vi } from 'vitest';

const invokeAuthenticatedFunction = vi.fn();

vi.mock('./account', () => ({
  invokeAuthenticatedFunction,
}));

describe('google sheets service', () => {
  test('requests recent spreadsheets', async () => {
    invokeAuthenticatedFunction.mockResolvedValueOnce({ spreadsheets: [] });
    const service = await import('./googleSheets');

    await service.browseRecentSpreadsheets();

    expect(invokeAuthenticatedFunction).toHaveBeenCalledWith('google-sheets-browser', {
      mode: 'recent',
    });
  });

  test('requests tabs and headers for a selected spreadsheet', async () => {
    invokeAuthenticatedFunction.mockResolvedValueOnce({ tabs: [], headers: [] });
    const service = await import('./googleSheets');

    await service.getSpreadsheetTabsAndHeaders('sheet-123', 'Inbound');

    expect(invokeAuthenticatedFunction).toHaveBeenCalledWith('google-sheets-browser', {
      mode: 'details',
      spreadsheetId: 'sheet-123',
      sheetTitle: 'Inbound',
    });
  });
});
