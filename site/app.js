/* herdr-recall landing — theme, the live Recall demo, copy, reveal.
   The demo draws the dialog in HTML, but every list rule (rows, order,
   search, tiers, selection, Clues) comes from Recall's own lib/, which the
   site links in rather than copies: lib/listview.js is the same seam the
   mod and its tests use. No dependencies. */

import { listView } from "./lib/listview.js";
import { segments } from "./lib/fuzzy.js";
import { location } from "./lib/columns.js";
import { STATUS_WORD } from "./lib/items.js";
import { createWorld, focusPane, targetPane, SPACE_COLORS } from "./world.js";

/* ---------- theme toggle ---------- */
var root = document.documentElement;
var toggle = document.getElementById("theme-toggle");
if (toggle) {
  toggle.addEventListener("click", function () {
    var cur = root.getAttribute("data-theme");
    var next = cur
      ? cur === "dark" ? "light" : "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("recall-theme", next); } catch (e) {}
  });
}

/* ---------- the Recall demo ---------- */
// Mirrors mods/recall/ui.js: the same categories, titles, icons and colors.
const CATEGORIES = ["all", "spaces", "tabs", "panes", "agents", "clues"];
const CATEGORY = {
  all: { label: "All", title: "Find Anywhere", icon: "all" },
  spaces: { label: "Spaces", title: "Recent Spaces", icon: "spaces" },
  tabs: { label: "Tabs", title: "Recent Tabs", icon: "tabs" },
  panes: { label: "Panes", title: "Recent Panes", icon: "panes" },
  agents: { label: "Agents", title: "Agents", icon: "agents" },
  clues: { label: "Clues", title: "Find by Clue", icon: "search" },
};
const SORTS = [["mru", "Recent"], ["priority", "Priority"], ["grouped", "Grouped"]];
const KIND_ICON = { space: "spaces", tab: "tabs", pane: "panes", agent: "agents", clue: "panes", hint: "search", "to-clues": "search" };
const CLUE_COLOR = { ssh: "cyan", cmd: "yellow", file: "magenta", term: "blue", port: "cyan", pid: "magenta" };
const CHIP_COLOR = { ".": "accent", port: "cyan", pid: "magenta" };

const dlg = document.getElementById("dlg");
const whereEl = document.getElementById("where");

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
function icon(name) {
  return `<span class="ico" style="--icon:url(icons/${name}.svg)" aria-hidden="true"></span>`;
}
function highlighted(text, idx, cls) {
  const segs = idx?.length ? segments(text, idx) : [{ text: text ?? "", hit: false }];
  return `<span class="${cls}">${segs.map((s) => (s.hit ? `<b>${esc(s.text)}</b>` : esc(s.text))).join("")}</span>`;
}
function titleHits(item, hits) {
  if (!item.excerpt) return hits.title;
  return Array.from({ length: item.excerpt[1] - item.excerpt[0] }, (_, i) => item.excerpt[0] + i);
}
function badge(item) {
  if (!item.spaceId) return `<span class="c-bd"></span>`;
  const letter = [...(item.spaceName ?? "?")][0]?.toUpperCase() ?? "?";
  return `<span class="c-bd" style="background:${SPACE_COLORS[item.spaceId] ?? "#888"}">${esc(letter)}</span>`;
}
function glyph(status) {
  if (status === "working") return `<span class="c-g"><span class="spin" aria-label="working"></span></span>`;
  const g = status === "blocked" || status === "done" ? "●" : status === "idle" ? "○" : "";
  return `<span class="c-g st-${status ?? "none"}">${g}</span>`;
}

