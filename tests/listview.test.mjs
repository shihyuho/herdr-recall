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
  // A bare shell is named after its program, on Panes as on All.
  assert.deepEqual(drawn("pane:p-cartsh"), ["storefront › checkout › ", "zsh"]);
  assert.deepEqual(drawn("pane:p-tf"), ["infra › terraform › ", "zsh"]);
  assert.equal(itemOf(listView("panes", town(), ""), "pane:p-cartsh").title, "zsh");
  // A pane with a title of its own keeps it.
  assert.equal(itemOf(view, "pane:p-dev").title, "npm run dev");
  // A tab row carries no program, so it draws the tab icon; Tabs draws its lead pane's.
  assert.equal(itemOf(view, "tab:tb-checkout").program, null);
  assert.equal(itemOf(listView("tabs", town(), ""), "tab:tb-checkout").program.name, "Claude Code");
});

test("a pane goes by one name in every category: its program when it has no title, its folder when Herdr doesn't know the program", () => {
  const snap = town();
  const set = (id, patch) => { Object.assign(snap.panes.find((p) => p.pane === id), patch); };
  set("p-tf", { program: null });
  set("p-cartsh", { program: { key: "htop", name: "htop", shell: false, agent: false } });
  const panes = listView("panes", snap, "");
  assert.equal(itemOf(panes, "pane:p-cartsh").title, "htop");
  assert.equal(itemOf(panes, "pane:p-tf").title, "infra");
  assert.equal(itemOf(listView("all", snap, ""), "pane:p-cartsh").title, "htop");
  assert.equal(itemOf(panes, "pane:p-dev").title, "npm run dev");
  assert.equal(itemOf(panes, "pane:p-cart").title, "fix cart rounding");
});

test("Panes, typed: a bare shell is found by its program's name, highlighted in its name", () => {
  const view = listView("panes", town(), "zsh");
  assert.deepEqual(keys(view), ["pane:p-cartsh", "pane:p-tf"]);
  assert.deepEqual(view.rows.map((r) => r.hits), [{ title: [0, 1, 2] }, { title: [0, 1, 2] }]);
});

test("All, typed: a bare shell is found by its program's name, highlighted in its name", () => {
  const view = listView("all", town(), "zsh");
  // checkout's row is found too: its pane list holds the shell's name.
  assert.deepEqual(keys(view), ["pane:p-cartsh", "pane:p-tf", "tab:tb-checkout"]);
  assert.deepEqual(view.rows.slice(0, 2).map((r) => r.hits), [{ title: [0, 1, 2] }, { title: [0, 1, 2] }]);
});

test("All, typed: the list only shrinks, and the total stays the untyped count", () => {
  const untyped = new Set(keys(listView("all", town(), "")));
  for (const query of ["r", "cart", "storefront", "plan"]) {
    const view = listView("all", town(), query);
    assert.equal(keys(view).every((k) => untyped.has(k)), true, query);
    assert.equal(new Set(keys(view)).size, view.rows.length, query);
    assert.equal(view.total, 15, query);
  }
  assert.deepEqual(keys(listView("all", town(), "plan")), ["agent:t-plan"]);
  assert.deepEqual(keys(listView("all", town(), "zzz")), ["to-clues"]);
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
  assert.deepEqual(keys(listView("all", snap, "quokka")), ["to-clues"]);
});

// Queries follow fzf's extended-search mode (fzf 0.73). A row has several
// fields where fzf has one line, so anchors hold at the start or end of
// any one field, and `!` drops a row when the term appears in any field.

/** town() with the dev-server pane retitled, to give a term a place mid-field. */
function retitled(title) {
  const snap = town();
  snap.panes.find((p) => p.pane === "p-dev").title = title;
  return snap;
}

test("`^pay` keeps rows with a field that starts with pay, lit there; plain `pay` also finds it mid-field", () => {
  const snap = retitled("repay dev");
  const view = listView("all", snap, "^pay");
  // p-ref and t-hooks are located in payments-api; sp-api is named payments-api.
  assert.deepEqual(view.rows.map((r) => [r.item.key, r.hits]), [
    ["pane:p-ref", { where: [0, 1, 2] }],
    ["agent:t-hooks", { where: [0, 1, 2] }],
    ["space:sp-api", { title: [0, 1, 2] }],
  ]);
  assert.equal(view.total, 15);
  assert.equal(keys(listView("all", snap, "pay")).includes("pane:p-dev"), true);
});

