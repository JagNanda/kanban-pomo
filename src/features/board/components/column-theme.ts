export interface ColumnTheme {
  accent: string;
  background: string;
  border: string;
  dot: string;
}

const todoTheme: ColumnTheme = {
  accent: "#f091c5",
  background: "rgba(73, 28, 57, 0.58)",
  border: "rgba(240, 145, 197, 0.72)",
  dot: "#f091c5"
};

const inProgressTheme: ColumnTheme = {
  accent: "#de9a34",
  background: "rgba(88, 61, 24, 0.58)",
  border: "rgba(222, 154, 52, 0.72)",
  dot: "#de9a34"
};

const reviewTheme: ColumnTheme = {
  accent: "#33a8bc",
  background: "rgba(20, 74, 86, 0.58)",
  border: "rgba(51, 168, 188, 0.72)",
  dot: "#48c4d9"
};

const doneTheme: ColumnTheme = {
  accent: "#8b74ea",
  background: "rgba(55, 42, 92, 0.58)",
  border: "rgba(139, 116, 234, 0.72)",
  dot: "#8b74ea"
};

const fallbackThemes: ColumnTheme[] = [
  todoTheme,
  inProgressTheme,
  reviewTheme,
  doneTheme
];

export const getColumnTheme = (columnName: string, index: number): ColumnTheme => {
  const normalized = columnName.trim().toLowerCase();
  const fallbackTheme = fallbackThemes[index % fallbackThemes.length] ?? todoTheme;

  if (
    normalized.includes("to do") ||
    normalized.includes("not yet") ||
    normalized.includes("backlog")
  ) {
    return todoTheme;
  }

  if (
    normalized.includes("in dev") ||
    normalized.includes("in progress") ||
    normalized.includes("doing")
  ) {
    return inProgressTheme;
  }

  if (normalized.includes("review")) {
    return reviewTheme;
  }

  if (normalized.includes("complete") || normalized.includes("done")) {
    return doneTheme;
  }

  return fallbackTheme;
};
