import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import SetInitCommand from "../../../src/flow/lib/set-init.js";
import { PREPARING_PREFIX } from "../../../src/lib/flow-helpers.js";

function setupProject(tmp) {
  writeJson(tmp, ".sennel/config.json", {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  });
  writeJson(tmp, "package.json", { name: "fixture", version: "0.0.0" });
  return tmp;
}

function preparingFilePath(tmp, runId) {
  return path.join(tmp, ".sennel", `${PREPARING_PREFIX}${runId}`);
}

function ageFileByMs(filePath, ageMs) {
  const now = Date.now();
  const targetMs = now - ageMs;
  const targetSec = targetMs / 1000;
  fs.utimesSync(filePath, targetSec, targetSec);
}

function captureStderr(fn) {
  const original = process.stderr.write.bind(process.stderr);
  let buf = "";
  process.stderr.write = (chunk) => {
    buf += typeof chunk === "string" ? chunk : chunk.toString();
    return true;
  };
  try {
    const result = fn();
    return { result, stderr: buf };
  } finally {
    process.stderr.write = original;
  }
}

describe("flow set init preparing-flow preservation", () => {
  let tmp;

  beforeEach(() => {
    tmp = createTmpDir("set-init-cleanup-");
    setupProject(tmp);
  });

  afterEach(() => {
    removeTmpDir(tmp);
  });

  it("preserves fresh and aged preparing files byte-identically and reports them", () => {
    const fm = makeFlowManager(tmp);

    const fresh = fm.generateRunId();
    const stale1 = fm.generateRunId();
    const stale2 = fm.generateRunId();
    fm.createPreparingFlow(fresh, { issue: 10 });
    fm.createPreparingFlow(stale1, { issue: 11 });
    fm.createPreparingFlow(stale2, { issue: 12 });
    const before = new Map([
      [fresh, fs.readFileSync(preparingFilePath(tmp, fresh))],
      [stale1, fs.readFileSync(preparingFilePath(tmp, stale1))],
      [stale2, fs.readFileSync(preparingFilePath(tmp, stale2))],
    ]);

    ageFileByMs(preparingFilePath(tmp, fresh), 10 * 60 * 1000);      // 10 min
    ageFileByMs(preparingFilePath(tmp, stale1), 2 * 60 * 60 * 1000); // 2h
    ageFileByMs(preparingFilePath(tmp, stale2), 3 * 60 * 60 * 1000); // 3h

    const cmd = new SetInitCommand();
    const { result, stderr } = captureStderr(() =>
      cmd.execute({ flowManager: fm, issue: 99 }),
    );

    for (const runId of [fresh, stale1, stale2]) {
      assert.equal(fs.existsSync(preparingFilePath(tmp, runId)), true);
      assert.deepEqual(fs.readFileSync(preparingFilePath(tmp, runId)), before.get(runId));
    }
    const newRunId = result.runId;
    assert.ok(newRunId, `expected runId in response, got ${JSON.stringify(result)}`);
    assert.equal(fs.existsSync(preparingFilePath(tmp, newRunId)), true);

    const warningLine = stderr
      .split("\n")
      .find((l) => l.includes("preparing flow(s) already exist"));
    assert.ok(
      warningLine,
      `expected warning line in stderr, got: ${stderr}`,
    );
    assert.match(warningLine, /^\[flow\] WARN: 3 preparing flow\(s\) already exist:/);
    for (const runId of [fresh, stale1, stale2]) {
      assert.ok(warningLine.includes(runId), `expected runId ${runId} in warning: ${warningLine}`);
    }
  });

  it("emits no warning when no preparing flows exist (AC-4, REQ-P6)", () => {
    const fm = makeFlowManager(tmp);

    const cmd = new SetInitCommand();
    const { result, stderr } = captureStderr(() =>
      cmd.execute({ flowManager: fm, issue: 1 }),
    );

    assert.ok(
      !stderr.includes("preparing flow(s) already exist"),
      `expected no warning, got: ${stderr}`,
    );
    const newRunId = result.runId;
    assert.ok(newRunId);
    assert.equal(fs.existsSync(preparingFilePath(tmp, newRunId)), true);
  });
});
