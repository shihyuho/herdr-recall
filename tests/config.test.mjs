// Contract: recall.json decides which categories show, in what order, and
// what keys do; a config written for herdr-recent-navigator keeps working.
import { test } from "node:test";
import assert from "node:assert/strict";
import { actionFor, normalizeKey, parseConfig, parseOpenCommand } from "../mods/recall/lib/config.js";

test("no config: every category, All first and Clues last, modeless keys", () => {
  const { config, error } = parseConfig(null);
  assert.equal(error, null);
  assert.deepEqual(config.categories, ["all", "spaces", "tabs", "panes", "agents", "clues"]);
  assert.equal(config.modal, false);
  assert.equal(actionFor(config.keys, "ctrl-n"), "move_down");
  assert.equal(actionFor(config.keys, "j"), null);
});

test("tabs: order and visibility, aliases, junk dropped, never empty", () => {
  const categoriesOf = (t) => parseConfig(JSON.stringify({ tabs: t })).config.categories;
  assert.deepEqual(categoriesOf(["tabs", " Workspaces ", "agents", "panes", "all"]), ["tabs", "spaces", "agents", "panes", "all"]);
  assert.deepEqual(categoriesOf(["agents", "agents", "bogus", 3]), ["agents"]);
  assert.deepEqual(categoriesOf([]), ["all"]);
});

test("tabs: `others` is Clues, the list it meant in herdr-recent-navigator; `all` is the new All", () => {
  const categoriesOf = (t) => parseConfig(JSON.stringify({ tabs: t })).config.categories;
  assert.deepEqual(categoriesOf(["others", "agents"]), ["clues", "agents"]);
  assert.deepEqual(categoriesOf(["Clues", "all"]), ["clues", "all"]);
  assert.deepEqual(categoriesOf(["others", "clues"]), ["clues"]);
});

test("open commands: each names the category it opens, `others` opening Clues", () => {
  assert.deepEqual(parseOpenCommand("open"), { category: null, sort: null });
  assert.deepEqual(parseOpenCommand("open-all"), { category: "all", sort: null });
  assert.deepEqual(parseOpenCommand("open-clues"), { category: "clues", sort: null });
  assert.deepEqual(parseOpenCommand("open-others"), { category: "clues", sort: null });
  assert.deepEqual(parseOpenCommand("open-workspaces"), { category: "spaces", sort: null });
  assert.deepEqual(parseOpenCommand("open-agents-priority"), { category: "agents", sort: "priority" });
  assert.deepEqual(parseOpenCommand("open-agents-recent"), { category: "agents", sort: "mru" });
});

test("navigator key spelling reads as Herdr keystrokes", () => {
  assert.equal(normalizeKey("C-p"), "ctrl-p");
  assert.equal(normalizeKey("S-Tab"), "shift-tab");
  assert.equal(normalizeKey("BackTab"), "shift-tab");
  assert.equal(normalizeKey("Esc"), "escape");
  assert.equal(normalizeKey("M-x"), "alt-x");
  assert.equal(normalizeKey("J"), "shift-j");
  assert.equal(normalizeKey("ctrl-shift-k"), "ctrl-shift-k");
  assert.equal(normalizeKey("Hyper-x"), null);
});

test("a printable movement key turns on modal input", () => {
  const { config } = parseConfig(JSON.stringify({ keybindings: { move_up: ["k", "Up", "C-p"], move_down: ["j", "Down", "C-n"] } }));
  assert.equal(config.modal, true);
  assert.equal(actionFor(config.keys, "j"), "move_down");
  assert.equal(actionFor(config.keys, "tab"), "next_category");
});

test("a printable select key alone keeps modeless input", () => {
  const { config } = parseConfig(JSON.stringify({ keybindings: { select: ["o"] } }));
  assert.equal(config.modal, false);
  assert.equal(actionFor(config.keys, "o"), "select");
});

test("a malformed keybindings table falls back to every default", () => {
  const { config } = parseConfig(JSON.stringify({ keybindings: { move_up: "k", move_down: ["j"] } }));
  assert.equal(config.modal, false);
  assert.equal(actionFor(config.keys, "j"), null);
  assert.equal(actionFor(config.keys, "up"), "move_up");
});

test("broken JSON reads as defaults and says why", () => {
  const { config, error } = parseConfig("{ tabs: [");
  assert.deepEqual(config.categories, ["all", "spaces", "tabs", "panes", "agents", "clues"]);
  assert.match(error, /^recall\.json: /);
});

test("categories: order and visibility, aliases, unknown dropped, first of duplicates kept, empty is All only", () => {
  const cats = (c, extra = {}) => parseConfig(JSON.stringify({ categories: c, ...extra })).config.categories;
  assert.deepEqual(cats(["agents", " WS ", "others", "bogus", 3, "agents", "all"]), ["agents", "spaces", "clues", "all"]);
  assert.deepEqual(cats(["workspace", "workspaces"]), ["spaces"]);
  assert.deepEqual(cats([]), ["all"]);
});

test("categories wins over tabs; tabs counts only when categories is absent", () => {
  const categoriesOf = (o) => parseConfig(JSON.stringify(o)).config.categories;
  assert.deepEqual(categoriesOf({ categories: ["panes"], tabs: ["agents", "all"] }), ["panes"]);
  assert.deepEqual(categoriesOf({ categories: [], tabs: ["agents"] }), ["all"]);
  assert.deepEqual(categoriesOf({ tabs: ["agents", "all"] }), ["agents", "all"]);
  assert.deepEqual(categoriesOf({}), ["all", "spaces", "tabs", "panes", "agents", "clues"]);
});
