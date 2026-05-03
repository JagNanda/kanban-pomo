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
    "#4a8dff",
    "#9b6dff",
    "#f1a340",
    "#63d26f"
  ][index % 4] ?? "#4a8dff");

const buildThemeFromColor = (color: string): ColumnTheme => ({
  accent: color,
  background: toRgba(color, 0.28),
  border: toRgba(color, 0.78),
  dot: mixHex(color, "#ffffff", 0.12)
});

const todoTheme: ColumnTheme = {
  accent: "#4a8dff",
  background: "rgba(20, 57, 114, 0.46)",
  border: "rgba(74, 141, 255, 0.78)",
  dot: "#4a8dff"
};

const inProgressTheme: ColumnTheme = {
  accent: "#9b6dff",
  background: "rgba(62, 35, 104, 0.5)",
  border: "rgba(155, 109, 255, 0.78)",
  dot: "#9b6dff"
};

const reviewTheme: ColumnTheme = {
  accent: "#f1a340",
  background: "rgba(92, 57, 18, 0.46)",
  border: "rgba(241, 163, 64, 0.76)",
  dot: "#f1a340"
};

const doneTheme: ColumnTheme = {
  accent: "#63d26f",
  background: "rgba(22, 92, 59, 0.5)",
  border: "rgba(61, 199, 111, 0.78)",
  dot: "#63d26f"
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

  if (explicitColor && hexToRgb(explicitColor)) {
    return buildThemeFromColor(explicitColor);
  }

  return fallbackTheme;
};
