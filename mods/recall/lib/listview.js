// What the navigator shows for one category: the seam every list rule is
// tested through. Pure: no gpui, no Herdr runtime, so `node --test` drives
// it with fixture snapshots.
//
//   listView(category, snap, query, options) → { rows, total, selected, label }
//
// - category: a category id: "all" (every space, tab, pane and agent),
//   "spaces", "tabs", "panes", "agents" or "clues" (the clue search).
// - snap: a Herdr snapshot as items.js reads it, focus history included
//   ({ spaces, panes, agents, terminals, focused, history, home, worktrees }).
// - query: what the person typed, as typed.
// - options.agentSort: Agents' order, "mru" | "priority" | "grouped".
// - options.clueData: the clues read so far for Clues
//   ({ others, content, procs, listeners }, see clues.js).
//
// - rows: [{ item, hits }] in display order; `hits[fieldKey]` lists the
//   highlighted code points of that field. All's items carry `crumb`, the
//   path drawn before the name (`space › tab › `, `space › `, or "" for a
//   space); it begins with the `where` field, so `hits.where` lights up
//   inside it.
// - total: how many rows the category lists with nothing typed, or null
//   when it shows no total (Clues).
// - selected: the index of the row to select when the list opens (0 when
//   there are no rows).
// - label: the clue-type chip to show beside the query, or null.
//
// The navigator renders this and keeps only its own UI state (moving the
// selection, re-aiming until the person moves, scrolling). Rules about
// which rows a list has, their order while typing, the selection and the
// query syntax belong here, behind this same signature: a new category
// is a new id, a synthetic row (such as one offering another search) is a
// row with its own item kind and actions.

import { buildItems } from "./items.js";
import { search } from "./fuzzy.js";
import { buildClues } from "./clues.js";

/** The row to open on: the first that isn't where you are now and isn't a clue's reason; row 0 while a query is typed. */
function openingRow(rows, query) {
  if (query) return 0;
  const first = rows.findIndex((r) => !r.item.current && r.item.kind !== "hint");
  return first < 0 ? 0 : first;
}

const NO_CLUES = { others: new Map(), content: new Map(), procs: null, listeners: null };

export function listView(category, snap, query, options = {}) {
  if (category === "clues") {
    const { rows, label } = buildClues(snap, options.clueData ?? NO_CLUES, query);
    return { rows, total: null, selected: openingRow(rows, query), label };
  }
  const items = buildItems(category, snap, { agentSort: options.agentSort });
  const rows = search(items, query, (i) => i.fields);
  return { rows, total: items.length, selected: openingRow(rows, query), label: null };
}
