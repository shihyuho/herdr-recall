// Contract: the rows each category lists, how they read, the order they
// come in, and what opening one does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildItems, groupWorktrees } from "../mods/recall/lib/items.js";
import { buildAll } from "../mods/recall/lib/all.js";
import { search } from "../mods/recall/lib/fuzzy.js";
import * as mru from "../mods/recall/lib/mru.js";
import { world, HOME } from "./fixtures.mjs";

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
  const rows = search(buildItems("panes", world()), "api nvim", (i) => i.fields);
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

const data = (others = new Map(), content = new Map(), procs = null, listeners = null) => ({ others, content, procs, listeners });

test("All lists what every pane runs and where, agents included; a bare shell has no cmd row", () => {
  const snap = world();
  const others = new Map([
    ["p1", { cwd: `${HOME}/code/web`, command: "claude", ssh: null, shellPid: 10 }],
    ["p2", { cwd: `${HOME}/code/web`, command: "-zsh", ssh: null, shellPid: 20 }],
    ["p3", { cwd: `${HOME}/code/api`, command: "nvim main.go", ssh: null, shellPid: 30 }],
  ]);
  const rows = buildAll(snap, data(others), "").rows.map((r) => [r.item.source, r.item.id, r.item.title]);
  assert.deepEqual(rows, [
    ["cmd", "p1", "claude"],
    ["cwd", "p1", "~/code/web"],
    ["cwd", "p2", "~/code/web"],
    ["cmd", "p3", "nvim main.go"],
    ["cwd", "p3", "~/code/api"],
  ]);
});

test("All: `.text` finds the agent session that printed it", () => {
  const snap = world();
  const content = new Map([
    ["p1", "> 登入失敗的原因是 token 過期\n"],
    ["p2", "$ ls\n"],
  ]);
  const rows = buildAll(snap, data(new Map(), content), ".token 過期").rows;
  assert.deepEqual(rows.map((r) => [r.item.id, r.item.title]), [["p1", "> 登入失敗的原因是 token 過期"]]);
  assert.deepEqual(rows[0].item.actions, [["tab.select", { id: "tb1" }], ["pane.focus", { pane: "p1" }]]);
});

test("All: a plain query also finds text in a pane's buffer", () => {
  const snap = world();
  const others = new Map([["p2", { cwd: `${HOME}/code/web`, command: "-zsh", ssh: null, shellPid: 20 }]]);
  const content = new Map([["p2", "$ npm test\nFAIL src/login.test.ts\n"]]);
  const rows = buildAll(snap, data(others, content), "FAIL").rows;
  assert.deepEqual(rows.map((r) => [r.item.source, r.item.title]), [["term", "FAIL src/login.test.ts"]]);
  assert.deepEqual(buildAll(snap, data(others, content), ".nothing").rows, []);
});

test("All: `port N` finds the pane whose shell started the listener", () => {
  const snap = world();
  const others = new Map([["p2", { cwd: `${HOME}/code/web`, command: "-zsh", ssh: null, shellPid: 20 }]]);
  const procs = new Map([[21, { ppid: 20, command: "node vite" }], [20, { ppid: 1, command: "-zsh" }], [99, { ppid: 1, command: "dockerd" }]]);
  const listeners = [{ port: 5173, pid: 21, addr: "*:5173" }, { port: 8080, pid: 99, addr: "*:8080" }];
  const hit = buildAll(snap, data(others, new Map(), procs, listeners), "port 5173").rows;
  assert.deepEqual(hit.map((r) => [r.item.kind, r.item.id, r.item.title, r.item.detail]), [["other", "p2", "*:5173", "node vite"]]);
  const orphan = buildAll(snap, data(others, new Map(), procs, listeners), "port 8080").rows;
  assert.deepEqual(orphan.map((r) => [r.item.kind, r.item.title, r.item.reason]), [["hint", "*:8080", "not in any pane"]]);
  const none = buildAll(snap, data(others, new Map(), procs, listeners), "port 1").rows;
  assert.deepEqual(none.map((r) => [r.item.kind, r.item.reason]), [["hint", "nothing listening"]]);
});

test("All: `ws `, `tab `, `pane ` swap to those lists", () => {
  const r = buildAll(world(), data(), "ws api");
  assert.equal(r.filter, "spaces");
  assert.deepEqual(r.rows.map((x) => x.item.id), ["sp2"]);
});
