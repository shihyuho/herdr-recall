// The navigator's look ("Preview" layout): a header with the category
// title and the search box, then three columns: an icon rail of the
// categories, the rows, and a preview of the selected row (where it is,
// what it runs, and its terminal's last lines, or what a space or tab
// holds). A one-line footer under them names the keys.
//
// navigator(nav, ctx) draws the dialog from the navigator's state and
// changes nothing but through nav's own methods:
//   reads  nav.{category, tabs, rows, at, scroll, input, mode, query,
//               agentSort, keys, preview, configError}
//   calls  nav.{switchTo, focusForMode, open}
//   ctx  = { view, selected, loading }  (view: what rowsFor returned)

import { div, svg, image, uniform_list } from "gpui-kit";
import { v_flex, h_flex, Input } from "gpui-base";
import { theme, shared, settings } from "herdr";
import { segments } from "./lib/fuzzy.js";

export const CATEGORY = {
  spaces: { label: "Spaces", title: "Recent Spaces" },
  tabs: { label: "Tabs", title: "Recent Tabs" },
  panes: { label: "Panes", title: "Recent Panes" },
  agents: { label: "Agents", title: "Agents" },
  all: { label: "All", title: "Find Anywhere" },
};
const SORT_LABEL = { mru: "Recent", priority: "Priority", grouped: "Grouped" };
export const SOURCE_COLOR = { ssh: "ansi6", cmd: "ansi3", file: "ansi5", term: "ansi4", cwd: "ansi2", port: "ansi6", pid: "ansi5" };
const CHIP_COLOR = { ".": "accent", ws: "ansi3", tab: "ansi1", pane: "ansi4", port: "ansi6", pid: "ansi5" };
export const KIND_ICON = { space: "spaces", tab: "tabs", pane: "panes", agent: "agents", other: "panes", hint: "all" };
const PREFIXES = "cmd ssh cwd file term port pid ws tab pane";
const SPINNER = "mods/workspace-chrome/spinner.svg";
export const ROW = 30;

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
export function badge(t, item, size) {
  if (!item.spaceId) return div().size(size).flex_none();
  const letter = [...(item.spaceName ?? "?")][0]?.toUpperCase() ?? "?";
  return h_flex().size(size).flex_none().rounded(Math.round(size * 0.28)).bg(spaceColor(t, item.spaceId, item.spaceName))
    .items_center().justify_center().text_size(size * 0.58).font_bold().text_color("#ffffff").child(letter);
}

export function glyph(t, status, size) {
  if (status === "working") return svg(SPINNER).size(size).flex_none().text_color(t.working).spin(900);
  const g = status === "blocked" || status === "done" ? "●" : status === "idle" ? "○" : "";
  return div().w(size).flex_none().text_size(size - 1).text_color(t[status] ?? t.dim).child(g);
}

export function statusWord(t, status) {
  if (status === "blocked") return div().flex_none().text_size(11.5).text_color(t.blocked).child("needs you");
  if (status === "done") return div().flex_none().text_size(11.5).text_color(t.done).child("finished");
  return null;
}

export function icon(t, item, size) {
  const p = item.program;
  if (p?.icon) return p.tint ? svg(p.icon).size(size).flex_none().text_color(t.muted) : image(p.icon).size(size).flex_none();
  return svg(`mods/recall/icons/${KIND_ICON[item.kind] ?? "panes"}.svg`).size(size).flex_none().text_color(t.dim);
}

/** Text with the matched characters (`idx`) drawn in `hitColor`. */
export function highlighted(s, idx, color, hitColor) {
  if (!idx?.length) return div().flex_none().text_color(color).child(s ?? "");
  return h_flex().flex_none().children(segments(s, idx).map((seg) =>
    div().text_color(seg.hit ? hitColor : color).when(seg.hit, (d) => d.font_semibold()).child(seg.text)));
}

