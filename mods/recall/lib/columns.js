// The navigator's columns past the title: what they say, how wide they
// are, and what the location column says.

/** Each column's width in px; the name column takes what is left. */
export const DEFAULT_WIDTHS = { location: 210, folder: 240, branch: 140, status: 70 };
export const MIN_WIDTH = 48;
export const MAX_WIDTH = 520;

function clampWidth(w) {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(w)));
}

/** Widths as stored (shared "recall.columns"); a column missing or not a number takes its default. */
export function loadWidths(raw) {
  const stored = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return Object.fromEntries(Object.entries(DEFAULT_WIDTHS).map(([column, width]) =>
    [column, Number.isFinite(stored[column]) ? clampWidth(stored[column]) : width]));
}

/**
 * A column's width once its left edge has been dragged `dx` px (negative:
 * leftwards) from where it was `start` wide. The name column gives or takes
 * the difference, so the edge stays under the pointer.
 */
export function dragWidth(start, dx) {
  return clampWidth(start - dx);
}

/** Where an item sits ("space › tab"); a space sits nowhere, so what it holds. */
export function location(item) {
  if (item.kind === "space") return [item.where, item.detail].filter(Boolean).join(" · ");
  if (!item.spaceName) return "";
  return item.tabName ? `${item.spaceName} › ${item.tabName}` : item.spaceName;
}
