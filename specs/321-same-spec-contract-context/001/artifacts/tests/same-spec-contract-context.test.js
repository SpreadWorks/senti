// spec: R1 R2 R3 R4 R5 R6 R7
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import * as gate from "../../../src/flow/lib/run-gate.js";
import { Agent } from "../../../src/lib/agent.js";
import { ProviderRegistry } from "../../../src/lib/provider.js";
import { Logger } from "../../../src/lib/log.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";
import { initGitRepo, commitAll, checkoutNewBranch } from "../../../tests/helpers/git-repo.js";
import { writePromptDispatchStubAgentScript, stubAgentConfig } from "../../../tests/helpers/stub-agent.js";
import { makeFlowState, moveFlowToStep } from "../../../tests/helpers/flow-setup.js";
import { writeIntegrationGateTrustArtifacts } from "../../../tests/helpers/integration-gate-artifacts.js";

const {
  RequirementGateBatch,
  buildImplCheckPrompt,
  planRequirementGateCalls,
  parseImplRequirementEvaluation,
} = gate;

function requirement(id, desc = `Implement ${id}.`) {
  return { id, desc, priority: "must" };
}

function makeSpec({ requirements, decisions = [], clarifications = [] }) {
  return {
    requirements,
    overview: { decisions },
    clarifications,
  };
}

function sharedDiff() {
  return [
    "diff --git a/src/output.js b/src/output.js",
    "--- a/src/output.js",
    "+++ b/src/output.js",
    "@@ -1 +1 @@",
    "-return [];",
    "+return { status: 'ready' };",
  ].join("\n");
}

function contextClass() {
  assert.equal(typeof gate.SameSpecContractContext, "function", "SameSpecContractContext export is required");
  return gate.SameSpecContractContext;
}

function buildContext(options) {
  const SameSpecContractContext = contextClass();
  return new SameSpecContractContext(options);
}

function promptFor({ spec, currentRequirementIds }) {
  buildContext({ spec, currentRequirementIds });
  const currentRequirements = spec.requirements.filter(({ id }) => currentRequirementIds.includes(id));
  return new RequirementGateBatch({
    requirements: currentRequirements,
    diff: sharedDiff(),
    structuredSpec: spec,
  }).buildPrompt().build();
}

function gateResponse(result, reason) {
  return JSON.stringify({
    evaluations: [
      { guardrail_id: "R1", result: "pass", reason: "Current required enum contract is present." },
      { guardrail_id: "R2", result: "pass", reason: "Current non-interception contract is present." },
      { guardrail_id: "R6", result, reason },
    ],
  });
}

function integrationSpec() {
  return {
    goal: "Evaluate preservation against the current same-spec contract.",
    background: "The legacy nullable output is retired.",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: {
      modules: [],
      data_flow: [],
      decisions: [{
        text: "R1 and R2 replace nullable and optional legacy output.",
        evidence: "The current schema is authoritative.",
        consideredAlternatives: "Nullable output was retired.",
      }],
    },
    requirements: [
      requirement("R1", "Output status is a required ready or blocked enum."),
      requirement("R2", "Valid current-contract output must not be intercepted."),
      requirement("R6", "Preserve output behavior without retaining retired forms from R1 and R2."),
    ],
    acceptance_criteria: [],
    clarifications: [{ q: "Is legacy [] valid?", a: "No; [] is explicitly invalid." }],
    alternatives_considered: [],
    open_questions: [],
  };
}

