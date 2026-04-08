export type BreakRecordRowId = string;

export interface BreakRecordRow {
  id: BreakRecordRowId;
  task_id: string;
  phase_type: "short_break" | "long_break";
  planned_duration_seconds: number;
  actual_duration_seconds: number;
  action: "completed" | "skipped";
  started_at: string;
  ended_at: string | null;
}
