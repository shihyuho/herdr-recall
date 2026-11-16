// Contract: CI checks Recall on the Herdr versions pickVersions returns, and
// nothing else. The versions job feeds it the lines of
// `git ls-remote --tags` from herdrdev/herdr-app and the version in
// releases.herdr.dev's latest.json; each version it returns becomes one
// macOS check leg. A wrong pick checks a version nobody can download, skips
// one people use, or runs past the cap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickVersions } from "../site/herdr-versions.js";

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
