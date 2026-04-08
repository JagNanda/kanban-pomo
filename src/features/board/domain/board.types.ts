import type { Brand } from "../../../shared/domain/brand";

export type BoardId = Brand<string, "BoardId">;

export interface Board {
  id: BoardId;
  name: string;
  createdAt: string;
  updatedAt: string;
}

