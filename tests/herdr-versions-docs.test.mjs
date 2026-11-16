// Contract: the docs a person reads before installing name the Herdr version
// the Done when list was last walked through on by hand, and it is BY_HAND,
// the one place that version is written. RECIPE.md names FLOOR, the oldest
// version CI checks. Changing either constant without the docs, or a doc
// without the constant, turns this red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BY_HAND, FLOOR } from "../site/herdr-versions.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Every doc that repeats the by-hand version, with the words that mark its
// by-hand sentence in that doc's language. Add a doc here when it starts
// naming the version.
const BY_HAND_DOCS = [
  { path: "README.md", marker: "walked through by hand" },
  { path: "README.zh-TW.md", marker: "親手逐項走過" },
  { path: "RECIPE.md", marker: "walked through by hand" },
];

const VERSION = /\d+\.\d+\.\d+/g;

// A doc's clauses: split at a sentence's or a clause's end. A version's dots
// are never followed by whitespace, so they don't split.
const clauses = (text) => text.split(/(?<=[.;])\s+|[。；\n]/);

const versionsIn = (clause) => clause.match(VERSION) ?? [];

for (const { path, marker } of BY_HAND_DOCS) {
  test(`${path} names BY_HAND as the version walked through by hand, and no other`, () => {
    const named = clauses(read(path)).filter((c) => c.includes(marker));
    assert.ok(named.some((c) => versionsIn(c).includes(BY_HAND)), `no clause with "${marker}" names ${BY_HAND} in ${path}`);
    for (const c of named) {
      assert.deepEqual(versionsIn(c).filter((v) => v !== BY_HAND), [], `in ${path}: ${c}`);
    }
  });
}

test("RECIPE.md names FLOOR as the oldest Herdr version CI checks", () => {
  const named = clauses(read("RECIPE.md")).filter((c) => c.includes("five latest Herdr releases"));
  assert.deepEqual(named.map(versionsIn), [[FLOOR]]);
});