function setupIntegrationGateFixture(tmp, implementationLine) {
  const specId = "001-current-contract";
  const specPath = `specs/${specId}/spec.json`;
  const pass = gateResponse("pass", "Required enum and non-interception preserve the explicit current replacement contract.");
  const fail = gateResponse("fail", "The implementation violates the required enum or current-contract non-interception behavior.");
  const stubPath = writePromptDispatchStubAgentScript(tmp, ".stub-agent.js", [
    { includes: "return {}; // enumViolation", response: fail },
    { includes: "interceptCurrentOutput", response: fail },
    { includes: "R1 and R2 replace nullable and optional legacy output.", response: pass },
  ], fail);
  writeJson(tmp, ".senti/config.json", {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
    agent: stubAgentConfig(stubPath),
  });
  writeJson(tmp, "package.json", { name: "same-spec-contract-fixture", version: "0.0.0" });
  writeJson(tmp, specPath, integrationSpec());
  writeFile(tmp, `specs/${specId}/spec.md`, "# Current Contract Fixture\n");
  writeJson(tmp, `specs/${specId}/file-map.json`, {
    R1: ["src/output.js"],
    R2: ["src/output.js"],
    R6: ["src/output.js"],
  });
  writeFile(tmp, "src/contract.js", "export const statuses = ['ready', 'blocked'];\n");
  writeFile(tmp, "src/output.js", "export function output() { return []; }\n");
  writeIntegrationGateTrustArtifacts(tmp, {
    specId,
    requirementIds: ["R1", "R2", "R6"],
  });
  initGitRepo(tmp);
  commitAll(tmp, "initial");
  checkoutNewBranch(tmp, `feature/${specId}`);
  writeFile(tmp, "src/output.js", `export function output() { ${implementationLine} }\n`);
  commitAll(tmp, "implementation");

  const flowState = makeFlowState({
    spec: specPath,
    runId: `run-${specId}`,
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    requirements: [],
    tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
    currentTaskId: null,
    metrics: [],
  });
  moveFlowToStep(flowState, "impl-gate");
  writeJson(tmp, `specs/${specId}/flow.json`, flowState);
  writeJson(tmp, ".senti/.active-flow", [{ spec: specId, mode: "local" }]);
}

function runIntegrationGateFixture(implementationLine) {
  const tmp = createTmpDir("same-spec-contract-context-");
  try {
    setupIntegrationGateFixture(tmp, implementationLine);
    const result = spawnSync(
      "node",
      [path.join(process.cwd(), "src/senti.js"), "flow", "run", "gate", "--phase", "integration", "--skip-guardrail"],
      {
        encoding: "utf8",
        env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
      },
    );
    assert.equal(result.error, undefined, result.error?.message);
    return JSON.parse(result.stdout.trim());
  } finally {
    removeTmpDir(tmp);
  }
}

function makeCacheAgent(root, countFile) {
  const script = [
    "const fs=require('fs');",
    "const file=process.argv[1];",
    "let count=fs.existsSync(file)?Number(fs.readFileSync(file,'utf8')):0;",
    "count+=1;fs.writeFileSync(file,String(count));",
    "process.stdout.write('provider-'+count);",
  ].join("");
  const profile = { command: "node", args: ["-e", script, countFile, "{{PROMPT}}"] };
  const config = {
    agent: {
      default: "test/exec",
      providers: { "test/exec": profile },
      timeout: 300,
    },
  };
  const spec = "specs/cache/spec.json";
  return new Agent({
    config,
    paths: { root, agentWorkDir: path.join(root, ".tmp") },
    registry: new ProviderRegistry(config.agent.providers),
    logger: new Logger({ logDir: path.join(root, ".tmp"), enabled: false }),
    flowManager: {
      resolveCurrentContext() { return { spec, taskId: null, sentiPhase: "impl" }; },
      loadActiveFlows() { return [{ spec }]; },
      appendMetric() {},
      accumulateAgentMetrics() {},
    },
  });
}

