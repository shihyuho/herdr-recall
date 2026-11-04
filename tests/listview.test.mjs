// Contract: what the navigator shows for a category, a snapshot and a query:
// the rows in order with their highlights, the total with nothing typed,
// and the row selected when the list opens.
import { test } from "node:test";
import assert from "node:assert/strict";
import { listView } from "../mods/recall/lib/listview.js";
import * as mru from "../mods/recall/lib/mru.js";
import { world, town, HOME } from "./fixtures.mjs";

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

test("Panes, typed: when the row you are on matches, the next row is selected", () => {
  const snap = world();
  snap.history = visited({ space: "sp1", tab: "tb2", pane: "p2" });
  const view = listView("panes", snap, "web");
  assert.deepEqual(ids(view), ["p2", "p1"]);
  assert.equal(view.rows[0].item.current, true);
  assert.equal(view.selected, 1);
  assert.deepEqual(view.rows.map((r) => r.hits), [{ title: [14, 15, 16] }, { where: [0, 1, 2] }]);
});

test("Panes, typed: when the row you are on is the only match, it is selected", () => {
  // "me@mac:~/code/web" is the title of p2 alone, the pane you are on.
  const view = listView("panes", world(), "mac");
  assert.deepEqual(ids(view), ["p2"]);
  assert.equal(view.rows[0].item.current, true);
  assert.equal(view.selected, 0);
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

// Typing sorts the matches into two tiers (ADR 0002): rows where every term
// appears unbroken in some field, then the rest; each tier keeps the order
// the list had with nothing typed.

test("All, typed: an older row where the term appears unbroken sits above a recent row that matches by scattered letters", () => {
  // `ng` is unbroken in "fix cart rounding" (the agent, and checkout's pane list),
  // and only scattered in refunds' "nvim ledger.go", which was focused more recently
  // than checkout's tab, and in "plan redis upgrade".
  const view = listView("all", town(), "ng");
  assert.deepEqual(keys(view), ["agent:t-cart", "tab:tb-checkout", "pane:p-ref", "agent:t-plan"]);
});

test("All, typed: each tier keeps the untyped order", () => {
  // `ra` is unbroken in "infra" and "terraform", scattered in the rest.
  const view = listView("all", town(), "ra");
  assert.deepEqual(keys(view), [
    "agent:t-plan", "pane:p-tf", "space:sp-infra",
    "agent:t-hooks", "agent:t-guide", "agent:t-review", "pane:p-readme", "tab:tb-checkout", "tab:tb-guides",
  ]);
});

test("All, typed: one more letter never swaps two rows that stay in one tier", () => {
  // Under `fa` and `fai` alike, "retry failed calls" is the one unbroken match;
  // the cart agent and checkout's tab match by scattered letters both times.
  assert.deepEqual(keys(listView("all", town(), "fa")), [
    "agent:t-hooks", "agent:t-cart", "agent:t-plan", "pane:p-tf", "tab:tb-checkout", "space:sp-infra",
  ]);
  assert.deepEqual(keys(listView("all", town(), "fai")), ["agent:t-hooks", "agent:t-cart", "tab:tb-checkout"]);
});

test("All, typed: a term that appears unbroken lights that occurrence, not scattered letters in the name", () => {
  const snap = town();
  snap.panes = snap.panes.map((p) => (p.pane === "p-ref" ? { ...p, title: "Add partial refunds" } : p));
  const view = listView("all", snap, "api");
  const row = view.rows.find((r) => r.item.key === "pane:p-ref");
  assert.equal(row.item.crumb, "payments-api › refunds › ");
  // "payments-api": a-p-i at 9, 10, 11; the name "Add partial refunds" stays unlit.
  assert.deepEqual(row.hits, { where: [9, 10, 11] });
});

test("All, typed: an unbroken run inside a word still beats a closer fuzzy alignment in the name", () => {
  // `api` sits unbroken inside the tab name "rapid"; in "Add pending invoices" it
  // would align on three word starts, which fzf's score prefers.
  const snap = town();
  snap.spaces = snap.spaces.map((s) => (s.id === "sp-api" ? { ...s, name: "payments" } : s));
  snap.spaces.find((s) => s.id === "sp-api").tabs[0].name = "rapid";
  snap.panes = snap.panes.map((p) => (p.pane === "p-ref" ? { ...p, title: "Add pending invoices", cwd: `${HOME}/code/payments` } : p));
  const row = listView("all", snap, "api").rows.find((r) => r.item.key === "pane:p-ref");
  assert.equal(row.item.crumb, "payments › rapid › ");
  assert.deepEqual(row.hits, { where: [12, 13, 14] });
});

test("Spaces, typed: when the name and another field hold the term alike, the name lights", () => {
  // "front" is in the name "storefront" and in its folder "~/code/storefront".
  const view = listView("spaces", town(), "front");
  assert.deepEqual(view.rows.map((r) => [r.item.key, r.hits]), [["space:sp-web", { title: [5, 6, 7, 8, 9] }]]);
});

test("Agents sorted by Priority keep Priority order within each tier", () => {
  // Priority, untyped: retry (blocked), rewrite (done), fix cart (working), plan (working), review (idle).
  // `rt` is unbroken in "start" and "cart", only scattered in "retry failed calls".
  assert.deepEqual(keys(listView("agents", town(), "", { agentSort: "priority" })), [
    "agent:t-hooks", "agent:t-guide", "agent:t-cart", "agent:t-plan", "agent:t-review",
  ]);
  assert.deepEqual(keys(listView("agents", town(), "rt", { agentSort: "priority" })), [
    "agent:t-guide", "agent:t-cart", "agent:t-review", "agent:t-hooks",
  ]);
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
