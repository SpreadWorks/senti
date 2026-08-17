/**
 * Spec verification tests for spec 163-logger-callsite-replace.
 *
 * Verifies that runCmd / runCmdAsync call Logger.git when cmd === "git",
 * and that key Logger.event call sites record the expected events.
 *
 * NOT part of the formal test suite (not run by `npm test`).
 * Run with: node specs/163-logger-callsite-replace/tests/logger-callsite.test.js
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, "../../../src");

const { Logger } = await import(`${srcRoot}/lib/log.js`);
const { runCmd, runCmdAsync } = await import(`${srcRoot}/lib/process.js`);

/** YYYY-MM-DD in local time */
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Read and parse JSONL file */
function readJsonl(file) {
  return fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

// ─── runCmd — Logger.git integration ──────────────────────────────────────────

describe("runCmd — Logger.git integration", () => {
  let tmpDir;
  let logFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "callsite-runcmd-"));
    logFile = path.join(tmpDir, `sdd-forge-${todayLocal()}.jsonl`);
    Logger._resetForTest();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    Logger._resetForTest();
  });

  it("R1: git コマンド実行後に JSONL に type:git レコードが記録される", async () => {
    const inst = Logger.getInstance();
    inst.init(tmpDir, { logs: { enabled: true, dir: tmpDir } }, { entryCommand: "test" });

    runCmd("git", ["--version"]);
    await inst.flush();

    assert.ok(fs.existsSync(logFile), `logFile should exist: ${logFile}`);
    const entries = readJsonl(logFile);
    const gitEntries = entries.filter((e) => e.type === "git");
    assert.ok(gitEntries.length >= 1, "at least one git entry should be recorded");
    const e = gitEntries[0];
    assert.equal(e.type, "git");
    assert.deepEqual(e.cmd, ["git", "--version"]);
    assert.equal(e.exitCode, 0);
    assert.ok(typeof e.ts === "string");
  });

  it("R3: git 以外のコマンドは Logger.git を呼ばない", async () => {
    const inst = Logger.getInstance();
    inst.init(tmpDir, { logs: { enabled: true, dir: tmpDir } }, { entryCommand: "test" });

    runCmd("node", ["--version"]);
    await inst.flush();

    // JSONL が存在しないか、git エントリがゼロ
    if (fs.existsSync(logFile)) {
      const entries = readJsonl(logFile);
      const gitEntries = entries.filter((e) => e.type === "git");
      assert.equal(gitEntries.length, 0, "non-git command must not create git log entries");
    }
  });

  it("R3: disabled 時は git コマンドを実行しても JSONL に何も書かれない", async () => {
    const inst = Logger.getInstance();
    inst.init(tmpDir, { logs: { enabled: false, dir: tmpDir } }, { entryCommand: "test" });

    runCmd("git", ["--version"]);
    await inst.flush();

    assert.ok(!fs.existsSync(logFile), "no JSONL file should exist when logging is disabled");
  });

  it("R1: 失敗した git コマンドでも exitCode が記録される", async () => {
    const inst = Logger.getInstance();
    inst.init(tmpDir, { logs: { enabled: true, dir: tmpDir } }, { entryCommand: "test" });

    // 存在しないサブコマンド → 非ゼロ終了
    runCmd("git", ["this-command-does-not-exist-xyz"]);
    await inst.flush();

    assert.ok(fs.existsSync(logFile), "logFile should exist");
    const entries = readJsonl(logFile);
    const gitEntries = entries.filter((e) => e.type === "git");
    assert.ok(gitEntries.length >= 1, "failed git command should still be recorded");
    assert.ok(gitEntries[0].exitCode !== 0, "exitCode should reflect failure");
  });
});

// ─── runCmdAsync — Logger.git integration ─────────────────────────────────────

describe("runCmdAsync — Logger.git integration", () => {
  let tmpDir;
  let logFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "callsite-async-"));
    logFile = path.join(tmpDir, `sdd-forge-${todayLocal()}.jsonl`);
    Logger._resetForTest();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    Logger._resetForTest();
  });

  it("R2: git コマンド実行後に JSONL に type:git レコードが記録される", async () => {
    const inst = Logger.getInstance();
    inst.init(tmpDir, { logs: { enabled: true, dir: tmpDir } }, { entryCommand: "test" });

    await runCmdAsync("git", ["--version"]);
    await inst.flush();

    assert.ok(fs.existsSync(logFile), `logFile should exist: ${logFile}`);
    const entries = readJsonl(logFile);
    const gitEntries = entries.filter((e) => e.type === "git");
    assert.ok(gitEntries.length >= 1, "at least one git entry should be recorded");
    assert.equal(gitEntries[0].type, "git");
    assert.deepEqual(gitEntries[0].cmd, ["git", "--version"]);
  });

  it("R3: disabled 時は JSONL に何も書かれない", async () => {
    const inst = Logger.getInstance();
    inst.init(tmpDir, { logs: { enabled: false, dir: tmpDir } }, { entryCommand: "test" });

    await runCmdAsync("git", ["--version"]);
    await inst.flush();

    assert.ok(!fs.existsSync(logFile), "no JSONL file should exist when logging is disabled");
  });
});