if (dlg) {
  const world = createWorld();
  const state = {
    snap: world.snap,
    clueData: world.clueData,
    category: "agents",
    agentSort: "mru",
    query: "",
    at: 0,
    rows: [],
    open: true,
    now: 5000,
  };

  dlg.classList.add("live");
  dlg.insertAdjacentHTML("beforeend", `
    <div class="dlg-head">
      <div class="dlg-title"></div>
      <label class="dlg-search">
        ${icon("search")}
        <span class="dlg-chip" hidden></span>
        <input type="text" spellcheck="false" autocomplete="off" aria-label="Search" placeholder="Type to search" />
        <span class="dlg-count"></span>
      </label>
      <div class="dlg-sort" role="group" aria-label="Sort agents">
        ${SORTS.map(([k, l]) => `<button type="button" data-sort="${k}">${l}</button>`).join("")}
      </div>
      <span class="dlg-esc">Esc</span>
    </div>
    <div class="dlg-body">
      <nav class="dlg-rail" aria-label="Categories">
        ${CATEGORIES.map((c) => `<button type="button" data-cat="${c}">${icon(CATEGORY[c].icon)}<span>${CATEGORY[c].label}</span></button>`).join("")}
      </nav>
      <div class="dlg-table">
        <div class="dlg-cols" aria-hidden="true">
          <span class="h-pad"></span><span class="h-nm">NAME</span><span class="h-loc">LOCATION</span><span class="h-fld">FOLDER</span><span class="h-br">BRANCH</span><span class="h-st">STATUS</span><span class="h-bd"></span>
        </div>
        <div class="dlg-rows" role="listbox" aria-label="Results"></div>
      </div>
    </div>
    <div class="dlg-foot"></div>
    <button class="dlg-closed" type="button" hidden><strong>Recall is closed</strong><span>Press <kbd>⌘E</kbd>, or click here, to open it again</span></button>
  `);

  const $ = (sel) => dlg.querySelector(sel);
  const input = $("input");
  const titleEl = $(".dlg-title");
  const chip = $(".dlg-chip");
  const countEl = $(".dlg-count");
  const sortEl = $(".dlg-sort");
  const rowsEl = $(".dlg-rows");
  const footEl = $(".dlg-foot");
  const locHead = $(".h-loc");
  const closedEl = $(".dlg-closed");

  const view = () => listView(state.category, state.snap, state.query, { agentSort: state.agentSort, clueData: state.clueData });

  /** Recompute the rows; `reaim` re-picks the opening selection, as a query change does. */
  function refresh(reaim) {
    const v = view();
    state.rows = v.rows;
    if (reaim) state.at = v.selected;
    state.at = Math.min(state.at, Math.max(0, v.rows.length - 1));
    draw(v);
  }

  function draw(v) {
    const c = state.category;
    dlg.classList.toggle("all", c === "all");
    titleEl.textContent = CATEGORY[c].title;
    locHead.textContent = c === "spaces" ? "CONTENTS" : "LOCATION";
    sortEl.hidden = c !== "agents";
    sortEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sort === state.agentSort)));
    dlg.querySelectorAll(".dlg-rail button").forEach((b) => b.setAttribute("aria-current", String(b.dataset.cat === c)));
    if (input.value !== state.query) input.value = state.query;
    countEl.textContent = state.query.trim() && v.total !== null ? `${v.count}/${v.total}` : String(v.count);
    chip.hidden = !v.label;
    if (v.label) {
      chip.textContent = v.label === "." ? "content" : v.label;
      chip.dataset.c = CHIP_COLOR[v.label] ?? CLUE_COLOR[v.label] ?? "accent";
    }

    if (!v.rows.length) {
      rowsEl.innerHTML = `<div class="dlg-empty">${state.query ? "Nothing matches" : "Nothing here yet"}</div>`;
    } else {
      rowsEl.innerHTML = v.rows.map((r, i) => rowHtml(r, i)).join("");
    }
    footEl.innerHTML = hints().map(([k, l, cls]) => `<span class="k ${cls ?? ""}"><span>${esc(k)}</span>${esc(l)}</span>`).join("");
    scrollToSelected();
  }

  function rowHtml({ item, hits }, i) {
    const isClue = item.kind === "clue" || item.kind === "hint";
    const ic = isClue
      ? `<span class="clue ${item.kind === "hint" ? "" : `cl-${CLUE_COLOR[item.clue] ?? ""}`}">${esc(item.clue)}</span>`
      : icon(KIND_ICON[item.kind] ?? "panes");
    const name = [
      item.crumb ? highlighted(item.crumb, hits.where, "crumb") : "",
      highlighted(item.title, titleHits(item, hits), "tt"),
      item.kind === "hint" ? `<span class="why">(${esc(item.reason)})</span>` : "",
      item.message ? `<span class="msg">${esc(item.message)}</span>` : "",
    ].join("");
    const word = STATUS_WORD[item.status];
    const cls = ["r", i === state.at ? "sel" : "", item.current ? "cur" : "", item.kind === "hint" ? "hint" : ""].join(" ");
    const loc = item.kind === "to-clues" ? "" : location(item);
    return `<div class="${cls}" role="option" aria-selected="${i === state.at}" data-i="${i}">`
      + glyph(item.status)
      + `<span class="c-ic${isClue ? " is-clue" : ""}">${ic}</span>`
      // On a phone the location columns are hidden; the name shows it on a second line instead.
      // All's path moves there too, so a narrow row keeps room for the name.
      + `<span class="c-nm"><span class="line">${name}</span>${sub(item, hits, loc)}</span>`
      + `<span class="c-loc">${esc(loc)}</span>`
      + `<span class="c-fld">${esc(item.path)}</span>`
      + `<span class="c-br">${esc(item.branch)}</span>`
      + `<span class="c-st">${word ? `<span class="st-${item.status}">${esc(word)}</span>` : ""}</span>`
      + badge(item)
      + `</div>`;
  }

  function sub(item, hits, loc) {
    if (state.category !== "all") return loc ? `<span class="sub">${esc(loc)}</span>` : "";
    return item.crumb ? highlighted(item.crumb.replace(/ › $/u, ""), hits.where, "sub") : "";
  }

  function hints() {
    const out = [["⏎", "open"], ["↑↓", "move"], ["⇥", "category", "opt"]];
    if (state.category === "agents") out.push(["⌃S", "sort", "opt"]);
    if (state.category === "clues") out.push([".", "buffers", "opt"], ["cmd ssh file term port pid", "prefixes", "opt"]);
    out.push(["esc", state.query ? "clear" : "close", "end"]);
    return out;
  }

  function scrollToSelected() {
    const el = rowsEl.children[state.at];
    if (!el || !el.classList.contains("r")) return;
    const top = el.offsetTop - rowsEl.offsetTop;
    if (top < rowsEl.scrollTop) rowsEl.scrollTop = top - 4;
    else if (top + el.offsetHeight > rowsEl.scrollTop + rowsEl.clientHeight) rowsEl.scrollTop = top + el.offsetHeight - rowsEl.clientHeight + 4;
  }

  function select(i) {
    if (!state.rows.length) return;
    const n = state.rows.length;
    state.at = ((i % n) + n) % n;
    rowsEl.querySelectorAll(".r").forEach((el, j) => {
      el.classList.toggle("sel", j === state.at);
      el.setAttribute("aria-selected", String(j === state.at));
    });
    scrollToSelected();
  }

  function switchTo(category, sort) {
    state.category = category;
    if (sort) state.agentSort = sort;
    refresh(true);
  }

  function drawWhere(flash) {
    const here = listView("panes", state.snap, "", {}).rows.find((r) => r.item.current)?.item;
    if (!here || !whereEl) return;
    whereEl.innerHTML = `${badge(here)}<span>${esc(here.where)} › ${esc(here.title)}</span>`;
    if (flash) {
      whereEl.classList.remove("flash");
      void whereEl.offsetWidth;
      whereEl.classList.add("flash");
    }
  }

  function setOpen(open, { focus = true } = {}) {
    state.open = open;
    closedEl.hidden = open;
    if (open) {
      state.query = "";
      refresh(true);
      if (focus) input.focus({ preventScroll: true });
    } else {
      input.blur();
    }
  }

  function openRow(i) {
    const r = state.rows[i];
    if (!r) return;
    const item = r.item;
    if (item.kind === "to-clues") { switchTo("clues"); input.focus({ preventScroll: true }); return; }
    const p = targetPane(state.snap, item);
    if (!p) return;
    state.now += 1000;
    state.snap = focusPane(state.snap, p.pane, state.now);
    drawWhere(true);
    setOpen(false);
  }

  input.addEventListener("input", () => {
    state.query = input.value;
    refresh(true);
  });

  input.addEventListener("keydown", (e) => {
    const ctrl = e.ctrlKey && !e.metaKey && !e.altKey;
    const key = e.key.toLowerCase();
    let handled = true;
    if (e.key === "ArrowDown" || (ctrl && key === "n")) select(state.at + 1);
    else if (e.key === "ArrowUp" || (ctrl && key === "p")) select(state.at - 1);
    else if (e.key === "Enter") openRow(state.at);
    else if (e.key === "Tab") {
      const i = CATEGORIES.indexOf(state.category);
      switchTo(CATEGORIES[(i + (e.shiftKey ? -1 : 1) + CATEGORIES.length) % CATEGORIES.length]);
    } else if (ctrl && key === "s") {
      if (state.category === "agents") {
        const i = SORTS.findIndex(([k]) => k === state.agentSort);
        switchTo("agents", SORTS[(i + 1) % SORTS.length][0]);
      }
    } else if (e.key === "Escape") {
      if (state.query) { state.query = ""; refresh(true); } else setOpen(false);
    } else if (ctrl && key === "c") setOpen(false);
    else handled = false;
    if (handled) e.preventDefault();
  });

  rowsEl.addEventListener("click", (e) => {
    const el = e.target.closest(".r");
    if (el) openRow(Number(el.dataset.i));
  });
  dlg.querySelector(".dlg-rail").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    switchTo(b.dataset.cat);
    input.focus({ preventScroll: true });
  });
  sortEl.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    switchTo("agents", b.dataset.sort);
    input.focus({ preventScroll: true });
  });
  closedEl.addEventListener("click", () => setOpen(true));

  // The open key: opens Recall, or closes it when it already has focus.
  document.addEventListener("keydown", (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "e") return;
    e.preventDefault();
    if (state.open && document.activeElement === input) { setOpen(false); return; }
    if (!state.open) setOpen(true, { focus: false });
    input.focus({ preventScroll: true });
    const r = dlg.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) document.getElementById("demo").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // "Try it" buttons anywhere on the page drive the demo.
  document.querySelectorAll("[data-q]").forEach((b) => {
    if (dlg.contains(b)) return;
    b.addEventListener("click", () => {
      state.open = true;
      closedEl.hidden = true;
      state.category = b.dataset.cat || state.category;
      if (b.dataset.sort) state.agentSort = b.dataset.sort;
      else if (state.category === "agents") state.agentSort = "mru";
      state.query = b.dataset.q ?? "";
      refresh(true);
      document.getElementById("demo").scrollIntoView({ behavior: "smooth", block: "start" });
      input.focus({ preventScroll: true });
      const n = input.value.length;
      input.setSelectionRange(n, n);
    });
  });

  drawWhere(false);
  refresh(true);
}

/* ---------- copy buttons ---------- */
document.querySelectorAll(".copy").forEach((btn) => {
  btn.addEventListener("click", () => {
    const card = btn.closest(".cmd");
    const pre = card && card.querySelector("pre");
    if (!pre) return;
    const lines = pre.querySelectorAll(".ln");
    const text = lines.length ? Array.from(lines, (l) => l.textContent).join("\n") : pre.textContent;
    const done = () => {
      const old = btn.textContent;
      btn.textContent = "copied";
      btn.classList.add("ok");
      setTimeout(() => { btn.textContent = old; btn.classList.remove("ok"); }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, done);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta); done();
    }
  });
});

/* ---------- scroll reveal ---------- */
const reveals = document.querySelectorAll(".reveal");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reduce || !("IntersectionObserver" in window)) {
  reveals.forEach((el) => el.classList.add("in"));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.16 });
  reveals.forEach((el) => io.observe(el));
}
