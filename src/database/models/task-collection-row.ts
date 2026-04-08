export type TaskCollectionRowId = string;

export interface TaskCollectionRow {
  id: TaskCollectionRowId;
  board_id: string;
  task_project_id: string | null;
  name: string;
  color: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}
