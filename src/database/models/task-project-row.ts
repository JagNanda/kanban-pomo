export type TaskProjectRowId = string;

export interface TaskProjectRow {
  id: TaskProjectRowId;
  board_id: string;
  name: string;
  color: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}
