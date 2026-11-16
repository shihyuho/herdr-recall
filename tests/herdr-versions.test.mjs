// Contract: CI checks Recall on the Herdr versions pickVersions returns, and
// nothing else. The versions job feeds it the lines of
// `git ls-remote --tags` from herdrdev/herdr-app and the version in
// releases.herdr.dev's latest.json; each version it returns becomes one
// macOS check leg. A wrong pick checks a version nobody can download, skips
// one people use, or runs past the cap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BY_HAND, COUNT, badge, describe, pickVersions, report } from "../site/herdr-versions.js";
import { IN_WORDS, links, text, versionsIn } from "./herdr-parts.mjs";

// What `git ls-remote --tags` prints: "<sha>\t<ref>", annotated tags twice.
const lsRemote = (...refs) => refs.map((ref, i) => `${String(i).padStart(40, "0")}\t${ref}`);

test("versions go newest first by number, so 0.1.10 is newer than 0.1.9", () => {
  const tags = lsRemote("refs/tags/v0.1.9", "refs/tags/v0.1.10", "refs/tags/v0.1.8", "refs/tags/v0.2.0", "refs/tags/v1.0.0");
  assert.deepEqual(pickVersions(tags, { floor: "0.0.1", latest: "1.0.0", count: 10 }), ["1.0.0", "0.2.0", "0.1.10", "0.1.9", "0.1.8"]);
});

test("only vX.Y.Z tags count: other refs and peeled ^{} refs are left out", () => {
  const tags = lsRemote(
    "refs/tags/v0.1.15",
    "refs/tags/v0.1.15^{}",
    "refs/tags/v0.1.16-rc.1",
    "refs/tags/0.1.14",
    "refs/tags/nightly",
    "refs/tags/v0.1",
    "refs/tags/v0.1.13",
    "refs/tags/v0.1.12^{}",
    "refs/heads/v0.1.11",
  );
  assert.deepEqual(pickVersions(tags, { floor: "0.0.1", latest: "9.9.9", count: 10 }), ["0.1.15", "0.1.13"]);
});

test("a tag newer than latest.json's version is left out, since its build isn't downloadable yet", () => {
  const tags = lsRemote("refs/tags/v0.1.17", "refs/tags/v0.1.16", "refs/tags/v0.2.0", "refs/tags/v0.1.15");
  assert.deepEqual(pickVersions(tags, { floor: "0.0.1", latest: "0.1.16", count: 10 }), ["0.1.16", "0.1.15"]);
});

test("a tag older than the floor is left out, and the floor itself is checked", () => {
  const tags = lsRemote("refs/tags/v0.1.11", "refs/tags/v0.1.12", "refs/tags/v0.1.13", "refs/tags/v0.0.20");
  assert.deepEqual(pickVersions(tags, { floor: "0.1.12", latest: "0.1.16", count: 10 }), ["0.1.13", "0.1.12"]);
});

// Herdr's tags as of 0.1.16, unordered as ls-remote may give them.
const herdrTags = lsRemote(
  ...["0.1.3", "0.1.12", "0.1.8", "0.1.16", "0.1.10", "0.1.9", "0.1.14", "0.1.11", "0.1.15", "0.1.13"]
    .flatMap((v) => [`refs/tags/v${v}`, `refs/tags/v${v}^{}`]),
);

test("exactly count versions are checked, the newest ones, when more are in range", () => {
  assert.deepEqual(pickVersions(herdrTags, { floor: "0.1.8", latest: "0.1.16", count: 5 }), ["0.1.16", "0.1.15", "0.1.14", "0.1.13", "0.1.12"]);
});

test("fewer than count are checked when the floor leaves fewer", () => {
  assert.deepEqual(pickVersions(herdrTags, { floor: "0.1.14", latest: "0.1.16", count: 5 }), ["0.1.16", "0.1.15", "0.1.14"]);
});

// Contract: report() is the results document published as herdr.json, which
// the badge and the site read. Its input is the check legs' result.json files,
// in whatever order the artifacts download; extra fields stay out. Its by_hand
// is always BY_HAND, the version the site names as walked through by hand.
const leg = (version, check, seconds) => ({ version, check, seconds, broken: "fails on the misspelt call", recall_exit: "0", broken_exit: "1" });
const meta = { run: "https://github.com/shihyuho/herdr-recall/actions/runs/7", at: "2026-11-16T03:21:02Z" };

