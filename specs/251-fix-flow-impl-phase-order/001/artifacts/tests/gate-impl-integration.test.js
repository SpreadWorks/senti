// spec: R14
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";
import { initGitRepo, commitAll, checkoutNewBranch } from "../../../tests/helpers/git-repo.js";
import { writeStubAgentScript, stubAgentConfig, defaultPassResponse } from "../../../tests/helpers/stub-agent.js";
import { FLOW_STEPS, buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { findStepById, flattenSteps } from "../../../src/flow/definition.js";

const CMD = path.join(process.cwd(), "src/sdd-forge.js");
const SPEC_ID = "001-fixture";
const SPEC_PATH = `specs/${SPEC_ID}/spec.md`;

function minimalSpecJson() {
  return {
    goal: "Fixture for spec 251 integration gate test.",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [{ id: "R1", desc: "anything goes", priority: "must", status: "pending" }],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  };
}

function setupFixtureForIntegrationGate(tmp) {
  const stubPath = writeStubAgentScript(tmp, ".stub-agent.js", defaultPassResponse());
  writeJson(tmp, ".sdd-forge/config.json", {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
    agent: stubAgentConfig(stubPath),
  });
  writeJson(tmp, "package.json", { name: "fixture", version: "0.0.0" });
  writeFile(tmp, SPEC_PATH, "# Fixture\n\n## Goal\n\nintegration gate test fixture.\n");
  writeJson(tmp, `specs/${SPEC_ID}/spec.json`, minimalSpecJson());

  const initial = "// fixture\ntest('a', () => { assert(1===1); });\n";
  writeFile(tmp, "tests/dummy.test.js", initial);
  initGitRepo(tmp);
  commitAll(tmp, "initial");

  checkoutNewBranch(tmp, `feature/${SPEC_ID}`);
  const modified = [
    "// fixture",
    "test('a', () => { assert(1===1); });",
    "test('b', () => {",
    "  assert(2===2);",
    "});",
    "",
  ].join("\n");
  writeFile(tmp, "tests/dummy.test.js", modified);
  commitAll(tmp, "feature change");

  // Build steps with flow-level gate-impl in_progress (no current task — flow scope).
  const steps = buildInitialSteps();
  for (const s of flattenSteps(steps)) s.status = "pending";
  // Mark prior leaves done so gate-impl is the next in_progress
  const leafOrder = ["branch", "prepare-spec", "draft", "review-draft", "gate-draft", "spec", "review-spec", "gate", "approval", "test", "review-test", "implement", "review"];
  for (const leafId of leafOrder) {
    const leaf = findStepById(steps, leafId);
    if (leaf) leaf.status = "done";
  }
  const gateImpl = findStepById(steps, "gate-impl");
  gateImpl.status = "in_progress";

  writeJson(tmp, `specs/${SPEC_ID}/flow.json`, {
    spec: SPEC_PATH,
    baseBranch: "main",
    featureBranch: `feature/${SPEC_ID}`,
    steps,
    requirements: [],
    tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
    currentTaskId: null,
    metrics: [],
  });
  writeJson(tmp, ".sdd-forge/.active-flow", [{ spec: SPEC_ID, mode: "local" }]);
}

describe("spec 251: integration gate (flow-level gate-impl)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R14: --phase omitted + flow-level gate-impl in_progress → PASS returns next='finalize-commit'", () => {
    tmp = createTmpDir();
    setupFixtureForIntegrationGate(tmp);

    const res = spawnSync(
      "node",
      [CMD, "flow", "run", "gate", "--skip-guardrail"],
      {
        encoding: "utf8",
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
      },
    );
    assert.equal(res.status, 0, `expected exit 0, got ${res.status}. stderr=${res.stderr}`);
    const env = JSON.parse(res.stdout.trim());
    assert.equal(env.ok, true);
    assert.equal(env.data.result, "pass", `envelope=${res.stdout}`);
    assert.equal(env.data.artifacts.phase, "integration", "auto-resolved phase is integration");
    assert.equal(env.data.next, "finalize-commit", "PASS_NEXT[integration] = finalize-commit");
  });
});
