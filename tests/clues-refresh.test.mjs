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
  for (const [broken, other] of [["ps", "lsof"], ["lsof", "ps"]]) {
    test(`a failed ${broken} (${how}) keeps the last process table and listeners as a pair, though ${other} answered`, async () => {
      const { mode, exec } = switchable();
      const { refresh } = rig({ exec });
      await refresh.run(1000);
      mode[broken] = how;
      mode[other] = "second";
      await refresh.run(11000);
      assert.equal(GOOD_PROCS(refresh), "node server.js");
      assert.deepEqual(refresh.data.listeners, [{ pid: 300, port: 3000, addr: "*:3000" }]);
    });

    test(`a first round where only ${other} answers leaves both empty, not half filled (${broken} ${how})`, async () => {
      const { mode, exec } = switchable();
      const { refresh } = rig({ exec });
      mode[broken] = how;
      await refresh.run(1000);
      assert.equal(refresh.data.procs.size, 0);
      assert.deepEqual(refresh.data.listeners, []);
    });
  }
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
  refresh.run(30999); // the buffer round is not due yet; the hung pane-state round is still guarded
  await new Promise((r) => setImmediate(r));
  assert.equal(reads(), 2);
  refresh.run(31000); // the buffer round is due (the hung round, 30 s old, starts over and hangs again)
  await new Promise((r) => setImmediate(r));
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
  refresh.run(11000);
  await new Promise((r) => setImmediate(r));
  refresh.run(21000);
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.read, 2); // skipped while the first buffer round hangs
  assert.equal(calls.get, 6); // pane state kept going, a round every 10 s
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

// ── Review fixes: a hung round, lsof's choice, due ──────────────────────

const tick = () => new Promise((r) => setImmediate(r));

test("a round running longer than 30 s no longer blocks the next, and its late results are dropped", async () => {
  let round = 1;
  const late = { get: [], ps: [], lsof: [] };
  const hold = (list) => new Promise((res) => list.push(res));
  const gets = [];
  const refresh = createCluesRefresh({
    exec: async (cmd) => {
      if (round === 1) return hold(cmd === "ps" ? late.ps : late.lsof);
      return { code: 0, stdout: cmd === "ps" ? PS : LSOF };
    },
    hc: async (args) => {
      if (args[0] === "read") return { code: 1, stdout: "" };
      gets.push(args[1]);
      if (round === 1) return hold(late.get);
      return { code: 0, stdout: JSON.stringify({ pid: 1 }) };
    },
    terminalPanes: () => PANES,
  });
  refresh.run(1000);
  await tick();
  assert.equal(gets.length, 2);
  refresh.run(30999); // the round has run 29.999 s: still guarded
  await tick();
  assert.equal(gets.length, 2);
  round = 2;
  await refresh.run(31000); // 30 s: the next due tick starts a new round
  assert.equal(gets.length, 4);
  assert.equal(refresh.data.paneState.get("p1").shellPid, 1);
  assert.equal(refresh.data.procs.get(300).command, "node server.js");
  // the first round's calls settle now, with other answers
  late.get.forEach((res) => res({ code: 0, stdout: JSON.stringify({ pid: 99 }) }));
  late.ps.forEach((res) => res({ code: 0, stdout: PS2 }));
  late.lsof.forEach((res) => res({ code: 0, stdout: LSOF2 }));
  await tick();
  assert.equal(refresh.data.paneState.get("p1").shellPid, 1);
  assert.equal(refresh.data.procs.get(300).command, "node server.js");
  assert.equal(refresh.data.procs.has(400), false);
  assert.deepEqual(refresh.data.listeners, [{ pid: 300, port: 3000, addr: "*:3000" }]);
});

test("a stale round settling does not unguard the newer round that is running", async () => {
  let round = 1;
  const late = [];
  const gets = [];
  const refresh = createCluesRefresh({
    exec: async (cmd) => ({ code: 0, stdout: cmd === "ps" ? PS : LSOF }),
    hc: async (args) => {
      if (args[0] === "read") return { code: 1, stdout: "" };
      gets.push(round);
      return new Promise((res) => late.push(res)); // every get hangs until released
    },
    terminalPanes: () => PANES,
  });
  refresh.run(1000);
  await tick();
  round = 2;
  refresh.run(31000); // supersedes round 1
  await tick();
  assert.deepEqual(gets, [1, 1, 2, 2]);
  late.slice(0, 2).forEach((res) => res({ code: 0, stdout: "{}" })); // round 1 settles
  await tick();
  refresh.run(41000); // round 2 has run 10 s: still guarded
  await tick();
  assert.equal(gets.length, 4);
});

