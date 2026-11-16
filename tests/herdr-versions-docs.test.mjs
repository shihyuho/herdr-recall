// Contract: the docs a person reads before installing name the Herdr version
// the Done when list was last walked through on by hand, and it is BY_HAND,
// the one place that version is written. The site's static HTML says what
// describe(null) says, so a visitor reads the same with no herdr.json.
// RECIPE.md names FLOOR, the oldest version CI checks, and every doc that
// says how many releases CI checks says COUNT. Changing a constant without
// the docs, or a doc without the constant, turns this red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BY_HAND, COUNT, FLOOR, describe } from "../site/herdr-versions.js";
import { IN_WORDS, links, text, versionsIn } from "./herdr-parts.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Every doc that repeats the by-hand version, with the words that mark its
// by-hand sentence in that doc's language. Add a doc here when it starts
// naming the version.
const BY_HAND_DOCS = [
  { path: "README.md", marker: "walked through by hand" },
  { path: "README.zh-TW.md", marker: "親手逐項走過" },
  { path: "RECIPE.md", marker: "walked through by hand" },
  { path: "site/index.html", marker: "walked through by hand" },
];

// A doc's clauses: split at a sentence's or a clause's end. A version's dots
// are never followed by whitespace, so they don't split.
const clauses = (doc) => doc.split(/(?<=[.;])\s+|[。；\n]/);

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
  const named = clauses(read("RECIPE.md")).filter((c) => c.includes(`${IN_WORDS.en[COUNT]} latest Herdr releases`));
  assert.deepEqual(named.map(versionsIn), [[FLOOR]]);
});

// Every doc that says how many of the latest releases CI checks, with the
// phrase that says it in that doc's language; its group is the count.
const EN_COUNT = /(\S+) latest (?:Herdr )?releases/g;
const COUNT_DOCS = [
  { path: "README.md", lang: "en", phrase: EN_COUNT },
  { path: "README.zh-TW.md", lang: "zh-TW", phrase: /最新的(\S)個版本/g },
  { path: "RECIPE.md", lang: "en", phrase: EN_COUNT },
  { path: "site/index.html", lang: "en", phrase: EN_COUNT },
];

for (const { path, lang, phrase } of COUNT_DOCS) {
  test(`${path} says CI checks the ${IN_WORDS.en[COUNT]} latest releases, COUNT in words`, () => {
    const counts = [...read(path).matchAll(phrase)].map((m) => m[1]);
    assert.notDeepEqual(counts, [], `${path} doesn't say how many releases CI checks`);
    assert.deepEqual(counts, counts.map(() => IN_WORDS[lang][COUNT]), `in ${path}`);
  });
}

// The site's static HTML: each piece describe() fills is the element marked
// data-herdr="<piece>". Read as a visitor reads it: its text, and its links.
const html = () => read("site/index.html");
const piece = (name) => {
  const m = new RegExp(`<(\\w+)[^>]*\\bdata-herdr="${name}"[^>]*>([\\s\\S]*?)</\\1>`).exec(html());
  assert.ok(m, `site/index.html has no element with data-herdr="${name}"`);
  return m[2];
};
const ENTITY = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" };
const visible = (h) => h.replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ENTITY[e]).replace(/\s+/g, " ").trim();
const anchors = (h) => [...h.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, href, t]) => [visible(t), href]);

const fallback = describe(null);
for (const [name, parts] of [["hero", fallback.hero], ["note", fallback.note], ["by-hand", fallback.byHand]]) {
  test(`site/index.html's ${name} says what describe(null) says, with the same links`, () => {
    assert.equal(visible(piece(name)), text(parts));
    assert.deepEqual(anchors(piece(name)), links(parts));
  });
}

test("site/index.html lists no version rows without herdr.json, and the hero's link has a target", () => {
  assert.equal(visible(piece("rows")), "");
  assert.equal(html().match(/\bid="herdr-versions"/g)?.length, 1);
});
