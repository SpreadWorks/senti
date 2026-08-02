/**
 * tests/unit/flow/run-retro-no-missing-requirements.test.js
 *
 * spec 251: retro is now a result-file aggregator that requires the artifacts
 * produced by the upstream test-execute and test-result-review steps. The
 * dry-run path returns an aggregated result without writing retro.json. The
 * fail path returns an Envelope.fail when an upstream artifact is missing.
 *
 * Historical context (spec 219 R2): retro used to call AI/diff on spec.md.
 * That entrypoint was replaced; this test now verifies the new artifact
 * dependency contract.
 */

// spec: R5 R52
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { RunRetroCommand } from "../../../src/flow/lib/run-retro.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { buildRepairFingerprint } from "../../../src/flow/lib/impl-repair-artifacts.js";
import { writeRepairFingerprintManifest } from "../../../src/flow/lib/repair-state-identity.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";

function createRepo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "retro-req-"));
  execFileSync("git", ["init", tmp], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "config", "user.email", "t@t.t"], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "config", "user.name", "t"], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "commit", "--allow-empty", "-m", "init"], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "checkout", "-b", "main"], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "checkout", "-b", "feature/001-test"], { stdio: "ignore" });
  fs.writeFileSync(path.join(tmp, "change.txt"), "hello\n");
  execFileSync("git", ["-C", tmp, "add", "."], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "commit", "-m", "change"], { stdio: "ignore" });
  return tmp;
}

function writeSpec(tmp, specId, requirements) {
  const specDir = path.join(tmp, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({
    goal: "test",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements,
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  }, null, 2));
  fs.writeFileSync(path.join(specDir, "spec.md"), "# Spec\n");
  return specDir;
}

function writeArtifacts(specDir, summary, verdict = "pass") {
  const root = path.dirname(path.dirname(specDir));
  const specPath = path.relative(root, path.join(specDir, "spec.json"));
  const rawOutput = path.join(specDir, "tests", ".raw", "test-execution.log");
  fs.mkdirSync(path.dirname(rawOutput), { recursive: true });
  fs.writeFileSync(rawOutput, "raw output\n");
  const repairFingerprint = buildRepairFingerprint({ root, specPath }).hash;
  fs.writeFileSync(path.join(specDir, "test-execute-result.json"), JSON.stringify({
    version: "2",
    raw_output_path: path.relative(path.dirname(specDir), rawOutput),
    summary,
    regression: {
      required: false,
      result: "skipped",
      mode: "none",
      changed_files: [],
      trigger_relevant_changed_files: [],
      category: "spec-artifact-only",
      reason: "unit fixture",
      classified_paths: [],
    },
    repairFingerprint,
  }, null, 2));
  fs.writeFileSync(path.join(specDir, "test-result-review.json"), JSON.stringify({
    verdict,
    checked_items: [{ check: "project_regression_verification", result: "pass" }],
    result_file_path: path.join(specDir, "test-execute-result.json"),
    raw_output_path: rawOutput,
    repairFingerprint,
  }, null, 2));
}

describe("R5: retro reads test-execute-result.json (spec 251)", () => {
  let tmp;
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  it("R5: dry-run retro aggregates pass/fail per requirement when artifacts exist", async () => {
    tmp = createRepo();
    const specId = "001-test";
    const specDir = writeSpec(tmp, specId, [
      { id: "R1", desc: "first", priority: "must", status: "pending" },
    ]);
    writeArtifacts(specDir, [
      {
        id: "R1",
        result: "pass",
        evidence: {
          test_file: "f.test.js",
          test_name: "R1: works",
          command: "node --test",
          raw_output_lines: { start_line: 1, end_line: 2 },
        },
      },
    ]);

    const ctx = {
      root: tmp,
      dryRun: true,
      flowState: {
        specId: specId,
        baseBranch: "main",
        requirements: [],
      },
    };

    const cmd = new RunRetroCommand();
    const out = await cmd.execute(ctx);
    assert.equal(out.result, "dry-run", JSON.stringify(out));
    assert.equal(out.artifacts.summary.total, 1);
    assert.equal(out.artifacts.summary.done, 1);
  });

  it("R5: returns Envelope.fail when test-execute-result.json is missing", async () => {
    tmp = createRepo();
    const specId = "001-test";
    writeSpec(tmp, specId, [
      { id: "R1", desc: "first", priority: "must", status: "pending" },
    ]);

    const ctx = {
      root: tmp,
      dryRun: true,
      flowState: {
        specId: specId,
        baseBranch: "main",
        requirements: [],
      },
    };

    const cmd = new RunRetroCommand();
    const result = await cmd.execute(ctx);
    assert.equal(result.ok, false);
    const msgs = result.errors.flatMap((e) => e.messages);
    assert.ok(
      msgs.some((m) => /test-result-review|test-execute/i.test(m)),
      `error must reference upstream artifact: ${msgs.join("; ")}`,
    );
  });

  it("rewinds stale post-gate evidence to test-execute instead of stranding retro", async () => {
    tmp = createRepo();
    const specId = "001-test";
    const specPath = `specs/${specId}/spec.json`;
    const specDir = writeSpec(tmp, specId, [
      { id: "R1", desc: "first", priority: "must", status: "pending" },
    ]);
    const state = moveFlowToStep(makeFlowState({ specId }), "retro");
    const previous = buildRepairFingerprint({ root: tmp, specPath, state });
    state.repairBaseline = previous.baseline.toJSON();
    writeRepairFingerprintManifest(specDir, previous);
    writeArtifacts(specDir, [{
      id: "R1",
      result: "pass",
      evidence: {
        test_file: "f.test.js",
        test_name: "R1: works",
        command: "node --test",
        raw_output_lines: { start_line: 1, end_line: 1 },
      },
    }]);
    fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "src", "post-gate-repair.js"), "export const repaired = true;\n");
    const flowManager = new FlowManager({
      root: tmp,
      mainRoot: tmp,
      inWorktree: false,
    });
    flowManager.create(state);

    const result = await new RunRetroCommand().execute({
      root: tmp,
      flowState: flowManager.loadReadOnly(),
      flowManager,
    });
    await FLOW_COMMANDS.run.retro.post({
      root: tmp,
      flowState: flowManager.loadReadOnly(),
      flowManager,
    }, result);
    const recoveredState = flowManager.loadReadOnly();

    assert.equal(result.result, "recovered");
    assert.equal(result.next, "test-execute");
    assert.equal(result.artifacts.evidenceRefresh.recovered, true);
    assert.equal(findStepById(recoveredState.steps, "test-execute").status, "in_progress");
    assert.equal(findStepById(recoveredState.steps, "retro").status, "pending");
    assert.equal(fs.existsSync(path.join(specDir, "test-execute-result.json")), false);
    assert.equal(fs.existsSync(path.join(specDir, "test-result-review.json")), false);
  });
});
