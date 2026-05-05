import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  demoBoardRow,
  demoBreakRecordRows,
  demoColumnRows,
  demoFieldDefinitionRows,
  demoPomodoroSessionRows,
  demoProcrastinationRecordRows,
  demoTaskCollectionRows,
  demoTaskProjectRows,
  demoTaskFieldAssignmentRows,
  demoTaskFieldValueRows,
  demoTaskRows
} from "../../../src/database/seed/demo-data";
import { defaultPomodoroConfig } from "../../../src/features/pomodoro/domain/default-config";
import type {
  AppSettingsSnapshot,
  BoardSnapshot
} from "../../../src/lib/electron-api/board-snapshot";

const insertBoard = `
  INSERT INTO boards (id, name, created_at, updated_at)
  VALUES (@id, @name, @created_at, @updated_at)
`;

const insertColumn = `
  INSERT INTO columns (id, board_id, name, color, order_index, created_at, updated_at)
  VALUES (@id, @board_id, @name, @color, @order_index, @created_at, @updated_at)
`;

const insertTask = `
  INSERT INTO tasks (
    id, board_id, column_id, task_project_id, task_collection_id, title, description, priority, order_index, estimated_completion_date,
    estimated_pomodoros, actual_tracked_seconds, pomodoro_count, completed_at, created_at, updated_at
  )
  VALUES (
    @id, @board_id, @column_id, @task_project_id, @task_collection_id, @title, @description, @priority, @order_index, @estimated_completion_date,
    @estimated_pomodoros, @actual_tracked_seconds, @pomodoro_count, @completed_at, @created_at, @updated_at
  )
`;

const insertTaskCollection = `
  INSERT INTO task_collections (id, board_id, task_project_id, name, color, order_index, created_at, updated_at)
  VALUES (@id, @board_id, @task_project_id, @name, @color, @order_index, @created_at, @updated_at)
`;

const insertTaskProject = `
  INSERT INTO task_projects (id, board_id, name, color, order_index, created_at, updated_at)
  VALUES (@id, @board_id, @name, @color, @order_index, @created_at, @updated_at)
`;

const insertFieldDefinition = `
  INSERT INTO field_definitions (id, board_id, name, type, scope, created_at, updated_at)
  VALUES (@id, @board_id, @name, @type, @scope, @created_at, @updated_at)
`;

const insertTaskFieldAssignment = `
  INSERT INTO task_field_assignments (field_definition_id, task_id)
  VALUES (@field_definition_id, @task_id)
`;

const insertTaskFieldValue = `
  INSERT INTO task_field_values (
    id, task_id, field_definition_id, type, text_value, number_value, boolean_value
  )
  VALUES (
    @id, @task_id, @field_definition_id, @type, @text_value, @number_value, @boolean_value
  )
`;

const insertPomodoroSession = `
  INSERT INTO pomodoro_sessions (
    id, task_id, phase_type, planned_duration_seconds, actual_duration_seconds,
    status, started_at, ended_at
  )
  VALUES (
    @id, @task_id, @phase_type, @planned_duration_seconds, @actual_duration_seconds,
    @status, @started_at, @ended_at
  )
`;

const insertBreakRecord = `
  INSERT INTO break_records (
    id, task_id, phase_type, planned_duration_seconds, actual_duration_seconds,
    action, started_at, ended_at
  )
  VALUES (
    @id, @task_id, @phase_type, @planned_duration_seconds, @actual_duration_seconds,
    @action, @started_at, @ended_at
  )
`;

const insertProcrastinationRecord = `
  INSERT INTO procrastination_records (
    id, task_id, actual_duration_seconds, note, started_at, ended_at
  )
  VALUES (
    @id, @task_id, @actual_duration_seconds, @note, @started_at, @ended_at
  )
`;

const insertArchivedCompletedTask = `
  INSERT INTO archived_completed_tasks (
    id, original_task_id, title, priority, estimated_completion_date, completed_at,
    collection_name, collection_color, project_name, project_color, pomodoro_count,
    actual_tracked_seconds, deleted_at
  )
  VALUES (
    @id, @original_task_id, @title, @priority, @estimated_completion_date, @completed_at,
    @collection_name, @collection_color, @project_name, @project_color, @pomodoro_count,
    @actual_tracked_seconds, @deleted_at
  )
`;

