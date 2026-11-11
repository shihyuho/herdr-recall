// Contract: Clues' refresh asks Herdr for what panes run (every 10 s) and
// what their buffers hold (every 30 s, new panes only), and fills the data
// that Clues rows are worked out from.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCluesRefresh } from "../mods/recall/lib/clues-refresh.js";

const PANES = [
  { pane: "p1", terminal: "t1", cwd: "/home/u/web" },
  { pane: "p2", terminal: "t2", cwd: "/home/u/api" },
];

const PS = "  100     1 /sbin/launchd\n  200   100 zsh\n  300   200 node server.js\n";
const LSOF = "p300\nn*:3000\n";

/** Fakes that record what they were asked and answer from tables. */
function rig({ hcGet = {}, hcRead = {}, exec } = {}) {
  const calls = { exec: [], hc: [], opts: [] };
  const fakeExec = exec ?? (async (cmd, args, opts) => {
    calls.exec.push([cmd, ...args]);
    calls.opts.push([cmd, opts]);
    if (cmd === "ps") return { code: 0, stdout: PS };
    return { code: 0, stdout: LSOF };
  });
  const wrapped = exec ? async (cmd, args, opts) => { calls.exec.push([cmd, ...args]); calls.opts.push([cmd, opts]); return exec(cmd, args, opts); } : fakeExec;
  const fakeHc = async (args) => {
    calls.hc.push(args);
    const [verb, terminal] = args;
    const table = verb === "get" ? hcGet : hcRead;
    const r = table[terminal];
    if (r instanceof Error) throw r;
    return r ?? { code: 1, stdout: "" };
  };
  const refresh = createCluesRefresh({ exec: wrapped, hc: fakeHc, terminalPanes: () => PANES });
  return { refresh, calls };
}

const getJson = (o) => ({ code: 0, stdout: JSON.stringify(o) });

test("the pane-state round asks hc get per terminal, then ps and lsof, and nothing else", async () => {
  const { refresh, calls } = rig({ hcGet: { t1: getJson({ pid: 200, foreground: { argv: ["node", "server.js"], cwd: "/home/u/web" } }), t2: getJson({ pid: 20 }) } });
  await refresh.run(1000);
  assert.deepEqual(calls.hc.filter((a) => a[0] === "get"), [["get", "t1", "--json"], ["get", "t2", "--json"]]);
  assert.deepEqual(calls.exec, [["ps", "-eo", "pid=,ppid=,command="], ["lsof", "-nP", "-iTCP", "-sTCP:LISTEN", "-F", "pn"]]);
});

test("the clues worked out from the rounds: per-pane state, process table and listeners", async () => {
  const { refresh } = rig({
    hcGet: {
      t1: getJson({ pid: 200, foreground: { argv: ["ssh", "deploy@db1"], cwd: "/srv" } }),
      t2: getJson({ pid: 20, cwd: "/home/u/api-shell", foreground: { name: "nvim" } }),
    },
  });
  await refresh.run(1000);
  const s1 = refresh.data.paneState.get("p1");
  assert.equal(s1.cwd, "/srv");
  assert.equal(s1.command, "ssh deploy@db1");
  assert.equal(s1.ssh, "deploy@db1");
  assert.equal(s1.shellPid, 200);
  assert.deepEqual(refresh.data.paneState.get("p2"), { cwd: "/home/u/api-shell", command: "nvim", ssh: null, shellPid: 20 });
  assert.equal(refresh.data.procs.get(300).command, "node server.js");
  assert.deepEqual(refresh.data.listeners, [{ pid: 300, port: 3000, addr: "*:3000" }]);
});

test("a terminal hc cannot read leaves no state for its pane; the others still fill in", async () => {
  const { refresh } = rig({ hcGet: { t1: { code: 1, stdout: "" }, t2: getJson({ pid: 20 }) } });
  await refresh.run(1000);
  assert.equal(refresh.data.paneState.has("p1"), false);
  assert.equal(refresh.data.paneState.has("p2"), true);
});

test("pane state refreshes every 10 s, not before", async () => {
  const { refresh, calls } = rig({ hcGet: { t1: getJson({ pid: 1 }), t2: getJson({ pid: 2 }) } });
  const gets = () => calls.hc.filter((a) => a[0] === "get").length;
  await refresh.run(1000);
  assert.equal(gets(), 2);
  await refresh.run(10999);
  assert.equal(gets(), 2);
  await refresh.run(11000);
  assert.equal(gets(), 4);
  assert.equal(calls.exec.filter((c) => c[0] === "ps").length, 2);
});

