import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  checkGuardrail,
  runGateFlow,
} from "../../../src/flow/lib/run-gate.js";
import {
  SpecTestCoverageDecision,
} from "../../../src/flow/lib/spec-test-coverage.js";

const GUARDRAIL = Object.freeze({
  id: "spec-test-coverage",
  title: "Spec Test Coverage",
  body: "Spec-local tests must cover testable requirements.",
  meta: { phase: ["spec"], category: "testing" },
});
const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));

describe("mechanical spec test coverage gate authority", () => {
  it("does not ask the semantic agent for downstream test evidence during spec", async () => {
    const decision = new SpecTestCoverageDecision({
      phase: "spec",
      guardrail: GUARDRAIL,
    });
    let agentCalled = false;
    const agent = {
      resolve: () => true,
      call: async () => {
        agentCalled = true;
        throw new Error("semantic agent must not own mechanical coverage");
      },
    };

    const semanticResult = await checkGuardrail(
      PROJECT_ROOT,
      "{}",
      "spec",
      undefined,
      [],
      {
        loadGuardrails: () => [GUARDRAIL],
        agent,
        excludedGuardrailIds: [GUARDRAIL.id],
      },
    );
    const result = await runGateFlow({
      root: PROJECT_ROOT,
      config: {},
      level: "parent",
      phase: "spec",
      targetPath: "specs/001-example/spec.json",
      targetText: "{}",
      textCheck: () => [],
      skipGuardrail: false,
      authoritativeEvaluations: [decision.toGateEvaluation()],
      checkGuardrailFn: async (_root, _text, _phase, _role, _passed, options) => {
        assert.deepEqual(options.excludedGuardrailIds, [GUARDRAIL.id]);
        return semanticResult;
      },
    });

    assert.equal(agentCalled, false);
    assert.equal(result.result, "pass");
    assert.deepEqual(
      result.artifacts.evaluations.map((evaluation) => [
        evaluation.guardrail_id,
        evaluation.result,
        evaluation.authority,
      ]),
      [[GUARDRAIL.id, "pass", "mechanical"]],
    );
  });

  it("continues evaluating semantic guardrails owned by the spec phase", async () => {
    const decision = new SpecTestCoverageDecision({
      phase: "spec",
      guardrail: GUARDRAIL,
    });
    let semanticCalls = 0;

    const result = await runGateFlow({
      root: PROJECT_ROOT,
      config: {},
      level: "parent",
      phase: "spec",
      targetPath: "specs/001-example/spec.json",
      targetText: "{}",
      textCheck: () => [],
      skipGuardrail: false,
      authoritativeEvaluations: [decision.toGateEvaluation()],
      checkGuardrailFn: async () => {
        semanticCalls += 1;
        return {
          passed: false,
          evaluations: [{
            guardrail_id: "spec-other",
            result: "fail",
            reason: "semantic spec issue",
            category: "process",
            title: "Other Spec Guardrail",
          }],
        };
      },
    });

    assert.equal(semanticCalls, 1);
    assert.equal(result.result, "fail");
    assert.equal(result.artifacts.failureKind, "ai_semantic_fail");
    assert.deepEqual(
      result.artifacts.evaluations.map((evaluation) => evaluation.guardrail_id),
      [GUARDRAIL.id, "spec-other"],
    );
  });
});
