// Contract: how wide Recall takes a text to be. Herdr gives a mod no way to
// measure one, so the width is worked out from the characters: never
// narrower than Herdr draws it, which would cut it, and little wider.
import { test } from "node:test";
import assert from "node:assert/strict";
import { metricsFor, textWidth } from "../mods/recall/lib/textwidth.js";

// What Herdr 0.1.13 drew, in px, for [text, text size] in Geist at zoom 1:
// each text in a box sized to it, read off a screenshot (2026-11-05).
const DRAWN = [
  ["~/code/github.com/shihyuho/herdr-recall", 12, 228],
  ["~/code/worktrees/agent-skills/feat/561-draft-prd", 12, 274],
  ["~/code/github.com/softleader/powerrangers", 12, 247],
  ["feat/561-draft-prd", 12, 101],
  ["main", 12, 27],
  ["payments-api › refunds", 12, 128],
  ["agent-skills ⎇ main › Slack 討論串 params", 13, 253],
  ["herdr-recall › 目前字體大小 › 目前字體大小", 13, 247],
  ["powerrangers › powerrangers › zsh", 13, 206],
  ["Plan the Redis upgrade", 13, 139],
  ["needs you", 11.5, 54],
  ["finished", 11.5, 42],
  ["LOCATION", 10.5, 51],
  ["CONTENTS", 10.5, 54],
  ["FOLDER", 10.5, 41],
  ["BRANCH", 10.5, 44],
  ["STATUS", 10.5, 37],
  ["abcdefghijklmnopqrstuvwxyz", 12, 161],
  ["ABCDEFGHIJKLMNOPQRSTUVWXYZ", 12, 202],
  ["0123456789", 12, 69],
];

test("in Herdr's interface font, a text is taken no narrower than Herdr draws it and at most a tenth and 2px wider", () => {
  const geist = metricsFor("Geist");
  for (const [text, size, drawn] of DRAWN) {
    const width = textWidth(text, size, geist);
    assert.ok(width >= drawn, `"${text}" at ${size}px is drawn ${drawn}px wide, taken as ${width}px: it would be cut`);
    assert.ok(width <= drawn * 1.1 + 2, `"${text}" at ${size}px is drawn ${drawn}px wide, taken as ${width}px: too much room`);
  }
});

test("no text takes no room", () => {
  assert.equal(textWidth("", 12, metricsFor("Geist")), 0);
  assert.equal(textWidth(undefined, 12, metricsFor("Geist")), 0);
});

test("in a font Recall has no measures for, a letter is taken no narrower than a fixed-width font's 0.6 of the text size, a CJK character as wide as the text size", () => {
  const other = metricsFor("JetBrains Mono");
  assert.ok(textWidth("main", 12, other) >= 4 * 0.6 * 12);
  assert.ok(textWidth("iiii", 12, other) >= 4 * 0.6 * 12);
  assert.ok(textWidth("字體", 12, other) >= 2 * 12);
});

test("Herdr's interface font is known by its name, whatever its case; no name means Herdr's own", () => {
  const narrow = textWidth("iiii", 12, metricsFor("Geist"));
  assert.equal(textWidth("iiii", 12, metricsFor("geist")), narrow);
  assert.equal(textWidth("iiii", 12, metricsFor(undefined)), narrow);
  assert.ok(narrow < textWidth("iiii", 12, metricsFor("JetBrains Mono")));
});
