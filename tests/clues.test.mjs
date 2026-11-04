// Contract: Clues (the former All) finds a pane by what it runs, the host
// it is ssh'd into, the text it printed or the port it owns, through the
// same list view as every other category.
import { test } from "node:test";
import assert from "node:assert/strict";
import { listView } from "../mods/recall/lib/listview.js";
import * as mru from "../mods/recall/lib/mru.js";
import { world, HOME } from "./fixtures.mjs";

const clueData = (others = new Map(), content = new Map(), procs = null, listeners = null) => ({ others, content, procs, listeners });

/** What Clues has read about each pane of world(). */
const worldOthers = () => new Map([
  ["p1", { cwd: `${HOME}/code/web`, command: "claude", ssh: null, shellPid: 10 }],
  ["p2", { cwd: `${HOME}/code/web`, command: "-zsh", ssh: null, shellPid: 20 }],
  ["p3", { cwd: `${HOME}/code/api`, command: "nvim main.go", ssh: null, shellPid: 30 }],
]);

const clueRows = (view) => view.rows.map((r) => [r.item.source, r.item.id]);

test("Clues, nothing typed: clues of the latest pane first, no total, the selection skips your pane", () => {
  const snap = world();
  snap.history = mru.record(mru.empty(), { space: "sp1", tab: "tb2", pane: "p2" }, 1);
  const view = listView("clues", snap, "", { clueData: clueData(worldOthers()) });
  assert.deepEqual(clueRows(view), [["cwd", "p2"], ["cmd", "p1"], ["cwd", "p1"], ["cmd", "p3"], ["cwd", "p3"]]);
  assert.equal(view.total, null);
  assert.equal(view.selected, 1);
  assert.equal(view.label, null);
});

test("Clues, typed with a clue-type word: its chip, the matching clue and its highlight", () => {
  const view = listView("clues", world(), "cmd nvim", { clueData: clueData(worldOthers()) });
  assert.equal(view.label, "cmd");
  assert.deepEqual(clueRows(view), [["cmd", "p3"]]);
  assert.deepEqual(view.rows[0].hits, { title: [0, 1, 2, 3] });
  assert.equal(view.total, null);
  assert.equal(view.selected, 0);
});

test("Clues lists what every pane runs and where, agents included; a bare shell has no cmd row", () => {
  const view = listView("clues", world(), "", { clueData: clueData(worldOthers()) });
  assert.deepEqual(view.rows.map((r) => [r.item.source, r.item.id, r.item.title]), [
    ["cmd", "p1", "claude"],
    ["cwd", "p1", "~/code/web"],
    ["cwd", "p2", "~/code/web"],
    ["cmd", "p3", "nvim main.go"],
    ["cwd", "p3", "~/code/api"],
  ]);
});

test("Clues: `.text` finds the agent session that printed it", () => {
  const content = new Map([
    ["p1", "> 登入失敗的原因是 token 過期\n"],
    ["p2", "$ ls\n"],
  ]);
  const rows = listView("clues", world(), ".token 過期", { clueData: clueData(new Map(), content) }).rows;
  assert.deepEqual(rows.map((r) => [r.item.id, r.item.title]), [["p1", "> 登入失敗的原因是 token 過期"]]);
  assert.deepEqual(rows[0].item.actions, [["tab.select", { id: "tb1" }], ["pane.focus", { pane: "p1" }]]);
});

test("Clues: a plain query also finds text in a pane's buffer", () => {
  const others = new Map([["p2", { cwd: `${HOME}/code/web`, command: "-zsh", ssh: null, shellPid: 20 }]]);
  const content = new Map([["p2", "$ npm test\nFAIL src/login.test.ts\n"]]);
  const rows = listView("clues", world(), "FAIL", { clueData: clueData(others, content) }).rows;
  assert.deepEqual(rows.map((r) => [r.item.source, r.item.title]), [["term", "FAIL src/login.test.ts"]]);
  assert.deepEqual(listView("clues", world(), ".nothing", { clueData: clueData(others, content) }).rows, []);
});

test("Clues: `port N` finds the pane whose shell started the listener", () => {
  const others = new Map([["p2", { cwd: `${HOME}/code/web`, command: "-zsh", ssh: null, shellPid: 20 }]]);
  const procs = new Map([[21, { ppid: 20, command: "node vite" }], [20, { ppid: 1, command: "-zsh" }], [99, { ppid: 1, command: "dockerd" }]]);
  const listeners = [{ port: 5173, pid: 21, addr: "*:5173" }, { port: 8080, pid: 99, addr: "*:8080" }];
  const rows = (query) => listView("clues", world(), query, { clueData: clueData(others, new Map(), procs, listeners) }).rows;
  assert.deepEqual(rows("port 5173").map((r) => [r.item.kind, r.item.id, r.item.title, r.item.detail]), [["other", "p2", "*:5173", "node vite"]]);
  assert.deepEqual(rows("port 8080").map((r) => [r.item.kind, r.item.title, r.item.reason]), [["hint", "*:8080", "not in any pane"]]);
  assert.deepEqual(rows("port 1").map((r) => [r.item.kind, r.item.reason]), [["hint", "nothing listening"]]);
});

test("Clues: `ws `, `tab `, `pane ` swap to those lists", () => {
  const view = listView("clues", world(), "ws api", { clueData: clueData() });
  assert.equal(view.label, "ws");
  assert.deepEqual(view.rows.map((x) => x.item.id), ["sp2"]);
});
