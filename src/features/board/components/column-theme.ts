export interface ColumnTheme {
  accent: string;
  background: string;
  border: string;
  dot: string;
}

const clampRgbChannel = (value: number): number =>
  Math.max(0, Math.min(255, Math.round(value)));

const hexToRgb = (
  hex: string
): {
  red: number;
  green: number;
  blue: number;
} | null => {
  const normalized = hex.trim().replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return null;
  }

  return {
    red: Number.parseInt(expanded.slice(0, 2), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    blue: Number.parseInt(expanded.slice(4, 6), 16)
  };
};

const toRgba = (hex: string, alpha: number): string => {
  const rgb = hexToRgb(hex);

  if (!rgb) {
    return `rgba(143, 153, 177, ${alpha})`;
  }

  return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${alpha})`;
};

const mixHex = (sourceHex: string, targetHex: string, ratio: number): string => {
  const source = hexToRgb(sourceHex);
  const target = hexToRgb(targetHex);

  if (!source || !target) {
    return sourceHex;
  }

  const mixed = {
    red: clampRgbChannel(source.red + (target.red - source.red) * ratio),
    green: clampRgbChannel(source.green + (target.green - source.green) * ratio),
    blue: clampRgbChannel(source.blue + (target.blue - source.blue) * ratio)
  };

  return `#${[mixed.red, mixed.green, mixed.blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
};

export const getDefaultColumnColor = (index: number): string =>
  ([
    "#f091c5",
    "#de9a34",
    "#48c4d9",
    "#8b74ea"
  ][index % 4] ?? "#f091c5");

const buildThemeFromColor = (color: string): ColumnTheme => ({
  accent: color,
  background: toRgba(color, 0.28),
  border: toRgba(color, 0.78),
  dot: mixHex(color, "#ffffff", 0.12)
});

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

export const getColumnTheme = (
  columnName: string,
  index: number,
  explicitColor?: string | null
): ColumnTheme => {
  const normalized = columnName.trim().toLowerCase();
  const fallbackTheme = fallbackThemes[index % fallbackThemes.length] ?? todoTheme;

  if (explicitColor && hexToRgb(explicitColor)) {
    return buildThemeFromColor(explicitColor);
  }

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
