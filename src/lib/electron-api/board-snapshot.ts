import type { Board } from "../../features/board/domain/board.types";
import type { Column } from "../../features/columns/domain/column.types";
import type {
  FieldDefinition,
  TaskFieldAssignment,
  TaskFieldValue
} from "../../features/custom-fields/domain/custom-fields.types";
import type {
  BreakRecord,
  PomodoroConfig,
  PomodoroSession
} from "../../features/pomodoro/domain/pomodoro.types";
import type { ArchivedCompletedTask } from "../../features/report/domain/report-history.types";
import type { TaskCollection } from "../../features/tasks/domain/task-collection.types";
import type { TaskProject } from "../../features/tasks/domain/task-project.types";
import type { Task } from "../../features/tasks/domain/task.types";

export interface BoardSnapshot {
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
  archivedCompletedTasks: ArchivedCompletedTask[];
  archivedPomodoroSessions: PomodoroSession[];
  archivedBreakRecords: BreakRecord[];
}

export interface AppSettingsSnapshot {
  pomodoroConfig: PomodoroConfig;
}
