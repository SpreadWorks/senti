/**
 * Tests for spec 217 (Issue #225 follow-up): finalize success envelope carries
 * a `data.nextCommand` hint so AI clients that consume the envelope mechanically
 * can run `sdd-forge flow report show` after finalize completes — even when the
 * dispatcher prompt (`src/flow/prompts/impl/finalize.md`) is not read.
 *
 * REQ-2: On success (result === "ok", dryRun === false), data.nextCommand equals
 *        "sdd-forge flow report show".
 * REQ-3: On preflight_failed / merge_failed / dry-run, data.nextCommand is absent.
 *
 * The happy-path and dry-run cases are exercised behaviorally via
 * `buildFinalizeSuccessEnvelope`; the early-return paths (preflight_failed,
 * merge_failed) require heavy git/ctx fixtures to trigger at the `execute()`
 * level, so their exclusion of `nextCommand` is verified by source inspection
 * to act as a safety-net against accidental inclusion.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  REPORT_SHOW_COMMAND,
  buildFinalizeSuccessEnvelope,
} from "../../../src/flow/lib/run-finalize.js";

const STATE_FIXTURE = Object.freeze({
  baseBranch: "main",
  featureBranch: "feature/x",
  worktree: true,
  spec: "specs/xxx/spec.md",
});

describe("buildFinalizeSuccessEnvelope — REPORT_SHOW_COMMAND hint (spec 217 REQ-2/REQ-3)", () => {
  it("exports the canonical command literal", () => {
    assert.equal(REPORT_SHOW_COMMAND, "sdd-forge flow report show");
  });

  it("ok envelope (dryRun=false) includes data.nextCommand equal to REPORT_SHOW_COMMAND", () => {
    const envelope = buildFinalizeSuccessEnvelope({
      dryRun: false,
      steps: { commit: { status: "done" } },
      state: STATE_FIXTURE,
    });
    assert.equal(envelope.result, "ok");
    assert.equal(envelope.nextCommand, REPORT_SHOW_COMMAND);
  });

  it("dry-run envelope omits data.nextCommand entirely", () => {
    const envelope = buildFinalizeSuccessEnvelope({
      dryRun: true,
      steps: { commit: { status: "dry-run" } },
      state: STATE_FIXTURE,
    });
    assert.equal(envelope.result, "dry-run");
    assert.ok(!("nextCommand" in envelope), "dry-run envelope must not contain nextCommand");
  });

  it("ok envelope preserves the existing artifacts shape alongside nextCommand", () => {
    const envelope = buildFinalizeSuccessEnvelope({
      dryRun: false,
      steps: {},
      state: STATE_FIXTURE,
    });
    assert.deepEqual(envelope.artifacts, {
      baseBranch: "main",
      featureBranch: "feature/x",
      worktree: true,
      spec: "specs/xxx/spec.md",
    });
  });
});

describe("run-finalize source — early-return envelopes do NOT leak nextCommand (spec 217 REQ-3)", () => {
  const sourcePath = path.join(process.cwd(), "src/flow/lib/run-finalize.js");
  const source = fs.readFileSync(sourcePath, "utf8");

  it("preflight_failed return block does not reference nextCommand", () => {
    const match = source.match(/result:\s*"preflight_failed"[\s\S]*?^\s*\};/m);
    assert.ok(match, "preflight_failed return block must exist");
    assert.doesNotMatch(
      match[0],
      /nextCommand/,
      "preflight_failed envelope must not include nextCommand",
    );
  });

  it("merge_failed return block does not reference nextCommand", () => {
    const match = source.match(/result:\s*"merge_failed"[\s\S]*?^\s*\};/m);
    assert.ok(match, "merge_failed return block must exist");
    assert.doesNotMatch(
      match[0],
      /nextCommand/,
      "merge_failed envelope must not include nextCommand",
    );
  });
});
