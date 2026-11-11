// The landing page's demo world: a Herdr snapshot shaped like herdr.d.ts
// (the shape tests/fixtures.mjs builds), plus the clue data main.js would
// read from herdr-core, ps and lsof. app.js hands both to Recall's own
// lib/listview.js, so the demo runs the mod's real list rules.
//
//   storefront    checkout      p-cart    agent "Fix cart rounding", working, where you are
//                               p-test    a bare zsh that printed a failing test
//                 dev-server    p-dev     npm run dev, listening on 5173
//   payments-api  refunds       p-refund  agent "Add partial refunds", blocked
//                               p-ledger  nvim ledger.go
//                 webhooks      p-hooks   agent "Retry failed webhooks", working
//   infra         terraform     p-plan    agent "Plan the Redis upgrade", idle
//                 prod          p-prod    ssh deploy@prod-db-1
//   docs          api-reference p-docs    agent "Document the refunds API", done
//
// Three agents' titles lead with a status mark, as Herdr's agents do; Recall
// shows them without it.
//
// Focus history, oldest first: docs' agent, webhooks' agent, the Redis plan,
// then the cart agent (where you are). "Add partial refunds" was never
// focused, so it follows the visited rows, first among the rest as blocked.

import * as mru from "./lib/mru.js";

export const HOME = "/Users/you";
const code = (name) => `${HOME}/code/${name}`;

function program(key, name, agent = false) {
  return { key, name, icon: null, tint: false, tile: null, color: null, shell: key === "shell", agent };
}
const ZSH = program("shell", "zsh");
const CLAUDE = program("claude", "Claude Code", true);
const CODEX = program("codex", "Codex", true);
const NVIM = program("nvim", "Neovim");
const NPM = program("npm", "npm");
const SSH = program("ssh", "ssh");

function tab(id, index, name, { status = null, active = false, panes = 1 } = {}) {
  return {
    id, index, name, named: true, active, status, panes, zoomed: false,
    settled: false, settled_at: null, changed_at: null, working_since: null,
  };
}

function space(id, index, name, tabs, { status = null, active = false, branch = "main" } = {}) {
  return { id, index, name, named: false, folder: code(name), machine: null, branch, active, status, tabs };
}

function pane(id, tabId, terminal, { title = "", cwd, prog = ZSH, status = null, focused = false, branch = "main" }) {
  return {
    pane: id, terminal, tab: tabId, title: title || terminal, cwd, branch, status,
    app: prog.agent ? prog.key : null, program: prog, focused, zoomed: false, movable: true,
  };
}

function agent(address, paneId, sp, tb, title, status, seq, prog = CLAUDE) {
  return {
    address, pane: paneId, space: sp.id, space_name: sp.name, tab: tb.id, tab_index: tb.index, tab_name: tb.name,
    status, app: prog.key, program: prog, title, seq, focused: false,
  };
}

/** Each space's badge color, as Herdr's `space.colors` would keep it. */
export const SPACE_COLORS = {
  "sp-store": "#4a8ee8",
  "sp-pay": "#e8834a",
  "sp-infra": "#8b6cf0",
  "sp-docs": "#3fae5f",
};

