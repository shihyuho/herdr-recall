// Contract: a linked worktree's space reads "<repo> ⎇ <branch>" and sits
// under its main checkout's space.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRevParse, resolveWorktrees } from "../mods/recall/lib/worktrees.js";
import { buildItems } from "../mods/recall/lib/items.js";
import { world } from "./fixtures.mjs";

test("rev-parse output reads as toplevel and common dir", () => {
  assert.deepEqual(parseRevParse("/r/shed\n/r/shed/.git\n"), { toplevel: "/r/shed", common: "/r/shed/.git" });
  assert.equal(parseRevParse("fatal: not a git repository\n"), null);
});

test("a linked worktree points at the space of its main checkout", () => {
  const map = resolveWorktrees([
    { id: "main", name: "shed", branch: "main", toplevel: "/r/shed", common: "/r/shed/.git" },
    { id: "wt", name: "feat", branch: "feat", toplevel: "/h/.herdr/worktrees/shed/feat", common: "/r/shed/.git" },
    { id: "lone", name: "x", branch: "fix", toplevel: "/h/wt/lib-fix", common: "/r/lib/.git" },
  ]);
  assert.deepEqual(map.get("main"), { linked: false, main: null, repo: "shed", branch: "main" });
  assert.deepEqual(map.get("wt"), { linked: true, main: "main", repo: "shed", branch: "feat" });
  assert.deepEqual(map.get("lone"), { linked: true, main: null, repo: "lib", branch: "fix" });
});

test("spaces list a worktree as repo ⎇ branch, found by the repo name", () => {
  const snap = world();
  snap.worktrees = new Map([
    ["sp1", { linked: false, main: null, repo: "web", branch: "main" }],
    ["sp2", { linked: true, main: "sp1", repo: "web", branch: "feat" }],
  ]);
  const items = buildItems("spaces", snap);
  assert.deepEqual(items.map((i) => [i.title, Boolean(i.nested)]), [["web", false], ["web ⎇ feat", true]]);
});
