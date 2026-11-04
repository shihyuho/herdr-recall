// Contract: what the navigator shows for a category, a snapshot and a query:
// the rows in order with their highlights, the total with nothing typed,
// and the row selected when the list opens.
import { test } from "node:test";
import assert from "node:assert/strict";
import { listView } from "../mods/recall/lib/listview.js";
import * as mru from "../mods/recall/lib/mru.js";
import { world, HOME } from "./fixtures.mjs";

const ids = (view) => view.rows.map((r) => r.item.id);

/** A history whose most recent focus is the last one given. */
function visited(...focuses) {
  return focuses.reduce((h, f, i) => mru.record(h, f, i + 1), mru.empty());
}

test("Tabs, nothing typed: most recent first, and the selection skips where you are", () => {
  const snap = world();
  snap.history = visited({ space: "sp1", tab: "tb2", pane: "p2" });
  const view = listView("tabs", snap, "");
  assert.deepEqual(ids(view), ["tb2", "tb1", "tb3"]);
  assert.equal(view.total, 3);
  assert.equal(view.selected, 1);
});

test("Spaces, nothing typed: the selection skips the space you are in", () => {
  const view = listView("spaces", world(), "");
  assert.deepEqual(ids(view), ["sp1", "sp2"]);
  assert.equal(view.total, 2);
  assert.equal(view.selected, 1);
});

test("Panes, typed: only matches, the untyped total, and highlights in each field a term matched", () => {
  const view = listView("panes", world(), "api nvim");
  assert.deepEqual(ids(view), ["p3"]);
  assert.equal(view.total, 3);
  assert.equal(view.selected, 0);
  assert.deepEqual(view.rows[0].hits, { where: [0, 1, 2], title: [0, 1, 2, 3] });
});

test("Panes, typed: row 0 is selected even when it is where you are", () => {
  const snap = world();
  snap.history = visited({ space: "sp1", tab: "tb2", pane: "p2" });
  const view = listView("panes", snap, "web");
  assert.deepEqual(ids(view), ["p2", "p1"]);
  assert.equal(view.rows[0].item.current, true);
  assert.equal(view.selected, 0);
  assert.deepEqual(view.rows.map((r) => r.hits), [{ title: [14, 15, 16] }, { where: [0, 1, 2] }]);
});

test("Panes, typed with no match: no rows, the total still counts them all", () => {
  const view = listView("panes", world(), "zzz");
  assert.deepEqual(ids(view), []);
  assert.equal(view.total, 3);
  assert.equal(view.selected, 0);
});

test("Agents follow the chosen sort, and the selection skips the focused agent", () => {
  const snap = world();
  const base = snap.agents[0];
  snap.agents = [
    { ...base, address: "a-idle", status: "idle", seq: 9 },
    { ...base, address: "a-work", status: "working", seq: 1 },
    { ...base, address: "a-block-old", status: "blocked", seq: 2 },
    { ...base, address: "a-block-new", status: "blocked", seq: 7, focused: true },
    { ...base, address: "a-done", status: "done", seq: 3 },
  ];
  const priority = listView("agents", snap, "", { agentSort: "priority" });
  assert.deepEqual(ids(priority), ["a-block-new", "a-block-old", "a-done", "a-work", "a-idle"]);
  assert.equal(priority.total, 5);
  assert.equal(priority.selected, 1);
  const grouped = listView("agents", snap, "", { agentSort: "grouped" });
  assert.deepEqual(ids(grouped), ["a-idle", "a-work", "a-block-old", "a-block-new", "a-done"]);
  assert.equal(grouped.selected, 0);
});

/** What the clue search has read about each pane of world(). */
function clueData() {
  const others = new Map([
    ["p1", { cwd: `${HOME}/code/web`, command: "claude", ssh: null, shellPid: 10 }],
    ["p2", { cwd: `${HOME}/code/web`, command: "-zsh", ssh: null, shellPid: 20 }],
    ["p3", { cwd: `${HOME}/code/api`, command: "nvim main.go", ssh: null, shellPid: 30 }],
  ]);
  return { others, content: new Map(), procs: null, listeners: null };
}

const clueRows = (view) => view.rows.map((r) => [r.item.source, r.item.id]);

test("Clue search, nothing typed: clues of the latest pane first, no total, the selection skips your pane", () => {
  const snap = world();
  snap.history = visited({ space: "sp1", tab: "tb2", pane: "p2" });
  const view = listView("all", snap, "", { clueData: clueData() });
  assert.deepEqual(clueRows(view), [["cwd", "p2"], ["cmd", "p1"], ["cwd", "p1"], ["cmd", "p3"], ["cwd", "p3"]]);
  assert.equal(view.total, null);
  assert.equal(view.selected, 1);
  assert.equal(view.label, null);
});

test("Clue search, typed with a clue-type word: its chip, the matching clue and its highlight", () => {
  const view = listView("all", world(), "cmd nvim", { clueData: clueData() });
  assert.equal(view.label, "cmd");
  assert.deepEqual(clueRows(view), [["cmd", "p3"]]);
  assert.deepEqual(view.rows[0].hits, { title: [0, 1, 2, 3] });
  assert.equal(view.total, null);
  assert.equal(view.selected, 0);
});
