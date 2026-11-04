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

export function tab(id, index, { name, named = false, status = null, active = false } = {}) {
  return {
    id, index, name: name ?? String(index), named, active, status, panes: 1, zoomed: false,
    settled: false, settled_at: null, changed_at: null, working_since: null,
  };
}

export function space(id, index, name, tabs, { folder = `${HOME}/code/${name}`, status = null, active = false, branch = "main" } = {}) {
  return { id, index, name, named: false, folder, machine: null, branch, active, status, tabs };
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