describe("321: bounded same-spec contract context", () => {
  it("R1: serializes current full text and same-spec records with exact zero-based locators", () => {
    const spec = makeSpec({
      requirements: [
        requirement("R1", "Return a required status enum."),
        requirement("R2", "Do not intercept valid current output."),
        requirement("R3", "Preserve the current R1 and R2 contract."),
      ],
      decisions: [{
        text: "The required enum replaces the nullable legacy output.",
        evidence: "The current output schema requires status.",
        consideredAlternatives: "Keeping null was rejected.",
      }],
      clarifications: [{
        q: "Is the legacy empty array valid?",
        a: "No. An empty array is invalid under the current contract.",
      }],
    });

    const SameSpecContractContext = contextClass();
    const context = new SameSpecContractContext({ spec, currentRequirementIds: ["R3"] });
    const text = context.toPromptText();

    assert.ok(context instanceof SameSpecContractContext);
    assert.match(text, /requirements\[2\].*R3.*Preserve the current R1 and R2 contract\./);
    assert.match(text, /requirements\[0\].*R1.*Return a required status enum\./);
    assert.match(text, /requirements\[1\].*R2.*Do not intercept valid current output\./);
    assert.match(text, /overview\.decisions\[0\].*required enum replaces the nullable legacy output/s);
    assert.match(text, /clarifications\[0\].*legacy empty array.*empty array is invalid/s);
  });

  it("R2: orders current, explicitly referenced, and remaining unique requirements by source order", () => {
    const spec = makeSpec({
      requirements: [
        requirement("R4", "Unreferenced first source item."),
        requirement("R.2", "Referenced second source item with a regex metacharacter."),
        requirement("R1", "Referenced third source item."),
        requirement("R3", "Preserve R1 and R.2 while implementing R3."),
        requirement("R5", "Current second batch item."),
      ],
    });
    const text = buildContext({
      spec,
      currentRequirementIds: ["R5", "R3"],
    }).toPromptText();
    const positions = ["R3", "R5", "R.2", "R1", "R4"].map((id) => text.indexOf(` ${id}:`));

    assert.ok(positions.every((position) => position >= 0));
    assert.deepEqual([...positions].sort((a, b) => a - b), positions);
    for (const id of ["R1", "R.2", "R3", "R4", "R5"]) {
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, (character) => `\\${character}`);
      assert.equal(text.match(new RegExp(` ${escaped}:`, "g"))?.length, 1);
    }
  });

  it("R3: enforces item, count, and total bounds with whole-item truncation records", () => {
    const requirements = [requirement("R0", "Current requirement.")];
    for (let index = 1; index <= 66; index += 1) {
      requirements.push(requirement(`R${index}`, index === 1 ? `too-long-${"x".repeat(769)}` : `summary-${index}`));
    }
    const decisions = Array.from({ length: 25 }, (_, index) => ({
      text: index === 0 ? `too-long-${"d".repeat(1025)}` : `decision-${index}`,
      evidence: "",
      consideredAlternatives: "",
    }));
    const clarifications = Array.from({ length: 25 }, (_, index) => ({
      q: index === 0 ? `too-long-${"q".repeat(1025)}` : `question-${index}`,
      a: `answer-${index}`,
    }));
    const context = buildContext({
      spec: makeSpec({ requirements, decisions, clarifications }),
      currentRequirementIds: ["R0"],
    });
    const text = context.toPromptText();

    assert.ok(text.length <= 48000);
    assert.doesNotMatch(text, /too-long-/);
    const omittedRequirementChars = requirements[1].desc.length + requirements[66].desc.length;
    const omittedDecisionChars = decisions[0].text.length;
    const omittedClarificationChars = clarifications[0].q.length + clarifications[0].a.length;
    assert.match(text, new RegExp(`truncated requirements: omitted_items=2; original_characters=${omittedRequirementChars}`));
    assert.match(text, new RegExp(`truncated overview\\.decisions: omitted_items=1; original_characters=${omittedDecisionChars}`));
    assert.match(text, new RegExp(`truncated clarifications: omitted_items=1; original_characters=${omittedClarificationChars}`));
    assert.doesNotMatch(text, /summary-66/);

    const totalBoundContext = buildContext({
      spec: makeSpec({
        requirements: [
          requirement("R0", "Current requirement."),
          ...Array.from({ length: 64 }, (_, index) => requirement(`R${index + 1}`, `item-${index}-${"z".repeat(740)}`)),
        ],
        decisions: [{ text: "whole-decision-sentinel", evidence: "", consideredAlternatives: "" }],
      }),
      currentRequirementIds: ["R0"],
    }).toPromptText();
    assert.ok(totalBoundContext.length <= 48000);
    assert.doesNotMatch(totalBoundContext, /whole-decision-sentinel/);
    assert.match(totalBoundContext, /truncated overview\.decisions: omitted_items=1; original_characters=\d+/);
  });

  it("R4: produces byte-identical context and prompt output and rejects current-text overflow", () => {
    const spec = makeSpec({
      requirements: [
        requirement("R1", "Define the current output."),
        requirement("R2", "Preserve R1."),
      ],
      decisions: [{ text: "R1 replaces the legacy output.", evidence: "current spec", consideredAlternatives: "legacy" }],
      clarifications: [{ q: "Can legacy output remain?", a: "No." }],
    });
    const first = promptFor({ spec, currentRequirementIds: ["R2"] });
    const second = promptFor({ spec: structuredClone(spec), currentRequirementIds: ["R2"] });

    assert.equal(first.systemPrompt, second.systemPrompt);
    assert.equal(first.userPrompt, second.userPrompt);
    assert.deepEqual(first.jsonSchema, second.jsonSchema);
    assert.throws(
      () => buildContext({
        spec: makeSpec({ requirements: [requirement("R1", "x".repeat(48000))] }),
        currentRequirementIds: ["R1"],
      }),
      /48000|current requirement|contract context/i,
    );
  });

  it("R5: supplies authoritative replacement guidance for positive and negative preservation evidence", () => {
    const spec = makeSpec({
      requirements: [
        requirement("R1", "Output status is a required ready or blocked enum."),
        requirement("R2", "Valid current-contract output must not be intercepted."),
        requirement("R6", "Preserve output behavior without retaining retired forms from R1 and R2."),
      ],
      decisions: [{
        text: "R1 and R2 replace nullable and optional legacy output.",
        evidence: "The current schema is authoritative.",
        consideredAlternatives: "Nullable output was retired.",
      }],
      clarifications: [{ q: "Is legacy [] valid?", a: "No; [] is explicitly invalid." }],
    });
    const compliant = promptFor({ spec, currentRequirementIds: ["R6"] });

    assert.match(compliant.systemPrompt, /explicit same-spec.*replace|current-contract.*replace/is);
    assert.match(compliant.systemPrompt, /retire|invalidat/is);
    assert.match(compliant.userPrompt, /R1 and R2 replace nullable and optional legacy output/);
    assert.match(compliant.userPrompt, /\[\] is explicitly invalid/);

    const positive = runIntegrationGateFixture("return { status: 'ready' };");
    const enumNegative = runIntegrationGateFixture("return {}; // enumViolation");
    const interceptionNegative = runIntegrationGateFixture("if (validCurrentOutput) return null; // interceptCurrentOutput\nreturn { status: 'ready' };");
    assert.equal(positive.data.result, "pass", JSON.stringify(positive));
    assert.equal(enumNegative.data.result, "fail", JSON.stringify(enumNegative));
    assert.equal(interceptionNegative.data.result, "fail", JSON.stringify(interceptionNegative));
  });

  it("R6: retains one call for a shared batch and changes only integration context and guidance", () => {
    const requirements = [requirement("R1", "Implement output."), requirement("R2", "Preserve R1.")];
    const spec = makeSpec({ requirements });
    const diff = sharedDiff();
    const plan = planRequirementGateCalls({
      requirements,
      relatedDiffs: new Map([["R1", diff], ["R2", diff]]),
      fullSpecText: "unused",
      fullDiff: diff,
      phase: "integration",
      structuredSpec: spec,
    });

    assert.equal(plan.calls.length, 1);
    assert.deepEqual(plan.calls[0].requirementIds, ["R1", "R2"]);
    const integration = plan.calls[0].buildPrompt().build();
    const baseline = buildImplCheckPrompt({ requirements, diff, knownIds: ["R1", "R2"] }).build();
    assert.match(integration.userPrompt, /Same-Spec Contract Context/);
    assert.deepEqual(integration.jsonSchema, baseline.jsonSchema);
    assert.equal(integration.fmtFallback, baseline.fmtFallback);
    assert.equal(integration.userPrompt.replace(/\n\n## Same-Spec Contract Context\n[\s\S]*?(?=\n\n## Git Diff)/, ""), baseline.userPrompt);
    assert.equal(
      integration.systemPrompt.replace(/\n- Assess preservation[^\n]+/g, "").replace(/\n- Explicit same-spec[^\n]+/g, ""),
      baseline.systemPrompt,
    );
  });

  it("R6: preserves skip, parser/tooling, cache, retry-counter, and artifact contracts", async () => {
    const requirements = [requirement("R1"), requirement("R2"), requirement("R3")];
    const diff = sharedDiff();
    const plan = planRequirementGateCalls({
      requirements,
      relatedDiffs: new Map([["R1", diff], ["R2", diff], ["R3", ""]]),
      previouslyPassed: new Set(["R2"]),
      phase: "task-impl",
    });
    assert.deepEqual(plan.calls.flatMap((batch) => batch.requirementIds), ["R1"]);
    assert.deepEqual(plan.evaluations.map(({ guardrail_id, result, reason }) => ({ guardrail_id, result, reason })), [
      { guardrail_id: "R2", result: "pass", reason: "previously passed (skipped on retry)" },
      { guardrail_id: "R3", result: "skip", reason: "no related diff found" },
    ]);
    assert.throws(
      () => parseImplRequirementEvaluation("not-json", ["R1"]),
      gate.EvaluationSchemaError,
    );

    const repairAttempts = [];
    const repaired = await gate.evaluateGuardrailObservationsWithRetry({
      knownIds: ["g1"],
      phase: "integration",
      callAgent(request) {
        repairAttempts.push(request);
        if (request.attempt === 1) return "not-json";
        return JSON.stringify({ evaluations: [{ guardrail_id: "g1", result: "pass", reason: "repaired" }] });
      },
    });
    assert.deepEqual(repaired.observations, []);
    assert.deepEqual(repairAttempts, [
      { attempt: 1, repair: false, cacheMode: "default" },
      { attempt: 2, repair: true, cacheMode: "bypass" },
    ]);

    const metrics = [];
    const ctx = {
      flowState: {},
      flowManager: {
        appendMetric(input) { metrics.push(input); },
        mutate(fn) { fn(ctx.flowState); },
      },
    };
    gate.updateGateRetryCounter(ctx, { result: "pass", artifacts: { phase: "integration" } });
    gate.updateGateRetryCounter(ctx, {
      result: "fail",
      artifacts: { phase: "integration", failureKind: "ai_semantic_fail" },
    });
    assert.deepEqual(metrics, [
      { phase: "integration", counter: "gateRetry", delta: 0, reset: true },
      { phase: "integration", counter: "gateRetry", delta: 1 },
    ]);

    const artifactRoot = createTmpDir("same-spec-contract-artifact-");
    try {
      const gateResult = { result: "pass", artifacts: { phase: "integration", evaluations: [] } };
      const written = await gate.runGatePhaseWithDependencies({
        phase: "integration",
        specDir: artifactRoot,
        gateResult,
      });
      assert.deepEqual(written, { changed: ["impl-gate-result.json"] });
      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(artifactRoot, "impl-gate-result.json"), "utf8")),
        gateResult,
      );
    } finally {
      removeTmpDir(artifactRoot);
    }

    const cacheRoot = createTmpDir("same-spec-contract-cache-");
    try {
      const countFile = path.join(cacheRoot, "provider-count.txt");
      const agent = makeCacheAgent(cacheRoot, countFile);
      const decisions = [];
      const first = await agent.call("same-prompt", {
        commandId: "flow.spec.gate",
        systemPrompt: "same-system",
        jsonSchema: { type: "object" },
        fmtFallback: "same-fallback",
        onCacheDecision(decision) { decisions.push(decision.cacheOutcome); },
      });
      const second = await agent.call("same-prompt", {
        commandId: "flow.spec.gate",
        systemPrompt: "same-system",
        jsonSchema: { type: "object" },
        fmtFallback: "same-fallback",
        onCacheDecision(decision) { decisions.push(decision.cacheOutcome); },
      });
      const changed = await agent.call("same-prompt\n## Same-Spec Contract Context\nchanged", {
        commandId: "flow.spec.gate",
        systemPrompt: "same-system",
        jsonSchema: { type: "object" },
        fmtFallback: "same-fallback",
        onCacheDecision(decision) { decisions.push(decision.cacheOutcome); },
      });
      assert.deepEqual([first, second, changed], ["provider-1", "provider-1", "provider-2"]);
      assert.deepEqual(decisions, ["miss", "hit", "miss"]);
    } finally {
      removeTmpDir(cacheRoot);
    }
  });

  it("R7: leaves task-impl and context-free prompt builders unchanged", () => {
    const SameSpecContractContext = contextClass();
    const requirements = [requirement("R1")];
    const diff = sharedDiff();
    const taskPlan = planRequirementGateCalls({
      requirements,
      relatedDiffs: new Map([["R1", diff]]),
      fullSpecText: "# Full task spec",
      fullDiff: diff,
      phase: "task-impl",
    });
    const taskPrompt = taskPlan.calls[0].buildPrompt().build();
    const directPrompt = buildImplCheckPrompt({ requirements, diff, knownIds: ["R1"] }).build();

    assert.doesNotMatch(taskPrompt.userPrompt, /Same-Spec Contract Context/);
    assert.doesNotMatch(taskPrompt.systemPrompt, /current-contract preservation/i);
    assert.deepEqual(taskPrompt, directPrompt);

    assert.throws(
      () => new SameSpecContractContext({
        spec: { requirements: null, overview: { decisions: [] }, clarifications: [] },
        currentRequirementIds: ["R1"],
      }),
      /requirements.*array/i,
    );
    assert.throws(
      () => planRequirementGateCalls({
        requirements,
        relatedDiffs: new Map([["R1", diff]]),
        phase: "integration",
      }),
      /structured spec|same-spec contract/i,
    );

    const packageJson = JSON.parse(fs.readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));
    assert.equal(packageJson.dependencies, undefined);
    assert.equal(packageJson.devDependencies, undefined);
    assert.equal(packageJson.optionalDependencies, undefined);
    assert.equal(packageJson.peerDependencies, undefined);
    const classSource = SameSpecContractContext.toString();
    assert.doesNotMatch(classSource, /(?:321|439|#437|ready or blocked|legacy \[\])/i);
    assert.match(classSource, /constructor\s*\(/);
    assert.equal(typeof gate.SameSpecContractRecord, "function");
    assert.equal(typeof gate.SameSpecContractSection, "function");
    const context = new SameSpecContractContext({
      spec: makeSpec({ requirements: [requirement("R1"), requirement("R2")] }),
      currentRequirementIds: ["R1"],
    });
    assert.ok(context.requirements instanceof gate.SameSpecContractSection);
    assert.ok(context.requirements.records.every((record) => record instanceof gate.SameSpecContractRecord));

    const nonImplPrompt = gate.buildGuardrailArticleEvalPrompt(
      "target text",
      [{ id: "g1", title: "Guardrail", body: "Check the target.", meta: { category: "spec" } }],
      "spec",
    ).build();
    assert.doesNotMatch(nonImplPrompt.userPrompt, /Same-Spec Contract Context/);
    assert.doesNotMatch(nonImplPrompt.systemPrompt, /current-contract preservation/i);
    assert.equal(gate.resolveGateStepId("draft"), "draft-gate");
    assert.equal(gate.resolveGateStepId("spec"), "spec-gate");
    assert.equal(gate.resolveGateStepId("test"), "spec-gate");
    assert.equal(gate.resolveGateStepId("acceptance"), "spec-gate");
  });
});
