import type { Brand } from "../../../shared/domain/brand";
import type { BoardId } from "../../board/domain/board.types";

export type TaskProjectId = Brand<string, "TaskProjectId">;

export interface TaskProject {
  id: TaskProjectId;
  boardId: BoardId;
  name: string;
  color: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}