/** A buffer match is drawn as its excerpt; highlight the whole excerpt. */
export function titleHits(item, hits) {
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

export function filterChip(t, label) {
  return div().px(6).h(18).flex_none().flex().items_center().rounded(4).text_size(11).font_semibold()
    .bg(t[CHIP_COLOR[label] ?? SOURCE_COLOR[label] ?? "accent"] ?? t.accent).text_color(t.background)
    .child(label === "." ? "content" : label);
}

export function sortToggle(t, nav) {
  return h_flex().flex_none().gap(2).p(2).rounded(7).bg(t.raised).children(["mru", "priority", "grouped"].map((s) =>
    div().id(`recall-sort-${s}`).px(8).h(20).flex().items_center().rounded(5).text_size(11.5).cursor_pointer()
      .when(nav.agentSort === s, (el) => el.bg(t.selected).text_color(t.foreground))
      .when(nav.agentSort !== s, (el) => el.text_color(t.dim).hover((x) => x.text_color(t.foreground)))
      .on_click((_e, cx) => { nav.switchTo(nav.category, s); cx.notify(); })
      .child(SORT_LABEL[s])));
}

export function header(t, nav, view) {
  const label = view.label;
  const count = nav.query.trim() && view.total !== undefined ? `${nav.rows.length}/${view.total}` : String(nav.rows.length);
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

// ── rail and rows ─────────────────────────────────────────────────────────

export function rail(t, nav) {
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

export function row(t, { item, hits }, on) {
  const other = item.kind === "other" || item.kind === "hint";
  return h_flex().h(ROW).mx(4).px(8).gap(8).items_center().rounded(6)
    .when(on, (el) => el.bg(t.selection))
    .when(Boolean(item.nested), (el) => el.pl(26))
    .child(glyph(t, item.status, 10))
    .child(other
      ? div().w(30).flex_none().text_size(11).font_semibold().text_color(item.kind === "hint" ? t.dim : t[SOURCE_COLOR[item.source]] ?? t.dim).child(item.source)
      : icon(t, item, 14))
    .child(h_flex().flex_1().min_w(0).gap(8).items_center().overflow_hidden()
      .child(highlighted(item.title, titleHits(item, hits), item.kind === "hint" ? t.dim : t.foreground, t.accent)
        .when(Boolean(item.current), (d) => d.font_semibold()))
      .when(item.kind === "hint", (el) => el.child(div().flex_none().text_color(t.blocked).child(`(${item.reason})`))))
    .child(badge(t, item, 16));
}

export function list(t, nav, loading) {
  const rows = nav.rows;
  if (!rows.length) {
    const msg = loading ? "Reading panes…" : nav.query ? "Nothing matches" : "Nothing here yet";
    return v_flex().size_full().items_center().justify_center().text_color(t.dim).child(msg);
  }
  return uniform_list("recall-rows", rows.length, (i) => rows[i].item.key, (range) => {
    const out = [];
    for (let i = range.start; i < range.end; i++) out.push(row(t, rows[i], i === nav.at));
    return out;
  })
    .track_scroll(nav.scroll)
    .on_item_click((key) => {
      const r = rows.find((x) => x.item.key === key);
      if (r) nav.open(r.item);
    })
    .size_full();
}

// ── preview ───────────────────────────────────────────────────────────────

export function preview(t, nav, sel) {
  if (!sel) return div().size_full().bg(t.chrome);
  const meta = (label, value) => value ? h_flex().gap(10).text_size(12)
    .child(div().w(64).flex_none().text_color(t.dim).child(label))
    .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(value)) : null;
  const entry = (x) => h_flex().gap(8).items_center().text_size(12.5)
    .child(glyph(t, x.status, 10)).child(div().text_color(t.foreground).child(x.title || " "));
  const screen = sel.terminal ? nav.preview.get(sel.terminal) : null;
  const font = settings()?.font_family ?? settings()?.font ?? "JetBrains Mono";
  const word = statusWord(t, sel.status);
  return v_flex().size_full().p(16).gap(12).bg(t.chrome).overflow_hidden().children([
    h_flex().gap(8).items_center()
      .child(badge(t, sel, 18))
      .child(div().text_size(12).text_color(t.muted).child(sel.tabName ? `${sel.spaceName} › ${sel.tabName}` : sel.spaceName ?? "")),
    h_flex().gap(10).items_center().children([
      icon(t, sel, 18),
      div().flex_1().min_w(0).text_size(15).font_semibold().truncate().child(sel.title || " "),
      word,
    ].filter(Boolean)),
    v_flex().gap(5).children([
      meta("program", sel.program?.name),
      meta("folder", sel.path),
      meta("branch", sel.branch),
      meta("terminal", sel.terminal),
      meta("message", sel.message),
    ].filter(Boolean)),
    // A space lists its tabs; a tab lists its panes until its lead pane's screen arrives.
    sel.kind === "space" ? v_flex().gap(4).children((sel.tabs ?? []).map(entry)) : null,
    sel.kind === "tab" && !screen?.lines ? v_flex().gap(4).children((sel.panes ?? []).map(entry)) : null,
    sel.terminal ? v_flex().flex_1().min_h(0).p(10).rounded(8).bg(t.background).overflow_hidden()
      .font_family(font).text_size(11.5).text_color(t.muted)
      .children((screen?.lines ?? ["…"]).map((line) => div().whitespace_nowrap().child(line || " "))) : null,
  ].filter(Boolean));
}

// ── footer ────────────────────────────────────────────────────────────────

/** The keys worth knowing in this mode: [keys, what they do], the last one drawn at the right. */
export function hints(nav) {
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

export function footer(t, nav) {
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

export function navigator(nav, { view, selected, loading }) {
  const t = theme();
  return v_flex().size_full()
    .child(header(t, nav, view))
    .child(h_flex().flex_1().min_h(0).items_start()
      .child(rail(t, nav))
      .child(div().w(360).h_full().flex_none().py(4).border_r(1).border_color(t.border).child(list(t, nav, loading)))
      .child(div().flex_1().min_w(0).h_full().child(preview(t, nav, selected))))
    .child(footer(t, nav));
}
