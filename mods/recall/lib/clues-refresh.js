// Clues' data refresh, apart from the view so node tests can drive it with
// fake `exec` and `hc`. Two rounds: the pane-state round (`hc get` per
// terminal, plus `ps` and `lsof`) every 10 s, and the buffer round (`hc read`,
// new panes only) every 30 s. The view keeps its 1 s timer and calls
// `run(now)`, which starts whichever round is due.
import { cleanBuffer, parseLsof, parsePs, parseSshTarget } from "./clue-extract.js";

export const PANE_STATE_EVERY = 10000;
export const CONTENT_EVERY = 30000;
// Each program Clues runs through `exec` gets this long (Herdr's default is 30 s).
export const PROGRAM_TIMEOUT = 5000;

/**
 * `exec(cmd, args)` and `hc(args)` are Herdr's; `terminalPanes()` lists the panes
 * that have a terminal (each `{ pane, terminal, cwd }`).
 * `data` is the one object listView reads; its fields are filled in place.
 */
export function createCluesRefresh({ exec, hc, terminalPanes }) {
  const data = { paneState: new Map(), content: new Map(), procs: null, listeners: null };
  let paneStateAt = 0;
  let contentAt = 0;
  // A round still running is not started again; the two are guarded apart.
  let paneStateRunning = false;
  let contentRunning = false;

  async function fetchPaneState() {
    await Promise.all(terminalPanes().map(async (p) => {
      try {
        const r = await hc(["get", p.terminal, "--json"]);
        if (r.code !== 0) return;
        const j = JSON.parse(r.stdout);
        const fg = j.foreground;
        const command = fg?.argv?.length ? fg.argv.join(" ") : fg?.name ?? null;
        data.paneState.set(p.pane, {
          cwd: fg?.cwd ?? j.cwd ?? p.cwd ?? null,
          command: command && command.trim() ? command : null,
          ssh: command ? parseSshTarget(command) : null,
          shellPid: j.pid ?? null,
        });
      } catch {}
    }));
  }

  // A failure (a rejection, or an exit code that is not an answer) keeps what
  // the last good round found; with none yet, empty.
  async function fetchLocator() {
    const [ps, lsof] = await Promise.all([askPs(), askLsof()]);
    if (ps) data.procs = ps;
    else data.procs ??= new Map();
    if (lsof) data.listeners = lsof;
    else data.listeners ??= [];
  }

  async function askPs() {
    try {
      const r = await exec("ps", ["-eo", "pid=,ppid=,command="], { timeout: PROGRAM_TIMEOUT });
      return r.code === 0 ? parsePs(r.stdout) : null;
    } catch {
      return null;
    }
  }

  async function askLsof() {
    for (const bin of ["lsof", "/usr/sbin/lsof"]) {
      try {
        const r = await exec(bin, ["-nP", "-iTCP", "-sTCP:LISTEN", "-F", "pn"], { timeout: PROGRAM_TIMEOUT });
        return r.code === 0 || r.code === 1 ? parseLsof(r.stdout) : null;
      } catch {}
    }
    return null;
  }

  async function fetchContent() {
    const missing = terminalPanes().filter((p) => !data.content.has(p.pane));
    await Promise.all(missing.map(async (p) => {
      try {
        const r = await hc(["read", p.terminal, "--lines", "3000"]);
        const text = r.code === 0 ? cleanBuffer(r.stdout) : null;
        if (text) data.content.set(p.pane, text);
      } catch {}
    }));
  }

  /**
   * Start each round that is due at `now` (ms). `onRound` is called as each round
   * settles (the view redraws then). Resolves when the rounds it started are done.
   */
  function run(now, onRound = () => {}) {
    const started = [];
    if (!paneStateRunning && (!paneStateAt || now - paneStateAt >= PANE_STATE_EVERY)) {
      paneStateAt = now;
      paneStateRunning = true;
      started.push(Promise.all([fetchPaneState(), fetchLocator()]).finally(() => { paneStateRunning = false; }).then(onRound));
    }
    if (!contentRunning && (!contentAt || now - contentAt >= CONTENT_EVERY)) {
      contentAt = now;
      contentRunning = true;
      started.push(fetchContent().finally(() => { contentRunning = false; }).then(onRound));
    }
    return Promise.all(started).then(() => {});
  }

  return { data, run };
}
