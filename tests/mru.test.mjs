// Contract: the recency history the tracker keeps and the navigator and
// quick-focus commands read back.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as mru from "../mods/recall/lib/mru.js";

const focus = (space, tab, pane, agent = null) => ({ space, tab, pane, agent });

test("each focus moves its space, tab, pane and agent to the front", () => {
  let h = mru.empty();
  h = mru.record(h, focus("s1", "t1", "p1", "a1"), 1);
  h = mru.record(h, focus("s2", "t2", "p2"), 2);
  h = mru.record(h, focus("s1", "t1", "p1", "a1"), 3);
  assert.deepEqual(h.tab.map((e) => e.id), ["t1", "t2"]);
  assert.deepEqual(h.pane.map((e) => [e.id, e.at]), [["p1", 3], ["p2", 2]]);
  assert.deepEqual(h.agent.map((e) => e.id), ["a1"]);
  assert.deepEqual(h.space.map((e) => e.id), ["s1", "s2"]);
});

test("re-recording where you already are changes nothing (no write)", () => {
  const h = mru.record(mru.empty(), focus("s1", "t1", "p1"), 1);
  assert.equal(mru.record(h, focus("s1", "t1", "p1"), 2), h);
});

test("history keeps at most LIMIT entries per kind", () => {
  let h = mru.empty();
  for (let i = 0; i < mru.LIMIT + 5; i++) h = mru.record(h, focus("s", `t${i}`, `p${i}`), i);
  assert.equal(h.tab.length, mru.LIMIT);
  assert.equal(h.tab[0].id, `t${mru.LIMIT + 4}`);
});

test("a stored history that is broken loads empty", () => {
  assert.deepEqual(mru.load({ v: 99, tab: [{ id: "x", at: 1 }] }), mru.empty());
  assert.deepEqual(mru.load({ v: 1, tab: [{ id: "x", at: 1 }, { id: 3 }] }).tab, [{ id: "x", at: 1 }]);
});

test("order: recent first, never-focused after in their given order", () => {
  let h = mru.empty();
  h = mru.record(h, focus("s", "b", null), 1);
  h = mru.record(h, focus("s", "d", null), 2);
  const sorted = mru.order(h, "tab", ["a", "b", "c", "d"], (x) => x);
  assert.deepEqual(sorted, ["d", "b", "a", "c"]);
});

test("previous skips where you are and ids that no longer exist", () => {
  let h = mru.empty();
  for (const [t, at] of [["t1", 1], ["gone", 2], ["t3", 3]]) h = mru.record(h, focus("s", t, null), at);
  const e = mru.previous(h, "tab", { current: "t3", live: new Set(["t1", "t3"]) });
  assert.equal(e.id, "t1");
  assert.equal(mru.previous(h, "tab", { current: "t3", live: new Set(["t3"]) }), null);
});
