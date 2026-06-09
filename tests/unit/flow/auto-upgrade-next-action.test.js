import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { spawnSync } from "node:child_process";
import { setupFlow, setStepDone } from "../../helpers/flow-setup.js";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";

function createTmp() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "auto-upgrade-na-"));
  fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "specs", "001-test"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, ".senti", "config.json"),
    JSON.stringify({
      lang: "ja",
      type: "base",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    }),
  );
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "fixture" }));
  return tmp;
}

function runNextAction(tmp) {
  const script = path.resolve("src/senti.js");
  return spawnSync("node", [script, "flow", "get", "next-action"], {
    encoding: "utf8",
    cwd: tmp,
    env: { ...process.env, SENTI_WORK_ROOT: tmp },
  });
}

describe("spec 232: autoUpgrade in next-action envelope (R3, T-4)", () => {
  let tmp;
  afterEach(() => { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });

  it("includes autoUpgrade in envelope when available (AC5)", () => {
    tmp = createTmp();
    const state = setupFlow(tmp, {
      autoUpgrade: { available: true, reason: "re-eval eligible" },
    });
    setStepDone(state, "branch", "prepare-spec", "draft", "draft-gate", "spec", "spec-gate", "approval");
    const testStep = findStepById(state.steps, "test");
    testStep.status = "in_progress";
    makeFlowManager(tmp).save(state);

    const res = runNextAction(tmp);
    assert.equal(res.status, 0, res.stderr);
    const envelope = JSON.parse(res.stdout.trim());
    assert.ok(envelope.ok);
    assert.ok(envelope.data.autoUpgrade, "autoUpgrade must be present");
    assert.equal(envelope.data.autoUpgrade.available, true);
  });

  it("omits autoUpgrade from envelope when not set", () => {
    tmp = createTmp();
    const state = setupFlow(tmp);
    setStepDone(state, "branch", "prepare-spec", "draft", "draft-gate", "spec", "spec-gate", "approval");
    const testStep = findStepById(state.steps, "test");
    testStep.status = "in_progress";
    makeFlowManager(tmp).save(state);

    const res = runNextAction(tmp);
    assert.equal(res.status, 0, res.stderr);
    const envelope = JSON.parse(res.stdout.trim());
    assert.ok(envelope.ok);
    assert.equal(envelope.data.autoUpgrade, undefined, "autoUpgrade must not be present when unset");
  });
});
