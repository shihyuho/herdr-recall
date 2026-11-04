// The navigator's look ("Columns" layout): a header with the category
// title and the search box, then an icon rail of the categories beside a
// table of the rows: name, location, folder, branch and status. Dragging the edge left of a head resizes that
// column (a double-click on it puts it back). A one-line footer under them
// names the keys.
//
// navigator(nav, ctx) draws the dialog from the navigator's state and
// changes nothing but through nav's own methods:
//   reads  nav.{category, tabs, rows, at, scroll, input, mode, query,
//               agentSort, widths, resizing, keys, configError}
//   calls  nav.{switchTo, focusForMode, open,
//               startResize, resizeTo, endResize}
//   ctx  = { view, loading }  (view: what lib/listview.js's listView returned)

import { div, svg, image } from "gpui-kit";
import { v_flex, h_flex, Input, v_virtual_list } from "gpui-base";
import { theme, shared } from "herdr";
import { segments } from "./lib/fuzzy.js";
import { location } from "./lib/columns.js";

const CATEGORY = {
  spaces: { label: "Spaces", title: "Recent Spaces" },
  tabs: { label: "Tabs", title: "Recent Tabs" },
  panes: { label: "Panes", title: "Recent Panes" },
  agents: { label: "Agents", title: "Agents" },
  all: { label: "All", title: "Find Anywhere" },
};
const SORT_LABEL = { mru: "Recent", priority: "Priority", grouped: "Grouped" };
const SOURCE_COLOR = { ssh: "ansi6", cmd: "ansi3", file: "ansi5", term: "ansi4", cwd: "ansi2", port: "ansi6", pid: "ansi5" };
const CHIP_COLOR = { ".": "accent", ws: "ansi3", tab: "ansi1", pane: "ansi4", port: "ansi6", pid: "ansi5" };
const KIND_ICON = { space: "spaces", tab: "tabs", pane: "panes", agent: "agents", other: "panes", hint: "all" };
const PREFIXES = "cmd ssh cwd file term port pid ws tab pane";
const SPINNER = "mods/workspace-chrome/spinner.svg";
const ROW = 30;

// ── atoms ─────────────────────────────────────────────────────────────────

// Space colors as Herdr's own mods keep them (shared "space.colors"), so a
// space's badge here matches its badge in the sidebar and in Go to.
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };
const PROJECT_COLORS = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
function spaceColor(t, id, name) {
  if (name === "~") return t.dim;
  const c = (shared("space.colors") ?? {})[id] ?? PROJECT_COLORS[0];
  return c.startsWith("#") ? c : (MARK[c] ?? t[c]);
}

/** The space's first letter on its color; an empty box keeps the column when there's no space. */
function badge(t, item, size) {
  if (!item.spaceId) return div().size(size).flex_none();
  const letter = [...(item.spaceName ?? "?")][0]?.toUpperCase() ?? "?";
  return h_flex().size(size).flex_none().rounded(Math.round(size * 0.28)).bg(spaceColor(t, item.spaceId, item.spaceName))
    .items_center().justify_center().text_size(size * 0.58).font_bold().text_color("#ffffff").child(letter);
}

function glyph(t, status, size) {
  if (status === "working") return svg(SPINNER).size(size).flex_none().text_color(t.working).spin(900);
  const g = status === "blocked" || status === "done" ? "●" : status === "idle" ? "○" : "";
  return div().w(size).flex_none().text_size(size - 1).text_color(t[status] ?? t.dim).child(g);
}

function statusWord(t, status) {
  if (status === "blocked") return div().flex_none().text_size(11.5).text_color(t.blocked).child("needs you");
  if (status === "done") return div().flex_none().text_size(11.5).text_color(t.done).child("finished");
  return null;
}

function icon(t, item, size) {
  const p = item.program;
  if (p?.icon) return p.tint ? svg(p.icon).size(size).flex_none().text_color(t.muted) : image(p.icon).size(size).flex_none();
  return svg(`mods/recall/icons/${KIND_ICON[item.kind] ?? "panes"}.svg`).size(size).flex_none().text_color(t.dim);
}