test("the results document names the range, oldest to newest, and lists versions newest first", () => {
  const results = [leg("0.1.9", "pass", 2), leg("0.1.12", "fail", 3), leg("0.1.10", "unknown", null), leg("0.1.11", "pass", 1)];
  assert.deepEqual(report(results, meta), {
    range: "0.1.9 – 0.1.12",
    by_hand: BY_HAND,
    run: "https://github.com/shihyuho/herdr-recall/actions/runs/7",
    checked_at: "2026-11-16T03:21:02Z",
    versions: [
      { version: "0.1.12", check: "fail", seconds: 3 },
      { version: "0.1.11", check: "pass", seconds: 1 },
      { version: "0.1.10", check: "unknown", seconds: null },
      { version: "0.1.9", check: "pass", seconds: 2 },
    ],
  });
});

test("one version checked is a range of that version alone, and none is no range", () => {
  assert.equal(report([leg("0.1.16", "pass", 5)], meta).range, "0.1.16");
  assert.deepEqual(report([], meta), { range: null, by_hand: BY_HAND, run: meta.run, checked_at: meta.at, versions: [] });
});

// A leg can die before it uploads its result.json; the versions job still
// listed its version, and the reader must see it as not checked, never as
// missing or passed. A leg that did upload keeps its own result.
test("a listed version whose leg uploaded no result is published as not checked", () => {
  const results = [leg("0.1.14", "pass", 4), leg("0.1.12", "fail", 3)];
  assert.deepEqual(report(results, { ...meta, expected: ["0.1.16", "0.1.14", "0.1.13", "0.1.12"] }).versions, [
    { version: "0.1.16", check: "unknown", seconds: null },
    { version: "0.1.14", check: "pass", seconds: 4 },
    { version: "0.1.13", check: "unknown", seconds: null },
    { version: "0.1.12", check: "fail", seconds: 3 },
  ]);
});

// Contract: badge() is the shields.io endpoint document the README's Herdr
// badge reads. The reader acts on its message and color: which versions are
// covered, and which to stay off.
const reportOf = (...versions) => report(versions.map(([v, check]) => leg(v, check, 1)), meta);

test("badge: every version passing shows the range in Herdr's red", () => {
  assert.deepEqual(badge(reportOf(["0.1.16", "pass"], ["0.1.12", "pass"], ["0.1.14", "pass"])), {
    schemaVersion: 1, label: "Herdr mod", message: "0.1.12 – 0.1.16", color: "df372b",
  });
});

test("badge: a failing version is named, newest first, and the badge turns orange", () => {
  assert.deepEqual(badge(reportOf(["0.1.12", "fail"], ["0.1.16", "fail"], ["0.1.14", "pass"])), {
    schemaVersion: 1, label: "Herdr mod", message: "0.1.12 – 0.1.16 · fails on 0.1.16, 0.1.12", color: "orange",
  });
});

test("badge: an unchecked version beside passes is named, and the badge turns grey", () => {
  assert.deepEqual(badge(reportOf(["0.1.16", "unknown"], ["0.1.12", "pass"])), {
    schemaVersion: 1, label: "Herdr mod", message: "0.1.12 – 0.1.16 · 0.1.16 not checked", color: "lightgrey",
  });
});

test("badge: a failure outranks an unchecked version, and both are named", () => {
  assert.deepEqual(badge(reportOf(["0.1.16", "unknown"], ["0.1.14", "fail"], ["0.1.12", "pass"])), {
    schemaVersion: 1, label: "Herdr mod", message: "0.1.12 – 0.1.16 · fails on 0.1.14 · 0.1.16 not checked", color: "orange",
  });
});

test("badge: a result it doesn't know counts as not checked, as on the site, never as a pass", () => {
  // A herdr.json from a newer or older publish may carry a check this one
  // doesn't know.
  const results = reportOf(["0.1.16", "skipped"], ["0.1.12", "pass"]);
  assert.deepEqual(badge(results), {
    schemaVersion: 1, label: "Herdr mod", message: "0.1.12 – 0.1.16 · 0.1.16 not checked", color: "lightgrey",
  });
  assert.deepEqual(describe(results).rows.map((r) => [r.version, r.check, r.mark]), [["0.1.16", "unknown", "–"], ["0.1.12", "pass", "✓"]]);
});

test("badge: no version checked reads not checked, in grey", () => {
  assert.deepEqual(badge(reportOf()), { schemaVersion: 1, label: "Herdr mod", message: "not checked", color: "lightgrey" });
});

