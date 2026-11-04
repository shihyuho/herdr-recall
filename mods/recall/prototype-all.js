// PROTOTYPE — throwaway, do not build on this file.
//
// Question: what should the new All look like, with nothing typed and while
// typing? All is now every space, tab, pane and agent in one list (see
// GLOSSARY.md and docs/adr/0001). Both variants draw breadcrumbs (NAME is
// space › tab › pane, no LOCATION). Flip variants with ⌥← / ⌥→, and real or
// demo data with ⌥↓ (demo rows don't run anything on Enter).
//
//   D  herdr-bar's rules: one fixed set of rows, typing only filters it.
//      No two rows lead to the same place: an agent stands for its pane, a
//      tab with one pane and a space with one tab get no row of their own,
//      and with one space there is no space row. Nothing typed → agents and
//      panes, then tabs, then spaces; visited first, the rest by status.
//      Typing → best match first: each term takes its best field, and +40
//      when that field is the name; ties keep the order above.
//   E  as D, but typing only filters: the rows keep the order above
//   F  as D, but typing sorts into two tiers: rows where every term appears
//      unbroken in some field first, the rest after; each tier keeps the
//      order above (the one agreed)
//   C  the old C, for comparison: nothing typed shows agents and panes,
//      typing searches every kind, so the list grows when you type
//
// Everything typed and found nothing → one row offering to search Clues.
// Delete this file and its PROTOTYPE hooks in main.js and ui.js once a
// variant wins.

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { shared, setShared } from "herdr";
import { buildItems } from "./lib/items.js";
import { matchTerm, search, terms } from "./lib/fuzzy.js";
import * as mru from "./lib/mru.js";

export const LAYOUTS = [
  { key: "F", name: "Two tiers: unbroken matches first, then recent" },
  { key: "D", name: "herdr-bar rules, typing ranks by match" },
  { key: "E", name: "herdr-bar rules, typing keeps the order" },
  { key: "C", name: "Old C: typing adds rows" },
];
const LAYOUT_KEY = "recall.prototype.all-variant";
const DEMO_KEY = "recall.prototype.all-demo";

export const layout = () => (LAYOUTS.some((l) => l.key === shared(LAYOUT_KEY)) ? shared(LAYOUT_KEY) : "F");
export const demo = () => shared(DEMO_KEY) === true;
export function cycleLayout(step) {
  const i = LAYOUTS.findIndex((l) => l.key === layout());
  setShared(LAYOUT_KEY, LAYOUTS[(i + step + LAYOUTS.length) % LAYOUTS.length].key);
}
export const toggleDemo = () => setShared(DEMO_KEY, !demo());

// ── All's rows ──────────────────────────────────────────────────────────────

const SPECIFIC = { agent: 0, pane: 1, tab: 2, space: 3 };

/** Every kind, most recently focused first; one focus touches all four, so ties go most specific first. */
function byRecency(items) {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const x = a.item.at, y = b.item.at;
      if (x != null && y != null && x !== y) return y - x;
      if (x != null && y == null) return -1;
      if (x == null && y != null) return 1;
      return SPECIFIC[a.item.kind] - SPECIFIC[b.item.kind] || a.i - b.i;
    })
    .map(({ item }) => item);
}

/** Nothing typed, layouts A and C: an agent stands for its pane; spaces and tabs wait for a query. */
function mostSpecific(items) {
  const agentTerminals = new Set(items.filter((i) => i.kind === "agent").map((i) => i.terminal));
  return items.filter((i) => i.kind === "agent" || (i.kind === "pane" && !agentTerminals.has(i.terminal)));
}

const toClues = (query) => ({ item: { kind: "to-clues", key: "to-clues", title: `Search Clues for "${query.trim()}"`, actions: [] }, hits: {} });

export function allRows(snap, query) {
  if (layout() !== "C") return placeRows(snap, query);
  const items = byRecency(["spaces", "tabs", "panes", "agents"].flatMap((c) => buildItems(c, snap)));
  if (!query.trim()) {
    const shown = mostSpecific(items);
    return { rows: shown.map((item) => ({ item, hits: {} })), filter: null, label: null, total: shown.length };
  }
  const rows = search(items, query, (i) => i.fields);
  if (!rows.length) rows.push(toClues(query));
  return { rows, filter: null, label: null, total: items.length };
}

// ── D: herdr-bar's rules ────────────────────────────────────────────────────

const LEVEL = { agent: 0, pane: 0, tab: 1, space: 2 };
const STATUS = { blocked: 0, done: 1, working: 2, idle: 3 };
const TITLE_BONUS = 40;

