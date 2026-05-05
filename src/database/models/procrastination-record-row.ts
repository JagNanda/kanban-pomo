export interface ProcrastinationRecordRow {
  id: string;
  task_id: string;
  actual_duration_seconds: number;
  note: string;
  started_at: string;
  ended_at: string;
}
