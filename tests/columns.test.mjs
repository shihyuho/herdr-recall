// Contract: what the table's location column says, the room each column
// needs for what it holds, and how wide the columns are drawn: fitted to
// their content with the name first, or at the width a person dragged.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_WIDTH, columnNeeds, dragWidth, fitColumns, headWidths, loadKept, location, shownColumns,
} from "../mods/recall/lib/columns.js";
import { buildItems } from "../mods/recall/lib/items.js";
import { metricsFor, textWidth } from "../mods/recall/lib/textwidth.js";
import { world } from "./fixtures.mjs";

const GEIST = metricsFor("Geist");

test("a space's location says what it holds and where it runs; anything else, where it sits", () => {
  const snap = world();
  snap.spaces[1].machine = "box";
  const spaces = Object.fromEntries(buildItems("spaces", snap).map((i) => [i.title, location(i)]));
  assert.deepEqual(spaces, { web: "2 tabs · 1 agent", api: "on box · 1 tab" });
  const panes = Object.fromEntries(buildItems("panes", snap).map((i) => [i.id, location(i)]));
  assert.deepEqual(panes, { p1: "web › 1", p2: "web › server", p3: "api › 1" });
  assert.deepEqual(buildItems("tabs", snap).map(location), ["web", "web", "api"]);
});

// ── what each column needs ───────────────────────────────────────────────

const PANE_HEADS = headWidths("panes", GEIST);
const PANES = [
  { kind: "pane", title: "zsh", spaceName: "web", tabName: "server", path: "~/code/web", branch: "main", status: null },
  { kind: "pane", title: "nvim ledger.go", spaceName: "payments-api", tabName: "refunds", path: "~/code/payments-api", branch: "feat/561-draft-prd", status: "blocked" },
];

test("each column needs the room of its longest value in any row: cells at 12px, the status word at 11.5px, the name at 13px", () => {
  assert.deepEqual(columnNeeds(PANES, PANE_HEADS, GEIST), {
    name: textWidth("nvim ledger.go", 13, GEIST),
    location: textWidth("payments-api › refunds", 12, GEIST),
    folder: textWidth("~/code/payments-api", 12, GEIST),
    branch: textWidth("feat/561-draft-prd", 12, GEIST),
    status: textWidth("needs you", 11.5, GEIST),
  });
});

test("the name needs its path and itself, not the agent's last message", () => {
  const row = { kind: "agent", crumb: "web › server › ", title: "fix login bug", path: "~/code/web", branch: "main", status: null };
  const needs = columnNeeds([row], PANE_HEADS, GEIST);
  assert.equal(needs.name, textWidth("web › server › fix login bug", 13, GEIST));
  const chatty = { ...row, message: "ran the whole suite twice and both runs came back green, so the fix holds" };
  assert.equal(columnNeeds([chatty], PANE_HEADS, GEIST).name, needs.name);
});

test("an unnamed tab's name needs its Tab name, not its pane list", () => {
  const unnamed = buildItems("tabs", world()).find((i) => i.id === "tb1");
  assert.equal(unnamed.paneList, "fix login bug");
  assert.equal(columnNeeds([unnamed], PANE_HEADS, GEIST).name, textWidth("1", 13, GEIST));
});

test("a row nested under its main checkout needs its 18px indent as well; a clue's reason, itself and the 8px before it", () => {
  const plain = columnNeeds([{ kind: "space", title: "web ⎇ fix", status: null }], PANE_HEADS, GEIST).name;
  assert.equal(columnNeeds([{ kind: "space", title: "web ⎇ fix", nested: true, status: null }], PANE_HEADS, GEIST).name, plain + 18);
  const hint = columnNeeds([{ kind: "hint", title: "port 5173", reason: "nothing listens", status: null }], PANE_HEADS, GEIST).name;
  assert.equal(hint, textWidth("port 5173", 13, GEIST) + 8 + textWidth("(nothing listens)", 13, GEIST));
});

