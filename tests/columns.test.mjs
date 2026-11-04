// Contract: what the table's location column says, the order a click on a
// column head puts the rows in, and how wide a dragged or stored column is.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_WIDTHS, MAX_WIDTH, MIN_WIDTH, dragWidth, loadWidths, location, nextSort, sortRows } from "../mods/recall/lib/columns.js";
import { buildItems } from "../mods/recall/lib/items.js";
import { world, space, tab } from "./fixtures.mjs";

const rowsOf = (items) => items.map((item) => ({ item, hits: {} }));
const keys = (rows) => rows.map((r) => r.item.key);
const titles = (rows) => rows.map((r) => r.item.title);
const sorted = (items, column, dir) => keys(sortRows(rowsOf(items), { column, dir }));

test("clicking a head sorts up, again sorts down, a third time gives back the recency order", () => {
  const rows = rowsOf(buildItems("tabs", world()));
  assert.deepEqual(titles(rows), ["fix login bug", "server", "nvim"]);
  const clicks = [];
  let sort = null;
  for (let i = 0; i < 3; i++) {
    sort = nextSort(sort, "name");
    clicks.push(titles(sortRows(rows, sort)));
  }
  assert.deepEqual(clicks, [
    ["fix login bug", "nvim", "server"],
    ["server", "nvim", "fix login bug"],
    ["fix login bug", "server", "nvim"],
  ]);
});

test("a click on another head starts that column ascending", () => {
  assert.deepEqual(nextSort({ column: "name", dir: -1 }, "branch"), { column: "branch", dir: 1 });
});

test("names sort as read: numbers by value, case ignored", () => {
  const items = [
    { key: "t10", title: "Tab 10" },
    { key: "t2", title: "tab 2" },
    { key: "a", title: "Alpha" },
  ];
  assert.deepEqual(sorted(items, "name", 1), ["a", "t2", "t10"]);
});

test("rows with nothing in the column come last both ways; ties keep their order", () => {
  const items = [
    { key: "a", branch: "main" },
    { key: "b", branch: null },
    { key: "c", branch: "main" },
    { key: "d", branch: "feat" },
  ];
  assert.deepEqual(sorted(items, "branch", 1), ["d", "a", "c", "b"]);
  assert.deepEqual(sorted(items, "branch", -1), ["a", "c", "d", "b"]);
});

test("status sorts what needs you first, then finished, working, idle", () => {
  const items = [
    { key: "idle", status: "idle" },
    { key: "none", status: null },
    { key: "working", status: "working" },
    { key: "blocked", status: "blocked" },
    { key: "done", status: "done" },
  ];
  assert.deepEqual(sorted(items, "status", 1), ["blocked", "done", "working", "idle", "none"]);
});

test("a worktree moves with its main checkout when spaces sort", () => {
  const snap = world();
  snap.spaces.push(space("sp3", 3, "zed", [tab("tb4", 1)]));
  snap.worktrees = new Map([
    ["sp1", { linked: false, main: null, repo: "web", branch: "main" }],
    ["sp2", { linked: true, main: "sp1", repo: "web", branch: "feat" }],
  ]);
  const rows = rowsOf(buildItems("spaces", snap));
  assert.deepEqual(titles(sortRows(rows, { column: "name", dir: -1 })), ["zed", "web", "web ⎇ feat"]);
});

test("a space's location says what it holds and where it runs; anything else, where it sits", () => {
  const snap = world();
  snap.spaces[1].machine = "box";
  const spaces = Object.fromEntries(buildItems("spaces", snap).map((i) => [i.title, location(i)]));
  assert.deepEqual(spaces, { web: "2 tabs · 1 agent", api: "on box · 1 tab" });
  const panes = Object.fromEntries(buildItems("panes", snap).map((i) => [i.id, location(i)]));
  assert.deepEqual(panes, { p1: "web › fix login bug", p2: "web › server", p3: "api › nvim" });
  assert.deepEqual(buildItems("tabs", snap).map(location), ["web", "web", "api"]);
});

test("spaces sort by location as by how many tabs they hold", () => {
  const items = buildItems("spaces", world());
  assert.deepEqual(items.map((i) => i.title), ["web", "api"]);
  assert.deepEqual(sorted(items, "location", 1), ["space:sp2", "space:sp1"]);
});

test("dragging a column's left edge left widens it by as much, right narrows it", () => {
  const mid = Math.round((MIN_WIDTH + MAX_WIDTH) / 2);
  assert.equal(dragWidth(mid, -3), mid + 3);
  assert.equal(dragWidth(mid, 3), mid - 3);
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
