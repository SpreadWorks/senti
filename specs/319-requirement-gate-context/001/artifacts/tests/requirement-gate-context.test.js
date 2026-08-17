// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Agent } from "../../../src/lib/agent.js";
import { Container } from "../../../src/lib/container.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { checkoutNewBranch, commitAll, initGitRepo } from "../../../tests/helpers/git-repo.js";
import { writeCapturingStubAgentScript, stubAgentConfig } from "../../../tests/helpers/stub-agent.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";
import * as gate from "../../../src/flow/lib/run-gate.js";

const {
  MAX_REQUIREMENT_CONTEXT_CHARS,
  MAX_REQUIREMENT_CONTEXT_ITEM_CHARS,
  MAX_REQUIREMENT_CONTEXT_ITEMS,
  RequirementContextEntry,
  RequirementGateContext,
  RequirementGateBatch,
  RequirementObligation,
  RunGateCommand,
  applyFlipOverride,
  buildGateResultArtifact,
  buildImplCheckPrompt,
  buildPerRequirementDiffs,
  buildRequirementGateContext,
  countGateRetry,
  classifyRequirementObligation,
  parseImplRequirementEvaluation,
  planRequirementGateCalls,
  updateGateRetryCounter,
} = gate;

const SENTI_CLI = path.join(process.cwd(), "src/senti.js");

function fixtureSpec(overrides = {}) {
  return {
    goal: "Requirement context fixture",
    background: "",
    scope: {
      in: ["Gate context"],
      out: ["Do not replace delegated routing", "Do not invent schema fields"],
    },
    constraints: ["Preserve the existing result object", "Use exact contract fields"],
    design_principles: [
      "R1 uses `mergeResult` as the exact result contract",
      "R10 uses `unrelatedField` only",
    ],
    overview: {
      modules: [
        { text: "R1 is owned by `src/context.js`" },
        { text: "R10 is owned by `src/unrelated.js`" },
      ],
      data_flow: [
        { text: "R1 sends `mergeResult` to the gate" },
        { text: "R10 sends `unrelatedField` elsewhere" },
      ],
      decisions: [
        { text: "R1 schema field contract is `mergeResult`" },
        { text: "R10 schema field contract is `unrelatedField`" },
      ],
    },
    requirements: [
      { id: "R1", desc: "Implement `mergeResult` context", priority: "must", status: "pending" },
      { id: "R10", desc: "Implement `unrelatedField`", priority: "must", status: "pending" },
    ],
    acceptance_criteria: [
      "AC1 (R1): render `mergeResult`",
      "AC2 (R10): render `unrelatedField`",
    ],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
    implementationTargets: ["src/context.js", "src/unrelated.js"],
    tasks: [
      {
        id: "T-1",
        title: "Add context",
        goal: "Implement R1 context in `src/context.js`.",
        acceptance: ["R1 renders `mergeResult`."],
        implementation_notes: "Keep R1 ownership in `src/context.js`.",
        test_strategy: "Test R1 prompt bytes.",
        parent: null,
        origin: "plan",
        added_round: 0,
        status: "pending",
      },
      {
        id: "T-10",
        title: "Add unrelated behavior",
        goal: "Implement R10 only.",
        acceptance: ["R10 renders unrelated content."],
        implementation_notes: "",
        test_strategy: "Test R10.",
        parent: null,
        origin: "plan",
        added_round: 0,
        status: "pending",
      },
    ],
    ...overrides,
  };
}

function buildContext({ spec = fixtureSpec(), requirement = spec.requirements[0], fileMap, relatedDiff } = {}) {
  return buildRequirementGateContext({
    spec,
    requirement,
    fileMap: fileMap ?? { R1: ["src/z.js", "src/context.js"], R10: ["src/unrelated.js"] },
    relatedDiff: relatedDiff ?? "diff --git a/src/context.js b/src/context.js\n+const mergeResult = {};\n",
  });
}

