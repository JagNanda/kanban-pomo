export type TaskProjectRowId = string;

export interface TaskProjectRow {
  id: TaskProjectRowId;
  board_id: string;
  name: string;
  color: string;
  is_study_project: number;
  order_index: number;
  created_at: string;
  updated_at: string;
}
