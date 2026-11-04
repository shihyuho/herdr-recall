// Contract: Clues (the former All) finds a pane by what it runs, the host
// it is ssh'd into, the text it printed or the port it owns, through the
// same list view as every other category.
import { test } from "node:test";
import assert from "node:assert/strict";
import { listView } from "../mods/recall/lib/listview.js";
import * as mru from "../mods/recall/lib/mru.js";
import { world, HOME } from "./fixtures.mjs";

const clueData = (paneState = new Map(), content = new Map(), procs = null, listeners = null) => ({ paneState, content, procs, listeners });

/** What Clues has read about each pane of world(). */
const worldPaneState = () => new Map([
  ["p1", { cwd: `${HOME}/code/web`, command: "claude", ssh: null, shellPid: 10 }],
  ["p2", { cwd: `${HOME}/code/web`, command: "-zsh", ssh: null, shellPid: 20 }],
  ["p3", { cwd: `${HOME}/code/api`, command: "nvim main.go", ssh: null, shellPid: 30 }],
]);

const clueRows = (view) => view.rows.map((r) => [r.item.clue, r.item.id]);

test("Clues, nothing typed: each pane's command, latest pane first, no total, the selection skips your pane", () => {
  const snap = world();
  snap.history = mru.record(mru.empty(), { space: "sp1", tab: "tb2", pane: "p2" }, 1);
  const view = listView("clues", snap, "", { clueData: clueData(worldPaneState()) });
  assert.deepEqual(clueRows(view), [["cmd", "p1"], ["cmd", "p3"]]);
  assert.equal(view.total, null);
  assert.equal(view.selected, 0);
  assert.equal(view.label, null);
});

test("Clues, typed with a clue-type word: its chip, the matching clue and its highlight", () => {
  const view = listView("clues", world(), "cmd nvim", { clueData: clueData(worldPaneState()) });
  assert.equal(view.label, "cmd");
  assert.deepEqual(clueRows(view), [["cmd", "p3"]]);
  assert.deepEqual(view.rows[0].hits, { title: [0, 1, 2, 3] });
  assert.equal(view.total, null);
  assert.equal(view.selected, 0);
});

