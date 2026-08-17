// spec: R1 R2 R3 R4 R5 R6
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as runGate from "../../../src/flow/lib/run-gate.js";
import * as reviewEvidence from "../../../src/flow/lib/set-review-evidence.js";

async function executeProductionGate(scenario) {
  const root = mkdtempSync(path.join(tmpdir(), "senti-gate-production-"));
  try {
    mkdirSync(path.join(root, ".senti"), { recursive: true });
    writeFileSync(path.join(root, ".senti", "config.json"), JSON.stringify({
      lang: "en", type: scenario.presetChain?.includes("missing-preset") ? "missing-preset" : "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
    }));
    const guardrail = {
      id: "required-guardrail",
      title: "Required guardrail",
      body: "The target must be evaluated.",
      meta: { category: "quality", phase: ["spec"] },
    };
    const configuredEvaluation = scenario.requiredAgent?.output || scenario.requiredGuardrail?.output;
    const agent = {
      resolve() { return scenario.requiredAgent !== null; },
      async call() {
        if (scenario.requiredAgent?.spawnError) {
          throw Object.assign(new Error(scenario.requiredAgent.spawnError), { code: "ENOENT" });
        }
        if (scenario.requiredAgent?.evaluationError) throw new Error(scenario.requiredAgent.evaluationError);
        if (typeof configuredEvaluation === "string") return configuredEvaluation;
        if (configuredEvaluation && !configuredEvaluation.result) return JSON.stringify(configuredEvaluation);
        if (configuredEvaluation?.result === "fail") {
          return JSON.stringify({ observations: [{
            failureMode: "guardrail-violation",
            requirementRef: guardrail.id,
            where: { file: "specs/demo/spec.json", locator: null },
            observed: configuredEvaluation.reason,
          }] });
        }
        return JSON.stringify({ observations: [] });
      },
    };
    const result = await runGate.runGateFlow({
      root, level: "parent", phase: "spec", targetPath: "specs/demo/spec.json", targetText: "{}",
      textCheck() { return []; }, checkerRole: "flow.spec.gate", skipGuardrail: false,
      guardrailPromptOptions: {
        agent,
        loadGuardrails() {
          if (scenario.requiredGuardrail === null) return null;
          if (Array.isArray(scenario.requiredGuardrail)) return scenario.requiredGuardrail;
          if (scenario.requiredGuardrail?.spawnError) {
            throw Object.assign(new Error(scenario.requiredGuardrail.spawnError), { code: "ENOENT" });
          }
          if (scenario.requiredGuardrail?.evaluationError) throw new Error(scenario.requiredGuardrail.evaluationError);
          return [guardrail];
        },
      },
    });
    return result;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("gate fail-closed specification", () => {
  it("R1: validates the complete preset chain once before semantic evaluation", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "senti-gate-prerequisite-"));
    let semanticCalls = 0;
    try {
      mkdirSync(path.join(root, ".senti"), { recursive: true });
      writeFileSync(path.join(root, ".senti", "config.json"), JSON.stringify({ type: "missing-preset" }));
      writeFileSync(path.join(root, "task.md"), "# task\n");
      assert.equal(typeof runGate.runGateFlow, "function");
      const result = await runGate.runGateFlow({
        root,
        level: "task",
        phase: "task-spec",
        targetPath: "task.md",
        targetText: "# task\n",
        textCheck() { semanticCalls += 1; return []; },
        skipGuardrail: false,
      });
      assert.equal(semanticCalls, 0);
      assert.equal(result.result, "fail");
      assert.equal(result.artifacts.failureKind, "prerequisite");
      assert.equal(result.artifacts.failureCode, "GATE_PRESET_NOT_FOUND");
      assert.equal(result.artifacts.warnings.length, 1);

      const cli = path.resolve(process.cwd(), "src/senti.js");
      let output;
      try {
        execFileSync(process.execPath, [
          cli, "flow", "run", "gate", "--phase", "task-spec", "--spec", "task.md",
        ], { cwd: root, encoding: "utf8", stdio: "pipe" });
        assert.fail("missing preset gate must return a failure envelope");
      } catch (error) {
        output = error.stdout;
      }
      const envelope = JSON.parse(output);
      assert.equal(envelope.errors[0].code, "GATE_PRESET_NOT_FOUND");
      assert.doesNotMatch(output, /retry/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("R2: blocks every unavailable required evaluation through the production gate", async () => {
    for (const scenario of [
      { requiredAgent: null, expected: "GATE_REQUIRED_AGENT_UNSET" },
      { requiredAgent: { spawnError: "unavailable" }, expected: "GATE_REQUIRED_AGENT_SPAWN" },
      { requiredAgent: { evaluationError: "unavailable" }, expected: "GATE_REQUIRED_AGENT_EVALUATION" },
      { requiredAgent: { output: "not-json" }, expected: "GATE_REQUIRED_OUTPUT" },
      { requiredAgent: { output: { unsupported: true } }, expected: "GATE_REQUIRED_SCHEMA" },
      { requiredGuardrail: null, expected: "GATE_REQUIRED_GUARDRAIL_UNSET" },
      { requiredGuardrail: [], expected: "GATE_REQUIRED_GUARDRAIL_UNSET" },
      { requiredGuardrail: { spawnError: "unavailable" }, expected: "GATE_REQUIRED_GUARDRAIL_SPAWN" },
      { requiredGuardrail: { evaluationError: "unavailable" }, expected: "GATE_REQUIRED_GUARDRAIL" },
    ]) {
      const result = await executeProductionGate(scenario);
      assert.equal(result.result, "fail", scenario.expected);
      assert.equal(result.artifacts.failureCode, scenario.expected);
      assert.notEqual(result.result, "pass");
    }
  });

  it("R3: persists typed failure artifacts and semantic evidence", async () => {
    const prerequisite = await executeProductionGate({ presetChain: ["missing-preset"] });
    const schema = await executeProductionGate({ requiredAgent: { output: { unsupported: true } } });
    const semantic = await executeProductionGate({ requiredAgent: { output: { result: "fail", reason: "actual finding" } } });
    assert.equal(prerequisite.artifacts.failureKind, "prerequisite");
    assert.equal(schema.artifacts.failureCode, "GATE_REQUIRED_SCHEMA");
    assert.equal(semantic.artifacts.evaluations[0].guardrail_id, "required-guardrail");
    assert.equal(semantic.artifacts.evaluations[0].result, "fail");
    assert.equal(semantic.artifacts.evaluations[0].reason, "actual finding");
    assert.match(semantic.artifacts.reasons[0].detail, /actual finding/);
  });

  it("R4: preserves configured PASS and FAIL evaluations and registry transitions", async () => {
    const pass = await executeProductionGate({
      requiredAgent: { output: { result: "pass", reason: "complete" } },
    });
    const fail = await executeProductionGate({
      requiredAgent: { output: { result: "fail", reason: "blocked" } },
    });
    assert.equal(pass.result, "pass");
    assert.equal(pass.artifacts.evaluations[0].guardrail_id, "required-guardrail");
    assert.equal(pass.artifacts.evaluations[0].result, "pass");
    assert.equal(fail.result, "fail");
    assert.match(fail.artifacts.reasons[0].detail, /blocked/);

    const foreignRoot = mkdtempSync(path.join(tmpdir(), "senti-gate-foreign-"));
    try {
      mkdirSync(path.join(foreignRoot, ".senti"), { recursive: true });
      writeFileSync(path.join(foreignRoot, ".senti", "config.json"), JSON.stringify({
        lang: "en", type: "base", docs: { languages: ["en"], defaultLanguage: "en" },
      }));
      const foreignOptional = await runGate.runGateFlow({
        root: foreignRoot,
        level: "parent", phase: "spec", targetPath: "specs/demo/spec.json", targetText: "{}",
        textCheck() { return []; }, checkerRole: "flow.spec.gate", skipGuardrail: false,
        checkGuardrailFn() {
          return { passed: true, evaluations: [
            { guardrail_id: "configured", result: "pass", reason: "complete" },
            { guardrail_id: "foreign-optional", result: "skip", reason: "foreign" },
          ] };
        },
      });
      assert.equal(foreignOptional.result, "pass");
      assert.deepEqual(foreignOptional.artifacts.evaluations.map((entry) => entry.guardrail_id), ["configured", "foreign-optional"]);
    } finally {
      rmSync(foreignRoot, { recursive: true, force: true });
    }

    let completedTaskId = null;
    await runGate.executeGateSideEffects({
      flowState: { currentTaskId: "T-1" },
      flowManager: {
        load() { return { currentTaskId: "T-1" }; },
        completeTask(taskId) { completedTaskId = taskId; },
        mutate(fn) { fn({}); },
      },
    }, "task-impl");
    assert.equal(completedTaskId, "T-1");
  });

  it("R5: rejects public CLI evaluation-bypass controls while test fixtures remain internal", () => {
    assert.equal(typeof runGate.parsePublicGateArguments, "function");
    assert.throws(
      () => runGate.parsePublicGateArguments(["--skip-required-evaluation"]),
      (error) => error.code === "GATE_REQUIRED_EVALUATION_BYPASS_FORBIDDEN",
    );
    const cli = path.resolve(process.cwd(), "src/senti.js");
    assert.throws(() => execFileSync(process.execPath, [
      cli,
      "flow",
      "run",
      "gate",
      "--phase",
      "spec",
      "--skip-guardrail",
    ], { encoding: "utf8", stdio: "pipe" }), (error) => {
      const output = `${error.stdout || ""}\n${error.stderr || ""}`;
      return /unknown option|unknown argument|--skip-guardrail/i.test(output);
    });
    assert.throws(() => execFileSync(process.execPath, [
      cli,
      "flow",
      "run",
      "gate",
      "--phase",
      "spec",
      "--test-fixture",
      "required-agent-pass",
    ], { encoding: "utf8", stdio: "pipe" }), (error) => {
      const output = `${error.stdout || ""}\n${error.stderr || ""}`;
      return /unknown option|unknown argument|--test-fixture/i.test(output);
    });
    assert.throws(() => execFileSync(process.execPath, [
      cli,
      "flow",
      "run",
      "gate",
      "--phase",
      "spec",
      "--test-fixture=required-agent-pass",
    ], { encoding: "utf8", stdio: "pipe" }), (error) => {
      const output = `${error.stdout || ""}\n${error.stderr || ""}`;
      return /unknown option|unknown argument|--test-fixture/i.test(output);
    });
    assert.deepEqual(runGate.parsePublicGateArguments([]), {});
  });

  it("R6: recovers a finalized flow-level artifact without another provider call and rejects stale targets", () => {
    assert.equal(typeof reviewEvidence.recoverFinalizedFlowReviewEvidence, "function");
    let providerCalls = 0;
    const registered = [];
    const state = { phase: "spec", taskId: null, treeSha: "a".repeat(40), targetStateDigest: "b".repeat(64) };
    const providerArtifact = {
      phase: "spec",
      taskId: null,
      treeSha: state.treeSha,
      targetStateDigest: state.targetStateDigest,
      verdict: "PASS",
      findings: [],
      finalized: true,
    };
    const recovered = reviewEvidence.recoverFinalizedFlowReviewEvidence({
      providerArtifact,
      state,
      invokeProvider() { providerCalls += 1; },
      canonicalEvidenceStore: {
        register(evidence) { registered.push(evidence); },
      },
    });
    assert.equal(providerCalls, 0);
    assert.equal(recovered.phase, "spec");
    assert.equal(recovered.taskId, null);
    assert.equal(recovered.treeSha, state.treeSha);
    assert.equal(registered.length, 1);
    assert.equal(registered[0].phase, "spec");
    assert.equal(registered[0].taskId, null);
    assert.equal(registered[0].treeSha, state.treeSha);
    assert.equal(registered[0].targetStateDigest, state.targetStateDigest);
    assert.equal(registered[0].identity.evidenceDigest.length, 64);
    for (const staleArtifact of [
      { ...providerArtifact, phase: "draft-questions" },
      { ...providerArtifact, taskId: "T-1" },
      { ...providerArtifact, treeSha: "c".repeat(40) },
      { ...providerArtifact, targetStateDigest: undefined },
      { ...providerArtifact, targetStateDigest: "d".repeat(64) },
    ]) {
      assert.throws(
        () => reviewEvidence.recoverFinalizedFlowReviewEvidence({
          providerArtifact: staleArtifact,
          state,
          invokeProvider() { providerCalls += 1; },
          canonicalEvidenceStore: {
            register(evidence) { registered.push(evidence); },
          },
        }),
        /phase|task|tree|state/i,
      );
    }
    assert.equal(providerCalls, 0);
  });
});
