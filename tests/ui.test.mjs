// Contract: what the dialog shows of the pointer. A row lights up under it,
// the selected row keeps its own background, and while a column is being
// dragged the rows show neither the light nor the hand, since the pointer
// then only passes over them. And what an unnamed tab's row draws after
// its name: its pane list, dim, lit where a search matched it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_IDS, DEFAULT_KEYS } from "../mods/recall/lib/config.js";
import { listView } from "../mods/recall/lib/listview.js";
import { world } from "./fixtures.mjs";
import { drawnElements, drawnRows } from "./herdr-runtime.mjs";

const { navigator } = await import("../mods/recall/ui.js");

/** Tabs, nothing typed unless `query` is: world()'s rows, the second selected. `state` is what differs in the navigator. */
function dialog(state = {}, query = "") {
  const view = listView("tabs", world(), query);
  const nav = {
    category: "tabs", categories: CATEGORY_IDS, rows: view.rows, at: 1,
    scroll: {}, input: {}, mode: "type", query: "", agentSort: "mru",
    widths: { name: 200, location: 120, folder: 160, branch: 80, status: 60 },
    resizing: null, keys: DEFAULT_KEYS, configError: null, scale: 1, query,
    ...state,
  };
  return navigator(nav, { view, loading: false });
}

test("a row lights up under the pointer in the theme's hover color; the selected row keeps the selection color there", () => {
  const rows = drawnRows(dialog());
  assert.deepEqual(rows.map((row) => row.hover.bg), ["hover", undefined, "hover"]);
  assert.deepEqual(rows.map((row) => row.styles.bg), [undefined, "selection", undefined]);
});

// Herdr draws a frame for a pointer that crosses onto an element only when
// the element has an id; without one the light waits for the next frame
// something else asks for, up to half a second later.
test("whatever lights up under the pointer has an id, and each row its own, so the light follows the pointer at once", () => {
  const lit = drawnElements(dialog()).filter((el) => Object.keys(el.hover).length);
  assert.ok(lit.length >= 2, "the dialog draws elements that light up");
  assert.deepEqual(lit.filter((el) => !el.styles.id).map((el) => el.kind), []);
  const ids = drawnRows(dialog()).map((row) => row.styles.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("the pointer is a hand over every row, and while a column is being dragged it is no hand and no row lights up", () => {
  const still = drawnRows(dialog());
  const dragged = drawnRows(dialog({ resizing: { column: "folder", x: 300, width: 160 } }));
  assert.deepEqual(still.map((row) => row.styles.cursor_pointer), [true, true, true]);
  assert.deepEqual(dragged.map((row) => row.styles.cursor_pointer), [undefined, undefined, undefined]);
  assert.deepEqual(dragged.map((row) => row.hover.bg), [undefined, undefined, undefined]);
});


const strings = (record) => record.children.filter((c) => typeof c === "string").join("");
/** The text an element draws, its children's included. */
const textOf = (el) => drawnElements(el).map(strings).join("");

/**
 * What a row draws in its name's box, part by part: { text, size, runs },
 * where runs are the pieces of text it is drawn in: [text, color, semibold].
 */
function nameParts(row) {
  const box = [row, ...row.children.flatMap((c) => drawnElements(c))].find((r) => r.styles.flex_1);
  return box.children.filter(Boolean).map((part) => ({
    text: textOf(part),
    size: drawnElements(part)[0].styles.text_size ?? null,
    runs: drawnElements(part).filter((r) => strings(r)).map((r) => [strings(r), r.styles.text_color, Boolean(r.styles.font_semibold)]),
  }));
}

test("an unnamed tab's row draws its pane list after its name, at 12px in the dim color; a named tab's row draws its name alone", () => {
  const drawn = drawnRows(dialog()).map((row) => nameParts(row).map(({ text, size }) => [text, size]));
  // world(), Tabs: web's unnamed tab 1 (an agent), the named server, api's unnamed tab 1 (nvim).
  assert.deepEqual(drawn.map((parts) => JSON.stringify(parts)).sort(), [
    [["1", null], ["fix login bug", 12]],
    [["1", null], ["nvim", 12]],
    [["server", null]],
  ].map((parts) => JSON.stringify(parts)).sort());
  const web = drawnRows(dialog()).map(nameParts).find((parts) => parts[1]?.text === "fix login bug");
  assert.deepEqual(web[1].runs, [["fix login bug", "dim", false]]);
});

test("a search's matched letters in a pane list take the accent color, semibold; the rest stays dim", () => {
  const [row] = drawnRows(dialog({}, "login"));
  assert.deepEqual(nameParts(row)[1].runs, [["fix ", "dim", false], ["login", "accent", true], [" bug", "dim", false]]);
});
