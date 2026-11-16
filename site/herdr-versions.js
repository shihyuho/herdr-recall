// Which Herdr versions CI checks Recall on. Pure, and shared: the check
// workflow imports it with Node, and the page can import it in the browser.

// The oldest Herdr CI checks: before it, `herdr-app check` crashed on mods
// with scrolling lists. Raise it only when Recall starts using
// something a newer Herdr added. The only place the floor is written.
export const FLOOR = "0.1.10";

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