test("`refunds$` keeps rows with a field that ends with refunds: the pane located in that tab, the tab itself", () => {
  const snap = retitled("refunds report");
  assert.deepEqual(keys(listView("panes", snap, "refunds")), ["pane:p-ref", "pane:p-dev"]);
  const view = listView("panes", snap, "refunds$");
  // "payments-api › refunds": r at 15 to s at 21.
  assert.deepEqual(view.rows.map((r) => [r.item.key, r.hits]), [["pane:p-ref", { where: [15, 16, 17, 18, 19, 20, 21] }]]);
  assert.deepEqual(keys(listView("tabs", snap, "refunds$")), ["tab:tb-refunds"]);
});

test("`^term$` keeps rows with a field that is exactly the term", () => {
  assert.deepEqual(keys(listView("all", town(), "^zsh$")), ["pane:p-cartsh", "pane:p-tf"]);
  assert.deepEqual(keys(listView("all", town(), "^zs$")), ["to-clues"]);
});

test("`'ng` keeps only rows where ng appears unbroken; plain `ng` also takes scattered letters", () => {
  assert.deepEqual(keys(listView("all", town(), "ng")), ["agent:t-cart", "tab:tb-checkout", "pane:p-ref", "agent:t-plan"]);
  const view = listView("all", town(), "'ng");
  // "fix cart rounding": n-g at 15, 16.
  assert.deepEqual(view.rows.map((r) => [r.item.key, r.hits]), [
    ["agent:t-cart", { title: [15, 16] }],
    ["tab:tb-checkout", { detail: [15, 16] }],
  ]);
});

test("`'api'` matches api only as a whole word: payments-api, not rapid; `'api` takes both", () => {
  const snap = retitled("rapid build");
  assert.deepEqual(keys(listView("all", snap, "'api'")), ["pane:p-ref", "agent:t-hooks", "space:sp-api"]);
  assert.deepEqual(keys(listView("all", snap, "'api")), ["pane:p-ref", "pane:p-dev", "agent:t-hooks", "space:sp-api"]);
  // "payments-api › refunds": a-p-i at 9, 10, 11.
  assert.deepEqual(listView("all", snap, "'api'").rows[0].hits, { where: [9, 10, 11] });
});

test("Operators keep smart case: a lowercase term ignores case, an uppercase letter makes it exact", () => {
  // "nvim README.md" names the pane and is in its tab's pane list.
  assert.deepEqual(keys(listView("all", town(), "'readme")), ["pane:p-readme", "tab:tb-guides"]);
  assert.deepEqual(keys(listView("all", town(), "'README")), ["pane:p-readme", "tab:tb-guides"]);
  assert.deepEqual(keys(listView("all", town(), "'Readme")), ["to-clues"]);
  assert.deepEqual(keys(listView("all", town(), "^Pay")), ["to-clues"]);
});

const ALL_UNTYPED = [
  "agent:t-cart", "pane:p-ref", "pane:p-dev", "agent:t-hooks", "agent:t-guide", "agent:t-plan", "agent:t-review",
  "pane:p-cartsh", "pane:p-readme", "pane:p-tf", "tab:tb-checkout", "tab:tb-guides", "space:sp-web", "space:sp-api", "space:sp-infra",
];
const without = (...gone) => ALL_UNTYPED.filter((k) => !gone.includes(k));

test("`!zsh` drops the shell panes and lights nothing; the negated term matches exactly, so `!zh` drops nothing", () => {
  const view = listView("all", town(), "!zsh");
  // checkout's tab row goes too: its panes include a shell.
  assert.deepEqual(keys(view), without("pane:p-cartsh", "pane:p-tf", "tab:tb-checkout"));
  assert.equal(view.rows.every((r) => Object.keys(r.hits).length === 0), true);
  assert.equal(view.total, 15);
  assert.deepEqual(keys(listView("all", town(), "!zh")), ALL_UNTYPED);
  // `!'zh` negates a fuzzy term, as in fzf: z-s-h holds z..h.
  assert.deepEqual(keys(listView("all", town(), "!'zh")), without("pane:p-cartsh", "pane:p-tf", "tab:tb-checkout"));
});

