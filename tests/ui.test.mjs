// Contract: what the dialog shows of the pointer. A row lights up under it,
// the selected row keeps its own background, and while a column is being
// dragged the rows show neither the light nor the hand, since the pointer
// then only passes over them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_IDS, DEFAULT_KEYS } from "../mods/recall/lib/config.js";
import { listView } from "../mods/recall/lib/listview.js";
import { world } from "./fixtures.mjs";
import { drawnRows } from "./herdr-runtime.mjs";

const { navigator } = await import("../mods/recall/ui.js");

/** Tabs with nothing typed: three rows, the second selected. `state` is what differs in the navigator. */
function dialog(state = {}) {
  const view = listView("tabs", world(), "");
  const nav = {
    category: "tabs", categories: CATEGORY_IDS, rows: view.rows, at: 1,
    scroll: {}, input: {}, mode: "type", query: "", agentSort: "mru",
    widths: { name: 200, location: 120, folder: 160, branch: 80, status: 60 },
    resizing: null, keys: DEFAULT_KEYS, configError: null, scale: 1,
    ...state,
  };
  return navigator(nav, { view, loading: false });
}

test("a row lights up under the pointer in the theme's hover color; the selected row keeps the selection color there", () => {
  const rows = drawnRows(dialog());
  assert.deepEqual(rows.map((row) => row.hover.bg), ["hover", undefined, "hover"]);
  assert.deepEqual(rows.map((row) => row.styles.bg), [undefined, "selection", undefined]);
});

test("the pointer is a hand over every row, and while a column is being dragged it is no hand and no row lights up", () => {
  const still = drawnRows(dialog());
  const dragged = drawnRows(dialog({ resizing: { column: "folder", x: 300, width: 160 } }));
  assert.deepEqual(still.map((row) => row.styles.cursor_pointer), [true, true, true]);
  assert.deepEqual(dragged.map((row) => row.styles.cursor_pointer), [undefined, undefined, undefined]);
  assert.deepEqual(dragged.map((row) => row.hover.bg), [undefined, undefined, undefined]);
});