test("a column's head is drawn at 10.5px, and Spaces heads its location CONTENTS; a column with no value in any row needs its head", () => {
  assert.deepEqual(PANE_HEADS, {
    location: textWidth("LOCATION", 10.5, GEIST),
    folder: textWidth("FOLDER", 10.5, GEIST),
    branch: textWidth("BRANCH", 10.5, GEIST),
    status: textWidth("STATUS", 10.5, GEIST),
  });
  assert.equal(headWidths("spaces", GEIST).location, textWidth("CONTENTS", 10.5, GEIST));
  const bare = [{ kind: "pane", title: "zsh", spaceName: "", tabName: "", path: "", branch: null, status: null }];
  assert.deepEqual(columnNeeds(bare, PANE_HEADS, GEIST), { name: textWidth("zsh", 13, GEIST), ...PANE_HEADS });
});

test("a column never needs more than the widest a drag allows", () => {
  const deep = [{ kind: "pane", title: "zsh", spaceName: "web", tabName: "1", path: `~/${"very-long-folder-name/".repeat(12)}`, branch: "main", status: null }];
  assert.equal(columnNeeds(deep, PANE_HEADS, GEIST).folder, MAX_WIDTH);
});

test("All has no location column; every other category has all four", () => {
  assert.deepEqual(shownColumns("all"), ["folder", "branch", "status"]);
  for (const category of ["spaces", "tabs", "panes", "agents", "clues"]) {
    assert.deepEqual(shownColumns(category), ["location", "folder", "branch", "status"]);
  }
});

// ── how wide the columns are drawn ───────────────────────────────────────

// Beside its name and four columns a row spends 136px: 12 at each end, the
// status glyph 10, the icon 30, the badge 16 and seven gaps of 8. On a
// 1000px list that leaves 864px; with three columns, 872px.
//
// `name` in a result is the least the name is drawn at; the name takes
// what the columns leave of the row.
const FOUR = ["location", "folder", "branch", "status"];
const HEADS = { location: 53, folder: 43, branch: 46, status: 39 };
const fit = (needs, { heads = HEADS, kept = {}, listWidth = 1000, shown = FOUR } = {}) => fitColumns({ needs, heads, kept, listWidth, shown });
const columns = ({ name: _name, ...widths }) => widths;
const taken = (widths) => Object.values(columns(widths)).reduce((a, b) => a + b, 0);

test("with room to spare, every column is exactly as wide as its content needs", () => {
  assert.deepEqual(columns(fit({ name: 300, location: 120, folder: 250, branch: 90, status: 54 })),
    { location: 120, folder: 250, branch: 90, status: 54 });
});

test("All's three columns fit the same way, with no location", () => {
  assert.deepEqual(columns(fit({ name: 300, location: 0, folder: 250, branch: 90, status: 54 }, { shown: ["folder", "branch", "status"] })),
    { folder: 250, branch: 90, status: 54 });
});

test("a little short of room, only the folder narrows: it is cut at its start, and the location and the branch stay whole", () => {
  // 864 less the name's 300 and the status's 54 leaves 510; the three need 620.
  assert.deepEqual(columns(fit({ name: 300, location: 150, folder: 330, branch: 140, status: 54 })),
    { location: 150, folder: 220, branch: 140, status: 54 });
});

test("the folder gives way down to its head before the location gives any, and the location before the branch", () => {
  const heads = { location: 50, folder: 50, branch: 50, status: 39 };
  // 864 less the name's 300 and the status's 54 leaves 510.
  const three = (needs) => columns(fit({ name: 300, status: 54, ...needs }, { heads }));
  assert.deepEqual(three({ location: 200, folder: 300, branch: 200 }), { location: 200, folder: 110, branch: 200, status: 54 });
  assert.deepEqual(three({ location: 300, folder: 300, branch: 200 }), { location: 260, folder: 50, branch: 200, status: 54 });
  assert.deepEqual(three({ location: 300, folder: 300, branch: 500 }), { location: 50, folder: 50, branch: 410, status: 54 });
});

test("a name longer than half the list asks for half, and the columns share what that leaves", () => {
  const heads = { location: 50, folder: 50, branch: 50, status: 39 };
  // 864 less the name's 500 and the status's 54 leaves 310 for the three.
  assert.deepEqual(columns(fit({ name: 900, location: 200, folder: 200, branch: 200, status: 54 }, { heads })),
    { location: 60, folder: 50, branch: 200, status: 54 });
});