/** Text with the matched characters (`idx`) drawn in `hitColor`. */
function highlighted(s, idx, color, hitColor) {
  if (!idx?.length) return div().flex_none().text_color(color).child(s ?? "");
  return h_flex().flex_none().children(segments(s, idx).map((seg) =>
    div().text_color(seg.hit ? hitColor : color).when(seg.hit, (d) => d.font_semibold()).child(seg.text)));
}

/** A buffer match is drawn as its excerpt; highlight the whole excerpt. */
function titleHits(item, hits) {
  if (!item.excerpt) return hits.title;
  return Array.from({ length: item.excerpt[1] - item.excerpt[0] }, (_, i) => item.excerpt[0] + i);
}

const KEY_GLYPH = { enter: "⏎", escape: "esc", tab: "⇥", up: "↑", down: "↓", left: "←", right: "→", backspace: "⌫", space: "␣" };
const MOD_GLYPH = { ctrl: "⌃", alt: "⌥", shift: "⇧", cmd: "⌘" };
/** "shift-tab" → "⇧⇥". */
export function keyLabel(keystroke) {
  if (!keystroke) return "";
  const parts = keystroke.split("-");
  const key = parts.pop();
  return parts.map((m) => MOD_GLYPH[m] ?? m).join("") + (KEY_GLYPH[key] ?? (key.length === 1 ? key.toUpperCase() : key));
}

// ── header ────────────────────────────────────────────────────────────────

function filterChip(t, label) {
  return div().px(6).h(18).flex_none().flex().items_center().rounded(4).text_size(11).font_semibold()
    .bg(t[CHIP_COLOR[label] ?? SOURCE_COLOR[label] ?? "accent"] ?? t.accent).text_color(t.background)
    .child(label === "." ? "content" : label);
}

function sortToggle(t, nav) {
  return h_flex().flex_none().gap(2).p(2).rounded(7).bg(t.raised).children(["mru", "priority", "grouped"].map((s) =>
    div().id(`recall-sort-${s}`).px(8).h(20).flex().items_center().rounded(5).text_size(11.5).cursor_pointer()
      .when(nav.agentSort === s, (el) => el.bg(t.selected).text_color(t.foreground))
      .when(nav.agentSort !== s, (el) => el.text_color(t.dim).hover((x) => x.text_color(t.foreground)))
      .on_click((_e, cx) => { nav.switchTo(nav.category, s); cx.notify(); })
      .child(SORT_LABEL[s])));
}

function header(t, nav, view) {
  const label = view.label;
  const count = nav.query.trim() && view.total !== null ? `${nav.rows.length}/${view.total}` : String(nav.rows.length);
  const search = h_flex().flex_1().h(30).px(10).gap(8).items_center().rounded(8).border_1()
    .border_color(nav.mode === "navigation" ? t.border : t.accent).bg(t.background)
    .children([
      svg("mods/recall/icons/search.svg").size(14).text_color(t.dim),
      label ? filterChip(t, label) : null,
      Input.new(nav.input).flex_1().h_full().text_size(12.8).text_color(nav.mode === "navigation" ? t.muted : t.foreground),
      nav.mode === "navigation" && !nav.query ? div().flex_none().text_size(11).text_color(t.dim).child("/ to filter") : null,
      div().flex_none().text_size(11).text_color(t.dim).child(count),
    ].filter(Boolean));
  return h_flex().h(48).flex_none().px(12).gap(12).items_center().border_b(1).border_color(t.border)
    .children([
      div().w(150).flex_none().text_size(14).font_semibold().truncate().child(CATEGORY[nav.category].title),
      search,
      nav.category === "agents" ? sortToggle(t, nav) : null,
      div().flex_none().text_size(11).text_color(t.dim).child("Esc"),
    ].filter(Boolean));
}

// ── rail and table ─────────────────────────────────────────────────────────

