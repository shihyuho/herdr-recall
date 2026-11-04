// The navigator's columns past the title: what they say, how wide they
// are, and the order a click on a column head puts the rows in.
//
// A sort is { column, dir }: column one of SORTABLE, dir 1 (ascending) or
// -1 (descending). No sort (null) keeps the category's own order: recency,
// or match quality while searching.

const STATUS_RANK = { blocked: 0, done: 1, working: 2, idle: 3 };

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

const SORT_VALUE = {
  name: (i) => i.title,
  location: (i) => (i.kind === "space" ? i.tabs?.length : location(i)),
  folder: (i) => i.path,
  branch: (i) => i.branch,
  status: (i) => STATUS_RANK[i.status],
};
export const SORTABLE = Object.keys(SORT_VALUE);

/** A click on `column`'s head: ascending, then descending, then no sort. */
export function nextSort(sort, column) {
  if (sort?.column !== column) return { column, dir: 1 };
  return sort.dir > 0 ? { column, dir: -1 } : null;
}

function blank(v) {
  return v === null || v === undefined || v === "";
}

function compare(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Rows ({ item, hits }) in `sort`'s order, or as given without one. A
 * nested row (a worktree under its main checkout) moves with the row above
 * it. Rows with nothing in the column come last either way; ties keep the
 * order they came in.
 */
export function sortRows(rows, sort) {
  const value = sort && SORT_VALUE[sort.column];
  if (!value) return rows;
  const groups = [];
  for (const r of rows) {
    if (r.item.nested && groups.length) groups[groups.length - 1].push(r);
    else groups.push([r]);
  }
  groups.sort((ga, gb) => {
    const a = value(ga[0].item), b = value(gb[0].item);
    if (blank(a) || blank(b)) return blank(a) - blank(b);
    return compare(a, b) * sort.dir;
  });
  return groups.flat();
}