test("a short name asks only for what it needs: columns that fit beside it are not cut to leave it more", () => {
  // 864 less the name's 60 and the status's 59 leaves 745; the three need 690.
  assert.deepEqual(fit({ name: 60, location: 150, folder: 400, branch: 140, status: 59 }),
    { name: 60, location: 150, folder: 400, branch: 140, status: 59 });
});

test("however little room there is, no column is narrower than its head, the status keeps what its words need, and a long name keeps 200px", () => {
  const heads = { location: 50, folder: 50, branch: 50, status: 39 };
  assert.deepEqual(fit({ name: 900, location: 200, folder: 200, branch: 200, status: 54 }, { heads, listWidth: 500 }),
    { name: 200, location: 50, folder: 50, branch: 50, status: 54 });
});

// Nothing dragged, these needs fit as { location: 150, folder: 220, branch: 140, status: 54 }
// and leave the name its 300.
const TIGHT = { name: 300, location: 150, folder: 250, branch: 140, status: 54 };

test("a dragged column is drawn at its dragged width, and the name gives or takes the difference: the other columns stay as they were", () => {
  assert.deepEqual(columns(fit(TIGHT)), { location: 150, folder: 220, branch: 140, status: 54 });
  assert.deepEqual(columns(fit(TIGHT, { kept: { location: 250 } })), { location: 250, folder: 220, branch: 140, status: 54 });
  assert.deepEqual(columns(fit(TIGHT, { kept: { location: 80 } })), { location: 80, folder: 220, branch: 140, status: 54 });
  assert.equal(fit(TIGHT, { kept: { status: 120 } }).status, 120);
});

test("once the name is down to its 200px, the columns that weren't dragged give way to a dragged one", () => {
  // Location at 300 leaves the name 150 of the 864; the folder gives the missing 50.
  assert.deepEqual(fit(TIGHT, { kept: { location: 300 } }), { name: 200, location: 300, folder: 170, branch: 140, status: 54 });
});

test("dragged widths hold as far as the row allows: the name keeps its 200px and every column its head, the dragged ones giving way last", () => {
  const widths = fit(TIGHT, { kept: { location: 400, folder: 520 } });
  assert.deepEqual(widths, { name: 200, location: 400, folder: 164, branch: 46, status: 54 });
  assert.equal(864 - taken(widths), 200);
});

test("a column dragged narrower than its head is drawn as wide as its head", () => {
  assert.equal(fit(TIGHT, { kept: { location: 20 } }).location, HEADS.location);
});

// ── dragging and keeping ─────────────────────────────────────────────────

test("dragging a column's left edge left widens it by as much, right narrows it", () => {
  assert.equal(dragWidth(200, -3, 1, 43), 203);
  assert.equal(dragWidth(200, 3, 1, 43), 197);
});

test("on a dialog drawn larger than its design, a drag moves the kept width by that much less, so the edge stays under the pointer", () => {
  assert.equal(dragWidth(200, -40, 2, 43), 220);
  assert.equal(dragWidth(200, 40, 2, 43), 180);
  assert.equal(dragWidth(200, -30, 1.5, 43), 220);
  assert.equal(dragWidth(200, -10, 0.5, 43), 220);
});

test("a drag stops at the column's head and at the widest a column may be", () => {
  assert.equal(dragWidth(200, 10000, 1, 43), 43);
  assert.equal(dragWidth(200, -10000, 1, 43), MAX_WIDTH);
});

test("kept widths: only a column that was dragged has one; a broken one is dropped, one too wide is pulled in", () => {
  assert.deepEqual(loadKept({ folder: 300, branch: "wide", status: MAX_WIDTH + 500, location: null, name: 240 }),
    { folder: 300, status: MAX_WIDTH });
  assert.deepEqual(loadKept({ location: -5, folder: 0, branch: 112.6 }), { branch: 113 });
  assert.deepEqual(loadKept(null), {});
  assert.deepEqual(loadKept([300]), {});
});
