// Contract: what the navigator's search shows. Observer: the person typing,
// who sees which rows stay, in what order, and which characters light up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchTerm, matchFields, segments } from "../mods/recall/lib/fuzzy.js";

test("a term that is not a subsequence matches nothing", () => {
  assert.equal(matchTerm("fix-login", "lgf"), null);
  assert.equal(matchTerm("ab", "abc"), null);
});

test("a subsequence matches and reports the characters it used", () => {
  assert.deepEqual(matchTerm("fix-login", "fl").indices, [0, 4]);
  assert.deepEqual(matchTerm("powerrangers", "rng").indices, [5, 7, 8]);
});

test("the tightest run wins over scattered letters", () => {
  // "a" and "b" also appear apart at 0 and 3; the adjacent pair at 5-6 is the match.
  assert.deepEqual(matchTerm("a_xb_ab", "ab").indices, [5, 6]);
});

test("word starts rank above letters inside a word", () => {
  assert.ok(matchTerm("fix-login", "fl").score > matchTerm("conflict", "fl").score);
});

test("lowercase ignores case, uppercase matches exactly", () => {
  assert.notEqual(matchTerm("Fix-Login", "fix"), null);
  assert.equal(matchTerm("fix-login", "Fix"), null);
  assert.deepEqual(matchTerm("Fix-Login", "FL").indices, [0, 4]);
});

test("CJK text matches by code point", () => {
  assert.deepEqual(matchTerm("過版與退版流程", "退版").indices, [3, 4]);
});

test("every term must match some field; terms may use different fields", () => {
  const fields = [
    { key: "title", text: "claude code" },
    { key: "where", text: "auth-service › 2" },
  ];
  const r = matchFields(fields, "auth claude");
  assert.deepEqual(r.hits, { where: [0, 1, 2, 3], title: [0, 1, 2, 3, 4, 5] });
  assert.equal(matchFields(fields, "auth codex"), null);
});

test("segments split text into matched and unmatched runs", () => {
  assert.deepEqual(segments("fix-login", [0, 4, 5]), [
    { text: "f", hit: true },
    { text: "ix-", hit: false },
    { text: "lo", hit: true },
    { text: "gin", hit: false },
  ]);
  assert.deepEqual(segments("abc", []), [{ text: "abc", hit: false }]);
});
