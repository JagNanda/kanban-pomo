import {
  demoBoardRow,
  demoBreakRecordRows,
  demoColumnRows,
  demoFieldDefinitionRows,
  demoInterruptionRecordRows,
  demoPomodoroSessionRows,
  demoTaskCollectionRows,
  demoTaskProjectRows,
  demoTaskFieldAssignmentRows,
  demoTaskFieldValueRows,
  demoTaskRows
} from "../../../database/seed/demo-data";
import type { Board } from "../domain/board.types";
import type { Column } from "../../columns/domain/column.types";
import type {
  FieldDefinition,
  TaskFieldAssignment,
  TaskFieldValue
} from "../../custom-fields/domain/custom-fields.types";
import type {
  BreakRecord,
  InterruptionRecord,
  PomodoroSession,
  ProcrastinationRecord
} from "../../pomodoro/domain/pomodoro.types";
import type { ArchivedCompletedTask } from "../../report/domain/report-history.types";
import type { TaskCollection } from "../../tasks/domain/task-collection.types";
import type { TaskProject } from "../../tasks/domain/task-project.types";
import type { Task } from "../../tasks/domain/task.types";

export interface LoadedBoardState {
  board: Board;
  columns: Column[];
  taskProjects: TaskProject[];
  taskCollections: TaskCollection[];
  tasks: Task[];
  fieldDefinitions: FieldDefinition[];
  taskFieldAssignments: TaskFieldAssignment[];
  taskFieldValues: TaskFieldValue[];
  pomodoroSessions: PomodoroSession[];
  breakRecords: BreakRecord[];
  procrastinationRecords: ProcrastinationRecord[];
  interruptionRecords: InterruptionRecord[];
  archivedCompletedTasks: ArchivedCompletedTask[];
  archivedPomodoroSessions: PomodoroSession[];
  archivedBreakRecords: BreakRecord[];
  archivedProcrastinationRecords: ProcrastinationRecord[];
  archivedInterruptionRecords: InterruptionRecord[];
}

export const loadMockBoardState = (): LoadedBoardState => ({
  board: {
    id: demoBoardRow.id as Board["id"],
    name: demoBoardRow.name,
    createdAt: demoBoardRow.created_at,
    updatedAt: demoBoardRow.updated_at
  },
  columns: demoColumnRows.map((row) => ({
    id: row.id as Column["id"],
    boardId: row.board_id as Column["boardId"],
    name: row.name,
    color: row.color,
    orderIndex: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })),
  taskProjects: demoTaskProjectRows.map((row) => ({
    id: row.id as TaskProject["id"],
    boardId: row.board_id as TaskProject["boardId"],
    name: row.name,
    color: row.color,
    orderIndex: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })),
  taskCollections: demoTaskCollectionRows.map((row) => ({
    id: row.id as TaskCollection["id"],
    boardId: row.board_id as TaskCollection["boardId"],
    taskProjectId: row.task_project_id as TaskCollection["taskProjectId"],
    name: row.name,
    color: row.color,
    orderIndex: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })),
  tasks: demoTaskRows.map((row) => ({
    id: row.id as Task["id"],
    boardId: row.board_id as Task["boardId"],
    columnId: row.column_id as Task["columnId"],
    taskProjectId: row.task_project_id as Task["taskProjectId"],
    taskCollectionId: row.task_collection_id as Task["taskCollectionId"],
    title: row.title,
    description: row.description,
    priority: row.priority,
    orderIndex: row.order_index,
    estimatedCompletionDate: row.estimated_completion_date,
    estimatedPomodoros: row.estimated_pomodoros,
    actualTrackedSeconds: row.actual_tracked_seconds,
    pomodoroCount: row.pomodoro_count,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })),
  fieldDefinitions: demoFieldDefinitionRows.map((row) => ({
    id: row.id as FieldDefinition["id"],
    boardId: row.board_id as FieldDefinition["boardId"],
    name: row.name,
    type: row.type,
    scope: row.scope,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })),
  taskFieldAssignments: demoTaskFieldAssignmentRows.map((row) => ({
    fieldDefinitionId: row.field_definition_id as TaskFieldAssignment["fieldDefinitionId"],
    taskId: row.task_id as TaskFieldAssignment["taskId"]
  })),
  taskFieldValues: demoTaskFieldValueRows.flatMap<TaskFieldValue>((row) => {
    if (row.type === "text" && row.text_value !== null) {
      return [
        {
          id: row.id as TaskFieldValue["id"],
          taskId: row.task_id as TaskFieldValue["taskId"],
          fieldDefinitionId: row.field_definition_id as TaskFieldValue["fieldDefinitionId"],
          type: "text" as const,
          value: row.text_value
        }
      ];
    }

    if (row.type === "number" && row.number_value !== null) {
      return [
        {
          id: row.id as TaskFieldValue["id"],
          taskId: row.task_id as TaskFieldValue["taskId"],
          fieldDefinitionId: row.field_definition_id as TaskFieldValue["fieldDefinitionId"],
          type: "number" as const,
          value: row.number_value
        }
      ];
    }

    if (row.type === "boolean" && row.boolean_value !== null) {
      return [
        {
          id: row.id as TaskFieldValue["id"],
          taskId: row.task_id as TaskFieldValue["taskId"],
          fieldDefinitionId: row.field_definition_id as TaskFieldValue["fieldDefinitionId"],
          type: "boolean" as const,
          value: Boolean(row.boolean_value)
        }
      ];
    }

    return [];
  }),
  pomodoroSessions: demoPomodoroSessionRows.map((row) => ({
    id: row.id as PomodoroSession["id"],
    taskId: row.task_id as PomodoroSession["taskId"],
    phaseType: row.phase_type,
    plannedDurationSeconds: row.planned_duration_seconds,
    actualDurationSeconds: row.actual_duration_seconds,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at
  })),
  breakRecords: demoBreakRecordRows.map((row) => ({
    id: row.id as BreakRecord["id"],
    taskId: row.task_id as BreakRecord["taskId"],
    phaseType: row.phase_type,
    plannedDurationSeconds: row.planned_duration_seconds,
    actualDurationSeconds: row.actual_duration_seconds,
    action: row.action,
    startedAt: row.started_at,
    endedAt: row.ended_at
  })),
  procrastinationRecords: [],
  interruptionRecords: demoInterruptionRecordRows.map((row) => ({
    id: row.id as InterruptionRecord["id"],
    taskId: row.task_id as InterruptionRecord["taskId"],
    actualDurationSeconds: row.actual_duration_seconds,
    reason: row.reason,
    startedAt: row.started_at,
    endedAt: row.ended_at
  })),
  archivedCompletedTasks: [],
  archivedPomodoroSessions: [],
  archivedBreakRecords: [],
  archivedProcrastinationRecords: [],
  archivedInterruptionRecords: []
});
