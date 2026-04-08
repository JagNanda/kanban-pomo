export type TaskFieldValueRowId = string;

export interface TaskFieldValueRow {
  id: TaskFieldValueRowId;
  task_id: string;
  field_definition_id: string;
  type: "text" | "number" | "boolean";
  text_value: string | null;
  number_value: number | null;
  boolean_value: number | null;
}

