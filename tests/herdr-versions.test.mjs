// Contract: CI checks Recall on the Herdr versions pickVersions returns, and
// nothing else. The versions job feeds it the lines of
// `git ls-remote --tags` from herdrdev/herdr-app and the version in
// releases.herdr.dev's latest.json; each version it returns becomes one
// macOS check leg. A wrong pick checks a version nobody can download, skips
// one people use, or runs past the cap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { badge, pickVersions, report } from "../site/herdr-versions.js";

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
// in whatever order the artifacts download; extra fields stay out.
const leg = (version, check, seconds) => ({ version, check, seconds, broken: "fails on the misspelt call", recall_exit: "0", broken_exit: "1" });
const meta = { byHand: "0.1.15", run: "https://github.com/shihyuho/herdr-recall/actions/runs/7", at: "2026-11-16T03:21:02Z" };

test("the results document names the range, oldest to newest, and lists versions newest first", () => {
  const results = [leg("0.1.9", "pass", 2), leg("0.1.12", "fail", 3), leg("0.1.10", "unknown", null), leg("0.1.11", "pass", 1)];
  assert.deepEqual(report(results, meta), {
    range: "0.1.9 – 0.1.12",
    by_hand: "0.1.15",
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
  assert.deepEqual(report([], meta), { range: null, by_hand: "0.1.15", run: meta.run, checked_at: meta.at, versions: [] });
});

// Contract: badge() is the shields.io endpoint document the README's Herdr
// badge reads. The reader acts on its message and color: which versions are
// covered, and which to stay off.
const doc = (...versions) => report(versions.map(([v, check]) => leg(v, check, 1)), meta);

test("badge: every version passing shows the range in Herdr's red", () => {
  assert.deepEqual(badge(doc(["0.1.16", "pass"], ["0.1.12", "pass"], ["0.1.14", "pass"])), {
    schemaVersion: 1, label: "Herdr mod", message: "0.1.12 – 0.1.16", color: "df372b",
  });
});

test("badge: a failing version is named, newest first, and the badge turns orange", () => {
  assert.deepEqual(badge(doc(["0.1.12", "fail"], ["0.1.16", "fail"], ["0.1.14", "pass"])), {
    schemaVersion: 1, label: "Herdr mod", message: "0.1.12 – 0.1.16 · fails on 0.1.16, 0.1.12", color: "orange",
  });
});

test("badge: an unchecked version beside passes is named, and the badge turns grey", () => {
  assert.deepEqual(badge(doc(["0.1.16", "unknown"], ["0.1.12", "pass"])), {
    schemaVersion: 1, label: "Herdr mod", message: "0.1.12 – 0.1.16 · 0.1.16 not checked", color: "lightgrey",
  });
});

test("badge: a failure outranks an unchecked version, and both are named", () => {
  assert.deepEqual(badge(doc(["0.1.16", "unknown"], ["0.1.14", "fail"], ["0.1.12", "pass"])), {
    schemaVersion: 1, label: "Herdr mod", message: "0.1.12 – 0.1.16 · fails on 0.1.14 · 0.1.16 not checked", color: "orange",
  });
});

test("badge: no version checked reads not checked, in grey", () => {
  assert.deepEqual(badge(doc()), { schemaVersion: 1, label: "Herdr mod", message: "not checked", color: "lightgrey" });
});