const insertArchivedPomodoroSession = `
  INSERT INTO archived_pomodoro_sessions (
    id, task_id, phase_type, planned_duration_seconds, actual_duration_seconds,
    status, started_at, ended_at
  )
  VALUES (
    @id, @task_id, @phase_type, @planned_duration_seconds, @actual_duration_seconds,
    @status, @started_at, @ended_at
  )
`;

const insertArchivedBreakRecord = `
  INSERT INTO archived_break_records (
    id, task_id, phase_type, planned_duration_seconds, actual_duration_seconds,
    action, started_at, ended_at
  )
  VALUES (
    @id, @task_id, @phase_type, @planned_duration_seconds, @actual_duration_seconds,
    @action, @started_at, @ended_at
  )
`;

const insertArchivedProcrastinationRecord = `
  INSERT INTO archived_procrastination_records (
    id, task_id, actual_duration_seconds, note, started_at, ended_at
  )
  VALUES (
    @id, @task_id, @actual_duration_seconds, @note, @started_at, @ended_at
  )
`;

export class AppDatabase {
  private readonly db: Database.Database;

  public constructor(dbFilePath: string) {
    fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
    this.db = new Database(dbFilePath);
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = FULL");
    this.db.pragma("busy_timeout = 5000");
    this.ensureSchema();
    this.ensureTaskColumns();
    this.seedIfEmpty();
  }

