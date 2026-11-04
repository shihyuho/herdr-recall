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

// Recent in Spaces, Tabs, Panes and Agents: the focused rows first, most
// recent first; rows never focused by status (blocked, done, working, idle,
// none), ties in Herdr's order. town()'s history: dev-server, refunds, then
// checkout, so recency differs from Herdr's order.

test("Tabs, nothing typed: focused tabs by recency, then never-focused ones blocked, done, working, none", () => {
  const view = listView("tabs", town(), "");
  assert.deepEqual(ids(view), [
    "tb-checkout", "tb-refunds", "tb-dev", // focused, most recent first
    "tb-hooks", "tb-guides", "tb-plan", "tb-tf", // blocked, done, working, none
  ]);
});

test("Spaces, nothing typed: focused spaces by recency, then never-focused ones by status", () => {
  const snap = town();
  snap.spaces[3].status = "blocked"; // infra now needs you; docs is done
  assert.deepEqual(ids(listView("spaces", snap, "")), ["sp-web", "sp-api", "sp-infra", "sp-docs"]);
});

test("Spaces: a linked worktree still nests under its main checkout, whatever the status order", () => {
  const snap = town();
  snap.spaces[3].status = "blocked";
  snap.worktrees = new Map([["sp-infra", { linked: true, main: "sp-docs", repo: "docs", branch: "feat" }]]);
  const view = listView("spaces", snap, "");
  assert.deepEqual(ids(view), ["sp-web", "sp-api", "sp-docs", "sp-infra"]);
  assert.equal(view.rows[3].item.nested, true);
});

test("Panes, nothing typed: focused panes by recency, then never-focused ones by status, ties in Herdr's order", () => {
  assert.deepEqual(ids(listView("panes", town(), "")), [
    "p-cart", "p-ref", "p-dev", // focused, most recent first
    "p-hooks", "p-guide", "p-plan", "p-review", "p-cartsh", "p-readme", "p-tf", // blocked, done, working, idle, none
  ]);
});

test("Agents, Recent: focused first, then never-focused by status with ties in Herdr's order; Priority and Grouped keep their own", () => {
  const snap = town();
  snap.agents.find((a) => a.address === "t-review").status = "working"; // ties with t-plan; it comes first in Herdr
  assert.deepEqual(ids(listView("agents", snap, "", { agentSort: "mru" })), ["t-cart", "t-hooks", "t-guide", "t-review", "t-plan"]);
  assert.deepEqual(ids(listView("agents", snap, "", { agentSort: "priority" })), ["t-hooks", "t-guide", "t-cart", "t-plan", "t-review"]);
  assert.deepEqual(ids(listView("agents", snap, "", { agentSort: "grouped" })), ["t-cart", "t-review", "t-hooks", "t-guide", "t-plan"]);
});

// A row can be found by anything it shows: its branch, its status word and its space's machine.
function onBranches() {
  const snap = town();
  snap.panes.find((p) => p.pane === "p-cart").branch = "hotfix/zeta";
  snap.panes.find((p) => p.pane === "p-hooks").branch = "hotfix/zeta";
  snap.panes.find((p) => p.pane === "p-dev").branch = "hotfix/zeta";
  return snap;
}

test("Typing a branch name finds the panes and agents on it, in Panes, Agents and All; highlights stay off it", () => {
  const snap = onBranches();
  assert.deepEqual(keys(listView("panes", snap, "zeta")).sort(), ["pane:p-cart", "pane:p-dev", "pane:p-hooks"]);
  assert.deepEqual(keys(listView("agents", snap, "zeta")).sort(), ["agent:t-cart", "agent:t-hooks"]);
  const all = listView("all", snap, "zeta");
  assert.deepEqual(keys(all).sort(), ["agent:t-cart", "agent:t-hooks", "pane:p-dev", "tab:tb-checkout"]);
  for (const r of all.rows) assert.deepEqual(Object.keys(r.hits).filter((k) => ["title", "where", "path", "detail"].includes(k)), []);
  assert.deepEqual(keys(listView("panes", snap, "nomatchbranch")), []);
});

test("Typing a branch name finds a tab whose lead pane is on it", () => {
  const snap = onBranches();
  assert.deepEqual(keys(listView("tabs", snap, "zeta")).sort(), ["tab:tb-checkout", "tab:tb-dev", "tab:tb-hooks"]);
});

test("`needs` finds the blocked agents and `finished` the done ones, as the STATUS column words them", () => {
  const snap = town();
  assert.deepEqual(keys(listView("agents", snap, "needs")), ["agent:t-hooks"]);
  assert.deepEqual(keys(listView("agents", snap, "finished")), ["agent:t-guide"]);
  assert.equal(keys(listView("all", snap, "needs")).includes("agent:t-hooks"), true);
  assert.equal(keys(listView("all", snap, "finished")).includes("agent:t-guide"), true);
  // The raw status names are not what a row shows.
  assert.deepEqual(keys(listView("agents", snap, "blocked")), []);
});

test("A space on another machine is found by the machine's name", () => {
  assert.deepEqual(keys(listView("spaces", town(), "build-box")), ["space:sp-infra"]);
  assert.deepEqual(keys(listView("all", town(), "build-box")), ["space:sp-infra"]);
});

test("Text found only in an agent's last message matches nothing", () => {
  const snap = town();
  snap.terminals = [{ address: "t-cart", report: { msg: "quokka migration finished" } }];
  assert.equal(itemOf(listView("agents", snap, ""), "agent:t-cart").message, "quokka migration finished");
  assert.deepEqual(keys(listView("agents", snap, "quokka")), []);
  assert.deepEqual(keys(listView("all", snap, "quokka")), []);
});