function rail(t, nav) {
  const entry = (c) => {
    const on = c === nav.category;
    return v_flex().id(`recall-cat-${c}`).w(48).h(46).gap(2).items_center().justify_center().rounded(8).cursor_pointer()
      .when(on, (el) => el.bg(t.selected))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
      .on_click((_e, cx) => { nav.switchTo(c); nav.focusForMode(); cx.notify(); })
      .child(svg(`mods/recall/icons/${c}.svg`).size(16).text_color(on ? t.accent : t.muted))
      .child(div().text_size(9.5).text_color(on ? t.foreground : t.dim).child(CATEGORY[c].label));
  };
  return v_flex().w(60).h_full().flex_none().py(6).gap(2).items_center().border_r(1).border_color(t.border)
    .children(nav.tabs.map(entry));
}

// The columns, by the key the widths are stored under. Every one
// but the name has a width of its own (nav.widths); the name takes the rest.
const COLUMNS = [
  { key: "name", label: () => "NAME" },
  { key: "location", label: (nav) => (nav.category === "spaces" ? "CONTENTS" : "LOCATION") },
  { key: "folder", label: () => "FOLDER" },
  { key: "branch", label: () => "BRANCH" },
  { key: "status", right: true, label: () => "STATUS" },
];

/** The grip on a column's left edge, over the gap before it. */
function edge(t, nav, column) {
  const on = nav.resizing?.column === column;
  return h_flex().id(`recall-edge-${column}`).absolute().top(0).bottom(0).left(-8).w(8).justify_center().cursor_col_resize()
    .hover((x) => x.bg(t.hover))
    .on_mouse_down("left", (e, cx) => { nav.startResize(column, e); cx.stop_propagation(); cx.notify(); })
    .child(div().w(1).h_full().bg(on ? t.accent : t.border));
}

function columnHead(t, nav) {
  const head = (c) => {
    const label = h_flex().id(`recall-col-${c.key}`).size_full().min_w(0).items_center()
      .when(Boolean(c.right), (el) => el.justify_end())
      .text_color(t.dim)
      .child(div().truncate().child(c.label(nav)));
    if (c.key === "name") return h_flex().flex_1().min_w(0).h_full().child(label);
    return h_flex().w(nav.widths[c.key]).flex_none().h_full().relative().child(label).child(edge(t, nav, c.key));
  };
  return h_flex().h(26).flex_none().mx(4).px(8).gap(8).items_center()
    .text_size(10.5).font_semibold().border_b(1).border_color(t.border)
    .child(div().w(10).flex_none())
    .child(div().w(30).flex_none())
    .children(COLUMNS.map(head))
    .child(div().w(16).flex_none());
}

function row(t, nav, { item, hits }, on) {
  const w = nav.widths;
  const other = item.kind === "other" || item.kind === "hint";
  const cell = (w, text, color) => div().w(w).flex_none().truncate().text_size(12).text_color(color).child(text || "");
  return h_flex().h(ROW).mx(4).px(8).gap(8).items_center().rounded(6)
    .when(on, (el) => el.bg(t.selection))
    .child(glyph(t, item.status, 10))
    .child(other
      ? div().w(30).flex_none().text_size(11).font_semibold().text_color(item.kind === "hint" ? t.dim : t[SOURCE_COLOR[item.source]] ?? t.dim).child(item.source)
      : h_flex().w(30).flex_none().child(icon(t, item, 14)))
    .child(h_flex().flex_1().min_w(0).gap(8).items_center().overflow_hidden()
      .when(Boolean(item.nested), (el) => el.pl(18))
      .child(highlighted(item.title, titleHits(item, hits), item.kind === "hint" ? t.dim : t.foreground, t.accent)
        .when(Boolean(item.current), (d) => d.font_semibold()))
      .when(item.kind === "hint", (el) => el.child(div().flex_none().text_color(t.blocked).child(`(${item.reason})`)))
      .when(Boolean(item.message), (el) => el.child(div().min_w(0).truncate().text_size(12).text_color(t.dim).child(item.message))))
    .child(cell(w.location, location(item), t.muted))
    .child(cell(w.folder, item.path, t.dim))
    .child(cell(w.branch, item.branch, t.dim))
    .child(h_flex().w(w.status).flex_none().justify_end().child(statusWord(t, item.status) ?? div()))
    .child(badge(t, item, 16));
}

