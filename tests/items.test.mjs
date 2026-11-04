// Contract: the rows each category lists, how they read, the order they
// come in, and what opening one does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildItems, groupWorktrees } from "../mods/recall/lib/items.js";
import { listView } from "../mods/recall/lib/listview.js";
import * as mru from "../mods/recall/lib/mru.js";
import { world } from "./fixtures.mjs";

const titles = (items) => items.map((i) => i.title);

test("an unnamed tab reads as what it runs, not its number", () => {
  const items = buildItems("tabs", world());
  assert.deepEqual(titles(items), ["fix login bug", "server", "nvim"]);
  assert.equal(items.find((i) => i.id === "tb2").current, true);
});

test("tabs come most recently focused first", () => {
  const snap = world();
  snap.history = mru.record(mru.record(mru.empty(), { space: "sp2", tab: "tb3", pane: "p3" }, 1), { space: "sp1", tab: "tb2", pane: "p2" }, 2);
  assert.deepEqual(buildItems("tabs", snap).map((i) => i.id), ["tb2", "tb3", "tb1"]);
});

test("opening a row runs the command that shows it", () => {
  const snap = world();
  assert.deepEqual(buildItems("tabs", snap).find((i) => i.id === "tb3").actions, [["tab.select", { id: "tb3" }]]);
  assert.deepEqual(buildItems("spaces", snap).find((i) => i.id === "sp2").actions, [["space.select", { id: "sp2" }]]);
  assert.deepEqual(buildItems("panes", snap).find((i) => i.id === "p3").actions, [["tab.select", { id: "tb3" }], ["pane.focus", { pane: "p3" }]]);
  assert.deepEqual(buildItems("agents", snap)[0].actions, [["agent.focus", { terminal: "t1" }]]);
});

test("a pane Herdr hasn't drawn shows its agent's title, a shell its folder", () => {
  const panes = buildItems("panes", world());
  assert.equal(panes.find((i) => i.id === "p1").title, "fix login bug");
  assert.equal(panes.find((i) => i.id === "p3").path, "~/code/api");
});

test("panes can be found by their tab and space names", () => {
  const rows = listView("panes", world(), "api nvim").rows;
  assert.deepEqual(rows.map((r) => r.item.id), ["p3"]);
});

test("agents by priority: blocked, done, working, idle; latest change first", () => {
  const snap = world();
  const base = snap.agents[0];
  snap.agents = [
    { ...base, address: "a-idle", status: "idle", seq: 9 },
    { ...base, address: "a-work", status: "working", seq: 1 },
    { ...base, address: "a-block-old", status: "blocked", seq: 2 },
    { ...base, address: "a-block-new", status: "blocked", seq: 7 },
    { ...base, address: "a-done", status: "done", seq: 3 },
  ];
  assert.deepEqual(buildItems("agents", snap, { agentSort: "priority" }).map((i) => i.id), ["a-block-new", "a-block-old", "a-done", "a-work", "a-idle"]);
  assert.deepEqual(buildItems("agents", snap, { agentSort: "grouped" }).map((i) => i.id), ["a-idle", "a-work", "a-block-old", "a-block-new", "a-done"]);
});

test("a linked worktree sits under its main checkout; an orphan keeps its place", () => {
  const items = [{ id: "wt" }, { id: "notes" }, { id: "shed" }, { id: "orphan" }];
  const worktrees = new Map([
    ["wt", { linked: true, main: "shed" }],
    ["orphan", { linked: true, main: "missing" }],
  ]);
  assert.deepEqual(groupWorktrees(items, worktrees).map((i) => [i.id, Boolean(i.nested)]), [
    ["notes", false], ["shed", false], ["wt", true], ["orphan", false],
  ]);
});
