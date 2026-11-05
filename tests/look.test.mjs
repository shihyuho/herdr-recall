// Contract: how large the dialog is drawn against its design, and in which
// font: Herdr's interface text size unless recall.json asks for another.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickFont, textScale } from "../mods/recall/lib/look.js";

test("no size asked for: the dialog follows Herdr's interface text size, as designed at 13px", () => {
  assert.equal(textScale(null, 13), 1);
  assert.equal(textScale(null, 19.5), 1.5);
  assert.equal(textScale(null, 26), 2);
});

test("a size asked for wins over Herdr's", () => {
  assert.equal(textScale(19.5, 13), 1.5);
  assert.equal(textScale(26, 39), 2);
  assert.equal(textScale(13, 26), 1);
});

test("the dialog is never drawn below half or above three times its design, the range of Herdr's zoom", () => {
  assert.equal(textScale(4, 13), 0.5);
  assert.equal(textScale(200, 13), 3);
  assert.equal(textScale(null, 1), 0.5);
  assert.equal(textScale(null, 100), 3);
});

test("when Herdr reports no usable interface text size, the dialog is drawn as designed", () => {
  assert.equal(textScale(null, undefined), 1);
  assert.equal(textScale(null, "26"), 1);
  assert.equal(textScale(null, 0), 1);
  assert.equal(textScale(null, NaN), 1);
});

test("a font this machine has is used, spelled as the machine spells it; one it lacks is not", () => {
  const installed = ["Geist", "JetBrains Mono", "Menlo"];
  assert.equal(pickFont("Menlo", installed), "Menlo");
  assert.equal(pickFont("jetbrains mono", installed), "JetBrains Mono");
  assert.equal(pickFont("Comic Neue", installed), null);
  assert.equal(pickFont(null, installed), null);
  assert.equal(pickFont("Menlo", undefined), null);
});
