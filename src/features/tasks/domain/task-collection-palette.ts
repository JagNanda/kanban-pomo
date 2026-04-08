export const taskCollectionPalette = [
  "#f091c5",
  "#de9a34",
  "#48c4d9",
  "#8b74ea",
  "#72c97f",
  "#ff7d6b",
  "#6bb5ff",
  "#d0a0ff",
  "#5fd0b5",
  "#ffb86b",
  "#7cc2ff",
  "#a7de72",
  "#ff96b2",
  "#9f8dff"
] as const;

export const getTaskCollectionColor = (index: number): string =>
  taskCollectionPalette[index % taskCollectionPalette.length] ?? taskCollectionPalette[0];