/** Every row All has, one per place, in the order it rests in with nothing typed. */
function places(snap) {
  const agents = buildItems("agents", snap);
  const withAgent = new Set(agents.map((a) => a.terminal));
  const raw = new Map(snap.panes.map((p) => [p.pane, p]));
  const panes = buildItems("panes", snap)
    .filter((p) => !withAgent.has(p.terminal))
    .map((p) => {
      // A bare shell goes by its program, not by its folder.
      const r = raw.get(p.id);
      const bare = !r?.title || r.title === r.terminal;
      if (!p.program?.shell || !bare) return p;
      const title = p.program.name;
      return { ...p, title, detail: "", fields: p.fields.map((f) => (f.key === "title" ? { ...f, text: title } : f)) };
    });
  const paneCount = new Map();
  for (const p of snap.panes) paneCount.set(p.tab, (paneCount.get(p.tab) ?? 0) + 1);
  const tabs = buildItems("tabs", snap).filter((t) => (paneCount.get(t.id) ?? 0) > 1).map((t) => ({ ...t, program: null }));
  const tabCount = new Map(snap.spaces.map((s) => [s.id, s.tabs.length]));
  const spaces = snap.spaces.length > 1 ? buildItems("spaces", snap).filter((s) => tabCount.get(s.id) > 1) : [];
  return [...agents, ...panes, ...tabs, ...spaces]
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const x = a.item, y = b.item;
      if (LEVEL[x.kind] !== LEVEL[y.kind]) return LEVEL[x.kind] - LEVEL[y.kind];
      if (x.at != null && y.at != null && x.at !== y.at) return y.at - x.at;
      if ((x.at != null) !== (y.at != null)) return x.at != null ? -1 : 1;
      return (STATUS[x.status] ?? 9) - (STATUS[y.status] ?? 9) || a.i - b.i;
    })
    .map(({ item }) => item);
}

/** Each term takes the field it matches best; +40 when that field is the name. */
function score(fields, query) {
  const hits = {};
  let total = 0;
  for (const term of terms(query)) {
    let best = null;
    for (const f of fields) {
      if (!f.text) continue;
      const r = matchTerm(f.text, term);
      if (!r) continue;
      if (!best || r.score > best.score) best = { score: r.score, key: f.key, indices: r.indices };
    }
    if (!best) return null;
    total += best.score + (best.key === "title" ? TITLE_BONUS : 0);
    hits[best.key] = [...new Set([...(hits[best.key] ?? []), ...best.indices])].sort((a, b) => a - b);
  }
  return { score: total, hits };
}

/** F's upper tier: every term appears unbroken in some field (smart case, as the fuzzy match). */
function unbroken(fields, query) {
  return terms(query).every((term) => {
    const sensitive = term !== term.toLowerCase();
    return fields.some((f) => f.text && (sensitive ? f.text : f.text.toLowerCase()).includes(term));
  });
}

function placeRows(snap, query) {
  const items = places(snap);
  const total = items.length;
  if (!query.trim()) return { rows: items.map((item) => ({ item, hits: {} })), filter: null, label: null, total };
  const rows = items
    .map((item, order) => ({ item, order, r: score(item.fields, query) }))
    .filter((x) => x.r)
    .map((x) => ({ ...x, tier: unbroken(x.item.fields, query) ? 0 : 1 }))
    .sort((a, b) => (layout() === "D" ? b.r.score - a.r.score : layout() === "F" ? a.tier - b.tier : 0) || a.order - b.order)
    .map(({ item, r }) => ({ item, hits: r.hits }));
  if (!rows.length) rows.push(toClues(query));
  return { rows, filter: null, label: null, total };
}

/** A space's Location in All: the machine it is on. */
export function spaceLocation(item) {
  return item.where ? item.where.replace(/^on /, "") : "This computer";
}

/** The breadcrumb's text, so far as it is the item's `where` field: hits there light up in it. */
export const breadcrumbHits = (item, hits) => (item.kind === "pane" || item.kind === "agent" || item.kind === "tab" ? hits?.where : undefined);

/** The breadcrumb: the path down to the item, the item itself bright. */
export function breadcrumb(item) {
  if (item.kind === "space" || item.kind === "to-clues") return "";
  if (item.kind === "tab") return `${item.spaceName} › `;
  return `${item.spaceName} › ${item.tabName} › `;
}

// ── demo world ──────────────────────────────────────────────────────────────

const HOME = "/Users/demo";
const prog = (key, name, icon, agent = false, tint = false) => ({ key, name, icon, tint, tile: null, color: null, shell: key === "shell", agent });
const CLAUDE = prog("claude", "Claude Code", "icons/claude.svg", true);
const CODEX = prog("codex", "Codex", "icons/codex.svg", true);
const ZSH = prog("shell", "zsh", "icons/shell.svg", false, true);
const NPM = prog("npm", "npm", "icons/npm.svg");
const NVIM = prog("nvim", "Neovim", "icons/nvim.svg");
export const DEMO_COLORS = { web: "#5b8def", api: "#e3814f", docs: "#3fae6a", infra: "#8b7cf6" };
const NAMES = { web: "storefront", api: "payments-api", docs: "docs", infra: "infra" };

