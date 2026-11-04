// Snapshot builders shaped like herdr.d.ts (SpaceInfo, TabInfo, PaneInfo,
// AgentInfo, Program), every documented field present.
import * as mru from "../mods/recall/lib/mru.js";

export const HOME = "/Users/me";

export function program(key, name, agent = false) {
  return { key, name, icon: null, tint: false, tile: null, color: null, shell: key === "shell", agent };
}
export const ZSH = program("shell", "zsh");
export const CLAUDE = program("claude", "Claude Code", true);
export const NVIM = program("nvim", "Neovim");
export const NPM = program("npm", "npm");

export function tab(id, index, { name, named = false, status = null, active = false, panes = 1 } = {}) {
  return {
    id, index, name: name ?? String(index), named, active, status, panes, zoomed: false,
    settled: false, settled_at: null, changed_at: null, working_since: null,
  };
}

export function space(id, index, name, tabs, { folder = `${HOME}/code/${name}`, status = null, active = false, branch = "main", machine = null } = {}) {
  return { id, index, name, named: false, folder, machine, branch, active, status, tabs };
}

export function pane(id, tabId, { terminal = null, title = "", cwd = null, prog = ZSH, status = null, focused = false } = {}) {
  return {
    pane: id, terminal, tab: tabId, title: title || terminal || "", cwd, branch: null, status,
    app: prog?.agent ? prog.key : null, program: prog, focused, zoomed: false, movable: true,
  };
}

export function agent(address, paneId, sp, tb, { title = "", status = "idle", seq = 0, focused = false } = {}) {
  return {
    address, pane: paneId, space: sp.id, space_name: sp.name, tab: tb.id, tab_index: tb.index, tab_name: tb.name,
    status, app: "claude-code", program: CLAUDE, title, seq, focused,
  };
}

/** Two spaces: "web" (a Claude tab, a shell tab) and "api" (an nvim tab). */
export function world() {
  const t1 = tab("tb1", 1);
  const t2 = tab("tb2", 2, { name: "server", named: true });
  const t3 = tab("tb3", 1);
  const web = space("sp1", 1, "web", [t1, t2], { active: true, status: "working" });
  const api = space("sp2", 2, "api", [t3]);
  const panes = [
    pane("p1", "tb1", { terminal: "t1", title: "t1", cwd: `${HOME}/code/web` }),
    pane("p2", "tb2", { terminal: "t2", title: "me@mac:~/code/web", cwd: `${HOME}/code/web`, focused: true }),
    pane("p3", "tb3", { terminal: "t3", title: "nvim", cwd: `${HOME}/code/api`, prog: NVIM }),
  ];
  const agents = [agent("t1", "p1", web, t1, { title: "fix login bug", status: "working", seq: 5 })];
  return {
    spaces: [web, api],
    panes,
    agents,
    terminals: [],
    focused: { space: "sp1", tab: "tb2", pane: "p2", terminal: "t2", shown: null, agent: null, cwd: `${HOME}/code/web` },
    history: mru.empty(),
    home: HOME,
    worktrees: null,
  };
}

/**
 * Four spaces, for All. Herdr lists them, their tabs and their panes in
 * this order:
 *
 *   storefront    checkout    p-cart    agent "fix cart rounding", working, where you are
 *                             p-review  agent "review cart totals", idle
 *                             p-cartsh  a bare zsh
 *                 dev-server  p-dev     npm, titled "npm run dev"
 *   payments-api  refunds     p-ref     nvim, titled "nvim ledger.go"
 *                 webhooks    p-hooks   agent "retry failed calls", blocked
 *   docs          guides      p-guide   agent "rewrite quick start", done
 *                             p-readme  nvim, titled "nvim README.md"
 *   infra         terraform   p-tf      a bare zsh                      (on build-box)
 *                 plan        p-plan    agent "plan redis upgrade", working
 *
 * Focus history, oldest first: dev-server's pane, refunds' pane, then
 * checkout's agent (where you are), so recency differs from Herdr's order.
 * Nothing else was ever focused.
 */