function list(t, nav, loading) {
  const rows = nav.rows;
  if (!rows.length) {
    const msg = loading ? "Reading panes…" : nav.query ? "Nothing matches" : "Nothing here yet";
    return v_flex().size_full().items_center().justify_center().text_color(t.dim).child(msg);
  }
  // A virtual list, not uniform_list: only it takes the scroll handle that
  // keeps the selected row in view (uniform_list ignores track_scroll).
  return v_virtual_list("recall-rows", rows.length, ROW, (i) => rows[i].item.key, (range) => {
    const out = [];
    for (let i = range.start; i < range.end; i++) out.push(row(t, nav, rows[i], i === nav.at));
    return out;
  })
    .track_scroll(nav.scroll)
    .on_item_click((key) => {
      const r = rows.find((x) => x.item.key === key);
      if (r) nav.open(r.item);
    })
    .size_full();
}

// ── footer ────────────────────────────────────────────────────────────────

/** The keys worth knowing in this mode: [keys, what they do], the last one drawn at the right. */
function hints(nav) {
  const first = (a) => keyLabel(nav.keys[a]?.[0]);
  const move = `${first("move_up")}${first("move_down")}`;
  const close = [first("dismiss"), nav.query ? "clear" : "close"];
  let out;
  if (nav.mode === "navigation") out = [[first("select"), "open"], [move, "move"], ["/", "filter"], [first("next_category"), "category"], close];
  else if (nav.mode === "filtering") out = [[first("select"), "open"], [move, "move"], [first("dismiss"), "done"], [first("force_quit"), "close"]];
  else out = [[first("select"), "open"], [move, "move"], [first("next_category"), "category"], close];
  const extra = nav.category === "agents" ? [["⌃S", "sort"]] : nav.category === "all" ? [[".", "buffers"], [PREFIXES, "prefixes"]] : [];
  return [...out.slice(0, -1), ...extra, out[out.length - 1]];
}

function footer(t, nav) {
  const chip = ([keys, label]) => h_flex().flex_none().gap(5).items_center()
    .child(div().px(5).rounded(4).bg(t.raised).text_color(t.muted).child(keys))
    .child(div().text_color(t.dim).child(label));
  const all = hints(nav);
  const tail = all.pop();
  return h_flex().h(28).flex_none().px(14).gap(14).items_center().border_t(1).border_color(t.border).bg(t.chrome)
    .text_size(11).overflow_hidden()
    .children([
      nav.configError ? div().flex_none().max_w(320).truncate().text_color(t.blocked).child(nav.configError) : null,
      ...all.map(chip),
      div().flex_1(),
      chip(tail),
    ].filter(Boolean));
}

// ── the dialog ────────────────────────────────────────────────────────────

export function navigator(nav, { view, loading }) {
  const t = theme();
  return v_flex().id("recall-table").size_full()
    // A resize follows the pointer anywhere over the dialog, and ends on release or on leaving it.
    .when(Boolean(nav.resizing), (el) => el.cursor_col_resize())
    .on_mouse_move((e, cx) => { if (nav.resizeTo(e.position.x)) cx.notify(); })
    .on_mouse_up("left", (_e, cx) => { if (nav.endResize()) cx.notify(); })
    .on_hover((hovered, cx) => { if (!hovered && nav.endResize()) cx.notify(); })
    .child(header(t, nav, view))
    .child(h_flex().flex_1().min_h(0).items_start()
      .child(rail(t, nav))
      .child(v_flex().flex_1().min_w(0).h_full().py(4)
        .child(columnHead(t, nav))
        .child(div().flex_1().min_h(0).pt(2).child(list(t, nav, loading)))))
    .child(footer(t, nav));
}