test("buffers refresh every 30 s, not before, and read only panes not read yet", async () => {
  const { refresh, calls } = rig({ hcRead: { t1: { code: 0, stdout: "hello world\n" }, t2: { code: 1, stdout: "" } } });
  const reads = () => calls.hc.filter((a) => a[0] === "read");
  await refresh.run(1000);
  assert.deepEqual(reads(), [["read", "t1", "--lines", "3000"], ["read", "t2", "--lines", "3000"]]);
  assert.equal(refresh.data.content.get("p1"), "hello world\n");
  await refresh.run(30999);
  assert.equal(reads().length, 2);
  await refresh.run(31000);
  // p1 was read; p2 gave nothing, so it is asked again
  assert.deepEqual(reads().slice(2), [["read", "t2", "--lines", "3000"]]);
});

test("a rejecting lsof falls back to /usr/sbin/lsof", async () => {
  const { refresh, calls } = rig({
    exec: async (cmd) => {
      if (cmd === "ps") return { code: 0, stdout: PS };
      if (cmd === "lsof") throw new Error("not found");
      return { code: 0, stdout: LSOF };
    },
  });
  await refresh.run(1000);
  assert.deepEqual(calls.exec.map((c) => c[0]), ["ps", "lsof", "/usr/sbin/lsof"]);
  assert.deepEqual(refresh.data.listeners, [{ pid: 300, port: 3000, addr: "*:3000" }]);
});

test("lsof exiting 1 (nothing listening) counts as success, 2 does not", async () => {
  const run = async (code) => {
    const { refresh } = rig({ exec: async (cmd) => (cmd === "ps" ? { code: 0, stdout: PS } : { code, stdout: LSOF }) });
    await refresh.run(1000);
    return refresh.data.listeners;
  };
  assert.deepEqual(await run(1), [{ pid: 300, port: 3000, addr: "*:3000" }]);
  assert.deepEqual(await run(0), [{ pid: 300, port: 3000, addr: "*:3000" }]);
  assert.deepEqual(await run(2), []);
});

test("ps failing leaves an empty process table", async () => {
  const { refresh } = rig({ exec: async (cmd) => (cmd === "ps" ? { code: 1, stdout: "" } : { code: 0, stdout: LSOF }) });
  await refresh.run(1000);
  assert.equal(refresh.data.procs.size, 0);
});

test("before any round, procs and listeners are unknown", () => {
  const { refresh } = rig();
  assert.equal(refresh.data.procs, null);
  assert.equal(refresh.data.listeners, null);
});

// ── Steady rounds ────────────────────────────────────────────────────────

const NEVER = () => new Promise(() => {});
const PS2 = "  100     1 /sbin/launchd\n  200   100 zsh\n  400   200 vite\n";
const LSOF2 = "p400\nn*:5173\n";
const GOOD_PROCS = (r) => r.data.procs.get(300).command;

/** An exec whose answers the test switches round by round. */
function switchable() {
  const mode = { ps: "good", lsof: "good" };
  const exec = async (cmd) => {
    const m = cmd === "ps" ? mode.ps : mode.lsof;
    if (m === "reject") throw new Error("timed out");
    if (m === "hang") return NEVER();
    if (m === "fail") return { code: cmd === "ps" ? 1 : 2, stdout: "" };
    if (m === "second") return { code: 0, stdout: cmd === "ps" ? PS2 : LSOF2 };
    return { code: 0, stdout: cmd === "ps" ? PS : LSOF };
  };
  return { mode, exec };
}

test("ps and lsof (and its fallback) are each given 5 000 ms; hc is not run through exec", async () => {
  const { refresh, calls } = rig({
    exec: async (cmd) => {
      if (cmd === "ps") return { code: 0, stdout: PS };
      if (cmd === "lsof") throw new Error("not found");
      return { code: 0, stdout: LSOF };
    },
  });
  await refresh.run(1000);
  assert.deepEqual(calls.opts, [["ps", { timeout: 5000 }], ["lsof", { timeout: 5000 }], ["/usr/sbin/lsof", { timeout: 5000 }]]);
});

for (const how of ["reject", "fail"]) {
  test(`a failed ps (${how}) keeps the last process table; lsof's good result still lands`, async () => {
    const { mode, exec } = switchable();
    const { refresh } = rig({ exec });
    await refresh.run(1000);
    mode.ps = how;
    mode.lsof = "second";
    await refresh.run(11000);
    assert.equal(GOOD_PROCS(refresh), "node server.js");
    assert.deepEqual(refresh.data.listeners, [{ pid: 400, port: 5173, addr: "*:5173" }]);
  });

  test(`a failed lsof (${how}) keeps the last listeners; ps's good result still lands`, async () => {
    const { mode, exec } = switchable();
    const { refresh } = rig({ exec });
    await refresh.run(1000);
    mode.lsof = how;
    mode.ps = "second";
    await refresh.run(11000);
    assert.deepEqual(refresh.data.listeners, [{ pid: 300, port: 3000, addr: "*:3000" }]);
    assert.equal(refresh.data.procs.get(400).command, "vite");
  });
}

