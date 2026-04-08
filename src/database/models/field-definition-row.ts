export type FieldDefinitionRowId = string;

export type FieldTypeRow = "text" | "number" | "boolean";
export type FieldScopeRow = "global" | "task_specific";

export interface FieldDefinitionRow {
  id: FieldDefinitionRowId;
  board_id: string;
  name: string;
  type: FieldTypeRow;
  scope: FieldScopeRow;
  created_at: string;
  updated_at: string;
}