test("a buffer read that hangs past 30 s no longer blocks the next buffer round, and its late text is dropped", async () => {
  let round = 1;
  const late = [];
  const refresh = createCluesRefresh({
    exec: async (cmd) => ({ code: 0, stdout: cmd === "ps" ? PS : LSOF }),
    hc: async (args) => {
      if (args[0] === "get") return { code: 1, stdout: "" };
      if (round === 1 && args[1] === "t1") return new Promise((res) => late.push(res));
      return { code: 0, stdout: round === 1 ? "other\n" : "fresh\n" };
    },
    terminalPanes: () => PANES,
  });
  refresh.run(1000);
  await tick();
  round = 2;
  await refresh.run(31000);
  assert.equal(refresh.data.content.get("p1"), "fresh\n");
  late[0]({ code: 0, stdout: "stale\n" });
  await tick();
  assert.equal(refresh.data.content.get("p1"), "fresh\n");
});

/** An exec that records each lsof asked for and answers by table. */
function lsofRig(answers) {
  const asked = [];
  const exec = async (cmd) => {
    if (cmd === "ps") return { code: 0, stdout: PS };
    asked.push(cmd);
    const a = answers[cmd];
    if (a instanceof Error) throw a;
    return a ?? { code: 0, stdout: LSOF };
  };
  return { asked, exec };
}

test("once an lsof has started, a later timeout does not try /usr/sbin/lsof", async () => {
  const answers = { lsof: { code: 0, stdout: LSOF } };
  const { asked, exec } = lsofRig(answers);
  const { refresh } = rig({ exec });
  await refresh.run(1000);
  answers.lsof = new Error("timed out");
  await refresh.run(11000);
  assert.deepEqual(asked, ["lsof", "lsof"]);
});

test("an lsof that started and exited 2 is still the one used afterwards", async () => {
  const answers = { lsof: { code: 2, stdout: "" } };
  const { asked, exec } = lsofRig(answers);
  const { refresh } = rig({ exec });
  await refresh.run(1000);
  answers.lsof = new Error("timed out");
  await refresh.run(11000);
  assert.deepEqual(asked, ["lsof", "lsof"]);
});

test("while lsof on PATH keeps rejecting, /usr/sbin/lsof is tried each round, and once it starts it is the one used", async () => {
  const answers = { lsof: new Error("not found"), "/usr/sbin/lsof": new Error("not found") };
  const { asked, exec } = lsofRig(answers);
  const { refresh } = rig({ exec });
  await refresh.run(1000);
  await refresh.run(11000);
  assert.deepEqual(asked, ["lsof", "/usr/sbin/lsof", "lsof", "/usr/sbin/lsof"]);
  answers["/usr/sbin/lsof"] = { code: 0, stdout: LSOF };
  await refresh.run(21000);
  answers["/usr/sbin/lsof"] = new Error("timed out");
  await refresh.run(31000);
  assert.deepEqual(asked.slice(4), ["lsof", "/usr/sbin/lsof", "/usr/sbin/lsof"]);
});

test("due tells whether a tick would start a round, so a quiet tick can skip spawning", async () => {
  const { refresh } = rig();
  assert.equal(refresh.due(1000), true);
  await refresh.run(1000);
  assert.equal(refresh.due(1000), false);
  assert.equal(refresh.due(10999), false);
  assert.equal(refresh.due(11000), true); // pane state
  await refresh.run(11000);
  assert.equal(refresh.due(20999), false);
  assert.equal(refresh.due(21000), true);
  await refresh.run(21000);
  assert.equal(refresh.due(30999), false);
  assert.equal(refresh.due(31000), true); // buffers, and pane state again
});

test("due stays false while a round runs, until it has run 30 s", async () => {
  const hung = new Promise(() => {});
  const refresh = createCluesRefresh({
    exec: async () => hung,
    hc: async (args) => (args[0] === "read" ? { code: 1, stdout: "" } : hung),
    terminalPanes: () => PANES,
  });
  refresh.run(1000);
  await tick();
  // buffers settle but are not due again until 31 s; pane state is hung
  assert.equal(refresh.due(11000), false);
  assert.equal(refresh.due(30999), false);
  assert.equal(refresh.due(31000), true);
});
