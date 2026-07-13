// spec: R14
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { validateSchema } from "../../../src/lib/schema-validate.js";
import { resolveLifecycle, resolveSideEffects } from "../../../src/flow/definition.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { runFlowCommandHooks } from "../../../src/lib/plugin-registry.js";

const CLI = join(process.cwd(), "src/senti.js");
const SHA = "0123456789abcdef0123456789abcdef01234567";

function runCli(tmp, args) {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
    });
    return { envelope: JSON.parse(stdout), exitCode: 0 };
  } catch (err) {
    const stdout = err.stdout?.toString() || "";
    return { envelope: stdout ? JSON.parse(stdout) : null, exitCode: err.status || 1 };
  }
}

function setupFlowAtStep(tmp, stepId) {
  const specId = "001-test";
  const state = {
    spec: `specs/${specId}/spec.json`,
    runId: `run-${specId}`,
    baseBranch: "main",
    featureBranch: "feature/001-test",
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    currentTaskId: null,
  };
  for (const step of state.steps.flatMap((entry) => entry.children || [entry])) {
    step.status = "pending";
  }
  findStepById(state.steps, stepId).status = "in_progress";

  const fm = makeFlowManager(tmp);
  fm.create(state);
  fm.addActiveFlow(specId, "local");
}

function schema(relPath) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "src", "flow", "schemas", relPath), "utf8"));
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
}

function writeJson(file, value) {
  write(file, `${JSON.stringify(value, null, 2)}\n`);
}

function setupPluginHookProject(tmp) {
  writeJson(path.join(tmp, ".senti", "config.json"), {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: {
      sources: [{ id: "fixture-source", type: "local", path: "." }],
      packages: [{ id: "sample-plugin", source: "fixture-source", commit: SHA }],
    },
  });
  const pluginRoot = path.join(tmp, ".senti", "plugins", "sample-plugin");
  writeJson(path.join(pluginRoot, "plugin.json"), {
    name: "sample-plugin",
    type: "mixed",
    contributions: {},
  });
  write(path.join(pluginRoot, "hooks", "gate-post.js"), `
    export default function register(api) {
      return class SampleHook extends api.FlowCommandHook {
        static command = "gate";
        static hook = "post";
        static priority = 0;
        async run(context) {
          await context.artifacts.writeJson("gate-post.json", {
            command: context.flow.currentStepId,
            result: context.result.result
          });
          return context.envelope.ok();
        }
      };
    }
  `);
  writeJson(path.join(tmp, "specs", "001-test", "spec.json"), { requirements: [] });
  return [{
    apiVersion: 1,
    pluginId: "sample-plugin",
    module: "hooks/gate-post.js",
    className: "SampleHook",
    command: "gate",
    hook: "post",
    priority: 0,
  }];
}

