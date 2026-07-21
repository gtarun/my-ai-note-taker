import { describe, expect, it, vi } from 'vitest';

import {
  MIGRATIONS,
  type MigrationContext,
  addColumnIfMissing,
  getLatestSchemaVersion,
  getPendingMigrations,
  runMigrations,
} from './migrations';

function createContext(tables: Record<string, string[]> = {}) {
  const statements: string[] = [];

  const ctx: MigrationContext = {
    execAsync: async (source) => {
      statements.push(source);

      // Keep the fake schema in sync so idempotence is actually exercised.
      const match = source.match(/ALTER TABLE (\w+) ADD COLUMN (\w+)/);
      if (match) {
        const [, table, column] = match;
        tables[table] = [...(tables[table] ?? []), column];
      }
    },
    getColumnNames: async (table) => tables[table] ?? [],
  };

  return { ctx, statements, tables };
}

describe('migration list', () => {
  it('has unique, gapless, ascending versions', () => {
    const versions = MIGRATIONS.map((migration) => migration.version);

    expect(versions).toEqual([...new Set(versions)]);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(versions).toEqual(versions.map((_, index) => index + 1));
  });

  it('reports the latest version', () => {
    expect(getLatestSchemaVersion()).toBe(MIGRATIONS.length);
  });
});

describe('getPendingMigrations', () => {
  it('returns everything for a fresh database', () => {
    expect(getPendingMigrations(0)).toHaveLength(MIGRATIONS.length);
  });

  it('returns nothing when fully migrated', () => {
    expect(getPendingMigrations(getLatestSchemaVersion())).toEqual([]);
  });

  it('returns only newer migrations for a partially migrated database', () => {
    const pending = getPendingMigrations(1);

    expect(pending.every((migration) => migration.version > 1)).toBe(true);
    expect(pending).toHaveLength(MIGRATIONS.length - 1);
  });
});

describe('addColumnIfMissing', () => {
  it('adds a column that does not exist', async () => {
    const { ctx, statements } = createContext({ app_preferences: ['id'] });

    await addColumnIfMissing(ctx, 'app_preferences', 'transcription_locale', "TEXT NOT NULL DEFAULT 'en-US'");

    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain('ADD COLUMN transcription_locale');
  });

  it('skips a column that already exists', async () => {
    // Existing installs arrive at user_version 0 with some of these columns
    // already present, so every migration must tolerate that.
    const { ctx, statements } = createContext({
      app_preferences: ['id', 'transcription_locale'],
    });

    await addColumnIfMissing(ctx, 'app_preferences', 'transcription_locale', 'TEXT');

    expect(statements).toEqual([]);
  });
});

describe('runMigrations', () => {
  it('applies every migration on a fresh database and records the version', async () => {
    const { ctx } = createContext({ app_preferences: ['id'], meetings: ['id'] });
    const setVersion = vi.fn(async () => {});

    const finalVersion = await runMigrations(ctx, 0, setVersion);

    expect(finalVersion).toBe(getLatestSchemaVersion());
    expect(setVersion).toHaveBeenCalledTimes(MIGRATIONS.length);
  });

  it('records the version after each migration so an interrupted run resumes', async () => {
    const { ctx } = createContext({ app_preferences: ['id'], meetings: ['id'] });
    const recorded: number[] = [];

    await runMigrations(ctx, 0, async (version) => {
      recorded.push(version);
    });

    expect(recorded).toEqual(MIGRATIONS.map((migration) => migration.version));
  });

  it('does nothing when already at the latest version', async () => {
    const { ctx, statements } = createContext({ app_preferences: ['id'] });
    const setVersion = vi.fn(async () => {});

    await runMigrations(ctx, getLatestSchemaVersion(), setVersion);

    expect(statements).toEqual([]);
    expect(setVersion).not.toHaveBeenCalled();
  });

  it('is safe to run twice — the second pass is a no-op', async () => {
    const { ctx, statements } = createContext({ app_preferences: ['id'], meetings: ['id'] });

    const firstVersion = await runMigrations(ctx, 0, async () => {});
    const countAfterFirst = statements.length;
    await runMigrations(ctx, firstVersion, async () => {});

    expect(statements).toHaveLength(countAfterFirst);
  });

  it('re-running from version 0 against an already-migrated schema adds nothing', async () => {
    // This is exactly the shape of an existing install: the columns are there
    // but user_version was never set, so every migration replays.
    const { ctx, statements } = createContext({ app_preferences: ['id'], meetings: ['id'] });
    await runMigrations(ctx, 0, async () => {});
    const countAfterFirst = statements.length;

    await runMigrations(ctx, 0, async () => {});

    expect(statements).toHaveLength(countAfterFirst);
  });

  it('stops at the failing migration without recording its version', async () => {
    const ctx: MigrationContext = {
      execAsync: async () => {
        throw new Error('disk is full');
      },
      getColumnNames: async () => [],
    };
    const setVersion = vi.fn(async () => {});

    await expect(runMigrations(ctx, 0, setVersion)).rejects.toThrow('disk is full');
    expect(setVersion).not.toHaveBeenCalled();
  });

  it('adds the transcription locale column with an en-US default', async () => {
    const { ctx, statements } = createContext({ app_preferences: ['id'], meetings: ['id'] });

    await runMigrations(ctx, 2, async () => {});

    const localeStatement = statements.find((statement) =>
      statement.includes('transcription_locale')
    );
    expect(localeStatement).toContain("DEFAULT 'en-US'");
  });
});
