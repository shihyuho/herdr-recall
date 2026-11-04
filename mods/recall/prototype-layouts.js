// PROTOTYPE — throwaway, do not build on this file.
//
// Question: without the right-hand preview column, what should the
// navigator look like? Four layouts on the same dialog, flipped with ⌥← / ⌥→
// or the pink pill at the bottom. The pick is kept in shared
// "recall.prototype.layout", so it survives closing and reopening.
//
//   preview  today's layout, for comparison
//   columns  icon rail + a full-width table: name, location, folder, branch
//   tabs     no rail: categories as tabs under the search, two-line rows
//   strip    icon rail + a full-width list + a short detail strip at the bottom
//
// Once one wins, fold it into ui.js properly and delete this file, its hooks
// in main.js (PROTOTYPE comments) and the `export`s added to ui.js for it.

import { div, svg, uniform_list } from "gpui-kit";
import { v_flex, h_flex, Input } from "gpui-base";
import { theme, shared, setShared, settings } from "herdr";
import * as ui from "./ui.js";

export const LAYOUT_KEY = "recall.prototype.layout";
export const LAYOUTS = [
  { key: "preview", name: "Preview (current)" },
  { key: "columns", name: "Columns" },
  { key: "tabs", name: "Top tabs, two-line rows" },
  { key: "strip", name: "Detail strip" },
];

export function currentLayout() {
  const k = shared(LAYOUT_KEY);
  return LAYOUTS.some((l) => l.key === k) ? k : "preview";
}

export function cycleLayout(step) {
  const i = LAYOUTS.findIndex((l) => l.key === currentLayout());
  setShared(LAYOUT_KEY, LAYOUTS[(i + step + LAYOUTS.length) % LAYOUTS.length].key);
}

// ── shared bits ─────────────────────────────────────────────────────────────

/** "space › tab" for anything below a space; "" for a space itself. */
function where(item) {
  if (item.kind === "space") return "";
  return item.tabName ? `${item.spaceName} › ${item.tabName}` : item.spaceName ?? "";
}

function isOther(item) {
  return item.kind === "other" || item.kind === "hint";
}

function sourceLabel(t, item, w) {
  return div().w(w).flex_none().text_size(11).font_semibold()
    .text_color(item.kind === "hint" ? t.dim : t[ui.SOURCE_COLOR[item.source]] ?? t.dim).child(item.source);
}

function title(t, item, hits) {
  return ui.highlighted(item.title, ui.titleHits(item, hits), item.kind === "hint" ? t.dim : t.foreground, t.accent)
    .when(Boolean(item.current), (d) => d.font_semibold());
}

/** ui.list with a row of the layout's own. */
function listWith(t, nav, loading, id, rowFn) {
  const rows = nav.rows;
  if (!rows.length) {
    const msg = loading ? "Reading panes…" : nav.query ? "Nothing matches" : "Nothing here yet";
    return v_flex().size_full().items_center().justify_center().text_color(t.dim).child(msg);
  }
  return uniform_list(id, rows.length, (i) => rows[i].item.key, (range) => {
    const out = [];
    for (let i = range.start; i < range.end; i++) out.push(rowFn(t, rows[i], i === nav.at));
    return out;
  })
    .track_scroll(nav.scroll)
    .on_item_click((key) => {
      const r = rows.find((x) => x.item.key === key);
      if (r) nav.open(r.item);
    })
    .size_full();
}

function body(t, nav, ...children) {
  return h_flex().flex_1().min_h(0).items_start().children(children);
}

// ── B: columns ──────────────────────────────────────────────────────────────
//
// Click a column head to sort by it: ascending, then descending, then back
// to the category's own order (recency, or match quality while searching).
// A worktree nested under its main checkout moves with it. Empty values
// always sort last. The sort lasts while the dialog is open.

const STATUS_RANK = { blocked: 0, done: 1, working: 2, idle: 3 };
const COLUMNS = [
  { key: "name", label: () => "NAME", value: (i) => i.title },
  {
    key: "where", w: 210,
    label: (nav) => (nav.category === "spaces" ? "CONTENTS" : "LOCATION"),
    value: (i) => (i.kind === "space" ? i.tabs?.length ?? null : where(i)),
  },
  { key: "path", w: 240, label: () => "FOLDER", value: (i) => i.path },
  { key: "branch", w: 140, label: () => "BRANCH", value: (i) => i.branch },
  { key: "status", w: 70, right: true, label: () => "STATUS", value: (i) => STATUS_RANK[i.status] },
];

/** What the location column shows: a space has no parent, so what it holds. */
function locationText(item) {
  if (item.kind === "space") return [item.where, item.detail].filter(Boolean).join(" · ");
  return where(item);
}

