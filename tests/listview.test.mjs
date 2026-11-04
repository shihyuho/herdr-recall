// Contract: what the navigator shows for a category, a snapshot and a query:
// the rows in order with their highlights, the total with nothing typed,
// and the row selected when the list opens.
import { test } from "node:test";
import assert from "node:assert/strict";
import { listView } from "../mods/recall/lib/listview.js";
import * as mru from "../mods/recall/lib/mru.js";
import { world, town } from "./fixtures.mjs";

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

// Clues' tests are in clues.test.mjs.

const keys = (view) => view.rows.map((r) => r.item.key);

test("All, nothing typed: one row per destination; agents and panes, then tabs, then spaces; focused first, the rest by status", () => {
  const view = listView("all", town(), "");
  assert.deepEqual(keys(view), [
    // agents and panes: focused, most recent first
    "agent:t-cart", "pane:p-ref", "pane:p-dev",
    // never focused: blocked, done, working, idle, then no status in Herdr's order
    "agent:t-hooks", "agent:t-guide", "agent:t-plan", "agent:t-review", "pane:p-cartsh", "pane:p-readme", "pane:p-tf",
    // tabs with more than one pane
    "tab:tb-checkout", "tab:tb-guides",
    // spaces with more than one tab
    "space:sp-web", "space:sp-api", "space:sp-infra",
  ]);
  assert.equal(view.total, 15);
  assert.equal(view.selected, 1);
  assert.equal(view.label, null);
});

const itemOf = (view, key) => view.rows.find((r) => r.item.key === key)?.item;

test("All: an agent stands for its pane, and a one-pane tab or a one-tab space gets no row of its own", () => {
  const shown = new Set(keys(listView("all", town(), "")));
  // checkout's agent pane is listed once, as its agent
  assert.equal(shown.has("agent:t-cart"), true);
  assert.equal(shown.has("pane:p-cart"), false);
  // dev-server has one pane: that pane's row, no tab row; checkout has three: a tab row
  assert.equal(shown.has("pane:p-dev"), true);
  assert.equal(shown.has("tab:tb-dev"), false);
  assert.equal(shown.has("tab:tb-checkout"), true);
  // docs has one tab: that tab's row, no space row; payments-api has two: a space row
  assert.equal(shown.has("tab:tb-guides"), true);
  assert.equal(shown.has("space:sp-docs"), false);
  assert.equal(shown.has("space:sp-api"), true);
});

test("All with one space lists no space row, even when that space has several tabs", () => {
  const snap = town();
  const storefront = new Set(["tb-checkout", "tb-dev"]);
  snap.spaces = snap.spaces.filter((s) => s.id === "sp-web");
  snap.panes = snap.panes.filter((p) => storefront.has(p.tab));
  snap.agents = snap.agents.filter((a) => storefront.has(a.tab));
  const view = listView("all", snap, "");
  assert.deepEqual(keys(view), ["agent:t-cart", "pane:p-dev", "agent:t-review", "pane:p-cartsh", "tab:tb-checkout"]);
  assert.equal(view.total, 5);
});

test("All leads each name with its path; a bare shell goes by its program, a tab row by the tab icon", () => {
  const view = listView("all", town(), "");
  const drawn = (key) => [itemOf(view, key).crumb, itemOf(view, key).title];
  assert.deepEqual(drawn("pane:p-ref"), ["payments-api › refunds › ", "nvim ledger.go"]);
  assert.deepEqual(drawn("agent:t-hooks"), ["payments-api › webhooks › ", "retry failed calls"]);
  assert.deepEqual(drawn("tab:tb-checkout"), ["storefront › ", "checkout"]);
  assert.deepEqual(drawn("space:sp-infra"), ["", "infra"]);
  // A bare shell is named after its program in All; Panes still names it after its folder.
  assert.deepEqual(drawn("pane:p-cartsh"), ["storefront › checkout › ", "zsh"]);
  assert.deepEqual(drawn("pane:p-tf"), ["infra › terraform › ", "zsh"]);
  assert.equal(itemOf(listView("panes", town(), ""), "pane:p-cartsh").title, "storefront");
  // A pane with a title of its own keeps it.
  assert.equal(itemOf(view, "pane:p-dev").title, "npm run dev");
  // A tab row carries no program, so it draws the tab icon; Tabs draws its lead pane's.
  assert.equal(itemOf(view, "tab:tb-checkout").program, null);
  assert.equal(itemOf(listView("tabs", town(), ""), "tab:tb-checkout").program.name, "Claude Code");
});

test("All, typed: a bare shell is found by its program's name, highlighted in its name", () => {
  const view = listView("all", town(), "zsh");
  assert.deepEqual(keys(view), ["pane:p-cartsh", "pane:p-tf"]);
  assert.deepEqual(view.rows.map((r) => r.hits), [{ title: [0, 1, 2] }, { title: [0, 1, 2] }]);
});

test("All, typed: the list only shrinks, and the total stays the untyped count", () => {
  const untyped = new Set(keys(listView("all", town(), "")));
  for (const query of ["r", "cart", "storefront", "plan", "zzz"]) {
    const view = listView("all", town(), query);
    assert.equal(keys(view).every((k) => untyped.has(k)), true, query);
    assert.equal(new Set(keys(view)).size, view.rows.length, query);
    assert.equal(view.total, 15, query);
  }
  assert.deepEqual(keys(listView("all", town(), "plan")), ["agent:t-plan"]);
  assert.deepEqual(keys(listView("all", town(), "zzz")), []);
});

test("All, typed: `refunds` finds the pane in the tab named refunds, lit inside its path", () => {
  const view = listView("all", town(), "refunds");
  assert.deepEqual(keys(view), ["pane:p-ref"]);
  assert.deepEqual(view.rows[0].hits, { where: [15, 16, 17, 18, 19, 20, 21] });
  assert.equal([...view.rows[0].item.crumb].slice(15, 22).join(""), "refunds");
});
