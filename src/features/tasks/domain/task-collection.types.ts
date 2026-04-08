import type { Brand } from "../../../shared/domain/brand";
import type { BoardId } from "../../board/domain/board.types";
import type { TaskProjectId } from "./task-project.types";

export type TaskCollectionId = Brand<string, "TaskCollectionId">;

export interface TaskCollection {
  id: TaskCollectionId;
  boardId: BoardId;
  taskProjectId: TaskProjectId | null;
  name: string;
  color: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}