async function evaluateWithPromptAwareStub({ requirement, context, diff, decide }) {
  const batch = new RequirementGateBatch({
    requirements: [requirement],
    contexts: [context],
    diff,
    maxChars: 120000,
  });
  const built = batch.buildPrompt().build();
  const agent = {
    async call(userPrompt, options) {
      const result = decide({
        userPrompt,
        systemPrompt: options.systemPrompt,
        mappedDiff: diff,
        renderedContext: context.toPromptText(),
      });
      return JSON.stringify({
        evaluations: [{
          guardrail_id: requirement.id,
          result,
          reason: `[REQ:${requirement.id}] stubbed evaluator ${result}`,
        }],
      });
    },
  };
  const response = await agent.call(built.userPrompt, { systemPrompt: built.systemPrompt });
  return parseImplRequirementEvaluation(response, batch.requirementIds)[0];
}

function runGateFixture({ requirement, acceptance, before, after, responseResult }) {
  const tmp = createTmpDir();
  const specId = "001-requirement-context";
  const specPath = `specs/${specId}/spec.json`;
  const sourcePath = "src/target.js";
  const capturePath = path.join(tmp, "captured-prompt.txt");
  const response = JSON.stringify({
    evaluations: [{
      guardrail_id: requirement.id,
      result: responseResult,
      reason: `[REQ:${requirement.id}] [AC:1] [EVIDENCE:${requirement.id}] ${responseResult}`,
    }],
  });
  const stubPath = writeCapturingStubAgentScript(tmp, ".stub-agent.js", capturePath, response);
  writeJson(tmp, ".senti/config.json", {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    agent: stubAgentConfig(stubPath),
  });
  writeJson(tmp, "package.json", { name: "requirement-context-e2e", version: "0.0.0" });
  const spec = fixtureSpec({
    requirements: [requirement],
    acceptance_criteria: [acceptance],
    overview: {
      modules: [{ text: `${requirement.id} is owned by \`${sourcePath}\`` }],
      data_flow: [{ text: `${requirement.id} maps cited evidence into the requirement gate` }],
      decisions: [{ text: `${requirement.id} schema field contract is \`mergeResult\`` }],
    },
    implementationTargets: [sourcePath],
    tasks: [{
      id: "T-1",
      title: "Implement fixture behavior",
      goal: `Implement ${requirement.id} in \`${sourcePath}\`.`,
      acceptance: [`${requirement.id} uses mapped evidence.`],
      implementation_notes: `Keep ${requirement.id} ownership in \`${sourcePath}\`.`,
      test_strategy: `Exercise ${requirement.id} through RunGateCommand.`,
      parent: null,
      origin: "plan",
      added_round: 0,
      status: "pending",
    }],
  });
  writeJson(tmp, specPath, spec);
  writeJson(tmp, `specs/${specId}/file-map.json`, { [requirement.id]: [sourcePath] });
  writeFile(tmp, sourcePath, before);
  const flowSteps = buildInitialSteps();
  findStepById(flowSteps, "branch").status = "pending";
  writeJson(tmp, `specs/${specId}/flow.json`, {
    runId: "run-436-e2e",
    issue: 436,
    spec: specPath,
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    steps: flowSteps,
    requirements: [{ id: requirement.id, status: "pending" }],
    tasks: [{ ...spec.tasks[0], steps: [] }],
    currentTaskId: null,
    metrics: [],
  });
  writeJson(tmp, ".senti/.active-flow", [{ spec: specId, mode: "local" }]);
  initGitRepo(tmp);
  commitAll(tmp, "initial fixture");
  checkoutNewBranch(tmp, `feature/${specId}`);
  writeFile(tmp, sourcePath, after);
  commitAll(tmp, "fixture change");

  const execution = spawnSync("node", [
    SENTI_CLI,
    "flow", "run", "gate",
    "--phase", "task-impl",
    "--skip-guardrail",
    "--expect-run-id", "run-436-e2e",
    "--expect-issue", "436",
    "--expect-spec", specPath,
  ], {
    cwd: tmp,
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
  });
  const envelope = JSON.parse(execution.stdout.trim());
  const prompt = fs.readFileSync(capturePath, "utf8");
  const flowState = JSON.parse(fs.readFileSync(path.join(tmp, `specs/${specId}/flow.json`), "utf8"));
  return { tmp, execution, envelope, prompt, flowState };
}

