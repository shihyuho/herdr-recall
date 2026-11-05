// Contract: what the table's location column says, and how wide a dragged or stored column is.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_WIDTHS, MAX_WIDTH, MIN_WIDTH, dragWidth, loadWidths, location } from "../mods/recall/lib/columns.js";
import { buildItems } from "../mods/recall/lib/items.js";
import { world } from "./fixtures.mjs";

test("a space's location says what it holds and where it runs; anything else, where it sits", () => {
  const snap = world();
  snap.spaces[1].machine = "box";
  const spaces = Object.fromEntries(buildItems("spaces", snap).map((i) => [i.title, location(i)]));
  assert.deepEqual(spaces, { web: "2 tabs · 1 agent", api: "on box · 1 tab" });
  const panes = Object.fromEntries(buildItems("panes", snap).map((i) => [i.id, location(i)]));
  assert.deepEqual(panes, { p1: "web › fix login bug", p2: "web › server", p3: "api › nvim" });
  assert.deepEqual(buildItems("tabs", snap).map(location), ["web", "web", "api"]);
});

test("dragging a column's left edge left widens it by as much, right narrows it", () => {
  const mid = Math.round((MIN_WIDTH + MAX_WIDTH) / 2);
  assert.equal(dragWidth(mid, -3), mid + 3);
  assert.equal(dragWidth(mid, 3), mid - 3);
});

test("on a dialog drawn larger than its design, a drag moves the kept width by that much less, so the edge stays under the pointer", () => {
  const mid = Math.round((MIN_WIDTH + MAX_WIDTH) / 2);
  assert.equal(dragWidth(mid, -40, 2), mid + 20);
  assert.equal(dragWidth(mid, 40, 2), mid - 20);
  assert.equal(dragWidth(mid, -30, 1.5), mid + 20);
  assert.equal(dragWidth(mid, -10, 0.5), mid + 20);
});

test("a drag stops at the narrowest and widest a column may be", () => {
  assert.equal(dragWidth(200, 10000), MIN_WIDTH);
  assert.equal(dragWidth(200, -10000), MAX_WIDTH);
});

test("stored widths: a kept one comes back, a missing or broken one is the default, one out of range is pulled in", () => {
  const kept = MIN_WIDTH + 1;
  assert.deepEqual(loadWidths({ location: kept, folder: "wide", branch: MAX_WIDTH + 500, status: null }), {
    location: kept,
    folder: DEFAULT_WIDTHS.folder,
    branch: MAX_WIDTH,
    status: DEFAULT_WIDTHS.status,
  });
  assert.deepEqual(loadWidths(null), DEFAULT_WIDTHS);
  assert.deepEqual(loadWidths([300]), DEFAULT_WIDTHS);
});
