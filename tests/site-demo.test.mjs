// Contract: the landing page's demo shows what its copy promises. Each "Try
// it" button on site/index.html names a category and a query; these are the
// rows a visitor sees for them, from site/world.js run through the mod's
// own listView. A change to lib/ or to the demo world that breaks a promise
// the page makes turns one of these red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { listView } from "../mods/recall/lib/listview.js";
import { createWorld, focusPane } from "../site/world.js";

const titles = (view) => view.rows.map((r) => r.item.title);
const selectedTitle = (view) => view.rows[view.selected]?.item.title;

test("Agents opens on the agent before the one you're in, so Enter goes back", () => {
  const { snap, clueData } = createWorld();
  const view = listView("agents", snap, "", { clueData });
  assert.equal(selectedTitle(view), "Plan the Redis upgrade");
});

test("after going there, Agents opens on where you came from", () => {
  const { snap, clueData } = createWorld();
  const there = focusPane(snap, "p-plan", 5000);
  const view = listView("agents", there, "", { clueData });
  assert.equal(selectedTitle(view), "Fix cart rounding");
});

test("Priority puts the agent that needs you first", () => {
  const { snap, clueData } = createWorld();
  const view = listView("agents", snap, "", { clueData, agentSort: "priority" });
  assert.equal(titles(view)[0], "Add partial refunds");
  assert.equal(view.rows[0].item.status, "blocked");
});

test("red puts the unbroken match above the scattered ones, each in recent order", () => {
  const { snap, clueData } = createWorld();
  const view = listView("agents", snap, "red", { clueData });
  assert.deepEqual(titles(view), [
    "Plan the Redis upgrade",
    "Retry failed webhooks",
    "Document the refunds API",
    "Add partial refunds",
  ]);
  assert.equal(view.total, 5);
});

test("port 5173 finds the pane that started the dev server", () => {
  const { snap, clueData } = createWorld();
  const view = listView("clues", snap, "port 5173", { clueData });
  assert.deepEqual(view.rows.map((r) => [r.item.clue, r.item.where]), [["port", "storefront › dev-server"]]);
});

test("^pay on All keeps only what lives in payments-api", () => {
  const { snap, clueData } = createWorld();
  const view = listView("all", snap, "^pay", { clueData });
  assert.deepEqual(view.rows.map((r) => `${r.item.crumb}${r.item.title}`), [
    "payments-api › webhooks › Retry failed webhooks",
    "payments-api › refunds › Add partial refunds",
    "payments-api › refunds › nvim ledger.go",
    "payments-api › refunds",
    "payments-api",
  ]);
});
