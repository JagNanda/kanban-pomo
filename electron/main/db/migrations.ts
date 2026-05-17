import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";

interface DatabaseMigration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

const migrationTableName = "schema_migrations";

const getTableColumnNames = (db: Database.Database, tableName: string): Set<string> => {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;

  return new Set(columns.map((column) => column.name));
};

const addColumnIfMissing = (
  db: Database.Database,
  tableName: string,
  columnName: string,
  definition: string
): void => {
  if (getTableColumnNames(db, tableName).has(columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
};

const getUserTableCount = (db: Database.Database): number => {
  const tables = db
    .prepare(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
         AND name != @migrationTableName`
    )
    .all({ migrationTableName }) as Array<{ name: string }>;

  return tables.length;
};

const escapeSqlString = (value: string): string => value.replace(/'/g, "''");

const formatBackupTimestamp = (value: Date): string => {
  const pad = (part: number): string => String(part).padStart(2, "0");

  return [
    value.getFullYear(),
    pad(value.getMonth() + 1),
    pad(value.getDate()),
    "-",
    pad(value.getHours()),
    pad(value.getMinutes()),
    pad(value.getSeconds())
  ].join("");
};

const createPreMigrationBackup = (
  db: Database.Database,
  dbFilePath: string,
  firstPendingVersion: number
): void => {
  if (getUserTableCount(db) === 0) {
    return;
  }

  const backupDirectory = path.join(path.dirname(dbFilePath), "backups");
  const parsedPath = path.parse(dbFilePath);
  const backupPath = path.join(
    backupDirectory,
    `${parsedPath.name}-${formatBackupTimestamp(new Date())}-before-v${firstPendingVersion}${parsedPath.ext}`
  );

  fs.mkdirSync(backupDirectory, { recursive: true });
  db.exec(`VACUUM main INTO '${escapeSqlString(backupPath)}'`);
};

const migrations: DatabaseMigration[] = [
  {
    version: 1,
    name: "initial_schema",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS boards (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS columns (
          id TEXT PRIMARY KEY,
          board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          color TEXT NOT NULL DEFAULT '#8f99b1',
          order_index INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS task_projects (
          id TEXT PRIMARY KEY,
          board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          order_index INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS task_collections (
          id TEXT PRIMARY KEY,
          board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
          task_project_id TEXT REFERENCES task_projects(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          order_index INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
          column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
          task_project_id TEXT REFERENCES task_projects(id) ON DELETE SET NULL,
          task_collection_id TEXT REFERENCES task_collections(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          priority TEXT NOT NULL DEFAULT 'medium',
          order_index INTEGER NOT NULL,
          estimated_completion_date TEXT,
          estimated_pomodoros INTEGER NOT NULL DEFAULT 0,
          actual_tracked_seconds INTEGER NOT NULL,
          pomodoro_count INTEGER NOT NULL,
          is_study_problem INTEGER NOT NULL DEFAULT 0,
          study_platform TEXT NOT NULL DEFAULT '',
          study_url TEXT NOT NULL DEFAULT '',
          study_difficulty TEXT,
          study_topic TEXT NOT NULL DEFAULT '',
          study_status TEXT NOT NULL DEFAULT 'unstarted',
          times_completed INTEGER NOT NULL DEFAULT 0,
          completed_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS field_definitions (
          id TEXT PRIMARY KEY,
          board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          scope TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS task_field_assignments (
          field_definition_id TEXT NOT NULL REFERENCES field_definitions(id) ON DELETE CASCADE,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          PRIMARY KEY (field_definition_id, task_id)
        );

        CREATE TABLE IF NOT EXISTS task_field_values (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          field_definition_id TEXT NOT NULL REFERENCES field_definitions(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          text_value TEXT,
          number_value REAL,
          boolean_value INTEGER
        );

        CREATE TABLE IF NOT EXISTS pomodoro_sessions (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          phase_type TEXT NOT NULL,
          planned_duration_seconds INTEGER NOT NULL,
          actual_duration_seconds INTEGER NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT
        );

        CREATE TABLE IF NOT EXISTS break_records (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          phase_type TEXT NOT NULL,
          planned_duration_seconds INTEGER NOT NULL,
          actual_duration_seconds INTEGER NOT NULL,
          action TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT
        );

        CREATE TABLE IF NOT EXISTS procrastination_records (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          actual_duration_seconds INTEGER NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          started_at TEXT NOT NULL,
          ended_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS interruption_records (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          actual_duration_seconds INTEGER NOT NULL,
          reason TEXT NOT NULL DEFAULT '',
          started_at TEXT NOT NULL,
          ended_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS archived_completed_tasks (
          id TEXT PRIMARY KEY,
          original_task_id TEXT NOT NULL,
          title TEXT NOT NULL,
          priority TEXT NOT NULL,
          estimated_completion_date TEXT,
          completed_at TEXT NOT NULL,
          collection_name TEXT,
          collection_color TEXT,
          project_name TEXT,
          project_color TEXT,
          pomodoro_count INTEGER NOT NULL,
          actual_tracked_seconds INTEGER NOT NULL,
          is_study_problem INTEGER NOT NULL DEFAULT 0,
          study_platform TEXT NOT NULL DEFAULT '',
          study_url TEXT NOT NULL DEFAULT '',
          study_difficulty TEXT,
          study_topic TEXT NOT NULL DEFAULT '',
          study_status TEXT NOT NULL DEFAULT 'unstarted',
          times_completed INTEGER NOT NULL DEFAULT 0,
          deleted_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS archived_pomodoro_sessions (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          phase_type TEXT NOT NULL,
          planned_duration_seconds INTEGER NOT NULL,
          actual_duration_seconds INTEGER NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT
        );

        CREATE TABLE IF NOT EXISTS archived_break_records (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          phase_type TEXT NOT NULL,
          planned_duration_seconds INTEGER NOT NULL,
          actual_duration_seconds INTEGER NOT NULL,
          action TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT
        );

        CREATE TABLE IF NOT EXISTS archived_procrastination_records (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          actual_duration_seconds INTEGER NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          started_at TEXT NOT NULL,
          ended_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS archived_interruption_records (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          actual_duration_seconds INTEGER NOT NULL,
          reason TEXT NOT NULL DEFAULT '',
          started_at TEXT NOT NULL,
          ended_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
    }
  },
  {
    version: 2,
    name: "legacy_column_backfill",
    up: (db) => {
      addColumnIfMissing(db, "tasks", "description", "TEXT NOT NULL DEFAULT ''");
      addColumnIfMissing(db, "tasks", "priority", "TEXT NOT NULL DEFAULT 'medium'");
      addColumnIfMissing(db, "tasks", "estimated_pomodoros", "INTEGER NOT NULL DEFAULT 0");
      addColumnIfMissing(db, "tasks", "task_collection_id", "TEXT");
      addColumnIfMissing(db, "tasks", "task_project_id", "TEXT");
      addColumnIfMissing(db, "tasks", "completed_at", "TEXT");
      addColumnIfMissing(db, "columns", "color", "TEXT NOT NULL DEFAULT '#8f99b1'");
      addColumnIfMissing(db, "task_collections", "task_project_id", "TEXT");
    }
  },
  {
    version: 3,
    name: "reporting_indexes",
    up: (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_tasks_due_date
          ON tasks(estimated_completion_date);
        CREATE INDEX IF NOT EXISTS idx_tasks_completed_at
          ON tasks(completed_at);
        CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_started_at
          ON pomodoro_sessions(started_at);
        CREATE INDEX IF NOT EXISTS idx_break_records_started_at
          ON break_records(started_at);
        CREATE INDEX IF NOT EXISTS idx_procrastination_records_started_at
          ON procrastination_records(started_at);
        CREATE INDEX IF NOT EXISTS idx_interruption_records_started_at
          ON interruption_records(started_at);
        CREATE INDEX IF NOT EXISTS idx_archived_completed_tasks_completed_at
          ON archived_completed_tasks(completed_at);
        CREATE INDEX IF NOT EXISTS idx_archived_pomodoro_sessions_started_at
          ON archived_pomodoro_sessions(started_at);
        CREATE INDEX IF NOT EXISTS idx_archived_break_records_started_at
          ON archived_break_records(started_at);
        CREATE INDEX IF NOT EXISTS idx_archived_procrastination_records_started_at
          ON archived_procrastination_records(started_at);
        CREATE INDEX IF NOT EXISTS idx_archived_interruption_records_started_at
          ON archived_interruption_records(started_at);
      `);
    }
  },
  {
    version: 4,
    name: "interruption_records",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS interruption_records (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          actual_duration_seconds INTEGER NOT NULL,
          reason TEXT NOT NULL DEFAULT '',
          started_at TEXT NOT NULL,
          ended_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS archived_interruption_records (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          actual_duration_seconds INTEGER NOT NULL,
          reason TEXT NOT NULL DEFAULT '',
          started_at TEXT NOT NULL,
          ended_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_interruption_records_started_at
          ON interruption_records(started_at);
        CREATE INDEX IF NOT EXISTS idx_archived_interruption_records_started_at
          ON archived_interruption_records(started_at);
      `);
    }
  },
  {
    version: 5,
    name: "study_problem_metadata",
    up: (db) => {
      addColumnIfMissing(db, "tasks", "is_study_problem", "INTEGER NOT NULL DEFAULT 0");
      addColumnIfMissing(db, "tasks", "study_platform", "TEXT NOT NULL DEFAULT ''");
      addColumnIfMissing(db, "tasks", "study_url", "TEXT NOT NULL DEFAULT ''");
      addColumnIfMissing(db, "tasks", "study_difficulty", "TEXT");
      addColumnIfMissing(db, "tasks", "study_topic", "TEXT NOT NULL DEFAULT ''");
      addColumnIfMissing(db, "tasks", "study_status", "TEXT NOT NULL DEFAULT 'unstarted'");
      addColumnIfMissing(db, "tasks", "times_completed", "INTEGER NOT NULL DEFAULT 0");

      addColumnIfMissing(
        db,
        "archived_completed_tasks",
        "is_study_problem",
        "INTEGER NOT NULL DEFAULT 0"
      );
      addColumnIfMissing(
        db,
        "archived_completed_tasks",
        "study_platform",
        "TEXT NOT NULL DEFAULT ''"
      );
      addColumnIfMissing(
        db,
        "archived_completed_tasks",
        "study_url",
        "TEXT NOT NULL DEFAULT ''"
      );
      addColumnIfMissing(db, "archived_completed_tasks", "study_difficulty", "TEXT");
      addColumnIfMissing(
        db,
        "archived_completed_tasks",
        "study_topic",
        "TEXT NOT NULL DEFAULT ''"
      );
      addColumnIfMissing(
        db,
        "archived_completed_tasks",
        "study_status",
        "TEXT NOT NULL DEFAULT 'unstarted'"
      );
      addColumnIfMissing(
        db,
        "archived_completed_tasks",
        "times_completed",
        "INTEGER NOT NULL DEFAULT 0"
      );
    }
  }
];

export const runDatabaseMigrations = (
  db: Database.Database,
  dbFilePath: string
): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${migrationTableName} (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedVersions = new Set(
    (
      db
        .prepare(`SELECT version FROM ${migrationTableName}`)
        .all() as Array<{ version: number }>
    ).map((migration) => migration.version)
  );
  const pendingMigrations = migrations.filter(
    (migration) => !appliedVersions.has(migration.version)
  );

  if (pendingMigrations.length === 0) {
    return;
  }

  const firstPendingMigration = pendingMigrations[0];

  if (!firstPendingMigration) {
    return;
  }

  createPreMigrationBackup(db, dbFilePath, firstPendingMigration.version);

  const applyPendingMigrations = db.transaction(() => {
    const insertMigration = db.prepare(
      `INSERT INTO ${migrationTableName} (version, name, applied_at)
       VALUES (@version, @name, @appliedAt)`
    );

    pendingMigrations.forEach((migration) => {
      migration.up(db);
      insertMigration.run({
        version: migration.version,
        name: migration.name,
        appliedAt: new Date().toISOString()
      });
    });
  });

  applyPendingMigrations();
};