test("Clues lists what every pane runs and where, agents included; a bare shell has no cmd row", () => {
  const view = listView("clues", world(), "", { clueData: clueData(worldPaneState()) });
  assert.deepEqual(view.rows.map((r) => [r.item.clue, r.item.id, r.item.title]), [
    ["cmd", "p1", "claude"],
    ["cmd", "p3", "nvim main.go"],
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
  const paneState = new Map([["p2", { cwd: `${HOME}/code/web`, command: "-zsh", ssh: null, shellPid: 20 }]]);
  const content = new Map([["p2", "$ npm test\nFAIL src/login.test.ts\n"]]);
  const rows = listView("clues", world(), "FAIL", { clueData: clueData(paneState, content) }).rows;
  assert.deepEqual(rows.map((r) => [r.item.clue, r.item.title]), [["term", "FAIL src/login.test.ts"]]);
  assert.deepEqual(listView("clues", world(), ".nothing", { clueData: clueData(paneState, content) }).rows, []);
});

test("Clues: `port N` finds the pane whose shell started the listener", () => {
  const paneState = new Map([["p2", { cwd: `${HOME}/code/web`, command: "-zsh", ssh: null, shellPid: 20 }]]);
  const procs = new Map([[21, { ppid: 20, command: "node vite" }], [20, { ppid: 1, command: "-zsh" }], [99, { ppid: 1, command: "dockerd" }]]);
  const listeners = [{ port: 5173, pid: 21, addr: "*:5173" }, { port: 8080, pid: 99, addr: "*:8080" }];
  const rows = (query) => listView("clues", world(), query, { clueData: clueData(paneState, new Map(), procs, listeners) }).rows;
  assert.deepEqual(rows("port 5173").map((r) => [r.item.kind, r.item.id, r.item.title, r.item.detail]), [["clue", "p2", "*:5173", "node vite"]]);
  assert.deepEqual(rows("port 8080").map((r) => [r.item.kind, r.item.title, r.item.reason]), [["hint", "*:8080", "not in any pane"]]);
  assert.deepEqual(rows("port 1").map((r) => [r.item.kind, r.item.reason]), [["hint", "nothing listening"]]);
});

test("Clues, typed: the selection skips your pane and a clue's reason row, landing on your pane when nothing else is left", () => {
  // p2 is where you are; its shell (pid 20) started vite. dockerd (pid 99) is in no pane.
  const paneState = new Map([
    ["p1", { cwd: `${HOME}/code/web`, command: "claude", ssh: null, shellPid: 10 }],
    ["p2", { cwd: `${HOME}/code/web`, command: "-zsh", ssh: null, shellPid: 20 }],
  ]);
  const procs = new Map([
    [10, { ppid: 1, command: "-zsh" }], [11, { ppid: 10, command: "node api" }],
    [20, { ppid: 1, command: "-zsh" }], [21, { ppid: 20, command: "node vite" }],
    [99, { ppid: 1, command: "dockerd" }],
  ]);
  const view = (listeners) => listView("clues", world(), "port 5173", { clueData: clueData(paneState, new Map(), procs, listeners) });
  const shown = (v) => v.rows.map((r) => [r.item.kind, r.item.id, r.item.current]);

  const alone = view([{ port: 5173, pid: 21, addr: "*:5173" }, { port: 5173, pid: 99, addr: "[::1]:5173" }]);
  assert.deepEqual(shown(alone), [["clue", "p2", true], ["hint", null, false]]);
  assert.equal(alone.selected, 0);

  const shared = view([{ port: 5173, pid: 21, addr: "*:5173" }, { port: 5173, pid: 11, addr: "127.0.0.1:5173" }, { port: 5173, pid: 99, addr: "[::1]:5173" }]);
  assert.equal(shared.rows[shared.selected].item.id, "p1");
});

test("Clues: a pane's folder is no clue, typed or not, and `cwd ` is plain text", () => {
  const paneState = new Map([...worldPaneState(), ["p2", { cwd: `${HOME}/scratch/zebra`, command: "-zsh", ssh: null, shellPid: 20 }], ["p3", { cwd: `${HOME}/code/api`, command: "cwd-tool", ssh: null, shellPid: 30 }]]);
  const rows = (query) => listView("clues", world(), query, { clueData: clueData(paneState) }).rows;
  assert.deepEqual(rows("").map((r) => r.item.clue), ["cmd", "cmd"]);
  assert.deepEqual(rows("zebra"), []);
  // beside it: the same text does match a command
  assert.deepEqual(rows("cwd ").map((r) => [r.item.clue, r.item.title]), [["cmd", "cwd-tool"]]);
  assert.equal(listView("clues", world(), "cwd tool", { clueData: clueData(paneState) }).label, null);
});

test("Clues: `ws `, `tab `, `pane ` are searched as plain text, not as category switches", () => {
  const paneState = new Map([["p3", { cwd: `${HOME}/code/api`, command: "ws api-server", ssh: null, shellPid: 30 }]]);
  for (const q of ["ws api", "tab api", "pane api"]) {
    const view = listView("clues", world(), q, { clueData: clueData(paneState) });
    assert.equal(view.label, null, q);
    assert.ok(view.rows.every((r) => r.item.kind === "clue"), q);
  }
  // the one that matches shows it is searched against the clues
  assert.deepEqual(listView("clues", world(), "ws api", { clueData: clueData(paneState) }).rows.map((r) => [r.item.clue, r.item.title]), [["cmd", "ws api-server"]]);
  assert.deepEqual(listView("clues", world(), "tab api", { clueData: clueData(paneState) }).rows, []);
});

// The query syntax applies to the text after the clue-type word.

test("Clues: operators after a clue-type word filter its clues", () => {
  const view = (query) => listView("clues", world(), query, { clueData: clueData(worldPaneState()) });
  assert.deepEqual(clueRows(view("cmd ")), [["cmd", "p1"], ["cmd", "p3"]]);
  assert.deepEqual(clueRows(view("cmd !nvim")), [["cmd", "p1"]]);
  assert.equal(view("cmd !nvim").label, "cmd");
  assert.deepEqual(view("cmd !nvim").rows[0].hits, {});
  const anchored = view("cmd ^nv");
  assert.deepEqual(clueRows(anchored), [["cmd", "p3"]]);
  assert.deepEqual(anchored.rows[0].hits, { title: [0, 1] });
  assert.deepEqual(clueRows(view("cmd ^main")), []);
  assert.deepEqual(clueRows(view("cmd claude | 'main")), [["cmd", "p1"], ["cmd", "p3"]]);
});

test("Clues: `port 5173` still finds the pane listening on 5173 beside the syntax", () => {
  const paneState = new Map([["p2", { cwd: `${HOME}/code/web`, command: "-zsh", ssh: null, shellPid: 20 }]]);
  const procs = new Map([[21, { ppid: 20, command: "node vite" }], [20, { ppid: 1, command: "-zsh" }]]);
  const listeners = [{ port: 5173, pid: 21, addr: "*:5173" }];
  const view = listView("clues", world(), "port 5173", { clueData: clueData(paneState, new Map(), procs, listeners) });
  assert.equal(view.label, "port");
  assert.deepEqual(view.rows.map((r) => [r.item.kind, r.item.id, r.item.title]), [["clue", "p2", "*:5173"]]);
});

test("Clues: in a pane's buffer, each term must hold in one line, anchors hold at the line's ends, and `!` drops a line", () => {
  const paneState = new Map([["p2", { cwd: `${HOME}/code/web`, command: "-zsh", ssh: null, shellPid: 20 }]]);
  const content = new Map([["p2", "$ npm test\nFAIL src/login.test.ts\n"]]);
  const lines = (query) => listView("clues", world(), query, { clueData: clueData(paneState, content) }).rows.map((r) => r.item.title);
  assert.deepEqual(lines(".FAIL login"), ["FAIL src/login.test.ts"]);
  assert.deepEqual(lines(".npm"), ["$ npm test"]);
  // a plain term is read literally in a buffer: n and t scattered in "$ npm test" are no match
  assert.deepEqual(lines(".nt"), []);
  assert.deepEqual(lines(".^npm"), []);
  assert.deepEqual(lines(".^fail"), ["FAIL src/login.test.ts"]);
  assert.deepEqual(lines(".test$"), ["$ npm test"]);
  // the excerpt keeps 14 characters before the hit, "ts" at 20
  assert.deepEqual(lines(".ts$"), ["…rc/login.test.ts"]);
  assert.deepEqual(lines(".login"), ["FAIL src/login.test.ts"]);
  assert.deepEqual(lines(".login !FAIL"), []);
  // `test` is in both lines; `!npm` drops the first. "test" at 15, so the excerpt is cut.
  assert.deepEqual(lines("term test"), ["$ npm test"]);
  assert.deepEqual(lines("term test !npm"), ["…AIL src/login.test.ts"]);
});

test("Clues: a buffer row lights the first term that matched in its line", () => {
  const paneState = new Map([["p2", { cwd: `${HOME}/code/web`, command: "-zsh", ssh: null, shellPid: 20 }]]);
  const content = new Map([["p2", "FAIL src/login.test.ts\n"]]);
  const row = listView("clues", world(), ".login FAIL", { clueData: clueData(paneState, content) }).rows[0];
  assert.deepEqual(row.item.excerpt, [9, 14]);
});

test("Clues, nothing typed: a pane ssh'd into a host lists its ssh clue", () => {
  const paneState = new Map([["p2", { cwd: `${HOME}/code/web`, command: "ssh deploy@box1", ssh: "deploy@box1", shellPid: 20 }]]);
  const view = listView("clues", world(), "", { clueData: clueData(paneState) });
  assert.deepEqual(view.rows.filter((r) => r.item.id === "p2" && r.item.clue === "ssh").map((r) => [r.item.clue, r.item.title]), [["ssh", "deploy@box1"]]);
});

test("Clues: a negated lowercase term in a buffer search is smart-case, so the line that really matches is found", () => {
  const paneState = new Map([["p2", { cwd: `${HOME}/code/web`, command: "-zsh", ssh: null, shellPid: 20 }]]);
  const content = new Map([["p2", "build FAILED\nbuild ok\n"]]);
  const rows = listView("clues", world(), ".build !fail", { clueData: clueData(paneState, content) }).rows;
  assert.deepEqual(rows.map((r) => [r.item.id, r.item.title]), [["p2", "build ok"]]);
});

test("Clues: `!` in a buffer search drops a line by its own text, not by the pane's folder or clue word", () => {
  const paneState = new Map([["p2", { cwd: `${HOME}/code/web`, command: "-zsh", ssh: null, shellPid: 20 }]]);
  const content = new Map([["p2", "build ok\n"]]);
  const rows = listView("clues", world(), ".build !web", { clueData: clueData(paneState, content) }).rows;
  assert.deepEqual(rows.map((r) => [r.item.id, r.item.title]), [["p2", "build ok"]]);
  const dropped = listView("clues", world(), ".build !ok", { clueData: clueData(paneState, content) }).rows;
  assert.deepEqual(dropped, []);
});

test("Clues: `.FAIL !term` keeps a terminal-buffer line that has FAIL, and `!flaky` drops one that has flaky", () => {
  const paneState = new Map([["p2", { cwd: `${HOME}/code/web`, command: "-zsh", ssh: null, shellPid: 20 }]]);
  const content = new Map([["p2", "$ npm test\nFAIL src/login.test.ts\n"]]);
  const rows = listView("clues", world(), ".FAIL !term", { clueData: clueData(paneState, content) }).rows;
  assert.deepEqual(rows.map((r) => [r.item.clue, r.item.title]), [["term", "FAIL src/login.test.ts"]]);
  const flaky = new Map([["p2", "FAIL flaky test\n"]]);
  assert.deepEqual(listView("clues", world(), ".FAIL !flaky", { clueData: clueData(paneState, flaky) }).rows, []);
});
