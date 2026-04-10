export type ColumnRowId = string;

export interface ColumnRow {
  id: ColumnRowId;
  board_id: string;
  name: string;
  color: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}
