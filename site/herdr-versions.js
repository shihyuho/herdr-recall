// Which Herdr versions CI checks Recall on. Pure, and shared: the check
// workflow imports it with Node, and the page can import it in the browser.

// The oldest Herdr CI checks: before it, `herdr-app check` crashed on mods
// with scrolling lists. Raise it only when Recall starts using
// something a newer Herdr added. The only place the floor is written.
export const FLOOR = "0.1.10";

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
export function report(results, { byHand, run, at }) {
  const versions = results
    .map(({ version, check, seconds }) => ({ version, check, seconds: seconds ?? null }))
    .sort((a, b) => compare(b.version, a.version));
  const newest = versions[0]?.version;
  const oldest = versions.at(-1)?.version;
  const range = !newest ? null : newest === oldest ? newest : `${oldest} – ${newest}`;
  return { range, by_hand: byHand, run, checked_at: at, versions };
}

// Herdr's red, as on every other badge of Recall's.
const HERDR_RED = "df372b";

// The shields.io endpoint document for the README's Herdr badge.
export function badge({ range, versions }) {
  const doc = (message, color) => ({ schemaVersion: 1, label: "Herdr mod", message, color });
  if (versions.length === 0) return doc("not checked", "lightgrey");
  const on = (check) => versions.filter((v) => v.check === check).map((v) => v.version);
  const [fails, unchecked] = [on("fail"), on("unknown")];
  const message = [
    range,
    ...(fails.length ? [`fails on ${fails.join(", ")}`] : []),
    ...(unchecked.length ? [`${unchecked.join(", ")} not checked`] : []),
  ].join(" · ");
  return doc(message, fails.length ? "orange" : unchecked.length ? "lightgrey" : HERDR_RED);
}