  public loadBoardSnapshot(): BoardSnapshot {
    const board = this.db
      .prepare(
        "SELECT id, name, created_at, updated_at FROM boards ORDER BY created_at ASC LIMIT 1"
      )
      .get() as
      | {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!board) {
      throw new Error("No board found in database.");
    }

    const columns = this.db
      .prepare(
        "SELECT id, board_id, name, color, order_index, created_at, updated_at FROM columns ORDER BY order_index ASC"
      )
      .all() as Array<{
      id: string;
      board_id: string;
      name: string;
      color: string;
      order_index: number;
      created_at: string;
      updated_at: string;
    }>;
    const taskProjects = this.db
      .prepare(
        `SELECT id, board_id, name, color, order_index, created_at, updated_at
         FROM task_projects
         ORDER BY order_index ASC, created_at ASC`
      )
      .all() as Array<{
      id: string;
      board_id: string;
      name: string;
      color: string;
      order_index: number;
      created_at: string;
      updated_at: string;
    }>;
    const taskCollections = this.db
      .prepare(
        `SELECT id, board_id, task_project_id, name, color, order_index, created_at, updated_at
         FROM task_collections
         ORDER BY order_index ASC, created_at ASC`
      )
      .all() as Array<{
      id: string;
      board_id: string;
      task_project_id: string | null;
      name: string;
      color: string;
      order_index: number;
      created_at: string;
      updated_at: string;
    }>;
    const tasks = this.db
      .prepare(
        `SELECT id, board_id, column_id, task_project_id, task_collection_id, title, description, priority, order_index, estimated_completion_date,
                estimated_pomodoros, actual_tracked_seconds, pomodoro_count, completed_at, created_at, updated_at
         FROM tasks
         ORDER BY column_id ASC, order_index ASC`
      )
      .all() as Array<{
      id: string;
      board_id: string;
      column_id: string;
      task_project_id: string | null;
      task_collection_id: string | null;
      title: string;
      description: string;
      priority: "low" | "medium" | "high";
      order_index: number;
      estimated_completion_date: string | null;
      estimated_pomodoros: number;
      actual_tracked_seconds: number;
      pomodoro_count: number;
      completed_at: string | null;
      created_at: string;
      updated_at: string;
    }>;
    const completedColumnIds = new Set(
      columns
        .filter((column) => ["completed", "done"].includes(column.name.trim().toLowerCase()))
        .map((column) => column.id)
    );
    const fieldDefinitions = this.db
      .prepare(
        "SELECT id, board_id, name, type, scope, created_at, updated_at FROM field_definitions ORDER BY created_at ASC"
      )
      .all() as Array<{
      id: string;
      board_id: string;
      name: string;
      type: "text" | "number" | "boolean";
      scope: "global" | "task_specific";
      created_at: string;
      updated_at: string;
    }>;
    const taskFieldAssignments = this.db
      .prepare("SELECT field_definition_id, task_id FROM task_field_assignments")
      .all() as Array<{
      field_definition_id: string;
      task_id: string;
    }>;
    const taskFieldValues = this.db
      .prepare(
        `SELECT id, task_id, field_definition_id, type, text_value, number_value, boolean_value
         FROM task_field_values`
      )
      .all() as Array<{
      id: string;
      task_id: string;
      field_definition_id: string;
      type: "text" | "number" | "boolean";
      text_value: string | null;
      number_value: number | null;
      boolean_value: number | null;
    }>;
    const pomodoroSessions = this.db
      .prepare(
        `SELECT id, task_id, phase_type, planned_duration_seconds, actual_duration_seconds,
                status, started_at, ended_at
         FROM pomodoro_sessions
         ORDER BY started_at DESC`
      )
      .all() as Array<{
      id: string;
      task_id: string;
      phase_type: "work" | "short_break" | "long_break";
      planned_duration_seconds: number;
      actual_duration_seconds: number;
      status: "completed" | "interrupted" | "abandoned";
      started_at: string;
      ended_at: string | null;
    }>;
    const breakRecords = this.db
      .prepare(
        `SELECT id, task_id, phase_type, planned_duration_seconds, actual_duration_seconds,
                action, started_at, ended_at
         FROM break_records
         ORDER BY started_at DESC`
      )
      .all() as Array<{
      id: string;
      task_id: string;
      phase_type: "short_break" | "long_break";
      planned_duration_seconds: number;
      actual_duration_seconds: number;
      action: "completed" | "skipped";
      started_at: string;
      ended_at: string | null;
    }>;
    const procrastinationRecords = this.db
      .prepare(
        `SELECT id, task_id, actual_duration_seconds, note, started_at, ended_at
         FROM procrastination_records
         ORDER BY started_at DESC`
      )
      .all() as Array<{
      id: string;
      task_id: string;
      actual_duration_seconds: number;
      note: string;
      started_at: string;
      ended_at: string;
    }>;
    const archivedCompletedTasks = this.db
      .prepare(
        `SELECT id, original_task_id, title, priority, estimated_completion_date, completed_at,
                collection_name, collection_color, project_name, project_color, pomodoro_count,
                actual_tracked_seconds, deleted_at
         FROM archived_completed_tasks
         ORDER BY completed_at DESC, deleted_at DESC`
      )
      .all() as Array<{
      id: string;
      original_task_id: string;
      title: string;
      priority: "low" | "medium" | "high";
      estimated_completion_date: string | null;
      completed_at: string;
      collection_name: string | null;
      collection_color: string | null;
      project_name: string | null;
      project_color: string | null;
      pomodoro_count: number;
      actual_tracked_seconds: number;
      deleted_at: string;
    }>;
    const archivedPomodoroSessions = this.db
      .prepare(
        `SELECT id, task_id, phase_type, planned_duration_seconds, actual_duration_seconds,
                status, started_at, ended_at
         FROM archived_pomodoro_sessions
         ORDER BY started_at DESC`
      )
      .all() as Array<{
      id: string;
      task_id: string;
      phase_type: "work" | "short_break" | "long_break";
      planned_duration_seconds: number;
      actual_duration_seconds: number;
      status: "completed" | "interrupted" | "abandoned";
      started_at: string;
      ended_at: string | null;
    }>;
    const archivedBreakRecords = this.db
      .prepare(
        `SELECT id, task_id, phase_type, planned_duration_seconds, actual_duration_seconds,
                action, started_at, ended_at
         FROM archived_break_records
         ORDER BY started_at DESC`
      )
      .all() as Array<{
      id: string;
      task_id: string;
      phase_type: "short_break" | "long_break";
      planned_duration_seconds: number;
      actual_duration_seconds: number;
      action: "completed" | "skipped";
      started_at: string;
      ended_at: string | null;
    }>;
    const archivedProcrastinationRecords = this.db
      .prepare(
        `SELECT id, task_id, actual_duration_seconds, note, started_at, ended_at
         FROM archived_procrastination_records
         ORDER BY started_at DESC`
      )
      .all() as Array<{
      id: string;
      task_id: string;
      actual_duration_seconds: number;
      note: string;
      started_at: string;
      ended_at: string;
    }>;

    return {
      board: {
        id: board.id as BoardSnapshot["board"]["id"],
        name: board.name,
        createdAt: board.created_at,
        updatedAt: board.updated_at
      },
      columns: columns.map((row) => ({
        id: row.id as BoardSnapshot["columns"][number]["id"],
        boardId: row.board_id as BoardSnapshot["columns"][number]["boardId"],
        name: row.name as string,
        color: row.color as string,
        orderIndex: row.order_index as number,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string
      })),
      taskProjects: taskProjects.map((row) => ({
        id: row.id as BoardSnapshot["taskProjects"][number]["id"],
        boardId: row.board_id as BoardSnapshot["taskProjects"][number]["boardId"],
        name: row.name,
        color: row.color,
        orderIndex: row.order_index,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      taskCollections: taskCollections.map((row) => ({
        id: row.id as BoardSnapshot["taskCollections"][number]["id"],
        boardId: row.board_id as BoardSnapshot["taskCollections"][number]["boardId"],
        taskProjectId: row.task_project_id as BoardSnapshot["taskCollections"][number]["taskProjectId"],
        name: row.name,
        color: row.color,
        orderIndex: row.order_index,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      tasks: tasks.map((row) => ({
        id: row.id as BoardSnapshot["tasks"][number]["id"],
        boardId: row.board_id as BoardSnapshot["tasks"][number]["boardId"],
        columnId: row.column_id as BoardSnapshot["tasks"][number]["columnId"],
        taskProjectId: row.task_project_id as BoardSnapshot["tasks"][number]["taskProjectId"],
        taskCollectionId: row.task_collection_id as BoardSnapshot["tasks"][number]["taskCollectionId"],
        title: row.title as string,
        description: row.description as string,
        priority: row.priority as BoardSnapshot["tasks"][number]["priority"],
        orderIndex: row.order_index as number,
        estimatedCompletionDate: row.estimated_completion_date as string | null,
        estimatedPomodoros: row.estimated_pomodoros as number,
        actualTrackedSeconds: row.actual_tracked_seconds as number,
        pomodoroCount: row.pomodoro_count as number,
        completedAt:
          (row.completed_at as string | null) ??
          (completedColumnIds.has(row.column_id) ? (row.updated_at as string) : null),
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string
      })),
      fieldDefinitions: fieldDefinitions.map((row) => ({
        id: row.id as BoardSnapshot["fieldDefinitions"][number]["id"],
        boardId: row.board_id as BoardSnapshot["fieldDefinitions"][number]["boardId"],
        name: row.name as string,
        type: row.type as BoardSnapshot["fieldDefinitions"][number]["type"],
        scope: row.scope as BoardSnapshot["fieldDefinitions"][number]["scope"],
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string
      })),
      taskFieldAssignments: taskFieldAssignments.map((row) => ({
        fieldDefinitionId: row.field_definition_id as BoardSnapshot["taskFieldAssignments"][number]["fieldDefinitionId"],
        taskId: row.task_id as BoardSnapshot["taskFieldAssignments"][number]["taskId"]
      })),
      taskFieldValues: taskFieldValues.flatMap<BoardSnapshot["taskFieldValues"][number]>((row) => {
        if (row.type === "text" && row.text_value !== null) {
          return [
            {
              id: row.id as BoardSnapshot["taskFieldValues"][number]["id"],
              taskId: row.task_id as BoardSnapshot["taskFieldValues"][number]["taskId"],
              fieldDefinitionId: row.field_definition_id as BoardSnapshot["taskFieldValues"][number]["fieldDefinitionId"],
              type: "text" as const,
              value: row.text_value
            }
          ];
        }

        if (row.type === "number" && row.number_value !== null) {
          return [
            {
              id: row.id as BoardSnapshot["taskFieldValues"][number]["id"],
              taskId: row.task_id as BoardSnapshot["taskFieldValues"][number]["taskId"],
              fieldDefinitionId: row.field_definition_id as BoardSnapshot["taskFieldValues"][number]["fieldDefinitionId"],
              type: "number" as const,
              value: row.number_value
            }
          ];
        }

        if (row.type === "boolean" && row.boolean_value !== null) {
          return [
            {
              id: row.id as BoardSnapshot["taskFieldValues"][number]["id"],
              taskId: row.task_id as BoardSnapshot["taskFieldValues"][number]["taskId"],
              fieldDefinitionId: row.field_definition_id as BoardSnapshot["taskFieldValues"][number]["fieldDefinitionId"],
              type: "boolean" as const,
              value: Boolean(row.boolean_value)
            }
          ];
        }

        return [];
      }),
      pomodoroSessions: pomodoroSessions.map((row) => ({
        id: row.id as BoardSnapshot["pomodoroSessions"][number]["id"],
        taskId: row.task_id as BoardSnapshot["pomodoroSessions"][number]["taskId"],
        phaseType: row.phase_type as BoardSnapshot["pomodoroSessions"][number]["phaseType"],
        plannedDurationSeconds: row.planned_duration_seconds as number,
        actualDurationSeconds: row.actual_duration_seconds as number,
        status: row.status as BoardSnapshot["pomodoroSessions"][number]["status"],
        startedAt: row.started_at as string,
        endedAt: row.ended_at as string | null
      })),
      breakRecords: breakRecords.map((row) => ({
        id: row.id as BoardSnapshot["breakRecords"][number]["id"],
        taskId: row.task_id as BoardSnapshot["breakRecords"][number]["taskId"],
        phaseType: row.phase_type as BoardSnapshot["breakRecords"][number]["phaseType"],
        plannedDurationSeconds: row.planned_duration_seconds as number,
        actualDurationSeconds: row.actual_duration_seconds as number,
        action: row.action as BoardSnapshot["breakRecords"][number]["action"],
        startedAt: row.started_at as string,
        endedAt: row.ended_at as string | null
      })),
      procrastinationRecords: procrastinationRecords.map((row) => ({
        id: row.id as BoardSnapshot["procrastinationRecords"][number]["id"],
        taskId: row.task_id as BoardSnapshot["procrastinationRecords"][number]["taskId"],
        actualDurationSeconds: row.actual_duration_seconds,
        note: row.note,
        startedAt: row.started_at,
        endedAt: row.ended_at
      })),
      archivedCompletedTasks: archivedCompletedTasks.map((row) => ({
        id: row.id as BoardSnapshot["archivedCompletedTasks"][number]["id"],
        originalTaskId:
          row.original_task_id as BoardSnapshot["archivedCompletedTasks"][number]["originalTaskId"],
        title: row.title,
        priority: row.priority,
        estimatedCompletionDate: row.estimated_completion_date,
        completedAt: row.completed_at,
        collectionName: row.collection_name,
        collectionColor: row.collection_color,
        projectName: row.project_name,
        projectColor: row.project_color,
        pomodoroCount: row.pomodoro_count,
        actualTrackedSeconds: row.actual_tracked_seconds,
        deletedAt: row.deleted_at
      })),
      archivedPomodoroSessions: archivedPomodoroSessions.map((row) => ({
        id: row.id as BoardSnapshot["archivedPomodoroSessions"][number]["id"],
        taskId: row.task_id as BoardSnapshot["archivedPomodoroSessions"][number]["taskId"],
        phaseType: row.phase_type as BoardSnapshot["archivedPomodoroSessions"][number]["phaseType"],
        plannedDurationSeconds: row.planned_duration_seconds as number,
        actualDurationSeconds: row.actual_duration_seconds as number,
        status: row.status as BoardSnapshot["archivedPomodoroSessions"][number]["status"],
        startedAt: row.started_at as string,
        endedAt: row.ended_at as string | null
      })),
      archivedBreakRecords: archivedBreakRecords.map((row) => ({
        id: row.id as BoardSnapshot["archivedBreakRecords"][number]["id"],
        taskId: row.task_id as BoardSnapshot["archivedBreakRecords"][number]["taskId"],
        phaseType: row.phase_type as BoardSnapshot["archivedBreakRecords"][number]["phaseType"],
        plannedDurationSeconds: row.planned_duration_seconds as number,
        actualDurationSeconds: row.actual_duration_seconds as number,
        action: row.action as BoardSnapshot["archivedBreakRecords"][number]["action"],
        startedAt: row.started_at as string,
        endedAt: row.ended_at as string | null
      })),
      archivedProcrastinationRecords: archivedProcrastinationRecords.map((row) => ({
        id: row.id as BoardSnapshot["archivedProcrastinationRecords"][number]["id"],
        taskId:
          row.task_id as BoardSnapshot["archivedProcrastinationRecords"][number]["taskId"],
        actualDurationSeconds: row.actual_duration_seconds,
        note: row.note,
        startedAt: row.started_at,
        endedAt: row.ended_at
      }))
    };
  }

  public saveBoardSnapshot(snapshot: BoardSnapshot): void {
    const transaction = this.db.transaction((currentSnapshot: BoardSnapshot) => {
      this.db.prepare("DELETE FROM archived_procrastination_records").run();
      this.db.prepare("DELETE FROM archived_break_records").run();
      this.db.prepare("DELETE FROM archived_pomodoro_sessions").run();
      this.db.prepare("DELETE FROM archived_completed_tasks").run();
      this.db.prepare("DELETE FROM procrastination_records").run();
      this.db.prepare("DELETE FROM break_records").run();
      this.db.prepare("DELETE FROM pomodoro_sessions").run();
      this.db.prepare("DELETE FROM task_field_values").run();
      this.db.prepare("DELETE FROM task_field_assignments").run();
      this.db.prepare("DELETE FROM field_definitions").run();
      this.db.prepare("DELETE FROM tasks").run();
      this.db.prepare("DELETE FROM task_collections").run();
      this.db.prepare("DELETE FROM task_projects").run();
      this.db.prepare("DELETE FROM columns").run();
      this.db.prepare("DELETE FROM boards").run();

      this.db
        .prepare(insertBoard)
        .run({
          id: currentSnapshot.board.id,
          name: currentSnapshot.board.name,
          created_at: currentSnapshot.board.createdAt,
          updated_at: currentSnapshot.board.updatedAt
        });

      const insertColumnStatement = this.db.prepare(insertColumn);
      currentSnapshot.columns.forEach((column) => {
        insertColumnStatement.run({
          id: column.id,
          board_id: column.boardId,
          name: column.name,
          color: column.color,
          order_index: column.orderIndex,
          created_at: column.createdAt,
          updated_at: column.updatedAt
        });
      });

      const insertTaskProjectStatement = this.db.prepare(insertTaskProject);
      currentSnapshot.taskProjects.forEach((taskProject) => {
        insertTaskProjectStatement.run({
          id: taskProject.id,
          board_id: taskProject.boardId,
          name: taskProject.name,
          color: taskProject.color,
          order_index: taskProject.orderIndex,
          created_at: taskProject.createdAt,
          updated_at: taskProject.updatedAt
        });
      });

      const insertTaskCollectionStatement = this.db.prepare(insertTaskCollection);
      currentSnapshot.taskCollections.forEach((taskCollection) => {
        insertTaskCollectionStatement.run({
          id: taskCollection.id,
          board_id: taskCollection.boardId,
          task_project_id: taskCollection.taskProjectId,
          name: taskCollection.name,
          color: taskCollection.color,
          order_index: taskCollection.orderIndex,
          created_at: taskCollection.createdAt,
          updated_at: taskCollection.updatedAt
        });
      });

      const insertTaskStatement = this.db.prepare(insertTask);
      currentSnapshot.tasks.forEach((task) => {
        insertTaskStatement.run({
          id: task.id,
          board_id: task.boardId,
          column_id: task.columnId,
          task_project_id: task.taskProjectId,
          task_collection_id: task.taskCollectionId,
          title: task.title,
          description: task.description,
          priority: task.priority,
          order_index: task.orderIndex,
          estimated_completion_date: task.estimatedCompletionDate,
          estimated_pomodoros: task.estimatedPomodoros,
          actual_tracked_seconds: task.actualTrackedSeconds,
          pomodoro_count: task.pomodoroCount,
          completed_at: task.completedAt,
          created_at: task.createdAt,
          updated_at: task.updatedAt
        });
      });

      const insertFieldDefinitionStatement = this.db.prepare(insertFieldDefinition);
      currentSnapshot.fieldDefinitions.forEach((fieldDefinition) => {
        insertFieldDefinitionStatement.run({
          id: fieldDefinition.id,
          board_id: fieldDefinition.boardId,
          name: fieldDefinition.name,
          type: fieldDefinition.type,
          scope: fieldDefinition.scope,
          created_at: fieldDefinition.createdAt,
          updated_at: fieldDefinition.updatedAt
        });
      });

      const insertTaskFieldAssignmentStatement = this.db.prepare(insertTaskFieldAssignment);
      currentSnapshot.taskFieldAssignments.forEach((assignment) => {
        insertTaskFieldAssignmentStatement.run({
          field_definition_id: assignment.fieldDefinitionId,
          task_id: assignment.taskId
        });
      });

      const insertTaskFieldValueStatement = this.db.prepare(insertTaskFieldValue);
      currentSnapshot.taskFieldValues.forEach((fieldValue) => {
        insertTaskFieldValueStatement.run({
          id: fieldValue.id,
          task_id: fieldValue.taskId,
          field_definition_id: fieldValue.fieldDefinitionId,
          type: fieldValue.type,
          text_value: fieldValue.type === "text" ? fieldValue.value : null,
          number_value: fieldValue.type === "number" ? fieldValue.value : null,
          boolean_value:
            fieldValue.type === "boolean" ? Number(fieldValue.value) : null
        });
      });

      const insertPomodoroSessionStatement = this.db.prepare(insertPomodoroSession);
      currentSnapshot.pomodoroSessions.forEach((session) => {
        insertPomodoroSessionStatement.run({
          id: session.id,
          task_id: session.taskId,
          phase_type: session.phaseType,
          planned_duration_seconds: session.plannedDurationSeconds,
          actual_duration_seconds: session.actualDurationSeconds,
          status: session.status,
          started_at: session.startedAt,
          ended_at: session.endedAt
        });
      });

      const insertBreakRecordStatement = this.db.prepare(insertBreakRecord);
      currentSnapshot.breakRecords.forEach((record) => {
        insertBreakRecordStatement.run({
          id: record.id,
          task_id: record.taskId,
          phase_type: record.phaseType,
          planned_duration_seconds: record.plannedDurationSeconds,
          actual_duration_seconds: record.actualDurationSeconds,
          action: record.action,
          started_at: record.startedAt,
          ended_at: record.endedAt
        });
      });

      const insertProcrastinationRecordStatement = this.db.prepare(
        insertProcrastinationRecord
      );
      currentSnapshot.procrastinationRecords.forEach((record) => {
        insertProcrastinationRecordStatement.run({
          id: record.id,
          task_id: record.taskId,
          actual_duration_seconds: record.actualDurationSeconds,
          note: record.note,
          started_at: record.startedAt,
          ended_at: record.endedAt
        });
      });

      const insertArchivedCompletedTaskStatement = this.db.prepare(insertArchivedCompletedTask);
      currentSnapshot.archivedCompletedTasks.forEach((task) => {
        insertArchivedCompletedTaskStatement.run({
          id: task.id,
          original_task_id: task.originalTaskId,
          title: task.title,
          priority: task.priority,
          estimated_completion_date: task.estimatedCompletionDate,
          completed_at: task.completedAt,
          collection_name: task.collectionName,
          collection_color: task.collectionColor,
          project_name: task.projectName,
          project_color: task.projectColor,
          pomodoro_count: task.pomodoroCount,
          actual_tracked_seconds: task.actualTrackedSeconds,
          deleted_at: task.deletedAt
        });
      });

      const insertArchivedPomodoroSessionStatement = this.db.prepare(
        insertArchivedPomodoroSession
      );
      currentSnapshot.archivedPomodoroSessions.forEach((session) => {
        insertArchivedPomodoroSessionStatement.run({
          id: session.id,
          task_id: session.taskId,
          phase_type: session.phaseType,
          planned_duration_seconds: session.plannedDurationSeconds,
          actual_duration_seconds: session.actualDurationSeconds,
          status: session.status,
          started_at: session.startedAt,
          ended_at: session.endedAt
        });
      });

      const insertArchivedBreakRecordStatement = this.db.prepare(insertArchivedBreakRecord);
      currentSnapshot.archivedBreakRecords.forEach((record) => {
        insertArchivedBreakRecordStatement.run({
          id: record.id,
          task_id: record.taskId,
          phase_type: record.phaseType,
          planned_duration_seconds: record.plannedDurationSeconds,
          actual_duration_seconds: record.actualDurationSeconds,
          action: record.action,
          started_at: record.startedAt,
          ended_at: record.endedAt
        });
      });

      const insertArchivedProcrastinationRecordStatement = this.db.prepare(
        insertArchivedProcrastinationRecord
      );
      currentSnapshot.archivedProcrastinationRecords.forEach((record) => {
        insertArchivedProcrastinationRecordStatement.run({
          id: record.id,
          task_id: record.taskId,
          actual_duration_seconds: record.actualDurationSeconds,
          note: record.note,
          started_at: record.startedAt,
          ended_at: record.endedAt
        });
      });
    });

    transaction(snapshot);
  }

  public loadAppSettings(): AppSettingsSnapshot {
    const row = this.db
      .prepare("SELECT value FROM app_settings WHERE key = ?")
      .get("pomodoro_config") as { value: string } | undefined;

    if (!row) {
      return { pomodoroConfig: defaultPomodoroConfig };
    }

    const parsedConfig = JSON.parse(row.value) as Partial<AppSettingsSnapshot["pomodoroConfig"]>;

    return {
      pomodoroConfig: {
        ...defaultPomodoroConfig,
        ...parsedConfig
      }
    };
  }

  public savePomodoroConfig(config: AppSettingsSnapshot["pomodoroConfig"]): void {
    this.db
      .prepare(
        `INSERT INTO app_settings (key, value)
         VALUES (@key, @value)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run({
        key: "pomodoro_config",
        value: JSON.stringify(config)
      });
  }

  private ensureSchema(): void {
    this.db.exec(`
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

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  private ensureTaskColumns(): void {
    const columns = this.db
      .prepare("PRAGMA table_info(tasks)")
      .all() as Array<{ name: string }>;
    const existingColumnNames = new Set(columns.map((column) => column.name));
    const boardColumns = this.db
      .prepare("PRAGMA table_info(columns)")
      .all() as Array<{ name: string }>;
    const existingBoardColumnNames = new Set(boardColumns.map((column) => column.name));
    const taskCollectionColumns = this.db
      .prepare("PRAGMA table_info(task_collections)")
      .all() as Array<{ name: string }>;
    const existingTaskCollectionColumnNames = new Set(
      taskCollectionColumns.map((column) => column.name)
    );

    if (!existingColumnNames.has("description")) {
      this.db.exec("ALTER TABLE tasks ADD COLUMN description TEXT NOT NULL DEFAULT ''");
    }

    if (!existingColumnNames.has("priority")) {
      this.db.exec(
        "ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'"
      );
    }

    if (!existingColumnNames.has("estimated_pomodoros")) {
      this.db.exec(
        "ALTER TABLE tasks ADD COLUMN estimated_pomodoros INTEGER NOT NULL DEFAULT 0"
      );
    }

    if (!existingColumnNames.has("task_collection_id")) {
      this.db.exec("ALTER TABLE tasks ADD COLUMN task_collection_id TEXT");
    }

    if (!existingColumnNames.has("task_project_id")) {
      this.db.exec("ALTER TABLE tasks ADD COLUMN task_project_id TEXT");
    }

    if (!existingColumnNames.has("completed_at")) {
      this.db.exec("ALTER TABLE tasks ADD COLUMN completed_at TEXT");
    }

    if (!existingBoardColumnNames.has("color")) {
      this.db.exec("ALTER TABLE columns ADD COLUMN color TEXT NOT NULL DEFAULT '#8f99b1'");
    }

    if (!existingTaskCollectionColumnNames.has("task_project_id")) {
      this.db.exec("ALTER TABLE task_collections ADD COLUMN task_project_id TEXT");
    }
  }

  private seedIfEmpty(): void {
    const boardCount = this.db
      .prepare("SELECT COUNT(*) as count FROM boards")
      .get() as { count: number };

    if (boardCount.count > 0) {
      return;
    }

    const seedTransaction = this.db.transaction(() => {
      this.db.prepare(insertBoard).run(demoBoardRow);

      const insertColumnStatement = this.db.prepare(insertColumn);
      demoColumnRows.forEach((row) => insertColumnStatement.run(row));

      const insertTaskProjectStatement = this.db.prepare(insertTaskProject);
      demoTaskProjectRows.forEach((row) => insertTaskProjectStatement.run(row));

      const insertTaskCollectionStatement = this.db.prepare(insertTaskCollection);
      demoTaskCollectionRows.forEach((row) => insertTaskCollectionStatement.run(row));

      const insertTaskStatement = this.db.prepare(insertTask);
      demoTaskRows.forEach((row) => insertTaskStatement.run(row));

      const insertFieldDefinitionStatement = this.db.prepare(insertFieldDefinition);
      demoFieldDefinitionRows.forEach((row) => insertFieldDefinitionStatement.run(row));

      const insertTaskFieldAssignmentStatement = this.db.prepare(insertTaskFieldAssignment);
      demoTaskFieldAssignmentRows.forEach((row) =>
        insertTaskFieldAssignmentStatement.run(row)
      );

      const insertTaskFieldValueStatement = this.db.prepare(insertTaskFieldValue);
      demoTaskFieldValueRows.forEach((row) => insertTaskFieldValueStatement.run(row));

      const insertPomodoroSessionStatement = this.db.prepare(insertPomodoroSession);
      demoPomodoroSessionRows.forEach((row) => insertPomodoroSessionStatement.run(row));

      const insertBreakRecordStatement = this.db.prepare(insertBreakRecord);
      demoBreakRecordRows.forEach((row) => insertBreakRecordStatement.run(row));

      const insertProcrastinationRecordStatement = this.db.prepare(
        insertProcrastinationRecord
      );
      demoProcrastinationRecordRows.forEach((row) =>
        insertProcrastinationRecordStatement.run(row)
      );

      this.savePomodoroConfig(defaultPomodoroConfig);
    });

    seedTransaction();
  }
}
