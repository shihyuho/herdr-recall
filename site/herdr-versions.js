// Which Herdr versions CI checks Recall on. Pure, and shared: the check
// workflow imports it with Node, and the page can import it in the browser.

// The oldest Herdr CI checks: before it, `herdr-app check` crashed on mods
// with scrolling lists. Raise it only when Recall starts using
// something a newer Herdr added. The only place the floor is written.
export const FLOOR = "0.1.10";

// How many of the latest releases CI checks. The free plan runs five macOS
// jobs at a time: five versions take as long as one. The only place the
// count is written; the docs test names every doc that says it in words.
export const COUNT = 5;

// COUNT as the site writes it.
const IN_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const LATEST = `${IN_WORDS[COUNT] ?? COUNT} latest`;

// The Herdr version RECIPE.md's Done when list was last walked through on by
// hand, in the running app. Change it only after walking the list again; the
// docs test names every place that repeats it. The only place it is written.
export const BY_HAND = "0.1.15";

const TAG = /^refs\/tags\/v(\d+\.\d+\.\d+)$/;

const parse = (version) => version.split(".").map(Number);

const compare = (a, b) => {
  const [x, y] = [parse(a), parse(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

// The versions to check, newest first, from the lines (or refs) that
// `git ls-remote --tags` prints.
export function pickVersions(tags, { floor, latest, count }) {
  return tags
    .map((line) => TAG.exec(line.trim().split(/\s+/).pop())?.[1])
    .filter(Boolean)
    // A tag can exist before its build is downloadable.
    .filter((v) => compare(v, latest) <= 0)
    .filter((v) => compare(v, floor) >= 0)
    .sort((a, b) => compare(b, a))
    .slice(0, count);
}

// The results document, published as herdr.json beside the page: each check
// leg's result (extra fields dropped), newest first, and the range they span.
// Its by_hand is BY_HAND, as the site's by-hand line is.
export function report(results, { run, at }) {
  const versions = results
    .map(({ version, check, seconds }) => ({ version, check, seconds: seconds ?? null }))
    .sort((a, b) => compare(b.version, a.version));
  return { range: span(versions), by_hand: BY_HAND, run, checked_at: at, versions };
}

// The oldest and the newest of versions listed newest first, joined by a
// spaced en dash; one version alone; none is no range.
function span(versions) {
  const newest = versions[0]?.version;
  const oldest = versions.at(-1)?.version;
  return !newest ? null : newest === oldest ? newest : `${oldest} – ${newest}`;
}

// Herdr's red, as on every other badge of Recall's.
const HERDR_RED = "df372b";

const CHECK = { code: "herdr-app check" };

// Each result a check leg records, as every reader shows it: the site's
// mark and words, the run summary's mark, and what the README badge says of
// the versions with it and the color it turns (a pass says nothing). The
// badge names them in this order, and the first that has versions colors it.
export const CHECKS = {
  pass: {
    mark: "✓", says: ["loads and draws in ", CHECK], summary: "✅ pass",
    badge: null,
  },
  fail: {
    mark: "✗", says: ["fails in ", CHECK], summary: "❌ fail",
    badge: { says: (versions) => `fails on ${versions}`, color: "orange" },
  },
  unknown: {
    mark: "–", says: ["not checked this run"], summary: "⚠️ unknown",
    badge: { says: (versions) => `${versions} not checked`, color: "lightgrey" },
  },
};

// A result's key in CHECKS: one this code doesn't know is unknown.
export const checkOf = (check) => (Object.hasOwn(CHECKS, check) ? check : "unknown");

// The shields.io endpoint document for the README's Herdr badge.
export function badge({ range, versions }) {
  const doc = (message, color) => ({ schemaVersion: 1, label: "Herdr mod", message, color });
  if (versions.length === 0) return doc("not checked", "lightgrey");
  const versionsWith = (check) => versions.filter((v) => checkOf(v.check) === check).map((v) => v.version);
  const named = Object.entries(CHECKS)
    .filter(([, c]) => c.badge)
    .map(([check, c]) => ({ ...c.badge, versions: versionsWith(check) }))
    .filter((n) => n.versions.length);
  const message = [range, ...named.map((n) => n.says(n.versions.join(", ")))].join(" · ");
  return doc(message, named[0]?.color ?? HERDR_RED);
}

// The site's text about the Herdr versions CI checks, from the results
// document, or from nothing (`null`) when herdr.json isn't there. Each piece
// is a list of parts: plain strings, and { b }, { code } or { a, href } for
// bold, code and links, so the page builds it without parsing HTML.
export function describe(results) {
  const rows = (Array.isArray(results?.versions) ? results.versions : [])
    .map(({ version, check }) => ({ version, check: checkOf(check) }))
    .sort((a, b) => compare(b.version, a.version))
    .map((row) => ({ ...row, mark: CHECKS[row.check].mark, says: CHECKS[row.check].says }));
  // From the rows, so a stale range beside no versions names nothing.
  const range = span(rows);
  const whichLink = { a: "which", href: "#herdr-versions" };
  return {
    hero: range
      ? ["Checked on Herdr ", { b: range }, " · ", whichLink]
      : [`Checked on the ${LATEST} Herdr releases · `, whichLink],
    note: [
      "CI runs ", CHECK, ` on the ${LATEST} releases`,
      ...(results?.run ? [" · ", { a: "latest run", href: results.run }] : []),
    ],
    rows,
    byHand: [
      "Last walked through by hand on ", { b: BY_HAND }, ": every item of RECIPE.md's ",
      { a: "Done when", href: "https://github.com/shihyuho/herdr-recall/blob/main/RECIPE.md#done-when" },
      " list, in the running app.",
    ],
  };
}
