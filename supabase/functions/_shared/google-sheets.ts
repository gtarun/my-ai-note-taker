export type ExtractionFieldPayload = {
  id: string;
  title: string;
  description?: string;
};

export type EnsuredSheet = {
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetTitle: string;
  spreadsheetUrl: string;
};

export type SpreadsheetSearchResult = {
  id: string;
  title: string;
  modifiedTime: string | null;
};

export async function ensureLayerSpreadsheet(params: {
  accessToken: string;
  layerName: string;
  spreadsheetId?: string | null;
  spreadsheetTitle?: string | null;
  sheetTitle?: string | null;
  fields: ExtractionFieldPayload[];
}): Promise<EnsuredSheet> {
  const ensuredSpreadsheet = params.spreadsheetId
    ? await getSpreadsheetMetadata(params.accessToken, params.spreadsheetId)
    : await createSpreadsheet(params.accessToken, buildSpreadsheetTitle(params.layerName), sanitizeSheetTitle(params.sheetTitle || params.layerName));

  const targetSheetTitle = sanitizeSheetTitle(params.sheetTitle || params.layerName);
  const existingSheet = ensuredSpreadsheet.sheets.find((sheet) => sheet.properties.title === targetSheetTitle);

  if (!existingSheet) {
    await addSheet(params.accessToken, ensuredSpreadsheet.spreadsheetId, targetSheetTitle);
  }

  await updateHeaderRow(
    params.accessToken,
    ensuredSpreadsheet.spreadsheetId,
    targetSheetTitle,
    params.fields.map((field) => field.id)
  );

  return {
    spreadsheetId: ensuredSpreadsheet.spreadsheetId,
    spreadsheetTitle: ensuredSpreadsheet.properties.title,
    sheetTitle: targetSheetTitle,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${ensuredSpreadsheet.spreadsheetId}/edit`,
  };
}

export async function appendSheetRow(params: {
  accessToken: string;
  spreadsheetId: string;
  sheetTitle: string;
  fields: ExtractionFieldPayload[];
  values: Record<string, string>;
}) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(params.spreadsheetId)}/values/${encodeURIComponent(params.sheetTitle)}!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [params.fields.map((field) => params.values[field.id] ?? '')],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as {
    updates?: {
      updatedRange?: string;
    };
  };
}

async function createSpreadsheet(accessToken: string, title: string, firstSheetTitle: string) {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        {
          properties: {
            title: firstSheetTitle,
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as {
    spreadsheetId: string;
    properties: { title: string };
    sheets: Array<{ properties: { title: string } }>;
  };
}

export async function getSpreadsheetMetadata(accessToken: string, spreadsheetId: string) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,properties(title),sheets(properties(title))`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as {
    spreadsheetId: string;
    properties: { title: string };
    sheets: Array<{ properties: { title: string } }>;
  };
}

export async function listRecentSpreadsheets(accessToken: string, pageSize = 3): Promise<SpreadsheetSearchResult[]> {
  const query = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)&pageSize=${pageSize}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const json = (await response.json()) as {
    files?: Array<{ id: string; name: string; modifiedTime?: string }>;
  };

  return (json.files ?? []).map((file) => ({
    id: file.id,
    title: file.name,
    modifiedTime: file.modifiedTime ?? null,
  }));
}

export async function searchSpreadsheetsByName(
  accessToken: string,
  query: string,
  pageSize = 10
): Promise<SpreadsheetSearchResult[]> {
  const escapedQuery = query.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const driveQuery = `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and name contains '${escapedQuery}'`;
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(driveQuery)}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)&pageSize=${pageSize}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const json = (await response.json()) as {
    files?: Array<{ id: string; name: string; modifiedTime?: string }>;
  };

  return (json.files ?? []).map((file) => ({
    id: file.id,
    title: file.name,
    modifiedTime: file.modifiedTime ?? null,
  }));
}

export async function listSpreadsheetTabs(accessToken: string, spreadsheetId: string): Promise<string[]> {
  const metadata = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  return metadata.sheets.map((sheet) => sheet.properties.title);
}

export async function readSheetHeaders(accessToken: string, spreadsheetId: string, sheetTitle: string): Promise<string[]> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(sheetTitle)}!1:1`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const json = (await response.json()) as {
    values?: string[][];
  };

  return json.values?.[0] ?? [];
}

async function addSheet(accessToken: string, spreadsheetId: string, sheetTitle: string) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTitle,
              },
            },
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

async function updateHeaderRow(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  headers: string[]
) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(sheetTitle)}!1:1?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [headers],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

function buildSpreadsheetTitle(layerName: string) {
  return `mu-fathom - ${layerName.trim() || 'Extraction layer'}`;
}

function sanitizeSheetTitle(value: string) {
  return value
    .replace(/[\[\]\*\/\\\?:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90) || 'Entries';
}