test("a round after a failed one works again and replaces what was kept", async () => {
  const { mode, exec } = switchable();
  const { refresh } = rig({ exec });
  await refresh.run(1000);
  mode.ps = "reject";
  mode.lsof = "reject";
  await refresh.run(11000);
  mode.ps = "second";
  mode.lsof = "second";
  await refresh.run(21000);
  assert.equal(refresh.data.procs.get(400).command, "vite");
  assert.deepEqual(refresh.data.listeners, [{ pid: 400, port: 5173, addr: "*:5173" }]);
});

test("lsof exiting 1 after a good round means nothing listens now, not a failure", async () => {
  const { mode, exec } = switchable();
  const { refresh } = rig({ exec: async (cmd, a, o) => (cmd !== "ps" && mode.lsof === "none" ? { code: 1, stdout: "" } : exec(cmd, a, o)) });
  await refresh.run(1000);
  mode.lsof = "none";
  await refresh.run(11000);
  assert.deepEqual(refresh.data.listeners, []);
});

test("a first round that fails leaves the process table and listeners empty", async () => {
  const { refresh } = rig({ exec: async () => { throw new Error("cannot start"); } });
  await refresh.run(1000);
  assert.equal(refresh.data.procs.size, 0);
  assert.deepEqual(refresh.data.listeners, []);
});

test("the last good round's state and clues survive a failed round", async () => {
  const { mode, exec } = switchable();
  const { refresh } = rig({ exec, hcGet: { t1: getJson({ pid: 200 }), t2: getJson({ pid: 20 }) } });
  await refresh.run(1000);
  mode.ps = "reject";
  mode.lsof = "reject";
  await refresh.run(11000);
  assert.equal(refresh.data.paneState.get("p1").shellPid, 200);
  assert.equal(refresh.data.procs.get(200).command, "zsh");
});

test("a pane-state round that is still running is not started again", async () => {
  const { mode, exec } = switchable();
  const { refresh, calls } = rig({ exec, hcGet: { t1: getJson({ pid: 1 }), t2: getJson({ pid: 2 }) } });
  mode.ps = "hang";
  refresh.run(1000);
  await new Promise((r) => setImmediate(r));
  const gets = () => calls.hc.filter((a) => a[0] === "get").length;
  const psCalls = () => calls.exec.filter((c) => c[0] === "ps").length;
  assert.equal(gets(), 2);
  assert.equal(psCalls(), 1);
  refresh.run(11000);
  refresh.run(21000);
  await new Promise((r) => setImmediate(r));
  assert.equal(gets(), 2);
  assert.equal(psCalls(), 1);
});

test("a hung pane-state round does not hold up the buffer round", async () => {
  const { mode, exec } = switchable();
  const { refresh, calls } = rig({ exec, hcRead: { t1: { code: 0, stdout: "x\n" }, t2: { code: 1, stdout: "" } } });
  mode.ps = "hang";
  refresh.run(1000);
  await new Promise((r) => setImmediate(r));
  const reads = () => calls.hc.filter((a) => a[0] === "read").length;
  assert.equal(reads(), 2);
  await refresh.run(31000); // buffer round due; pane-state round skipped but still hung
  assert.equal(reads(), 3);
});

test("a buffer round that is still running is not started again, and does not hold up pane state", async () => {
  let hang = true;
  const calls = { get: 0, read: 0 };
  const refresh = createCluesRefresh({
    exec: async (cmd) => ({ code: 0, stdout: cmd === "ps" ? PS : LSOF }),
    hc: async (args) => {
      if (args[0] === "read") { calls.read++; return hang ? NEVER() : { code: 0, stdout: "x\n" }; }
      calls.get++;
      return { code: 0, stdout: JSON.stringify({ pid: 1 }) };
    },
    terminalPanes: () => PANES,
  });
  refresh.run(1000);
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.read, 2);
  refresh.run(31000);
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.read, 2); // skipped while the first buffer round hangs
  assert.equal(calls.get, 4); // pane state kept going at 11 s-spaced rounds (1 s and 31 s)
  hang = false;
});

test("a round that rejects or fails does not stay marked as running", async () => {
  const { mode, exec } = switchable();
  const { refresh, calls } = rig({ exec });
  mode.ps = "reject";
  mode.lsof = "reject";
  await refresh.run(1000);
  await refresh.run(11000);
  assert.equal(calls.exec.filter((c) => c[0] === "ps").length, 2);
});
