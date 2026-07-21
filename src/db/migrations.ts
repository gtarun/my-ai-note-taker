/**
 * Schema migrations.
 *
 * The database previously had no versioning at all: `CREATE TABLE IF NOT
 * EXISTS` defined the schema and two tables had hand-rolled `PRAGMA
 * table_info` column checks bolted on. Because `IF NOT EXISTS` is a no-op on an
 * existing table, adding a column to any of the other five tables would have
 * silently broken every install already in the wild.
 *
 * Rules for adding a migration:
 * - Append a new entry with the next `version`. Never edit or renumber a
 *   released one — installs that already ran it will not run it again.
 * - Keep statements idempotent where practical. Existing installs jump from
 *   `user_version = 0` with a schema that may already contain some of these
 *   columns, so every migration must tolerate being applied to a database that
 *   already satisfies it.
 */

export type MigrationContext = {
  execAsync: (source: string) => Promise<void>;
  getColumnNames: (table: string) => Promise<string[]>;
};

export type Migration = {
  version: number;
  name: string;
  up: (ctx: MigrationContext) => Promise<void>;
};

/** Adds a column only when it is missing, so the migration is safe to re-run. */
export async function addColumnIfMissing(
  ctx: MigrationContext,
  table: string,
  column: string,
  definition: string
) {
  const columns = await ctx.getColumnNames(table);

  if (!columns.includes(column)) {
    await ctx.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'app_preferences catalog url and onboarding flag',
    // Previously an ad-hoc PRAGMA check in initializeDatabase.
    up: async (ctx) => {
      await addColumnIfMissing(ctx, 'app_preferences', 'model_catalog_url', "TEXT NOT NULL DEFAULT ''");
      await addColumnIfMissing(
        ctx,
        'app_preferences',
        'has_seen_onboarding',
        'INTEGER NOT NULL DEFAULT 0'
      );
    },
  },
  {
    version: 2,
    name: 'meetings extraction columns',
    // Previously an ad-hoc PRAGMA loop in initializeDatabase.
    up: async (ctx) => {
      const columns: Array<[string, string]> = [
        ['selected_layer_id', 'TEXT'],
        ['extraction_layer_name', 'TEXT'],
        ['extraction_fields_json', 'TEXT'],
        ['extraction_values_json', 'TEXT'],
        ['extraction_status', 'TEXT'],
        ['extraction_error_message', 'TEXT'],
        ['extraction_sync_status', 'TEXT'],
        ['extraction_sync_error_message', 'TEXT'],
        ['extraction_synced_at', 'TEXT'],
        ['extraction_synced_row_id', 'TEXT'],
      ];

      for (const [name, definition] of columns) {
        await addColumnIfMissing(ctx, 'meetings', name, definition);
      }
    },
  },
  {
    version: 3,
    name: 'persist transcription locale',
    /*
     * The Settings screen has offered Hindi, Punjabi, and auto-detect since the
     * locale feature landed, but the value had nowhere to live: the preferences
     * UPDATE wrote four columns and none was the locale, so every read fell
     * back to 'en-US' and the user's choice silently reverted.
     */
    up: async (ctx) => {
      await addColumnIfMissing(
        ctx,
        'app_preferences',
        'transcription_locale',
        "TEXT NOT NULL DEFAULT 'en-US'"
      );
    },
  },
  {
    version: 4,
    name: 'english renderings of transcript and summary',
    /*
     * A meeting held in Hindi or Punjabi produced a transcript nobody outside
     * the room could read and a summary in whatever language the model felt
     * like — the prompt never said. These hold the English rendering alongside
     * the original rather than replacing it, because the verbatim words are the
     * record and a translation is an interpretation of it.
     *
     * Nullable with no default: null means "not generated", which is different
     * from an empty string meaning "generated and came back empty".
     */
    up: async (ctx) => {
      const columns: Array<[string, string]> = [
        ['transcript_english', 'TEXT'],
        ['summary_original_json', 'TEXT'],
        ['detected_language', 'TEXT'],
      ];

      for (const [name, definition] of columns) {
        await addColumnIfMissing(ctx, 'meetings', name, definition);
      }
    },
  },
];

export function getLatestSchemaVersion(): number {
  return MIGRATIONS.reduce((highest, migration) => Math.max(highest, migration.version), 0);
}

export function getPendingMigrations(currentVersion: number): Migration[] {
  return MIGRATIONS.filter((migration) => migration.version > currentVersion).sort(
    (a, b) => a.version - b.version
  );
}

/**
 * Applies every migration newer than the database's `user_version`, recording
 * progress after each one so an interrupted run resumes rather than repeating
 * work already committed.
 */
export async function runMigrations(
  ctx: MigrationContext,
  currentVersion: number,
  setVersion: (version: number) => Promise<void>
): Promise<number> {
  let version = currentVersion;

  for (const migration of getPendingMigrations(currentVersion)) {
    await migration.up(ctx);
    await setVersion(migration.version);
    version = migration.version;
  }

  return version;
}
