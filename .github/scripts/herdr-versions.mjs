// The check workflow's version list, from site/herdr-versions.js, so CI
// picks with the same function the tests cover. Prints GITHUB_OUTPUT lines:
//   versions=["0.1.16",...]  the matrix, newest first
//   latest=0.1.16            latest.json's version
//   sha256=...               latest.json's macOS checksum for it
import { execFileSync } from "node:child_process";
import { FLOOR, pickVersions } from "../../site/herdr-versions.js";

// The free plan runs five macOS jobs at a time: five versions take as long as one.
const COUNT = 5;

const tags = execFileSync("git", ["ls-remote", "--tags", "https://github.com/herdrdev/herdr-app"], { encoding: "utf8" })
  .split("\n")
  .filter((line) => line.trim());

const res = await fetch("https://releases.herdr.dev/app/latest.json");
if (!res.ok) throw new Error(`latest.json: HTTP ${res.status}`);
const latest = await res.json();

const versions = pickVersions(tags, { floor: FLOOR, latest: latest.version, count: COUNT });
if (versions.length === 0) {
  throw new Error(`no Herdr tag between ${FLOOR} and ${latest.version} among ${tags.length} refs`);
}

console.log(`versions=${JSON.stringify(versions)}`);
console.log(`latest=${latest.version}`);
console.log(`sha256=${latest.targets["macos-aarch64"].sha256}`);