test("`!^pay` and `!refunds$` drop rows with a field that starts or ends so, and keep rows that hold it elsewhere", () => {
  const repay = retitled("repay dev");
  assert.deepEqual(keys(listView("all", repay, "!^pay")), without("pane:p-ref", "agent:t-hooks", "space:sp-api"));
  const report = retitled("refunds report");
  // p-ref is located in "payments-api › refunds"; p-dev is titled "refunds report".
  assert.equal(keys(listView("panes", report, "!refunds$")).includes("pane:p-dev"), true);
  assert.equal(keys(listView("panes", report, "!refunds$")).includes("pane:p-ref"), false);
  assert.equal(keys(listView("panes", report, "!refunds")).includes("pane:p-dev"), false);
});

test("A negated term drops a row when it appears in any field; only the positive terms light up", () => {
  // "review cart totals" is the review agent's name and sits in checkout's pane list.
  const view = listView("all", town(), "'cart !review");
  assert.deepEqual(view.rows.map((r) => [r.item.key, r.hits]), [["agent:t-cart", { title: [4, 5, 6, 7] }]]);
  assert.deepEqual(keys(listView("all", town(), "'cart")), ["agent:t-cart", "agent:t-review", "tab:tb-checkout"]);
});

test("A negated term leaves the tiers as the other terms set them", () => {
  assert.deepEqual(keys(listView("all", town(), "ng !zsh")), ["agent:t-cart", "pane:p-ref", "agent:t-plan"]);
});

test("`a | b` keeps rows that match either; a bar with nothing after it is ignored", () => {
  assert.deepEqual(keys(listView("all", town(), "refunds webhooks")), ["to-clues"]);
  assert.deepEqual(keys(listView("all", town(), "refunds | webhooks")), ["pane:p-ref", "agent:t-hooks"]);
  assert.deepEqual(keys(listView("all", town(), "refunds |")), ["pane:p-ref"]);
  // OR binds tighter than AND: (refunds or webhooks) and nvim.
  assert.deepEqual(keys(listView("all", town(), "refunds | webhooks 'nvim")), ["pane:p-ref"]);
});

test("An exact term puts its rows in the upper tier; in an OR group, the alternative that matched decides", () => {
  // `ng` is unbroken in "fix cart rounding", scattered in "nvim ledger.go" and "plan redis upgrade";
  // the shell panes match `'zsh` alone, which rises them above the scattered rows.
  const view = listView("all", town(), "'zsh | ng");
  assert.deepEqual(keys(view), ["agent:t-cart", "pane:p-cartsh", "pane:p-tf", "tab:tb-checkout", "pane:p-ref", "agent:t-plan"]);
  assert.deepEqual(view.rows[1].hits, { title: [0, 1, 2] });
  // refunds' pane holds `ledger` unbroken, so it rises although `ng` is scattered in it.
  const either = listView("all", town(), "ng | ledger");
  assert.deepEqual(keys(either), ["agent:t-cart", "pane:p-ref", "tab:tb-checkout", "agent:t-plan"]);
  assert.deepEqual(either.rows[1].hits, { title: [5, 6, 7, 8, 9, 10] });
});

test("`\\ ` is a literal space inside a term", () => {
  assert.deepEqual(keys(listView("all", town(), "'cart r")), ["agent:t-cart", "agent:t-review", "tab:tb-checkout"]);
  const view = listView("all", town(), "'cart\\ r");
  // "fix cart rounding": "cart r" at 4 to 9.
  assert.deepEqual(view.rows.map((r) => [r.item.key, r.hits]), [
    ["agent:t-cart", { title: [4, 5, 6, 7, 8, 9] }],
    ["tab:tb-checkout", { detail: [4, 5, 6, 7, 8, 9] }],
  ]);
});

test("An operator with nothing after it filters nothing yet", () => {
  for (const query of ["!", "'", "^", "!^"]) assert.deepEqual(keys(listView("all", town(), query)), ALL_UNTYPED, query);
});

test("All, a query nothing matches: one row offering Clues for that query, and it is selected", () => {
  const view = listView("all", town(), "zzqx");
  assert.equal(view.rows.length, 1);
  assert.equal(view.rows[0].item.kind, "to-clues");
  assert.equal(view.rows[0].item.title, 'Search Clues for "zzqx"');
  assert.equal(view.selected, 0);
});

