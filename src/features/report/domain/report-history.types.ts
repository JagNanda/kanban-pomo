import type { Brand } from "../../../shared/domain/brand";
import type { TaskId, TaskPriority } from "../../tasks/domain/task.types";

export type ArchivedCompletedTaskId = Brand<string, "ArchivedCompletedTaskId">;

export interface ArchivedCompletedTask {
  id: ArchivedCompletedTaskId;
  originalTaskId: TaskId;
  title: string;
  priority: TaskPriority;
  estimatedCompletionDate: string | null;
  completedAt: string;
  collectionName: string | null;
  collectionColor: string | null;
  projectName: string | null;
  projectColor: string | null;
  pomodoroCount: number;
  actualTrackedSeconds: number;
  deletedAt: string;
}