// Contract: describe() is the site's text about Herdr versions: the hero
// line, the "Herdr versions" tier's header note, its rows and its by-hand
// line. A visitor reads it to learn whether their Herdr is covered. Each
// piece is a list of parts: plain strings, and { b }, { code } or
// { a, href } for bold, code and links; text() and links() read a piece as a
// visitor would.

test("describe: the hero line names the range checked and links to the list", () => {
  const { hero } = describe(reportOf(["0.1.16", "pass"], ["0.1.12", "pass"], ["0.1.14", "fail"]));
  assert.equal(text(hero), "Checked on Herdr 0.1.12 – 0.1.16 · which");
  assert.deepEqual(hero.filter((p) => p.b), [{ b: "0.1.12 – 0.1.16" }]);
  assert.deepEqual(links(hero), [["which", "#herdr-versions"]]);
});

test("describe: one row per version, newest first by number, marked by its result", () => {
  // herdr.json as written by hand or by an older publish, out of order.
  const results = {
    range: "0.1.9 – 0.1.12", by_hand: "0.1.15", run: meta.run, checked_at: meta.at,
    versions: [
      { version: "0.1.9", check: "pass", seconds: 2 },
      { version: "0.1.12", check: "fail", seconds: 3 },
      { version: "0.1.10", check: "unknown", seconds: null },
      { version: "0.1.11", check: "pass", seconds: 1 },
    ],
  };
  assert.deepEqual(describe(results).rows.map((r) => [r.version, r.check, r.mark, text(r.says)]), [
    ["0.1.12", "fail", "✗", "fails in herdr-app check"],
    ["0.1.11", "pass", "✓", "loads and draws in herdr-app check"],
    ["0.1.10", "unknown", "–", "not checked this run"],
    ["0.1.9", "pass", "✓", "loads and draws in herdr-app check"],
  ]);
});

test("describe: the header note says what CI runs and links to the run behind the list", () => {
  const { note } = describe(reportOf(["0.1.16", "pass"]));
  assert.equal(text(note), `CI runs herdr-app check on the ${IN_WORDS.en[COUNT]} latest releases · latest run`);
  assert.deepEqual(links(note), [["latest run", "https://github.com/shihyuho/herdr-recall/actions/runs/7"]]);
});

test("describe: the by-hand line names BY_HAND, the version the Done when list was walked through on", () => {
  // by_hand is BY_HAND in every published document; a stale one doesn't win.
  const { byHand } = describe({ ...reportOf(["0.1.16", "pass"]), by_hand: "0.1.3" });
  assert.equal(text(byHand), `Last walked through by hand on ${BY_HAND}: every item of RECIPE.md's Done when list, in the running app.`);
  assert.deepEqual(byHand.filter((p) => p.b), [{ b: BY_HAND }]);
  assert.deepEqual(links(byHand), [["Done when", "https://github.com/shihyuho/herdr-recall/blob/main/RECIPE.md#done-when"]]);
});

// What the page says with no herdr.json (no JavaScript, a local preview, a
// fork's site), and with a run that checked nothing: what CI checks, and no
// version number but the by-hand one.
const versionsOnSite = ({ hero, note, rows, byHand }) =>
  [hero, note, ...rows.map((r) => [r.version, ...r.says]), byHand].flatMap((parts) => versionsIn(text(parts)));

test("describe(null): what CI checks, with no rows and no version but the by-hand one", () => {
  const site = describe(null);
  assert.equal(text(site.hero), `Checked on the ${IN_WORDS.en[COUNT]} latest Herdr releases · which`);
  assert.deepEqual(links(site.hero), [["which", "#herdr-versions"]]);
  assert.equal(text(site.note), `CI runs herdr-app check on the ${IN_WORDS.en[COUNT]} latest releases`);
  assert.deepEqual(site.rows, []);
  assert.deepEqual(versionsOnSite(site), [BY_HAND]);
});

test("describe: a report with no versions reads like no report, whatever its range says", () => {
  const empty = { range: "0.1.12 – 0.1.16", by_hand: BY_HAND, run: meta.run, checked_at: meta.at, versions: [] };
  const site = describe(empty);
  assert.equal(text(site.hero), `Checked on the ${IN_WORDS.en[COUNT]} latest Herdr releases · which`);
  assert.deepEqual(site.rows, []);
  assert.deepEqual(versionsOnSite(site), [BY_HAND]);
  // Beside it, a report with versions does name them.
  assert.deepEqual(versionsOnSite(describe(reportOf(["0.1.16", "pass"]))), ["0.1.16", "0.1.16", BY_HAND]);
});
