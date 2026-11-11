// Clues' data refresh, apart from the view so node tests can drive it with
// fake `exec` and `hc`. Two rounds: the pane-state round (`hc get` per
// terminal, plus `ps` and `lsof`) every 10 s, and the buffer round (`hc read`,
// new panes only) every 30 s. The view keeps its 1 s timer and calls
// `run(now)`, which starts whichever round is due.
import { cleanBuffer, parseLsof, parsePs, parseSshTarget } from "./clue-extract.js";

export const PANE_STATE_EVERY = 10000;
export const CONTENT_EVERY = 30000;

/**
 * `exec(cmd, args)` and `hc(args)` are Herdr's; `terminalPanes()` lists the panes
 * that have a terminal (each `{ pane, terminal, cwd }`).
 * `data` is the one object listView reads; its fields are filled in place.
 */
export function createCluesRefresh({ exec, hc, terminalPanes }) {
  const data = { paneState: new Map(), content: new Map(), procs: null, listeners: null };
  let paneStateAt = 0;
  let contentAt = 0;

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

  async function fetchLocator() {
    try {
      const ps = await exec("ps", ["-eo", "pid=,ppid=,command="]);
      data.procs = ps.code === 0 ? parsePs(ps.stdout) : new Map();
    } catch {
      data.procs = new Map();
    }
    let lsof = null;
    for (const bin of ["lsof", "/usr/sbin/lsof"]) {
      try {
        lsof = await exec(bin, ["-nP", "-iTCP", "-sTCP:LISTEN", "-F", "pn"]);
        break;
      } catch {}
    }
    data.listeners = lsof && (lsof.code === 0 || lsof.code === 1) ? parseLsof(lsof.stdout) : [];
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
    if (!paneStateAt || now - paneStateAt >= PANE_STATE_EVERY) {
      paneStateAt = now;
      started.push(Promise.all([fetchPaneState(), fetchLocator()]).then(onRound));
    }
    if (!contentAt || now - contentAt >= CONTENT_EVERY) {
      contentAt = now;
      started.push(fetchContent().then(onRound));
    }
    return Promise.all(started).then(() => {});
  }

  return { data, run };
}