test("All, a query that matches: no Clues row beside the matches", () => {
  const view = listView("all", town(), "api");
  assert.ok(view.rows.length > 0);
  assert.ok(view.rows.every((r) => r.item.kind !== "to-clues"));
});

test("All, nothing typed: no Clues row", () => {
  assert.ok(listView("all", town(), "").rows.every((r) => r.item.kind !== "to-clues"));
});

test("All offers no Clues row when Clues is not a category", () => {
  assert.equal(listView("all", town(), "zzqx", { cluesAvailable: false }).rows.length, 0);
});

test("The query is trimmed in the Clues row's title", () => {
  assert.equal(listView("all", town(), "  zzqx ").rows[0].item.title, 'Search Clues for "zzqx"');
});

// The header reads `count/total`: the count is what matched, so the Clues
// offer row (not a match) is not counted.
test("count is the number of matching rows: 0 for a query All turns into the Clues offer", () => {
  const miss = listView("all", town(), "zzqx");
  assert.equal(miss.rows.length, 1);
  assert.equal(miss.count, 0);
  assert.equal(miss.total, listView("all", town(), "").rows.length);
});

test("count equals the rows when they all match, typed or not", () => {
  const typed = listView("all", town(), "api");
  assert.ok(typed.rows.length > 0);
  assert.equal(typed.count, typed.rows.length);
  const open = listView("all", town(), "");
  assert.equal(open.count, open.rows.length);
  assert.equal(listView("all", town(), "zzqx", { cluesAvailable: false }).count, 0);
});

for (const category of ["spaces", "tabs", "panes", "agents"]) {
  test(`${category}, a query nothing matches: no rows, so "Nothing matches"`, () => {
    assert.equal(listView(category, town(), "zzqx").rows.length, 0);
  });
}

test("All, nothing typed: returning to an agent after a shell pane puts it back on top, and Agents' own Recent order is unchanged", () => {
  // t1 agent hooks, t2 shell cartsh, t3 hooks again, t4 shell tf (where you are now).
  const snap = town();
  let h = mru.empty();
  h = mru.record(h, { space: "sp-api", tab: "tb-hooks", pane: "p-hooks", agent: "t-hooks" }, 1000);
  h = mru.record(h, { space: "sp-web", tab: "tb-checkout", pane: "p-cartsh", agent: null }, 2000);
  h = mru.record(h, { space: "sp-api", tab: "tb-hooks", pane: "p-hooks", agent: "t-hooks" }, 3000);
  h = mru.record(h, { space: "sp-infra", tab: "tb-tf", pane: "p-tf", agent: null }, 4000);
  snap.history = h;
  snap.focused = { ...snap.focused, space: "sp-infra", tab: "tb-tf", pane: "p-tf", terminal: "t-tf", agent: null };
  for (const a of snap.agents) a.focused = false;

  const all = listView("all", snap, "");
  assert.deepEqual(keys(all).slice(0, 3), ["pane:p-tf", "agent:t-hooks", "pane:p-cartsh"]);
  assert.equal(all.selected, 1);

  assert.deepEqual(keys(listView("agents", snap, "")).slice(0, 2), ["agent:t-hooks", "agent:t-guide"]);
});

test("Tabs and All, typed: a folder finds the tab that shows it", () => {
  const snap = town();
  assert.deepEqual(keys(listView("tabs", snap, "code/docs")), ["tab:tb-guides"]);
  assert.ok(keys(listView("all", snap, "code/docs")).includes("tab:tb-guides"));
});

test("the columns fit every row the category lists, whatever is typed: a query narrows the rows, not what the widths fit", () => {
  const snap = town();
  const fits = (view) => view.fitTo.map((i) => i.key).sort();
  const untyped = listView("panes", snap, "");
  assert.deepEqual(fits(untyped), keys(untyped).sort());
  const typed = listView("panes", snap, "nvim");
  assert.ok(typed.rows.length < untyped.rows.length, "the query narrows the rows");
  assert.deepEqual(fits(typed), fits(untyped));
  // All, a query nothing matches: still every row, not the row offering Clues.
  assert.deepEqual(fits(listView("all", snap, "zzzz")), fits(listView("all", snap, "")));
});
