import type { Brand } from "../../../shared/domain/brand";
import type { BoardId } from "../../board/domain/board.types";

export type ColumnId = Brand<string, "ColumnId">;

export interface Column {
  id: ColumnId;
  boardId: BoardId;
  name: string;
  color: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}
