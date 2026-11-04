// Builds the navigator's rows from a snapshot of Herdr's live data.
//
// A snapshot is plain data, so this module runs (and is tested) without the
// app: { spaces, panes, agents, focused, history, home, worktrees }.
// Every row is an item:
//   { kind, key, id, title, detail, where, path, branch, program, status,
//     current, at, fields: [{ key, text }], actions: [[command, args]] }
// `fields` is what search matches; `actions` run in order when the row is
// opened.

import * as mru from "./mru.js";

export const STATUS_RANK = { blocked: 0, done: 1, working: 2, idle: 3 };

/** `/Users/me/x` as `~/x` when it is under home. */
export function tildify(path, home) {
  if (!path) return "";
  if (home && (path === home || path.startsWith(home + "/"))) return "~" + path.slice(home.length);
  return path;
}

function lastSegment(path) {
  if (!path) return "";
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

/** Indexes the snapshot's spaces and tabs by id. */
export function index(snap) {
  const space = new Map();
  const tab = new Map();
  for (const s of snap.spaces) {
    space.set(s.id, s);
    for (const t of s.tabs) tab.set(t.id, { tab: t, space: s });
  }
  const panesOf = new Map();
  const described = new Map();
  for (const p of snap.panes) {
    const d = describePane(p, snap);
    described.set(p.pane, d);
    if (!panesOf.has(p.tab)) panesOf.set(p.tab, []);
    panesOf.get(p.tab).push(d);
  }
  return { space, tab, panesOf, described };
}

/**
 * What a pane shows, filled in from what Herdr knows elsewhere. A pane in a
 * tab the window hasn't drawn yet only has its terminal's address as title
 * and its shell as program; the agents list and herdr-core know better.
 */
export function describePane(p, snap) {
  const agent = p.terminal ? snap.agents.find((a) => a.address === p.terminal) : null;
  const core = p.terminal ? snap.terminals?.find((x) => x.address === p.terminal) : null;
  const cwd = p.cwd ?? core?.cwd ?? null;
  const bare = !p.title || p.title === p.terminal;
  const title = agent?.title || (bare ? "" : p.title);
  const program = agent?.program ?? p.program ?? null;
  return {
    pane: p,
    agent,
    title: title || (p.terminal ? lastSegment(cwd) || program?.name : p.mod) || p.title || "",
    program,
    cwd,
    branch: p.branch ?? null,
    status: agent?.status ?? p.status ?? null,
  };
}

/**
 * What a tab is about: its agent's pane, else its focused pane, else its
 * first. Herdr calls an unnamed tab by its number, which says nothing.
 */
export function leadPane(described) {
  if (!described?.length) return null;
  return described.find((d) => d.agent || d.program?.agent) ?? described.find((d) => d.pane.focused) ?? described[0];
}

function paneLabel(d) {
  return d?.title || d?.program?.name || "";
}

/** A tab's display name: its own name when named, else what it runs. */
export function tabLabel(tab, described) {
  if (tab.named) return tab.name;
  return paneLabel(leadPane(described)) || `Tab ${tab.index}`;
}

function spaceLabel(space, worktrees) {
  const wt = worktrees?.get(space.id);
  if (wt?.linked) return `${wt.repo} ⎇ ${wt.branch ?? lastSegment(space.folder)}`;
  return space.name;
}

function spaceItems(snap, ix) {
  const items = snap.spaces.map((s) => {
    const title = spaceLabel(s, snap.worktrees);
    const agentsHere = snap.agents.filter((a) => a.space === s.id).length;
    const path = tildify(s.folder, snap.home);
    return {
      kind: "space",
      key: `space:${s.id}`,
      id: s.id,
      title,
      detail: [`${s.tabs.length} tab${s.tabs.length === 1 ? "" : "s"}`, agentsHere ? `${agentsHere} agent${agentsHere === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · "),
      where: s.machine ? `on ${s.machine}` : "",
      spaceId: s.id,
      spaceName: title,
      tabName: null,
      tabs: s.tabs.map((t) => ({ title: tabLabel(t, ix.panesOf.get(t.id)), status: t.status, active: t.active })),
      path,
      branch: s.branch,
      program: null,
      status: s.status,
      current: snap.focused?.space === s.id,
      at: mru.lastFocused(snap.history, "space", s.id),
      fields: [
        { key: "title", text: title },
        { key: "path", text: path },
        { key: "branch", text: s.branch ?? "" },
      ],
      actions: [["space.select", { id: s.id }]],
    };
  });
  return groupWorktrees(mru.order(snap.history, "space", items, (i) => i.id), snap.worktrees);
}

/**
 * Puts each linked worktree's space right under its main checkout's space,
 * keeping the main space where recency put it.
 */
export function groupWorktrees(items, worktrees) {
  if (!worktrees?.size) return items;
  const mainOf = (it) => {
    const wt = worktrees.get(it.id);
    return wt?.linked ? wt.main : null;
  };
  const present = new Set(items.map((i) => i.id));
  const children = new Map();
  for (const it of items) {
    const main = mainOf(it);
    if (main && present.has(main)) {
      if (!children.has(main)) children.set(main, []);
      children.get(main).push(it);
    }
  }
  const out = [];
  for (const it of items) {
    const main = mainOf(it);
    if (main && present.has(main)) continue;
    out.push(it);
    for (const child of children.get(it.id) ?? []) out.push({ ...child, nested: true });
  }
  return out;
}

function tabItems(snap, ix) {
  const items = [];
  for (const s of snap.spaces) {
    for (const t of s.tabs) {
      const ps = ix.panesOf.get(t.id) ?? [];
      const lead = leadPane(ps);
      const title = tabLabel(t, ps);
      const runs = [...new Set(ps.map((d) => d.program?.name).filter(Boolean))].join(" · ");
      items.push({
        kind: "tab",
        key: `tab:${t.id}`,
        id: t.id,
        title,
        detail: t.named ? paneLabel(lead) : runs,
        where: spaceLabel(s, snap.worktrees),
        spaceId: s.id,
        spaceName: spaceLabel(s, snap.worktrees),
        tabName: null,
        terminal: lead?.pane.terminal ?? null,
        panes: ps.map((d) => ({ title: paneLabel(d), program: d.program, status: d.status })),
        path: tildify(lead?.cwd, snap.home),
        branch: lead?.branch ?? null,
        program: lead?.program ?? null,
        status: t.status,
        current: snap.focused?.tab === t.id,
        at: mru.lastFocused(snap.history, "tab", t.id),
        settled: t.settled,
        fields: [
          { key: "title", text: title },
          { key: "detail", text: t.named ? paneLabel(lead) : runs },
          { key: "where", text: spaceLabel(s, snap.worktrees) },
          { key: "panes", text: ps.map(paneLabel).join(" ") },
        ],
        actions: [["tab.select", { id: t.id }]],
      });
    }
  }
  return mru.order(snap.history, "tab", items, (i) => i.id);
}

function paneItems(snap, ix) {
  const items = [];
  for (const p of snap.panes) {
    const at = ix.tab.get(p.tab);
    if (!at) continue;
    const d = ix.described.get(p.pane);
    const tLabel = tabLabel(at.tab, ix.panesOf.get(p.tab));
    const sLabel = spaceLabel(at.space, snap.worktrees);
    const title = paneLabel(d);
    const where = `${sLabel} › ${tLabel}`;
    const path = tildify(d.cwd, snap.home);
    items.push({
      kind: "pane",
      key: `pane:${p.pane}`,
      id: p.pane,
      title,
      detail: d.program?.name && d.program.name !== title ? d.program.name : "",
      where,
      spaceId: at.space.id,
      spaceName: sLabel,
      tabName: tLabel,
      path,
      branch: d.branch,
      program: d.program,
      status: d.status,
      current: snap.focused?.pane === p.pane,
      at: mru.lastFocused(snap.history, "pane", p.pane),
      terminal: p.terminal,
      fields: [
        { key: "title", text: title },
        { key: "where", text: where },
        { key: "path", text: path },
        { key: "detail", text: d.program?.name ?? "" },
      ],
      actions: [["tab.select", { id: p.tab }], ["pane.focus", { pane: p.pane }]],
    });
  }
  return mru.order(snap.history, "pane", items, (i) => i.id);
}

/**
 * Agents in one of three orders: "mru" (most recently focused first),
 * "priority" (blocked, done, working, idle; latest change first within
 * each) or "grouped" (space, tab, pane order, as Herdr lists them).
 */
function agentItems(snap, ix, sort) {
  const items = snap.agents.map((a, i) => {
    const at = ix.tab.get(a.tab);
    const sLabel = at ? spaceLabel(at.space, snap.worktrees) : a.space_name;
    const tLabel = at ? tabLabel(at.tab, ix.panesOf.get(a.tab)) : a.tab_name;
    const title = a.title || a.program?.name || a.address;
    const where = `${sLabel} › ${tLabel}`;
    const pane = ix.described.get(a.pane);
    const path = tildify(pane?.cwd, snap.home);
    return {
      kind: "agent",
      key: `agent:${a.address}`,
      id: a.address,
      title,
      detail: a.program?.name && a.program.name !== title ? a.program.name : "",
      where,
      spaceId: a.space,
      spaceName: sLabel,
      tabName: tLabel,
      terminal: a.address,
      message: snap.terminals?.find((x) => x.address === a.address)?.report?.msg ?? null,
      path,
      branch: pane?.branch ?? null,
      program: a.program ?? null,
      status: a.status,
      current: a.focused,
      at: mru.lastFocused(snap.history, "agent", a.address),
      seq: a.seq,
      model: i,
      fields: [
        { key: "title", text: title },
        { key: "where", text: where },
        { key: "detail", text: a.program?.name ?? "" },
        { key: "path", text: path },
      ],
      actions: [["agent.focus", { terminal: a.address }]],
    };
  });
  if (sort === "priority") {
    return [...items].sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || b.seq - a.seq || a.model - b.model);
  }
  if (sort === "grouped") return items;
  return mru.order(snap.history, "agent", items, (i) => i.id);
}

/** The rows of one category. `options.agentSort`: "mru" | "priority" | "grouped". */
export function buildItems(category, snap, options = {}) {
  const ix = index(snap);
  switch (category) {
    case "spaces": return spaceItems(snap, ix);
    case "tabs": return tabItems(snap, ix);
    case "panes": return paneItems(snap, ix);
    case "agents": return agentItems(snap, ix, options.agentSort ?? "mru");
    default: return [];
  }
}
