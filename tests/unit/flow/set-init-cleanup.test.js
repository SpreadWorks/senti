import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import SetInitCommand from "../../../src/flow/lib/set-init.js";
import { PREPARING_PREFIX } from "../../../src/lib/flow-helpers.js";

function setupProject(tmp) {
  writeJson(tmp, ".senti/config.json", {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  });
  writeJson(tmp, "package.json", { name: "fixture", version: "0.0.0" });
  return tmp;
}

function preparingFilePath(tmp, runId) {
  return path.join(tmp, ".senti", `${PREPARING_PREFIX}${runId}`);
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

describe("flow set init — stale preparing-flow cleanup (spec 222)", () => {
  let tmp;

  beforeEach(() => {
    tmp = createTmpDir("set-init-cleanup-");
    setupProject(tmp);
  });

  afterEach(() => {
    removeTmpDir(tmp);
  });

  it("deletes stale preparing files and reports count of only remaining fresh files (AC-1, REQ-P1, REQ-P4)", () => {
    const fm = makeFlowManager(tmp);

    const fresh = fm.generateRunId();
    const stale1 = fm.generateRunId();
    const stale2 = fm.generateRunId();
    fm.createPreparingFlow(fresh, { issue: 10 });
    fm.createPreparingFlow(stale1, { issue: 11 });
    fm.createPreparingFlow(stale2, { issue: 12 });

    ageFileByMs(preparingFilePath(tmp, fresh), 10 * 60 * 1000);      // 10 min
    ageFileByMs(preparingFilePath(tmp, stale1), 2 * 60 * 60 * 1000); // 2h
    ageFileByMs(preparingFilePath(tmp, stale2), 3 * 60 * 60 * 1000); // 3h

    const cmd = new SetInitCommand();
    const { result, stderr } = captureStderr(() =>
      cmd.execute({ flowManager: fm, issue: 99 }),
    );

    // stale files removed
    assert.equal(fs.existsSync(preparingFilePath(tmp, stale1)), false);
    assert.equal(fs.existsSync(preparingFilePath(tmp, stale2)), false);
    // fresh file retained
    assert.equal(fs.existsSync(preparingFilePath(tmp, fresh)), true);
    // a new preparing flow was created for the generated runId
    const newRunId = result.runId;
    assert.ok(newRunId, `expected runId in response, got ${JSON.stringify(result)}`);
    assert.equal(fs.existsSync(preparingFilePath(tmp, newRunId)), true);

    // warning reflects only the fresh pre-existing preparing flow (count = 1)
    const warningLine = stderr
      .split("\n")
      .find((l) => l.includes("preparing flow(s) already exist"));
    assert.ok(
      warningLine,
      `expected warning line in stderr, got: ${stderr}`,
    );
    assert.match(warningLine, /^\[flow\] WARN: 1 preparing flow\(s\) already exist:/);
    assert.ok(
      warningLine.includes(fresh),
      `expected fresh runId ${fresh} in warning: ${warningLine}`,
    );
    assert.ok(
      !warningLine.includes(stale1),
      `stale runId ${stale1} should not appear in warning: ${warningLine}`,
    );
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
