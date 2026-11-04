// Contract: recall.json decides which categories show, in what order, and
// what keys do; a config written for herdr-recent-navigator keeps working.
import { test } from "node:test";
import assert from "node:assert/strict";
import { actionFor, normalizeKey, parseConfig } from "../mods/recall/lib/config.js";

test("no config: every category, default order, modeless keys", () => {
  const { config, error } = parseConfig(null);
  assert.equal(error, null);
  assert.deepEqual(config.tabs, ["spaces", "tabs", "panes", "agents", "all"]);
  assert.equal(config.modal, false);
  assert.equal(actionFor(config.keys, "ctrl-n"), "move_down");
  assert.equal(actionFor(config.keys, "j"), null);
});

test("tabs: order and visibility, aliases, junk dropped, never empty", () => {
  const tabs = (t) => parseConfig(JSON.stringify({ tabs: t })).config.tabs;
  assert.deepEqual(tabs(["tabs", " Workspaces ", "agents", "panes", "others"]), ["tabs", "spaces", "agents", "panes", "all"]);
  assert.deepEqual(tabs(["agents", "agents", "bogus", 3]), ["agents"]);
  assert.deepEqual(tabs([]), ["all"]);
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
  assert.deepEqual(config.tabs, ["spaces", "tabs", "panes", "agents", "all"]);
  assert.match(error, /^recall\.json: /);
});
