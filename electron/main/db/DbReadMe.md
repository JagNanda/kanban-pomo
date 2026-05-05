# Kanban Pomo Database

The app stores its local data in one SQLite database:

```txt
<Electron userData>/kanban-pomo.sqlite
```

SQLite is the right default for this desktop app. Keep the core app data in this one file unless there is a specific reason to split something out, such as large file attachments or disposable cache data.

## Files

```txt
electron/main/db/database.ts
electron/main/db/migrations.ts
```

`database.ts` owns reads, writes, seeding, and the app-facing database API.

`migrations.ts` owns schema creation and schema changes. Treat it as the source of truth for table structure.

## Startup Flow

On app start, `AppDatabase` opens the SQLite file and runs:

1. SQLite pragmas:
   - `foreign_keys = ON`
   - `journal_mode = WAL`
   - `synchronous = FULL`
   - `busy_timeout = 5000`
2. `runDatabaseMigrations(...)`
3. `seedIfEmpty()`

The app records applied migrations in:

```sql
schema_migrations(version, name, applied_at)
```

## Backups

Before applying pending migrations to an existing database, the migration runner creates a backup here:

```txt
<Electron userData>/backups/
```

Backup filenames look like:

```txt
kanban-pomo-YYYYMMDD-HHMMSS-before-vN.sqlite
```

Backups are created with `VACUUM main INTO ...`, which produces a consistent SQLite backup even when WAL mode is enabled.

New empty databases are not backed up before initial schema creation.

## Adding a Migration

Add a new object to the end of the `migrations` array in `migrations.ts`.

Use the next integer version. Never edit the body of a migration that has already shipped, because existing users may already have that version recorded in `schema_migrations`.

Example:

```ts
{
  version: 4,
  name: "add_task_tags",
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_tags (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }
}
```

For additive column changes, prefer `addColumnIfMissing(...)` so older local databases and fresh databases both migrate cleanly:

```ts
{
  version: 5,
  name: "add_task_energy",
  up: (db) => {
    addColumnIfMissing(db, "tasks", "energy", "TEXT NOT NULL DEFAULT 'normal'");
  }
}
```

## Migration Rules

- Migrations must be deterministic.
- Migrations should be safe to run once and only once.
- Use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` when possible.
- Use `addColumnIfMissing(...)` for `ALTER TABLE ... ADD COLUMN`.
- Keep data fixes in migrations when they are required for the schema to work.
- Do not move schema changes back into `database.ts`.
- Avoid storing large binary data in SQLite. Store files on disk and keep metadata in SQLite.

## Destructive Changes

SQLite has limited `ALTER TABLE` support. For destructive or structural changes, use the copy-table pattern:

1. Create the new table.
2. Copy/transform data from the old table.
3. Drop the old table.
4. Rename the new table.
5. Recreate indexes.

Do all of that inside one migration. The migration runner wraps pending migrations in a transaction.

## Testing

Run this after editing database code:

```bash
npm run typecheck
```

For a migration that changes existing data, also test against a copy of a real `kanban-pomo.sqlite` file and confirm:

- the app starts,
- `schema_migrations` contains the new version,
- user data is still present,
- a pre-migration backup was created,
- new installs still seed correctly.

## Future Import and Export

If backup/export UI is added later, export should checkpoint or use `VACUUM INTO` before copying the database. Import should replace the database while it is closed, then restart or reopen the app database connection.