/** A fresh demo world: `{ snap, clueData }`. */
export function createWorld() {
  const checkout = tab("tb-checkout", 1, "checkout", { status: "working", active: true, panes: 2 });
  const dev = tab("tb-dev", 2, "dev-server");
  const refunds = tab("tb-refunds", 1, "refunds", { status: "blocked", active: true, panes: 2 });
  const hooks = tab("tb-hooks", 2, "webhooks", { status: "working" });
  const tf = tab("tb-tf", 1, "terraform", { status: "idle", active: true });
  const prod = tab("tb-prod", 2, "prod");
  const api = tab("tb-api", 1, "api-reference", { status: "done", active: true });

  const store = space("sp-store", 1, "storefront", [checkout, dev], { status: "working", active: true });
  const pay = space("sp-pay", 2, "payments-api", [refunds, hooks], { status: "blocked" });
  const infra = space("sp-infra", 3, "infra", [tf, prod], { status: "idle" });
  const docs = space("sp-docs", 4, "docs", [api], { status: "done" });

  const panes = [
    pane("p-cart", "tb-checkout", "t-cart", { cwd: code("storefront"), prog: CLAUDE, status: "working", focused: true, branch: "fix/cart-rounding" }),
    pane("p-test", "tb-checkout", "t-test", { cwd: code("storefront"), branch: "fix/cart-rounding" }),
    pane("p-dev", "tb-dev", "t-dev", { title: "npm run dev", cwd: code("storefront"), prog: NPM, focused: true }),
    pane("p-refund", "tb-refunds", "t-refund", { cwd: code("payments-api"), prog: CLAUDE, status: "blocked", focused: true, branch: "feat/refunds" }),
    pane("p-ledger", "tb-refunds", "t-ledger", { title: "nvim ledger.go", cwd: code("payments-api"), prog: NVIM, branch: "feat/refunds" }),
    pane("p-hooks", "tb-hooks", "t-hooks", { cwd: code("payments-api"), prog: CODEX, status: "working", focused: true, branch: "feat/webhook-retry" }),
    pane("p-plan", "tb-tf", "t-plan", { cwd: code("infra"), prog: CLAUDE, status: "idle", focused: true }),
    pane("p-prod", "tb-prod", "t-prod", { title: "ssh deploy@prod-db-1", cwd: code("infra"), prog: SSH, focused: true }),
    pane("p-docs", "tb-api", "t-docs", { cwd: code("docs"), prog: CLAUDE, status: "done", focused: true }),
  ];

  const agents = [
    agent("t-cart", "p-cart", store, checkout, "⠐ Fix cart rounding", "working", 9),
    agent("t-refund", "p-refund", pay, refunds, "Add partial refunds", "blocked", 8),
    agent("t-hooks", "p-hooks", pay, hooks, "⠐ Retry failed webhooks", "working", 7, CODEX),
    agent("t-plan", "p-plan", infra, tf, "✳ Plan the Redis upgrade", "idle", 4),
    agent("t-docs", "p-docs", docs, api, "Document the refunds API", "done", 6),
  ];
  agents[0].focused = true;

  let history = mru.empty();
  history = mru.record(history, { space: "sp-docs", tab: "tb-api", pane: "p-docs", agent: "t-docs" }, 1000);
  history = mru.record(history, { space: "sp-pay", tab: "tb-hooks", pane: "p-hooks", agent: "t-hooks" }, 2000);
  history = mru.record(history, { space: "sp-infra", tab: "tb-tf", pane: "p-plan", agent: "t-plan" }, 3000);
  history = mru.record(history, { space: "sp-store", tab: "tb-checkout", pane: "p-cart", agent: "t-cart" }, 4000);

  const snap = {
    spaces: [store, pay, infra, docs],
    panes,
    agents,
    terminals: [{ address: "t-refund", report: { msg: "Run the migration on staging first?" } }],
    focused: { space: "sp-store", tab: "tb-checkout", pane: "p-cart", terminal: "t-cart", shown: null, agent: "t-cart", cwd: code("storefront") },
    history,
    home: HOME,
    worktrees: null,
  };

  const state = (cwd, command, shellPid, ssh = null) => ({ cwd, command, ssh, shellPid });
  const paneState = new Map([
    ["p-cart", state(code("storefront"), "claude", 4200)],
    ["p-test", state(code("storefront"), "-zsh", 4300)],
    ["p-dev", state(code("storefront"), "npm run dev", 4100)],
    ["p-refund", state(code("payments-api"), "claude", 5200)],
    ["p-ledger", state(code("payments-api"), "nvim ledger.go", 5300)],
    ["p-hooks", state(code("payments-api"), "codex", 5400)],
    ["p-plan", state(code("infra"), "claude", 6100)],
    ["p-prod", state(code("infra"), "ssh deploy@prod-db-1", 6200, "deploy@prod-db-1")],
    ["p-docs", state(code("docs"), "claude", 7100)],
  ]);

  const content = new Map([
    ["p-test", [
      "❯ npm test",
      " FAIL  src/cart.test.ts",
      "  ● cart › rounds half-cents up",
      "    Expected: 10.01",
      "    Received: 10",
      "Tests: 1 failed, 23 passed, 24 total",
      "❯",
    ].join("\n")],
    ["p-dev", [
      "> storefront@2.4.0 dev",
      "> vite",
      "  VITE v7.1.2  ready in 412 ms",
      "  ➜  Local:   http://localhost:5173/",
    ].join("\n")],
    ["p-ledger", [
      "package ledger",
      "// Refund reverses part of a charge.",
      "func Refund(c Charge, amount Cents) (Entry, error) {",
      "\tif amount > c.Remaining() {",
      "\t\treturn Entry{}, ErrOverRefund",
      "\t}",
    ].join("\n")],
    ["p-prod", [
      "deploy@prod-db-1:~$ redis-cli info memory | grep used_memory_human",
      "used_memory_human:1.92G",
      "deploy@prod-db-1:~$",
    ].join("\n")],
    ["p-refund", [
      "Added PartialRefund to the ledger and a migration for refund_lines.",
      "Run the migration on staging first?",
    ].join("\n")],
  ]);

  const procs = new Map([
    [4100, { ppid: 1, command: "-zsh" }],
    [4101, { ppid: 4100, command: "npm run dev" }],
    [4102, { ppid: 4101, command: "node /Users/you/code/storefront/node_modules/.bin/vite" }],
    [6200, { ppid: 1, command: "-zsh" }],
    [6201, { ppid: 6200, command: "ssh deploy@prod-db-1" }],
    [880, { ppid: 1, command: "postgres -D /opt/homebrew/var/postgresql@17" }],
  ]);
  const listeners = [
    { port: 5173, pid: 4102, addr: "127.0.0.1:5173" },
    { port: 5432, pid: 880, addr: "127.0.0.1:5432" },
  ];

  return { snap, clueData: { paneState, content, procs, listeners } };
}