function empty(v) {
  return v === null || v === undefined || v === "";
}

function compare(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function toggleSort(nav, key) {
  const s = nav.protoSort;
  nav.protoSort = s?.col !== key ? { col: key, dir: 1 } : s.dir > 0 ? { col: key, dir: -1 } : null;
  nav.protoKeep = nav.rows?.[nav.at]?.item.key ?? null; // keep the selected row selected
}

/** PROTOTYPE hook, called by main.js on the rows before it picks the selection. */
export function sortRows(nav, rows) {
  let out = rows;
  const s = nav.protoSort;
  const col = s && currentLayout() === "columns" && COLUMNS.find((c) => c.key === s.col);
  if (col) {
    const groups = [];
    for (const r of rows) {
      if (r.item.nested && groups.length) groups[groups.length - 1].push(r);
      else groups.push([r]);
    }
    groups.sort((ga, gb) => {
      const a = col.value(ga[0].item), b = col.value(gb[0].item);
      if (empty(a) || empty(b)) return empty(a) - empty(b);
      return compare(a, b) * s.dir;
    });
    out = groups.flat();
  }
  if (nav.protoKeep) {
    const i = out.findIndex((r) => r.item.key === nav.protoKeep);
    if (i >= 0) {
      nav.at = i;
      nav.auto = false;
      nav.follow = true;
    }
    nav.protoKeep = null;
  }
  return out;
}

function columnHead(t, nav) {
  const head = (c) => {
    const on = nav.protoSort?.col === c.key;
    const text = c.label(nav) + (on ? (nav.protoSort.dir > 0 ? " ▲" : " ▼") : "");
    return h_flex().id(`recall-col-${c.key}`).h_full().items_center().cursor_pointer()
      .when(Boolean(c.w), (el) => el.w(c.w).flex_none())
      .when(!c.w, (el) => el.flex_1().min_w(0))
      .when(Boolean(c.right), (el) => el.justify_end())
      .text_color(on ? t.accent : t.dim)
      .hover((x) => x.text_color(t.foreground))
      .on_click((_e, cx) => { toggleSort(nav, c.key); nav.focusForMode(); cx.notify(); })
      .child(div().truncate().child(text));
  };
  return h_flex().h(26).flex_none().mx(4).px(8).gap(8).items_center()
    .text_size(10.5).font_semibold().border_b(1).border_color(t.border)
    .child(div().w(10).flex_none())
    .child(div().w(30).flex_none())
    .children(COLUMNS.map(head))
    .child(div().w(16).flex_none());
}

const COL = Object.fromEntries(COLUMNS.filter((c) => c.w).map((c) => [c.key, c.w]));

function columnsRow(t, { item, hits }, on) {
  const cell = (w, text, color) => div().w(w).flex_none().truncate().text_size(12).text_color(color).child(text || "");
  return h_flex().h(30).mx(4).px(8).gap(8).items_center().rounded(6)
    .when(on, (el) => el.bg(t.selection))
    .child(ui.glyph(t, item.status, 10))
    .child(isOther(item) ? sourceLabel(t, item, 30) : h_flex().w(30).flex_none().child(ui.icon(t, item, 14)))
    .child(h_flex().flex_1().min_w(0).gap(8).items_center().overflow_hidden()
      .when(Boolean(item.nested), (el) => el.pl(18))
      .child(title(t, item, hits))
      .when(item.kind === "hint", (el) => el.child(div().flex_none().text_color(t.blocked).child(`(${item.reason})`)))
      .when(Boolean(item.message), (el) => el.child(div().min_w(0).truncate().text_size(12).text_color(t.dim).child(item.message))))
    .child(cell(COL.where, locationText(item), t.muted))
    .child(cell(COL.path, item.path, t.dim))
    .child(cell(COL.branch, item.branch, t.dim))
    .child(h_flex().w(COL.status).flex_none().justify_end().child(ui.statusWord(t, item.status) ?? div()))
    .child(ui.badge(t, item, 16));
}

function columns(t, nav, { view, loading }) {
  return v_flex().size_full()
    .child(ui.header(t, nav, view))
    .child(body(t, nav,
      ui.rail(t, nav),
      v_flex().flex_1().min_w(0).h_full().py(4)
        .child(columnHead(t, nav))
        .child(div().flex_1().min_h(0).pt(2).child(listWith(t, nav, loading, "recall-rows-columns", columnsRow)))))
    .child(ui.footer(t, nav));
}

// ── C: top tabs, two-line rows ──────────────────────────────────────────────

function bigSearch(t, nav, view) {
  const count = nav.query.trim() && view.total !== undefined ? `${nav.rows.length}/${view.total}` : String(nav.rows.length);
  const field = h_flex().flex_1().h(38).px(12).gap(10).items_center().rounded(9).border_1()
    .border_color(nav.mode === "navigation" ? t.border : t.accent).bg(t.background)
    .children([
      svg("mods/recall/icons/search.svg").size(16).text_color(t.dim),
      view.label ? ui.filterChip(t, view.label) : null,
      Input.new(nav.input).flex_1().h_full().text_size(14).text_color(nav.mode === "navigation" ? t.muted : t.foreground),
      nav.mode === "navigation" && !nav.query ? div().flex_none().text_size(11).text_color(t.dim).child("/ to filter") : null,
      div().flex_none().text_size(11).text_color(t.dim).child(count),
    ].filter(Boolean));
  return h_flex().flex_none().px(14).pt(12).pb(8).gap(12).items_center()
    .child(field)
    .child(div().flex_none().text_size(11).text_color(t.dim).child("Esc"));
}

function tabBar(t, nav) {
  const tab = (c) => {
    const on = c === nav.category;
    return h_flex().id(`recall-ptab-${c}`).h_full().px(10).gap(6).items_center().relative().cursor_pointer()
      .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
      .on_click((_e, cx) => { nav.switchTo(c); nav.focusForMode(); cx.notify(); })
      .child(svg(`mods/recall/icons/${c}.svg`).size(13).text_color(on ? t.accent : t.dim))
      .child(div().text_size(12.5).text_color(on ? t.foreground : t.muted).when(on, (d) => d.font_semibold()).child(ui.CATEGORY[c].label))
      .when(on, (el) => el.child(div().absolute().left(0).right(0).bottom(0).h(2).bg(t.accent)));
  };
  return h_flex().h(34).flex_none().px(10).gap(2).items_center().border_b(1).border_color(t.border)
    .children(nav.tabs.map(tab))
    .child(div().flex_1())
    .when(nav.category === "agents", (el) => el.child(ui.sortToggle(t, nav)));
}

function subtitle(item) {
  if (item.kind === "hint") return `${item.detail ? item.detail + " · " : ""}${item.reason}`;
  const parts = [where(item)];
  if (item.kind === "agent" && item.message) parts.push(item.message);
  else {
    if (item.kind === "space" && item.tabs) parts.push(`${item.tabs.length} tab${item.tabs.length === 1 ? "" : "s"}`);
    if (item.kind === "tab" && item.panes) parts.push(`${item.panes.length} pane${item.panes.length === 1 ? "" : "s"}`);
    parts.push(item.path, item.branch && `⎇ ${item.branch}`);
  }
  return parts.filter(Boolean).join("  ·  ");
}

function twoLineRow(t, { item, hits }, on) {
  return h_flex().h(46).mx(6).px(10).gap(10).items_center().rounded(7)
    .when(on, (el) => el.bg(t.selection))
    .when(Boolean(item.nested), (el) => el.pl(34))
    .child(ui.badge(t, item, 24))
    .child(v_flex().flex_1().min_w(0).gap(2)
      .child(h_flex().gap(7).items_center().overflow_hidden()
        .child(ui.glyph(t, item.status, 10))
        .child(isOther(item) ? sourceLabel(t, item, 30) : ui.icon(t, item, 14))
        .child(title(t, item, hits)))
      .child(div().truncate().text_size(11.5).text_color(t.dim).child(subtitle(item) || " ")))
    .child(ui.statusWord(t, item.status) ?? div());
}

function topTabs(t, nav, { view, loading }) {
  return v_flex().size_full()
    .child(bigSearch(t, nav, view))
    .child(tabBar(t, nav))
    .child(div().flex_1().min_h(0).py(4).child(listWith(t, nav, loading, "recall-rows-tabs", twoLineRow)))
    .child(ui.footer(t, nav));
}

// ── D: detail strip ─────────────────────────────────────────────────────────

const STRIP = 118;

function stripRow(t, { item, hits }, on) {
  return h_flex().h(30).mx(4).px(8).gap(8).items_center().rounded(6)
    .when(on, (el) => el.bg(t.selection))
    .when(Boolean(item.nested), (el) => el.pl(26))
    .child(ui.glyph(t, item.status, 10))
    .child(isOther(item) ? sourceLabel(t, item, 30) : ui.icon(t, item, 14))
    .child(h_flex().flex_1().min_w(0).gap(8).items_center().overflow_hidden()
      .child(title(t, item, hits))
      .when(item.kind === "hint", (el) => el.child(div().flex_none().text_color(t.blocked).child(`(${item.reason})`))))
    .child(div().max_w(320).flex_none().truncate().text_size(11.5).text_color(t.dim).child(where(item)))
    .child(ui.badge(t, item, 16));
}

function strip(t, nav, sel) {
  const box = h_flex().h(STRIP).flex_none().px(14).py(10).gap(14).border_t(1).border_color(t.border).bg(t.chrome);
  if (!sel) return box;
  const meta = [sel.program?.name, sel.path, sel.branch && `⎇ ${sel.branch}`].filter(Boolean).join("  ·  ");
  const facts = v_flex().w(340).flex_none().h_full().gap(5).overflow_hidden()
    .child(h_flex().gap(8).items_center()
      .child(ui.badge(t, sel, 16))
      .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.muted).child(where(sel) || sel.spaceName || "")))
    .child(h_flex().gap(8).items_center()
      .child(ui.icon(t, sel, 16))
      .child(div().flex_1().min_w(0).truncate().text_size(14).font_semibold().child(sel.title || " "))
      .child(ui.statusWord(t, sel.status) ?? div()))
    .child(div().truncate().text_size(11.5).text_color(t.dim).child(meta || " "))
    .when(Boolean(sel.message), (el) => el.child(div().truncate().text_size(11.5).text_color(t.muted).child(sel.message)));

  // What it holds: a terminal's last lines, else a space's tabs or a tab's panes.
  const screen = sel.terminal ? nav.preview.get(sel.terminal) : null;
  const chips = (list) => h_flex().flex_1().min_w(0).flex_wrap().gap(6).content_start().overflow_hidden().children(list.map((x) =>
    h_flex().h(22).px(8).gap(6).items_center().rounded(5).bg(t.raised).text_size(11.5)
      .child(ui.glyph(t, x.status, 9)).child(div().text_color(t.foreground).child(x.title || " "))));
  let holds;
  if (sel.terminal && (screen?.lines || sel.kind !== "tab")) {
    const font = settings()?.font_family ?? settings()?.font ?? "JetBrains Mono";
    holds = v_flex().flex_1().min_w(0).h_full().px(10).py(6).rounded(6).bg(t.background).overflow_hidden().justify_end()
      .font_family(font).text_size(11).text_color(t.muted)
      .children((screen?.lines?.slice(-5) ?? ["…"]).map((line) => div().whitespace_nowrap().child(line || " ")));
  } else if (sel.kind === "space") holds = chips(sel.tabs ?? []);
  else if (sel.kind === "tab") holds = chips(sel.panes ?? []);
  else holds = div().flex_1();
  return box.child(facts).child(holds);
}