describe("Issue #436 requirement gate context", () => {
  test("R1: context value classes enforce invariants and own rendering", () => {
    assert.throws(() => new RequirementContextEntry({ section: "requirement", reference: "", text: "x" }));
    assert.throws(() => new RequirementContextEntry({ section: "requirement", reference: "[REQ:R1]", text: "" }));
    assert.throws(() => new RequirementContextEntry({ section: "unknown", reference: "[REQ:R1]", text: "x" }));
    assert.throws(() => new RequirementObligation("unknown"));
    assert.throws(() => new RequirementGateContext({ requirementId: "", obligation: new RequirementObligation("implementation"), entries: [] }));

    const entry = new RequirementContextEntry({
      section: "requirement",
      reference: "[REQ:R1]",
      text: "Implement the exact contract",
    });
    const obligation = new RequirementObligation("implementation");
    const context = new RequirementGateContext({ requirementId: "R1", obligation, entries: [entry] });
    assert.match(entry.toPromptText(), /^\[REQ:R1\] Implement the exact contract$/);
    assert.equal(Object.isFrozen(entry), true);
    assert.equal(Object.isFrozen(obligation), true);
    assert.equal(Object.isFrozen(context), true);
    assert.throws(() => new RequirementGateContext({ requirementId: "R1", obligation, entries: [entry], maxItems: 0 }));
    assert.throws(() => new RequirementGateContext({ requirementId: "R1", obligation, entries: [entry], maxItemChars: 0 }));
    assert.throws(() => new RequirementGateContext({ requirementId: "R1", obligation, entries: [entry], maxChars: 0 }));
    assert.throws(() => new RequirementGateContext({ requirementId: "R1", obligation, entries: new Set([entry]) }));
  });

  test("R2: context selects global and exact-linked authoritative sources", () => {
    const spec = fixtureSpec({
      implementationTargets: ["src/context.js", "src/unrelated.js", "context.js"],
    });
    const text = buildContext({ spec }).toPromptText();
    for (const ref of [
      "[REQ:R1]",
      "[AC:1]",
      "[OUT:1]",
      "[CONSTRAINT:1]",
      "[PRINCIPLE:1]",
      "[MODULE:1]",
      "[DATA:1]",
      "[DECISION:1]",
      "[SCHEMA:DECISION:1:1]",
      "[TASK:T-1]",
      "[TARGET:1]",
      "[FILE-MAP:R1:1]",
      "[EVIDENCE:R1]",
    ]) {
      assert.ok(text.includes(ref), `missing ${ref}`);
    }
    assert.match(text, /\+const mergeResult = \{\};/);
    assert.doesNotMatch(text, /\[TARGET:3\]/);
    assert.doesNotMatch(text, /AC2 \(R10\)|unrelatedField|src\/unrelated\.js|TASK:T-10/);
  });

  test("R3: context bounds and ordering are deterministic", () => {
    assert.equal(MAX_REQUIREMENT_CONTEXT_ITEMS, 12);
    assert.equal(MAX_REQUIREMENT_CONTEXT_ITEM_CHARS, 1000);
    assert.equal(MAX_REQUIREMENT_CONTEXT_CHARS, 24000);
    const spec = fixtureSpec({
      constraints: Array.from({ length: 13 }, (_, i) => `constraint-${String(i + 1).padStart(2, "0")}-${"x".repeat(1100)}`),
    });
    const first = buildContext({ spec, fileMap: { R1: ["src/z.js", "src/a.js"] } }).toPromptText();
    const second = buildContext({ spec, fileMap: { R1: ["src/a.js", "src/z.js"] } }).toPromptText();
    assert.equal(first, second);
    assert.ok(first.length <= MAX_REQUIREMENT_CONTEXT_CHARS);
    assert.match(first, /CONTEXT:TRUNCATED/);
    assert.ok(first.indexOf("src/a.js") < first.indexOf("src/z.js"));
    assert.doesNotMatch(first, /constraint-13/);
    const firstConstraintLine = first.split("\n").find((line) => line.startsWith("[CONSTRAINT:1]"));
    assert.ok(firstConstraintLine.length <= MAX_REQUIREMENT_CONTEXT_ITEM_CHARS);
    assert.match(firstConstraintLine, /\[CONTEXT:TRUNCATED\]$/);
  });

  test("R4: identical input produces identical prompt bytes and cache identity", () => {
    const contextA = buildContext();
    const contextB = buildContext();
    const promptA = buildImplCheckPrompt({ contexts: [contextA], diff: "diff", knownIds: ["R1"] }).build();
    const promptB = buildImplCheckPrompt({ contexts: [contextB], diff: "diff", knownIds: ["R1"] }).build();
    const bytesA = `${promptA.systemPrompt}\n${promptA.userPrompt}`;
    const bytesB = `${promptB.systemPrompt}\n${promptB.userPrompt}`;
    assert.equal(bytesA, bytesB);
    assert.equal(crypto.createHash("sha256").update(bytesA).digest("hex"), crypto.createHash("sha256").update(bytesB).digest("hex"));
    assert.ok(bytesA.length <= 900000);

    const diff = "x".repeat(120001 - contextA.toPromptText().length);
    const batch = new RequirementGateBatch({
      requirements: [fixtureSpec().requirements[0]],
      contexts: [contextA],
      diff,
      maxChars: 120000,
    });
    assert.equal(batch.promptCharCount, contextA.toPromptText().length + diff.length);
    assert.equal(batch.promptCharCount, 120001);
    assert.equal(batch.overflow, true);

    const agent = Object.create(Agent.prototype);
    const resolved = {
      providerKey: "stub",
      profileKey: "gate",
      profile: { command: "stub", args: ["--json"] },
    };
    const optionsA = { commandId: "flow.spec.gate", systemPrompt: promptA.systemPrompt, jsonSchema: promptA.jsonSchema };
    const optionsB = { commandId: "flow.spec.gate", systemPrompt: promptB.systemPrompt, jsonSchema: promptB.jsonSchema };
    assert.equal(
      agent._buildPromptCacheKeyForTest(resolved, promptA.userPrompt, optionsA),
      agent._buildPromptCacheKeyForTest(resolved, promptB.userPrompt, optionsB),
    );

    const oversizedDiff = [
      "diff --git a/src/huge.js b/src/huge.js",
      "+++ b/src/huge.js",
      `+${"x".repeat(900001)}`,
    ].join("\n");
    const agentLimitBatch = new RequirementGateBatch({
      requirements: [fixtureSpec().requirements[0]],
      contexts: [contextA],
      diff: oversizedDiff,
      maxChars: 120000,
    });
    assert.ok(agentLimitBatch.diff.length < oversizedDiff.length);
    assert.ok(agentLimitBatch.promptCharCount <= 900000);
  });

  test("R5: obligation classification covers implementation, regression, preservation, and non-interception", () => {
    assert.equal(classifyRequirementObligation({ id: "R1", desc: "Add a context section" }, []).kind, "implementation");
    assert.equal(classifyRequirementObligation({ id: "R2", desc: "No regression in existing routing" }, []).kind, "regression-only");
    assert.equal(classifyRequirementObligation({ id: "R3", desc: "Preserve delegated behavior" }, []).kind, "preservation/non-interception");
    assert.equal(classifyRequirementObligation({ id: "R4", desc: "Do not intercept the delegated route" }, []).kind, "preservation/non-interception");
    assert.equal(classifyRequirementObligation({ id: "R5", desc: "No regression; add a new route" }, []).kind, "implementation");
    assert.equal(
      classifyRequirementObligation(
        { id: "R6", desc: "Verify delegated routing" },
        ["AC1 (R6): preserve the delegated route unchanged"],
      ).kind,
      "preservation/non-interception",
    );
  });

  test("R6: Issue #432 R6 prompt evaluates preservation evidence without reimplementation", async () => {
    const spec = fixtureSpec({
      requirements: [{ id: "R6", desc: "Preserve delegated existing task-level reopen behavior", priority: "must", status: "pending" }],
      acceptance_criteria: ["AC1 (R6): regression evidence proves the delegated route remains unchanged"],
      tasks: [],
      implementationTargets: ["tests/reopen-regression.test.js"],
    });
    const context = buildContext({ spec, requirement: spec.requirements[0], fileMap: { R6: ["tests/reopen-regression.test.js"] }, relatedDiff: "+test delegated route\n" });
    const built = buildImplCheckPrompt({ contexts: [context], diff: "+test delegated route", knownIds: ["R6"] }).build();
    const prompt = `${built.systemPrompt}\n${built.userPrompt}`;
    assert.match(prompt, /preservation\/non-interception/);
    assert.match(prompt, /must not (?:demand|require) reimplementation/i);
    assert.match(prompt, /regression evidence/i);
    assert.match(prompt, /FAIL.*(?:absent|missing).*evidence/is);

    const pass = await evaluateWithPromptAwareStub({
      requirement: spec.requirements[0],
      context,
      diff: "+test delegated route",
      decide: ({ userPrompt }) => userPrompt.includes("[EVIDENCE:R6]") && userPrompt.includes("+test delegated route")
        ? "pass"
        : "fail",
    });
    assert.equal(pass.result, "pass");

    const missingEvidenceContext = buildContext({
      spec,
      requirement: spec.requirements[0],
      fileMap: { R6: ["tests/reopen-regression.test.js"] },
      relatedDiff: "",
    });
    assert.doesNotMatch(missingEvidenceContext.toPromptText(), /\[EVIDENCE:R6\]/);
    const fail = await evaluateWithPromptAwareStub({
      requirement: spec.requirements[0],
      context: missingEvidenceContext,
      diff: "",
      decide: ({ renderedContext, mappedDiff }) => (
        renderedContext.includes("required regression evidence")
        && renderedContext.includes("[EVIDENCE:R6]")
        && mappedDiff.includes("delegated route")
      ) ? "pass" : "fail",
    });
    assert.equal(fail.result, "fail");

    const contradictory = await evaluateWithPromptAwareStub({
      requirement: spec.requirements[0],
      context,
      diff: "-delegateToExistingRoute();\n+interceptWithNewRoute();",
      decide: ({ userPrompt }) => userPrompt.includes("interceptWithNewRoute") ? "fail" : "pass",
    });
    assert.equal(contradictory.result, "fail");
  });

  test("R7: Issue #434 R7 prompt accepts cited safe canonical paths and exact schema fields", async () => {
    const spec = fixtureSpec({
      requirements: [{ id: "R7", desc: "Accept canonical safe path a/../x using the exact schema contract", priority: "must", status: "pending" }],
      acceptance_criteria: ["AC1 (R7): schema field contract is `mergeResult` and a/../x is accepted"],
      overview: { modules: [], data_flow: [], decisions: [{ text: "R7 schema field contract defines `mergeResult`" }] },
      tasks: [],
      implementationTargets: ["src/path-merge.js"],
    });
    const context = buildContext({ spec, requirement: spec.requirements[0], fileMap: { R7: ["src/path-merge.js"] }, relatedDiff: "+return { mergeResult };\n" });
    const built = buildImplCheckPrompt({ contexts: [context], diff: "+return { mergeResult };", knownIds: ["R7"] }).build();
    const prompt = `${built.systemPrompt}\n${built.userPrompt}`;
    assert.match(prompt, /a\/\.\.\/x/);
    assert.match(prompt, /mergeResult/);
    assert.doesNotMatch(prompt, /mergeOutcome/);
    assert.match(prompt, /absent from (?:the )?(?:rendered )?authoritative context/i);

    const evaluation = await evaluateWithPromptAwareStub({
      requirement: spec.requirements[0],
      context,
      diff: "+return { mergeResult };",
      decide: ({ userPrompt }) => (
        userPrompt.includes("a/../x")
        && userPrompt.includes("mergeResult")
        && !userPrompt.includes("mergeOutcome")
      ) ? "pass" : "fail",
    });
    assert.equal(evaluation.result, "pass");
  });

  test("R8: implementation prompt requires stable citations and real missing-behavior FAIL", async () => {
    const missingBehaviorDiff = "diff without mergeResult behavior";
    const context = buildContext({ relatedDiff: missingBehaviorDiff });
    const built = buildImplCheckPrompt({ contexts: [context], diff: "diff", knownIds: ["R1"] }).build();
    const prompt = `${built.systemPrompt}\n${built.userPrompt}`;
    assert.match(prompt, /every (?:evaluation )?reason.*\[REQ:<id>\]/i);
    assert.match(prompt, /additional source reference/i);
    assert.match(prompt, /FAIL.*(?:changed behavior|integration|exact field).*omits/is);
    assert.match(prompt, /cannot.*(?:field|outcome|rejection rule).*absent/is);

    const evaluation = await evaluateWithPromptAwareStub({
      requirement: fixtureSpec().requirements[0],
      context,
      diff: missingBehaviorDiff,
      decide: ({ userPrompt }) => userPrompt.includes("+const mergeResult") ? "pass" : "fail",
    });
    assert.equal(evaluation.result, "fail");
  });

  test("R9: implementation evaluation result schema remains unchanged", () => {
    assert.equal(typeof buildRequirementGateContext, "function");
    const parsed = parseImplRequirementEvaluation(JSON.stringify({
      evaluations: [{ guardrail_id: "R1", result: "pass", reason: "[REQ:R1] implemented" }],
    }), ["R1"]);
    assert.deepEqual(parsed, [{ guardrail_id: "R1", result: "pass", reason: "[REQ:R1] implemented" }]);
    assert.deepEqual(Object.keys(parsed[0]), ["guardrail_id", "result", "reason"]);

    const metrics = [];
    const ctx = { flowManager: { appendMetric: (entry) => metrics.push(entry) } };
    updateGateRetryCounter(ctx, { result: "fail", artifacts: { phase: "integration", failureKind: "ai_semantic_fail" } });
    updateGateRetryCounter(ctx, { result: "pass", artifacts: { phase: "integration" } });
    assert.deepEqual(metrics, [
      { phase: "integration", counter: "gateRetry", delta: 1 },
      { phase: "integration", counter: "gateRetry", delta: 0, reset: true },
    ]);
    assert.equal(countGateRetry(metrics, "integration"), 0);

    const artifact = buildGateResultArtifact({
      level: "integration",
      phase: "integration",
      target: "specs/fixture/spec.json",
      verdict: "pass",
      evaluations: parsed,
      passPrescription: "retro",
      failPrescription: "implement",
    });
    assert.deepEqual(Object.keys(artifact), ["result", "changed", "artifacts", "next"]);
    assert.deepEqual(Object.keys(artifact.artifacts), ["target", "level", "phase", "evaluations", "nextAction"]);

    const planned = planRequirementGateCalls({
      requirements: [fixtureSpec().requirements[0]],
      relatedDiffs: new Map([["R1", ""]]),
      phase: "integration",
    });
    assert.equal(planned.calls.length, 0);
    assert.deepEqual(planned.evaluations.map(({ guardrail_id, result }) => ({ guardrail_id, result })), [
      { guardrail_id: "R1", result: "skip" },
    ]);

    const perReq = buildPerRequirementDiffs(
      { R1: ["src/context.js"] },
      new Map([
        ["src/context.js", "context diff"],
        ["src/unmapped.js", "unmapped diff"],
      ]),
      ["R1"],
      "full diff",
    );
    assert.match(perReq.get("R1"), /context diff/);
    assert.match(perReq.get("R1"), /unmapped diff/);

    const flipped = applyFlipOverride({
      evaluations: [{ guardrail_id: "R1", result: "fail", reason: "changed" }],
      previousEntry: { passedGuardrails: ["R1"], headSha: "a", worktreeHash: "b" },
      currentState: { headSha: "a", worktreeHash: "b" },
      phase: "integration",
    });
    assert.equal(flipped[0].result, "pass");
  });

  test("R10: target guard remains before command-specific context construction", async () => {
    assert.equal(typeof buildRequirementGateContext, "function");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-gate-guard-"));
    const specPath = "specs/319-requirement-gate-context/spec.json";
    const specDir = path.join(root, path.dirname(specPath));
    fs.mkdirSync(specDir, { recursive: true });
    const artifactPaths = [
      path.join(root, specPath),
      path.join(specDir, "file-map.json"),
      path.join(specDir, "impl-gate-result.json"),
    ];
    fs.writeFileSync(artifactPaths[0], JSON.stringify(fixtureSpec()));
    fs.writeFileSync(artifactPaths[1], JSON.stringify({ R1: ["src/context.js"] }));
    fs.writeFileSync(artifactPaths[2], JSON.stringify({ result: "prior" }));
    const state = {
      runId: "run-436",
      issue: 436,
      spec: specPath,
      baseBranch: "main",
      steps: [],
      tasks: [],
      currentTaskId: null,
    };
    const before = JSON.stringify(state);
    const artifactBytes = artifactPaths.map((file) => fs.readFileSync(file, "utf8"));
    const flowManager = {
      load: () => state,
      forRoot: () => flowManager,
    };
    const container = new Container();
    container.register("paths", { root });
    container.register("mainRoot", root);
    container.register("config", {});
    container.register("flowManager", flowManager);
    container.register("inWorktree", false);
    let agentCalls = 0;
    container.register("agent", {
      resolve: () => {
        agentCalls += 1;
        return null;
      },
      call: async () => {
        agentCalls += 1;
        throw new Error("agent must not run");
      },
    });

    const originalReadFileSync = fs.readFileSync;
    const originalWriteFileSync = fs.writeFileSync;
    let commandFileReads = 0;
    let commandFileWrites = 0;
    try {
      fs.readFileSync = (...args) => {
        commandFileReads += 1;
        return originalReadFileSync(...args);
      };
      fs.writeFileSync = (...args) => {
        commandFileWrites += 1;
        return originalWriteFileSync(...args);
      };
      for (const input of [
        { expectRunId: "run-other" },
        { expectIssue: 999 },
        { expectSpec: "specs/999-other/spec.json" },
      ]) {
        const result = await new RunGateCommand().run(container, input);
        assert.equal(result.ok, false);
        assert.equal(result.errors[0].code, "ACTIVE_FLOW_MISMATCH");
        assert.equal(JSON.stringify(state), before);
      }
    } finally {
      fs.readFileSync = originalReadFileSync;
      fs.writeFileSync = originalWriteFileSync;
    }
    assert.equal(commandFileReads, 0, "spec, context, file-map, and cache reads stay behind target guards");
    assert.equal(commandFileWrites, 0, "artifact and cache writes stay behind target guards");
    assert.equal(agentCalls, 0);
    assert.deepEqual(artifactPaths.map((file) => fs.readFileSync(file, "utf8")), artifactBytes);
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("R11: real RunGateCommand path covers Issue #432, Issue #434, and missing behavior", () => {
    const fixtures = [
      {
        name: "Issue #432 preservation pass",
        requirement: { id: "R6", desc: "Preserve delegated existing behavior", priority: "must", status: "pending" },
        acceptance: "AC1 (R6): required regression evidence keeps the delegated route unchanged",
        before: "export const route = () => delegateExisting();\n",
        after: "export const route = () => delegateExisting();\n// regression evidence: delegated route unchanged\n",
        responseResult: "pass",
        promptIncludes: ["preservation/non-interception", "regression evidence", "delegated route unchanged"],
      },
      {
        name: "Issue #432 interception fail",
        requirement: { id: "R6", desc: "Preserve delegated existing behavior", priority: "must", status: "pending" },
        acceptance: "AC1 (R6): required regression evidence keeps the delegated route unchanged",
        before: "export const route = () => delegateExisting();\n",
        after: "export const route = () => interceptWithNewRoute();\n",
        responseResult: "fail",
        promptIncludes: ["preservation/non-interception", "interceptWithNewRoute"],
      },
      {
        name: "Issue #434 canonical path pass",
        requirement: { id: "R7", desc: "Accept canonical safe path a/../x using the exact schema contract", priority: "must", status: "pending" },
        acceptance: "AC1 (R7): schema field contract is `mergeResult` and a/../x is accepted",
        before: "export const merge = () => null;\n",
        after: "export const merge = () => ({ mergeResult: 'a/../x' });\n",
        responseResult: "pass",
        promptIncludes: ["a/../x", "mergeResult", "[SCHEMA:DECISION:1:1]"],
      },
      {
        name: "missing required behavior fail",
        requirement: { id: "R8", desc: "Add exact field `requiredField` to the gate result", priority: "must", status: "pending" },
        acceptance: "AC1 (R8): exact field `requiredField` is returned by the changed implementation",
        before: "export const result = () => ({});\n",
        after: "export const result = () => ({ unrelatedField: true });\n",
        responseResult: "fail",
        promptIncludes: ["requiredField", "unrelatedField", "[EVIDENCE:R8]"],
      },
    ];

    for (const fixture of fixtures) {
      const result = runGateFixture(fixture);
      try {
        assert.equal(result.execution.status, 0, `${fixture.name}: ${result.execution.stderr}`);
        assert.equal(result.envelope.ok, true, fixture.name);
        assert.equal(result.envelope.data.result, fixture.responseResult, fixture.name);
        assert.equal(result.envelope.data.artifacts.phase, "task-impl", fixture.name);
        assert.match(result.prompt, /## Requirement Contexts/);
        assert.match(result.prompt, new RegExp(`\\[REQ:${fixture.requirement.id}\\]`));
        for (const expected of fixture.promptIncludes) {
          assert.ok(result.prompt.includes(expected), `${fixture.name}: prompt missing ${expected}`);
        }
        const gateMetrics = result.flowState.metrics.filter((entry) => (
          entry.phase === "task-impl" && entry.counter === "gateRetry"
        ));
        assert.ok(gateMetrics.length > 0, `${fixture.name}: missing gate counter hook evidence`);
        if (fixture.responseResult === "pass") assert.equal(gateMetrics.at(-1).reset, true);
        else assert.equal(gateMetrics.at(-1).delta, 1);
      } finally {
        removeTmpDir(result.tmp);
      }
    }
  });

  test("R11: public context API exposes the required deterministic limits", () => {
    assert.equal(typeof buildRequirementGateContext, "function");
    assert.equal(typeof classifyRequirementObligation, "function");
    assert.equal(MAX_REQUIREMENT_CONTEXT_ITEMS, 12);
    assert.equal(MAX_REQUIREMENT_CONTEXT_ITEM_CHARS, 1000);
    assert.equal(MAX_REQUIREMENT_CONTEXT_CHARS, 24000);
  });
});