export function town() {
  const checkout = tab("tb-checkout", 1, { name: "checkout", named: true, active: true, status: "working", panes: 3 });
  const dev = tab("tb-dev", 2, { name: "dev-server", named: true });
  const refunds = tab("tb-refunds", 1, { name: "refunds", named: true });
  const hooks = tab("tb-hooks", 2, { name: "webhooks", named: true, status: "blocked" });
  const guides = tab("tb-guides", 1, { name: "guides", named: true, status: "done", panes: 2 });
  const tf = tab("tb-tf", 1, { name: "terraform", named: true });
  const plan = tab("tb-plan", 2, { name: "plan", named: true, status: "working" });
  const web = space("sp-web", 1, "storefront", [checkout, dev], { active: true, status: "working" });
  const api = space("sp-api", 2, "payments-api", [refunds, hooks], { status: "blocked" });
  const docs = space("sp-docs", 3, "docs", [guides], { status: "done" });
  const infra = space("sp-infra", 4, "infra", [tf, plan], { folder: "/srv/infra", machine: "build-box", status: "working" });
  const code = (name) => `${HOME}/code/${name}`;
  const panes = [
    pane("p-cart", "tb-checkout", { terminal: "t-cart", cwd: code("storefront"), prog: CLAUDE, status: "working", focused: true }),
    pane("p-review", "tb-checkout", { terminal: "t-review", cwd: code("storefront"), prog: CLAUDE, status: "idle" }),
    pane("p-cartsh", "tb-checkout", { terminal: "t-cartsh", cwd: code("storefront") }),
    pane("p-dev", "tb-dev", { terminal: "t-dev", title: "npm run dev", cwd: code("storefront"), prog: NPM }),
    pane("p-ref", "tb-refunds", { terminal: "t-ref", title: "nvim ledger.go", cwd: code("payments-api"), prog: NVIM }),
    pane("p-hooks", "tb-hooks", { terminal: "t-hooks", cwd: code("payments-api"), prog: CLAUDE, status: "blocked" }),
    pane("p-guide", "tb-guides", { terminal: "t-guide", cwd: code("docs"), prog: CLAUDE, status: "done" }),
    pane("p-readme", "tb-guides", { terminal: "t-readme", title: "nvim README.md", cwd: code("docs"), prog: NVIM }),
    pane("p-tf", "tb-tf", { terminal: "t-tf", cwd: "/srv/infra" }),
    pane("p-plan", "tb-plan", { terminal: "t-plan", cwd: "/srv/infra", prog: CLAUDE, status: "working" }),
  ];
  const agents = [
    agent("t-cart", "p-cart", web, checkout, { title: "fix cart rounding", status: "working", seq: 9, focused: true }),
    agent("t-review", "p-review", web, checkout, { title: "review cart totals", status: "idle", seq: 3 }),
    agent("t-hooks", "p-hooks", api, hooks, { title: "retry failed calls", status: "blocked", seq: 8 }),
    agent("t-guide", "p-guide", docs, guides, { title: "rewrite quick start", status: "done", seq: 7 }),
    agent("t-plan", "p-plan", infra, plan, { title: "plan redis upgrade", status: "working", seq: 6 }),
  ];
  let history = mru.empty();
  history = mru.record(history, { space: "sp-web", tab: "tb-dev", pane: "p-dev", agent: null }, 1000);
  history = mru.record(history, { space: "sp-api", tab: "tb-refunds", pane: "p-ref", agent: null }, 2000);
  history = mru.record(history, { space: "sp-web", tab: "tb-checkout", pane: "p-cart", agent: "t-cart" }, 3000);
  return {
    spaces: [web, api, docs, infra],
    panes,
    agents,
    terminals: [],
    focused: { space: "sp-web", tab: "tb-checkout", pane: "p-cart", terminal: "t-cart", shown: null, agent: "t-cart", cwd: code("storefront") },
    history,
    home: HOME,
    worktrees: null,
  };
}
