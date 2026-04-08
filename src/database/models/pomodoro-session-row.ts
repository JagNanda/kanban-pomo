export type PomodoroSessionRowId = string;

export type PomodoroPhaseTypeRow = "work" | "short_break" | "long_break";
export type PomodoroSessionStatusRow =
  | "completed"
  | "interrupted"
  | "abandoned";

export interface PomodoroSessionRow {
  id: PomodoroSessionRowId;
  task_id: string;
  phase_type: PomodoroPhaseTypeRow;
  planned_duration_seconds: number;
  actual_duration_seconds: number;
  status: PomodoroSessionStatusRow;
  started_at: string;
  ended_at: string | null;
}

