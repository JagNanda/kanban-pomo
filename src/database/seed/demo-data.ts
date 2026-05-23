import type { BoardRow } from "../models/board-row";
import type { BreakRecordRow } from "../models/break-record-row";
import type { ColumnRow } from "../models/column-row";
import type { FieldDefinitionRow } from "../models/field-definition-row";
import type { InterruptionRecordRow } from "../models/interruption-record-row";
import type { AiWorkRecordRow } from "../models/ai-work-record-row";
import type { PomodoroSessionRow } from "../models/pomodoro-session-row";
import type { ProcrastinationRecordRow } from "../models/procrastination-record-row";
import type { TaskCollectionRow } from "../models/task-collection-row";
import type { TaskProjectRow } from "../models/task-project-row";
import type { TaskFieldAssignmentRow } from "../models/task-field-assignment-row";
import type { TaskFieldValueRow } from "../models/task-field-value-row";
import type { TaskRow } from "../models/task-row";

const createdAt = "2026-03-27T12:00:00.000Z";

export const demoBoardRow: BoardRow = {
  id: "board_main",
  name: "Studio Sprint Board",
  created_at: createdAt,
  updated_at: createdAt
};

export const demoColumnRows: ColumnRow[] = [
  {
    id: "column_backlog",
    board_id: "board_main",
    name: "Not Yet Started",
    color: "#f091c5",
    order_index: 0,
    created_at: createdAt,
    updated_at: createdAt
  },
  {
    id: "column_dev",
    board_id: "board_main",
    name: "In Dev",
    color: "#de9a34",
    order_index: 1,
    created_at: createdAt,
    updated_at: createdAt
  },
  {
    id: "column_review",
    board_id: "board_main",
    name: "Code Review",
    color: "#48c4d9",
    order_index: 2,
    created_at: createdAt,
    updated_at: createdAt
  },
  {
    id: "column_done",
    board_id: "board_main",
    name: "Completed",
    color: "#8b74ea",
    order_index: 3,
    created_at: createdAt,
    updated_at: createdAt
  }
];

export const demoTaskProjectRows: TaskProjectRow[] = [
  {
    id: "project_marketing_site",
    board_id: "board_main",
    name: "Marketing Site",
    color: "#f091c5",
    is_study_project: 0,
    order_index: 0,
    created_at: createdAt,
    updated_at: createdAt
  },
  {
    id: "project_desktop_app",
    board_id: "board_main",
    name: "Desktop App",
    color: "#48c4d9",
    is_study_project: 0,
    order_index: 1,
    created_at: createdAt,
    updated_at: createdAt
  }
];

export const demoTaskCollectionRows: TaskCollectionRow[] = [
  {
    id: "collection_landing_page",
    board_id: "board_main",
    task_project_id: "project_marketing_site",
    name: "Landing Page",
    color: "#f091c5",
    order_index: 0,
    created_at: createdAt,
    updated_at: createdAt
  },
  {
    id: "collection_desktop_foundation",
    board_id: "board_main",
    task_project_id: "project_desktop_app",
    name: "Desktop Foundation",
    color: "#de9a34",
    order_index: 1,
    created_at: createdAt,
    updated_at: createdAt
  },
  {
    id: "collection_focus_flow",
    board_id: "board_main",
    task_project_id: "project_desktop_app",
    name: "Focus Flow",
    color: "#48c4d9",
    order_index: 2,
    created_at: createdAt,
    updated_at: createdAt
  }
];

export const demoTaskRows: TaskRow[] = [
  {
    id: "task_shell",
    board_id: "board_main",
    column_id: "column_dev",
    task_project_id: "project_desktop_app",
    task_collection_id: "collection_desktop_foundation",
    title: "Shape the desktop shell and preload bridge",
    description: "Wire the main process, preload bridge, and renderer together cleanly.",
    priority: "high",
    order_index: 0,
    estimated_completion_date: "2026-03-29",
    estimated_pomodoros: 4,
    actual_tracked_seconds: 5400,
    ai_tracked_seconds: 0,
    pomodoro_count: 3,
    is_study_problem: 0,
    study_platform: "",
    study_url: "",
    study_difficulty: null,
    study_topic: "",
    study_status: "unstarted",
    times_completed: 0,
    completed_at: null,
    created_at: createdAt,
    updated_at: createdAt
  },
  {
    id: "task_fields",
    board_id: "board_main",
    column_id: "column_backlog",
    task_project_id: "project_marketing_site",
    task_collection_id: "collection_landing_page",
    title: "Build custom field management for task-specific metadata",
    description: "Support flexible task schemas while keeping the core task model simple.",
    priority: "medium",
    order_index: 0,
    estimated_completion_date: "2026-03-30",
    estimated_pomodoros: 5,
    actual_tracked_seconds: 1800,
    ai_tracked_seconds: 0,
    pomodoro_count: 1,
    is_study_problem: 0,
    study_platform: "",
    study_url: "",
    study_difficulty: null,
    study_topic: "",
    study_status: "unstarted",
    times_completed: 0,
    completed_at: null,
    created_at: createdAt,
    updated_at: createdAt
  },
  {
    id: "task_timer",
    board_id: "board_main",
    column_id: "column_review",
    task_project_id: "project_desktop_app",
    task_collection_id: "collection_focus_flow",
    title: "Refine the Pomodoro transitions and interruption tracking",
    description: "Make work, break, and interruption history feel reliable and clear in the UI.",
    priority: "medium",
    order_index: 0,
    estimated_completion_date: "2026-03-28",
    estimated_pomodoros: 3,
    actual_tracked_seconds: 3600,
    ai_tracked_seconds: 0,
    pomodoro_count: 2,
    is_study_problem: 0,
    study_platform: "",
    study_url: "",
    study_difficulty: null,
    study_topic: "",
    study_status: "unstarted",
    times_completed: 0,
    completed_at: null,
    created_at: createdAt,
    updated_at: createdAt
  }
];

export const demoFieldDefinitionRows: FieldDefinitionRow[] = [];

export const demoTaskFieldAssignmentRows: TaskFieldAssignmentRow[] = [];

export const demoTaskFieldValueRows: TaskFieldValueRow[] = [];

export const demoPomodoroSessionRows: PomodoroSessionRow[] = [
  {
    id: "session_shell_1",
    task_id: "task_shell",
    phase_type: "work",
    planned_duration_seconds: 1500,
    actual_duration_seconds: 1500,
    status: "completed",
    started_at: "2026-03-26T13:00:00.000Z",
    ended_at: "2026-03-26T13:25:00.000Z"
  },
  {
    id: "session_timer_interrupt",
    task_id: "task_timer",
    phase_type: "work",
    planned_duration_seconds: 1500,
    actual_duration_seconds: 900,
    status: "interrupted",
    started_at: "2026-03-26T18:00:00.000Z",
    ended_at: "2026-03-26T18:15:00.000Z"
  }
];

export const demoBreakRecordRows: BreakRecordRow[] = [
  {
    id: "break_shell_1",
    task_id: "task_shell",
    phase_type: "short_break",
    planned_duration_seconds: 300,
    actual_duration_seconds: 300,
    action: "completed",
    started_at: "2026-03-26T13:25:00.000Z",
    ended_at: "2026-03-26T13:30:00.000Z"
  }
];

export const demoProcrastinationRecordRows: ProcrastinationRecordRow[] = [];

export const demoInterruptionRecordRows: InterruptionRecordRow[] = [];

export const demoAiWorkRecordRows: AiWorkRecordRow[] = [];
