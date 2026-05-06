export interface InterruptionRecordRow {
  id: string;
  task_id: string;
  actual_duration_seconds: number;
  reason: string;
  started_at: string;
  ended_at: string;
}
