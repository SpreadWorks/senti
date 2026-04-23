import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import { PREPARING_TTL_MS, PREPARING_PREFIX } from "../../../src/lib/flow-helpers.js";

function setupProject(tmp) {
  writeJson(tmp, ".sdd-forge/config.json", {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  });
  writeJson(tmp, "package.json", { name: "fixture", version: "0.0.0" });
  return tmp;
}

function preparingFilePath(tmp, runId) {
  return path.join(tmp, ".sdd-forge", `${PREPARING_PREFIX}${runId}`);
}

function ageFileByMs(filePath, ageMs) {
  const now = Date.now();
  const targetMs = now - ageMs;
  const targetSec = targetMs / 1000;
  fs.utimesSync(filePath, targetSec, targetSec);
}

describe("preparing flow stale cleanup (spec 222)", () => {
  let tmp;

  beforeEach(() => {
    tmp = createTmpDir("clean-stale-preparing-");
    setupProject(tmp);
  });

  afterEach(() => {
    removeTmpDir(tmp);
  });

  it("PREPARING_TTL_MS equals 60 * 60 * 1000 (1 hour)", () => {
    assert.equal(PREPARING_TTL_MS, 60 * 60 * 1000);
  });

  it("deletes files older than PREPARING_TTL_MS and keeps newer ones (AC-2)", () => {
    const fm = makeFlowManager(tmp);
    const newId = fm.generateRunId();
    const oldId = fm.generateRunId();
    fm.createPreparingFlow(newId, { issue: 1 });
    fm.createPreparingFlow(oldId, { issue: 2 });

    ageFileByMs(preparingFilePath(tmp, newId), 59 * 60 * 1000); // 59 min
    ageFileByMs(preparingFilePath(tmp, oldId), 61 * 60 * 1000); // 61 min

    const deleted = fm.cleanStalePreparingFlows();

    assert.deepEqual(deleted, [oldId]);
    assert.equal(fs.existsSync(preparingFilePath(tmp, newId)), true);
    assert.equal(fs.existsSync(preparingFilePath(tmp, oldId)), false);
  });

  it("returns empty array when no preparing flows exist", () => {
    const fm = makeFlowManager(tmp);
    const deleted = fm.cleanStalePreparingFlows();
    assert.deepEqual(deleted, []);
  });

  it("returns empty array when all preparing flows are fresh", () => {
    const fm = makeFlowManager(tmp);
    const a = fm.generateRunId();
    const b = fm.generateRunId();
    fm.createPreparingFlow(a, { issue: 1 });
    fm.createPreparingFlow(b, { issue: 2 });
    // freshly created files have mtime = now, so neither should be stale
    const deleted = fm.cleanStalePreparingFlows();
    assert.deepEqual(deleted, []);
    assert.equal(fs.existsSync(preparingFilePath(tmp, a)), true);
    assert.equal(fs.existsSync(preparingFilePath(tmp, b)), true);
  });
});
