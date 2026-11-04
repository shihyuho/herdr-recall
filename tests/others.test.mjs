// Contract: Clues finds a pane by what it runs, prints or owns, with
// the query grammar herdr-recent-navigator users already type.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bufferKind, commandIsShell, contentExcerpt, isShellPromptTitle, paneForPid, parseEditorTarget,
  parseFilter, parseLsof, parsePs, parseSshTarget, stripAnsi,
} from "../mods/recall/lib/others.js";

test("ssh target: destination with -l user and -p port folded in", () => {
  assert.equal(parseSshTarget("ssh -l deploy -p 2200 web1"), "deploy@web1:2200");
  assert.equal(parseSshTarget("ssh -p2200 me@web1"), "me@web1:2200");
  assert.equal(parseSshTarget("/usr/bin/ssh -i ~/.ssh/key me@host uptime"), "me@host");
});

test("ssh target: a jump host or option value is not the destination", () => {
  assert.equal(parseSshTarget("ssh -J bastion -v app"), "app");
  assert.equal(parseSshTarget("ssh -o StrictHostKeyChecking=no app"), "app");
  assert.equal(parseSshTarget("ssh -- -weird-host"), "-weird-host");
});

test("ssh target: not ssh, or no destination", () => {
  assert.equal(parseSshTarget("ssh"), null);
  assert.equal(parseSshTarget("ssh -v"), null);
  assert.equal(parseSshTarget("git push"), null);
  assert.equal(parseSshTarget("mosh me@box"), "me@box");
});

test("a bare shell is a shell however it is spelled", () => {
  assert.equal(commandIsShell("-zsh"), true);
  assert.equal(commandIsShell("/bin/bash -l"), true);
  assert.equal(commandIsShell("npm run dev"), false);
});

test("editor target: path, +line, and path:line", () => {
  assert.deepEqual(parseEditorTarget("nvim +42 src/main.rs"), { path: "src/main.rs", line: 42 });
  assert.deepEqual(parseEditorTarget("vim -u NONE notes.md"), { path: "notes.md", line: null });
  assert.deepEqual(parseEditorTarget("hx src/app.ts:7"), { path: "src/app.ts", line: 7 });
  assert.equal(parseEditorTarget("nvim"), null);
});

test("a prompt-shaped title means the shell is back", () => {
  assert.equal(isShellPromptTitle("me@mac:~/code"), true);
  assert.equal(isShellPromptTitle("me@mac: /tmp"), true);
  assert.equal(isShellPromptTitle("nvim main.rs"), false);
  assert.equal(isShellPromptTitle("a b@mac:~"), false);
});

test("buffer kind: an editor on a file is a file row with an absolute path", () => {
  assert.deepEqual(bufferKind({ cwd: "/repo/", command: "nvim +3 src/a.rs" }, "nvim"), {
    kind: "file", file: "/repo/src/a.rs", context: "/repo/src/a.rs:3",
  });
  // Exited editor: the title is a prompt again.
  assert.equal(bufferKind({ cwd: "/repo", command: "nvim a.rs" }, "me@mac:~/repo").kind, "term");
  assert.deepEqual(bufferKind({ cwd: "/repo", command: "npm test" }, "npm"), { kind: "term", file: null, context: "/repo" });
});

test("filter prefixes need one space after the label", () => {
  assert.deepEqual(parseFilter("cmd vite"), { filter: "cmd", label: "cmd", needle: "vite" });
  assert.deepEqual(parseFilter(".file x"), { filter: "file", label: "file", needle: "x" });
  assert.deepEqual(parseFilter(".error"), { filter: "content", label: ".", needle: "error" });
  for (const q of ["ws auth", "tab auth", "pane auth", "cwd auth"]) assert.deepEqual(parseFilter(q), { filter: null, label: null, needle: q });
  assert.deepEqual(parseFilter("port "), { filter: "port", label: "port", needle: "" });
  assert.deepEqual(parseFilter("cmd"), { filter: null, label: null, needle: "cmd" });
  assert.deepEqual(parseFilter("deploy cmd x"), { filter: null, label: null, needle: "deploy cmd x" });
});

test("excerpt: the hit's line, 14 before and 80 after, cut marks", () => {
  const line = "0123456789abcdefghijERROR" + "x".repeat(100);
  const ex = contentExcerpt(`first\n${line}\nlast`, "ERROR");
  assert.equal(ex.text, "…6789abcdefghijERROR" + "x".repeat(80) + "…");
  assert.deepEqual(ex.hit, [15, 20]);
});

test("excerpt: exact case wins over an earlier other-case hit; else ignore case", () => {
  assert.equal(contentExcerpt("error one\nError two", "Error").text, "Error two");
  assert.equal(contentExcerpt("all quiet\nERROR here", "error").text, "ERROR here");
  assert.equal(contentExcerpt("nothing", "error"), null);
  assert.equal(contentExcerpt("text", "  "), null);
});

test("ANSI escapes are stripped before searching", () => {
  assert.equal(stripAnsi("\u001b[31mred\u001b[0m \u001b]0;title\u0007ok"), "red ok");
});

test("lsof listeners and ps processes parse into tables", () => {
  const listeners = parseLsof("p100\nn*:3000\nn*:3000\np200\nn[::1]:4321\n");
  assert.deepEqual(listeners, [
    { port: 3000, pid: 100, addr: "*:3000" },
    { port: 4321, pid: 200, addr: "[::1]:4321" },
  ]);
  const procs = parsePs("  100   50 node vite\n   50    1 -zsh\n");
  assert.deepEqual(procs.get(100), { ppid: 50, command: "node vite" });
});

test("a process belongs to the pane whose shell is its ancestor", () => {
  const procs = parsePs("300 200 node server\n200 50 npm run dev\n50 1 -zsh\n999 1 dockerd\n");
  const shells = new Map([[50, "pane-a"]]);
  assert.equal(paneForPid(300, shells, procs), "pane-a");
  assert.equal(paneForPid(50, shells, procs), "pane-a");
  assert.equal(paneForPid(999, shells, procs), null);
});
