export type TaskRowId = string;

export interface TaskRow {
  id: TaskRowId;
  board_id: string;
  column_id: string;
  task_project_id: string | null;
  task_collection_id: string | null;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  order_index: number;
  estimated_completion_date: string | null;
  estimated_pomodoros: number;
  actual_tracked_seconds: number;
  pomodoro_count: number;
  is_study_problem: number;
  study_platform: string;
  study_url: string;
  study_difficulty: "easy" | "medium" | "hard" | null;
  study_topic: string;
  study_status: "unstarted" | "attempted" | "solved" | "reviewing";
  times_completed: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
