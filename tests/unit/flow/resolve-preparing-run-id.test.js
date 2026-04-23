import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import { resolvePreparingRunId } from "../../../src/flow/lib/resolve-preparing-run-id.js";

function setupProject(tmp) {
  writeJson(tmp, ".sdd-forge/config.json", {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  });
  writeJson(tmp, "package.json", { name: "fixture", version: "0.0.0" });
  return tmp;
}

describe("resolve-preparing-run-id — removal of single auto-select heuristic (spec 220)", () => {
  let tmp;

  beforeEach(() => {
    tmp = createTmpDir("resolve-preparing-");
    setupProject(tmp);
  });

  afterEach(() => {
    removeTmpDir(tmp);
  });

  it("returns fail (MISSING_RUN_ID) when one preparing exists and --run-id is omitted", () => {
    const fm = makeFlowManager(tmp);
    const only = fm.generateRunId();
    fm.createPreparingFlow(only, { issue: 1 });

    const result = resolvePreparingRunId(fm, undefined, {
      type: "run",
      key: "auto-check",
    });
    assert.ok(result.fail, `expected fail envelope, got ${JSON.stringify(result)}`);
    const envelope = result.fail;
    assert.equal(envelope.ok, false);
    const codes = (envelope.errors || []).map((e) => e.code);
    assert.ok(
      codes.includes("MISSING_RUN_ID"),
      `expected MISSING_RUN_ID, got ${codes.join(",")}`,
    );
  });

  it("returns fail (MISSING_RUN_ID) for set-auto call site (zeroPreparingAsFail) with one preparing + no runId", () => {
    const fm = makeFlowManager(tmp);
    const only = fm.generateRunId();
    fm.createPreparingFlow(only, { issue: 1 });

    const result = resolvePreparingRunId(fm, undefined, {
      type: "set",
      key: "auto",
      zeroPreparingAsFail: true,
    });
    assert.ok(result.fail);
    const codes = (result.fail.errors || []).map((e) => e.code);
    assert.ok(codes.includes("MISSING_RUN_ID"));
  });

  it("returns fail (MISSING_RUN_ID) with two preparing + no runId", () => {
    const fm = makeFlowManager(tmp);
    fm.createPreparingFlow(fm.generateRunId(), { issue: 1 });
    fm.createPreparingFlow(fm.generateRunId(), { issue: 2 });

    const result = resolvePreparingRunId(fm, undefined, {
      type: "run",
      key: "auto-check",
    });
    assert.ok(result.fail);
    const codes = (result.fail.errors || []).map((e) => e.code);
    assert.ok(codes.includes("MISSING_RUN_ID"));
  });

  it("accepts explicit --run-id when it matches an existing preparing flow", () => {
    const fm = makeFlowManager(tmp);
    const target = fm.generateRunId();
    fm.createPreparingFlow(target, { issue: 1 });

    const result = resolvePreparingRunId(fm, target, {
      type: "run",
      key: "auto-check",
    });
    assert.equal(result.runId, target);
    assert.equal(result.fail, undefined);
  });

  it("returns fail when --run-id does not match any preparing", () => {
    const fm = makeFlowManager(tmp);
    fm.createPreparingFlow(fm.generateRunId(), { issue: 1 });

    const result = resolvePreparingRunId(fm, "nonexistent-id", {
      type: "run",
      key: "auto-check",
    });
    assert.ok(result.fail);
    const codes = (result.fail.errors || []).map((e) => e.code);
    assert.ok(
      codes.includes("PREPARING_FLOW_NOT_FOUND"),
      `expected PREPARING_FLOW_NOT_FOUND, got ${codes.join(",")}`,
    );
  });

  it("returns {runId: null} when zero preparing and zeroPreparingAsFail is false", () => {
    const fm = makeFlowManager(tmp);

    const result = resolvePreparingRunId(fm, undefined, {
      type: "run",
      key: "auto-check",
      zeroPreparingAsFail: false,
    });
    assert.equal(result.runId, null);
    assert.equal(result.fail, undefined);
  });
});
