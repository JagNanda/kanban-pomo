import type { Brand } from "../../../shared/domain/brand";
import type { BoardId } from "../../board/domain/board.types";
import type { TaskId } from "../../tasks/domain/task.types";

export type FieldDefinitionId = Brand<string, "FieldDefinitionId">;
export type TaskFieldValueId = Brand<string, "TaskFieldValueId">;

export type FieldType = "text" | "number" | "boolean";
export type FieldScope = "global" | "task_specific";

export interface FieldDefinition {
  id: FieldDefinitionId;
  boardId: BoardId;
  name: string;
  type: FieldType;
  scope: FieldScope;
  createdAt: string;
  updatedAt: string;
}

export interface TaskFieldAssignment {
  fieldDefinitionId: FieldDefinitionId;
  taskId: TaskId;
}

export type TaskFieldValue =
  | {
      id: TaskFieldValueId;
      taskId: TaskId;
      fieldDefinitionId: FieldDefinitionId;
      type: "text";
      value: string;
    }
  | {
      id: TaskFieldValueId;
      taskId: TaskId;
      fieldDefinitionId: FieldDefinitionId;
      type: "number";
      value: number;
    }
  | {
      id: TaskFieldValueId;
      taskId: TaskId;
      fieldDefinitionId: FieldDefinitionId;
      type: "boolean";
      value: boolean;
    };