// [pane, terminal, space, tab, program, title, status, branch, agent title or null, message]
const PANES = [
  ["p1", "t1", "web", "checkout", CLAUDE, "", "working", "fix/cart-rounding", "Fix cart total rounding", null],
  ["p2", "t2", "web", "checkout", ZSH, "", null, "fix/cart-rounding", null, null],
  ["p3", "t3", "web", "search", CODEX, "", "working", "perf/suggest", "Speed up search suggestions", null],
  ["p4", "t4", "web", "dev-server", NPM, "npm run dev", null, "main", null, null],
  ["p5", "t5", "api", "refunds", CLAUDE, "", "blocked", "feat/refunds", "Add partial refunds", "Run the migration on staging?"],
  ["p6", "t6", "api", "webhooks", CODEX, "", "working", "feat/webhook-retry", "Retry failed webhooks", null],
  ["p7", "t7", "api", "shell", ZSH, "", null, "main", null, null],
  ["p8", "t8", "docs", "guides", CODEX, "", "done", "docs/quick-start", "Rewrite the quick start", "Draft ready for review"],
  ["p9", "t9", "docs", "api-reference", CLAUDE, "", "idle", "main", "Document the refunds API", null],
  ["p10", "t10", "docs", "preview", NVIM, "nvim README.md", null, "main", null, null],
  ["p11", "t11", "infra", "terraform", CLAUDE, "", "idle", "main", "Plan the Redis upgrade", null],
  ["p12", "t12", "api", "webhooks", ZSH, "", null, "feat/webhook-retry", null, null],
];
// Where you have been, oldest first; the last is where you are.
const VISITS = ["p11", "p9", "p6", "p4", "p8", "p5", "p1"];

export function demoSnapshot() {
  const tabs = {};
  for (const [, , sp, tb] of PANES) {
    tabs[sp] ??= [];
    if (!tabs[sp].some((t) => t.id === `tb-${tb}`)) {
      tabs[sp].push({ id: `tb-${tb}`, index: tabs[sp].length + 1, name: tb, named: true, active: false, status: null, panes: 1, zoomed: false, settled: false, settled_at: null, changed_at: null, working_since: null });
    }
  }
  const spaces = Object.keys(NAMES).map((sp, i) => ({
    id: sp, index: i + 1, name: NAMES[sp], named: true, folder: `${HOME}/code/${NAMES[sp]}`,
    machine: sp === "infra" ? "build-box" : null, branch: PANES.find((p) => p[2] === sp)[7], active: false, status: null, tabs: tabs[sp],
  }));
  const panes = PANES.map(([pane, terminal, sp, tb, program, title, status, branch]) => ({
    pane, terminal, tab: `tb-${tb}`, title, cwd: `${HOME}/code/${NAMES[sp]}`, branch, status,
    app: program.agent ? program.key : null, program, focused: pane === "p1", zoomed: false, movable: true,
  }));
  const agents = PANES.filter((p) => p[8]).map(([pane, terminal, sp, tb, program, , status, , title], i) => ({
    address: terminal, pane, space: sp, space_name: NAMES[sp], tab: `tb-${tb}`, tab_index: 1, tab_name: tb,
    status, app: program.key, program, title, seq: 100 - i, focused: pane === "p1",
  }));
  let history = mru.empty();
  VISITS.forEach((id, i) => {
    const p = PANES.find((x) => x[0] === id);
    history = mru.record(history, { space: p[2], tab: `tb-${p[3]}`, pane: p[0], agent: p[8] ? p[1] : null }, 1000 + i * 1000);
  });
  return {
    spaces, panes, agents,
    terminals: PANES.map((p) => ({ address: p[1], report: p[9] ? { msg: p[9] } : null })),
    focused: { space: "web", tab: "tb-checkout", pane: "p1", terminal: "t1", shown: null, agent: "t1", cwd: `${HOME}/code/storefront` },
    history, home: HOME, worktrees: null,
  };
}

// ── switcher ────────────────────────────────────────────────────────────────

export function switcher() {
  const i = LAYOUTS.findIndex((l) => l.key === layout());
  const arrow = (id, g, fn) => h_flex().id(id).w(24).h(22).items_center().justify_center().rounded_full().cursor_pointer()
    .hover((x) => x.bg("#ffffff26")).on_click((_e, cx) => { fn(); cx.notify(); }).child(g);
  return h_flex().absolute().left(0).right(0).bottom(38).justify_center()
    .child(h_flex().h(28).px(3).gap(6).items_center().rounded_full().bg("#16161a").border_1().border_color("#ff4fa3").shadow_lg()
      .text_size(11.5).text_color("#ffffff")
      .child(arrow("recall-proto-prev", "‹", () => cycleLayout(-1)))
      .child(div().font_semibold().text_color("#ff4fa3").child("PROTOTYPE"))
      .child(div().child(`${LAYOUTS[i].key}  ${LAYOUTS[i].name}`))
      .child(h_flex().id("recall-proto-data").px(6).h(20).items_center().rounded_full().cursor_pointer().bg("#ffffff1a")
        .on_click((_e, cx) => { toggleDemo(); cx.notify(); }).child(demo() ? "demo data" : "your data"))
      .child(div().text_color("#9a9aa6").child("⌥← ⌥→ ⌥↓"))
      .child(arrow("recall-proto-next", "›", () => cycleLayout(1))));
}