/** Where a row takes you: the pane to focus, by the row's kind. */
export function targetPane(snap, item) {
  const inTab = (tabId) => {
    const ps = snap.panes.filter((p) => p.tab === tabId);
    return ps.find((p) => p.focused) ?? ps[0];
  };
  switch (item.kind) {
    case "agent": return snap.panes.find((p) => p.terminal === item.id);
    case "pane":
    case "clue": return snap.panes.find((p) => p.pane === item.id);
    case "tab": return inTab(item.id);
    case "space": {
      const s = snap.spaces.find((x) => x.id === item.id);
      const t = s?.tabs.find((x) => x.active) ?? s?.tabs[0];
      return t ? inTab(t.id) : null;
    }
    default: return null;
  }
}

/**
 * Focuses a pane the way Herdr would, and records it as Recall's tracker
 * does. Returns the new snapshot; the old one is left as it was.
 */
export function focusPane(snap, paneId, now) {
  const p = snap.panes.find((x) => x.pane === paneId);
  if (!p) return snap;
  const sp = snap.spaces.find((s) => s.tabs.some((t) => t.id === p.tab));
  const ag = snap.agents.find((a) => a.address === p.terminal) ?? null;
  const spaces = snap.spaces.map((s) => ({
    ...s,
    active: s.id === sp.id,
    tabs: s.id === sp.id ? s.tabs.map((t) => ({ ...t, active: t.id === p.tab })) : s.tabs,
  }));
  const panes = snap.panes.map((x) => (x.tab === p.tab ? { ...x, focused: x.pane === paneId } : x));
  const agents = snap.agents.map((a) => ({ ...a, focused: a.address === ag?.address }));
  const focus = { space: sp.id, tab: p.tab, pane: paneId, agent: ag?.address ?? null };
  return {
    ...snap,
    spaces,
    panes,
    agents,
    focused: { space: sp.id, tab: p.tab, pane: paneId, terminal: p.terminal, shown: null, agent: ag?.address ?? null, cwd: p.cwd },
    history: mru.record(snap.history, focus, now),
  };
}
