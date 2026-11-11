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
  const calls = { exec: [], hc: [] };
  const fakeExec = exec ?? (async (cmd, args) => {
    calls.exec.push([cmd, ...args]);
    if (cmd === "ps") return { code: 0, stdout: PS };
    return { code: 0, stdout: LSOF };
  });
  const wrapped = exec ? async (cmd, args) => { calls.exec.push([cmd, ...args]); return exec(cmd, args); } : fakeExec;
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