function detailStrip(t, nav, { view, selected, loading }) {
  return v_flex().size_full()
    .child(ui.header(t, nav, view))
    .child(body(t, nav,
      ui.rail(t, nav),
      div().flex_1().min_w(0).h_full().py(4).child(listWith(t, nav, loading, "recall-rows-strip", stripRow))))
    .child(strip(t, nav, selected))
    .child(ui.footer(t, nav));
}

// ── switcher ────────────────────────────────────────────────────────────────

function switcher(layout) {
  const i = LAYOUTS.findIndex((l) => l.key === layout);
  const arrow = (id, g, step) => h_flex().id(id).w(24).h(22).items_center().justify_center().rounded_full().cursor_pointer()
    .hover((x) => x.bg("#ffffff26"))
    .on_click((_e, cx) => { cycleLayout(step); cx.notify(); })
    .child(g);
  const lift = layout === "strip" ? STRIP + 36 : 38;
  return h_flex().absolute().left(0).right(0).bottom(lift).justify_center()
    .child(h_flex().h(28).px(3).gap(6).items_center().rounded_full().bg("#16161a").border_1().border_color("#ff4fa3").shadow_lg()
      .text_size(11.5).text_color("#ffffff")
      .child(arrow("recall-proto-prev", "‹", -1))
      .child(div().font_semibold().text_color("#ff4fa3").child("PROTOTYPE"))
      .child(div().child(`${i + 1}/${LAYOUTS.length}  ${LAYOUTS[i].name}`))
      .child(div().text_color("#9a9aa6").child("⌥← ⌥→"))
      .child(arrow("recall-proto-next", "›", 1)));
}

// ── entry ───────────────────────────────────────────────────────────────────

export function navigator(nav, ctx) {
  const t = theme();
  const layout = currentLayout();
  const view =
    layout === "columns" ? columns(t, nav, ctx)
    : layout === "tabs" ? topTabs(t, nav, ctx)
    : layout === "strip" ? detailStrip(t, nav, ctx)
    : ui.navigator(nav, ctx);
  return div().size_full().relative().child(view).child(switcher(layout));
}
