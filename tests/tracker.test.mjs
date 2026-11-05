// Contract: the window Recall asks Herdr for to run its tracker in. It lies
// over the layout, so it must stay out of the pointer's way, and one Herdr
// kept from an earlier version must be told apart from one opened now.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isCurrentTracker, trackerWindow } from "../mods/recall/lib/tracker.js";

test("the tracker's window is a few px a side: Herdr reads a size of 1 or less as a share of its own window, which would lay it over everything", () => {
  const { kind, width, height } = trackerWindow("recall");
  assert.equal(kind, "window");
  for (const [side, px] of [["width", width], ["height", height]]) {
    assert.ok(px > 1, `${side} ${px} is a share of Herdr's window, not px`);
    assert.ok(px <= 4, `${side} ${px}px takes that much of the layout from the pointer`);
  }
});

test("a tracker kept from before it carried its size is not today's; one opened now is", () => {
  assert.equal(isCurrentTracker({ role: "tracker", overlay: "ov1" }), false);
  assert.equal(isCurrentTracker({ ...trackerWindow("recall").props, overlay: "ov2" }), true);
});

test("a tracker kept at another size is not today's", () => {
  assert.equal(isCurrentTracker({ role: "tracker", size: 1, overlay: "ov3" }), false);
});