describe("acceptance-review migration parity", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R14: unaffected next-action envelopes keep the existing public shape", () => {
    tmp = createTmpDir();
    for (const stepId of ["impl-review", "impl-gate", "retro", "final-regression", "finalize-commit"]) {
      setupFlowAtStep(tmp, stepId);
      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);

      assert.equal(exitCode, 0, `${stepId} next-action exits successfully`);
      assert.equal(envelope.ok, true, `${stepId} envelope ok`);
      assert.deepEqual(Object.keys(envelope.data).sort(), [
        "action",
        "context",
        "instructions",
        "maxAttempts",
        "output_schema",
        "requires_approval",
        "step",
        "taskId",
      ]);
      assert.equal(envelope.data.step, stepId);
      assert.equal(Object.hasOwn(envelope.data, "failurePolicy"), false);
      removeTmpDir(tmp);
      tmp = createTmpDir();
    }
  });

  it("R14: finalize leaf approval behavior is preserved", () => {
    tmp = createTmpDir();
    const expectedApproval = new Map([
      ["finalize-commit", true],
      ["finalize-merge", false],
      ["finalize-sync", false],
      ["finalize-cleanup", false],
    ]);
    for (const [stepId, requiresApproval] of expectedApproval) {
      setupFlowAtStep(tmp, stepId);
      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);

      assert.equal(exitCode, 0, `${stepId} next-action exits successfully`);
      assert.equal(envelope.ok, true);
      assert.equal(envelope.data.step, stepId);
      assert.equal(envelope.data.requires_approval, requiresApproval);
      removeTmpDir(tmp);
      tmp = createTmpDir();
    }
  });

  it("R14: review, gate, and retro artifact meanings remain schema-compatible", () => {
    const reviewArtifact = { verdict: "pass", comments: ["No issues."] };
    const gateArtifact = {
      verdict: "pass",
      issues: [],
      nextAction: {
        diagnosis: { summary: "No observations.", observations: [] },
        prescription: "continue",
      },
    };
    const retroArtifact = {
      requirements: [{ desc: "Requirement done.", status: "done", note: "Verified." }],
      summary: { total: 1, done: 1, not_done: 0, rate: 1 },
      unplanned: [],
    };

    assert.deepEqual(validateSchema(reviewArtifact, schema("next-action/review.schema.json")), []);
    assert.deepEqual(validateSchema(gateArtifact, schema("next-action/gate.schema.json")), []);
    assert.deepEqual(validateSchema(retroArtifact, schema("retro.schema.json")), []);
  });

  it("R14: review and gate lifecycle actions preserve metrics, promotion, issue-log, and side effects", () => {
    const reviewPass = resolveLifecycle({
      currentStepId: "impl-review",
      phase: "impl",
      event: "review:post",
      result: { artifacts: { phase: "impl", verdict: "PASS" } },
    });
    assert.equal(reviewPass.some((action) => action.constructor.name === "IncrementMetric"), true);
    assert.equal(reviewPass.some((action) => action.step === "impl-review" && action.status === "done"), true);

    const gatePass = resolveLifecycle({
      currentStepId: "impl-gate",
      phase: "integration",
      event: "gate:post",
      result: { result: "pass", artifacts: { phase: "integration" } },
    });
    assert.equal(gatePass.some((action) => action.constructor.name === "IncrementMetric"), true);
    assert.equal(gatePass.some((action) => action.constructor.name === "ExecuteSideEffects"), true);
    assert.equal(gatePass.some((action) => action.step === "impl-gate" && action.status === "done"), true);

    const gateFail = resolveLifecycle({
      currentStepId: "impl-gate",
      phase: "integration",
      event: "gate:post",
      result: { result: "fail", artifacts: { phase: "integration" } },
    });
    assert.equal(gateFail.some((action) => action.constructor.name === "AppendIssueLog"), true);
    assert.equal(gateFail.some((action) => action.step === "impl-gate" && action.status === "in_progress"), true);
    assert.deepEqual(resolveSideEffects({ stepId: "impl-gate" }), [
      "completeTask",
      "promoteNextTask",
      "mergeOverview",
    ]);
  });

  it("R14: plugin hook execution remains wired for existing gate post lifecycle", async () => {
    tmp = createTmpDir();
    setupFlowAtStep(tmp, "impl-gate");
    const snapshot = setupPluginHookProject(tmp);

    const hookResult = await runFlowCommandHooks(tmp, snapshot, {
      command: "gate",
      hook: "post",
      flow: { spec: "specs/001-test/spec.json", currentStepId: "impl-gate" },
      result: { result: "pass" },
    });

    assert.equal(hookResult.ok, true);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(tmp, "specs", "001-test", "plugin-artifacts", "sample-plugin", "gate-post.json"), "utf8")),
      { command: "impl-gate", result: "pass" },
    );
    const state = makeFlowManager(tmp).load();
    assert.equal(findStepById(state.steps, "impl-gate").status, "in_progress");
  });
});
