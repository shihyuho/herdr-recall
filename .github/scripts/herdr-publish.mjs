// The check workflow's publish step, with site/herdr-versions.js, so the
// documents come from the functions the tests cover.
//   node herdr-publish.mjs <results dir> <out dir>
// Reads <results dir>/*/result.json (one per check leg's artifact) and writes
// <out dir>/herdr.json, the results document, and <out dir>/badge.json, the
// README badge's endpoint document. Appends the run's summary table to
// $GITHUB_STEP_SUMMARY, or prints it when that isn't set.
//   VERSIONS  the versions job's list: a leg that left no result is unknown
//   RUN_URL   this run's URL, the documents' `run`
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHECKS, badge, checkOf, report } from "../../site/herdr-versions.js";

const [resultsDir, outDir] = process.argv.slice(2);
if (!resultsDir || !outDir) throw new Error("usage: herdr-publish.mjs <results dir> <out dir>");

const legs = (existsSync(resultsDir) ? readdirSync(resultsDir) : [])
  .map((name) => join(resultsDir, name))
  .filter((dir) => existsSync(join(dir, "result.json")))
  .map((dir) => ({ dir, ...JSON.parse(readFileSync(join(dir, "result.json"), "utf8")) }));

// A leg that died before uploading still counts, as not checked.
for (const version of JSON.parse(process.env.VERSIONS || "[]")) {
  if (!legs.some((l) => l.version === version)) {
    legs.push({ version, check: "unknown", seconds: null, broken: "no result uploaded" });
  }
}

const results = report(legs, {
  run: process.env.RUN_URL ?? null,
  at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
});

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "herdr.json"), `${JSON.stringify(results, null, 2)}\n`);
writeFileSync(join(outDir, "badge.json"), `${JSON.stringify(badge(results), null, 2)}\n`);

const tail = (file, n) => (existsSync(file) ? readFileSync(file, "utf8").trimEnd().split("\n").slice(-n).join("\n") : "");
const leg = (version) => legs.find((l) => l.version === version);

const summary = [
  "## herdr-app check mods/recall",
  "",
  `Badge: **${badge(results).message}**`,
  "",
  "| Herdr | Recall | seconds | broken copy |",
  "| --- | --- | --- | --- |",
  ...results.versions.map((v) => `| ${v.version} | ${CHECKS[checkOf(v.check)].summary} | ${v.seconds ?? "–"} | ${leg(v.version).broken ?? ""} |`),
  "",
  ...results.versions.filter((v) => leg(v.version).dir).flatMap((v) => [
    `<details><summary>${v.version} logs</summary>`,
    "",
    "```text",
    tail(join(leg(v.version).dir, "recall.log"), 40),
    "--- broken copy:",
    tail(join(leg(v.version).dir, "broken.log"), 20),
    "```",
    "",
    "</details>",
  ]),
  "",
].join("\n");

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);
