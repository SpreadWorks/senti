// spec: R8 R11 R12
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { RunFinalizeCommitCommand } from "../../../src/flow/lib/run-finalize-commit.js";
import {
  DURABLE_TEST_ARTIFACT_RELATIVE_PATHS,
  RESETTABLE_TEST_ARTIFACT_RELATIVE_PATHS,
  RAW_OUTPUT_RELATIVE,
  TEST_EXECUTE_RESULT_FILE,
} from "../../../src/flow/lib/test-artifacts.js";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import { checkoutNewBranch, commitAll, initGitRepo } from "../../../tests/helpers/git-repo.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";

const SPEC_ID = "258-scenario-validity-step";
const SPEC_REL = `specs/${SPEC_ID}/spec.json`;
const SDD_FORGE_CLI = path.join(process.cwd(), "src/sdd-forge.js");

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function latestCommitFiles(root) {
  return git(root, ["show", "--name-only", "--format="])
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
}

function setupFinalizeFixture() {
  const root = createTmpDir("scenario-validity-finalize-");
  initGitRepo(root);
  writeJson(root, ".sdd-forge/config.json", {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
  });
  writeJson(root, "package.json", { scripts: { test: "node --test" } });
  writeJson(root, SPEC_REL, { requirements: [{ id: "R8", desc: "artifact requirement" }] });
  commitAll(root, "base");
  checkoutNewBranch(root, "feature/scenario-validity-artifacts");

  writeFile(root, "src/implementation.js", "export const implemented = true;\n");
  writeJson(root, `specs/${SPEC_ID}/scenario-validity-result.json`, { version: "1" });
  writeFile(root, `specs/${SPEC_ID}/tests/.raw/scenario-validity.log`, "scenario-validity raw\n");
  writeJson(root, `specs/${SPEC_ID}/test-execute-result.json`, { version: "2" });
  writeJson(root, `specs/${SPEC_ID}/test-result-review.json`, {
    verdict: "pass",
    checked_items: [{ check: "project_regression_verification", result: "pass" }],
  });
  writeFile(root, `specs/${SPEC_ID}/test-result-review.md`, "# review\n");
  writeFile(root, `specs/${SPEC_ID}/tests/.raw/test-execution.log`, "test-execute raw\n");

  const state = {
    spec: SPEC_REL,
    baseBranch: "main",
    featureBranch: "feature/scenario-validity-artifacts",
    steps: [],
    requirements: [{ id: "R8", desc: "artifact requirement" }],
    tasks: [],
    currentTaskId: null,
  };
  const flowManager = makeFlowManager(root);
  flowManager.create(state);
  flowManager.addActiveFlow(SPEC_ID, "local");

  return { root, flowManager, state };
}

test("R8: test artifact helpers classify scenario-validity artifacts as durable and resettable", async () => {
  const artifacts = await import("../../../src/flow/lib/test-artifacts.js");
  assert.equal(artifacts.SCENARIO_VALIDITY_RESULT_FILE, "scenario-validity-result.json");
  assert.equal(artifacts.SCENARIO_VALIDITY_RAW_OUTPUT_RELATIVE, "tests/.raw/scenario-validity.log");
  assert.ok(DURABLE_TEST_ARTIFACT_RELATIVE_PATHS.includes("scenario-validity-result.json"));
  assert.ok(DURABLE_TEST_ARTIFACT_RELATIVE_PATHS.includes("tests/.raw/scenario-validity.log"));
  assert.ok(RESETTABLE_TEST_ARTIFACT_RELATIVE_PATHS.includes("scenario-validity-result.json"));
  assert.ok(RESETTABLE_TEST_ARTIFACT_RELATIVE_PATHS.includes("tests/.raw/scenario-validity.log"));
});

test("R8: finalize implementation commit excludes scenario-validity and test-execute artifacts independently", async () => {
  const fixture = setupFinalizeFixture();
  try {
    const command = new RunFinalizeCommitCommand();
    const result = await command.execute({
      root: fixture.root,
      flowState: fixture.state,
      flowManager: fixture.flowManager,
      message: "feat: implementation without test artifacts",
    });
    assert.equal(result.status, "done");

    const files = latestCommitFiles(fixture.root);
    assert.ok(files.includes("src/implementation.js"), "implementation file is committed");

    for (const rel of [
      "scenario-validity-result.json",
      "tests/.raw/scenario-validity.log",
      "test-execute-result.json",
      "test-result-review.json",
      "test-result-review.md",
      "tests/.raw/test-execution.log",
    ]) {
      assert.equal(
        files.includes(`specs/${SPEC_ID}/${rel}`),
        false,
        `${rel} must not be staged in implementation commit`,
      );
    }

    const status = git(fixture.root, ["status", "--short", "--untracked-files=all", "--", `specs/${SPEC_ID}`]);
    assert.match(status, /scenario-validity-result\.json/);
    assert.match(status, /tests\/\.raw\/scenario-validity\.log/);
    assert.match(status, /test-execute-result\.json/);
    assert.match(status, /tests\/\.raw\/test-execution\.log/);
  } finally {
    removeTmpDir(fixture.root);
  }
});

test("R12: prompts keep scenario-validity separate from test-execute and list review anti-patterns", () => {
  const planTest = readRepoFile("src/flow/prompts/plan/test.md");
  const planScenario = readRepoFile("src/flow/prompts/plan/scenario-validity.md");
  const reviewTest = readRepoFile("src/flow/prompts/plan/review-test.md");
  const implTestExecute = readRepoFile("src/flow/prompts/impl/test-execute.md");

  assert.match(planTest, /write|author|create/i);
  assert.match(planTest, /specs\/<spec>\/tests|spec-local/i);
  assert.match(planTest, /do not run|do not execute|not execute/i);

  assert.match(planScenario, /pre-implementation|before implementation/i);
  assert.match(planScenario, /spec-local/i);
  assert.match(planScenario, /expected_fail/);
  assert.match(planScenario, /scenario-validity-result\.json/);
  assert.match(planScenario, /tests\/\.raw\/scenario-validity\.log/);
  assert.doesNotMatch(planScenario, /root regression/i);

  assert.match(reviewTest, /static|anti-pattern/i);
  assert.match(reviewTest, /assertions that do not go through production code/);
  assert.match(reviewTest, /input-as-expected round trips/);
  assert.match(reviewTest, /always-matching regex/);
  assert.match(reviewTest, /existence-only checks/);
  assert.match(reviewTest, /catch-all PASS handling/);
  assert.match(reviewTest, /split-removed separator literal assertions/);

  assert.match(implTestExecute, /post-implementation|after implementation/i);
  assert.match(implTestExecute, /root regression/);
  assert.match(implTestExecute, /test-execute-result\.json/);
  assert.match(implTestExecute, /tests\/\.raw\/test-execution\.log/);

  assert.equal(TEST_EXECUTE_RESULT_FILE, "test-execute-result.json");
  assert.equal(RAW_OUTPUT_RELATIVE, "tests/.raw/test-execution.log");
  assert.ok(DURABLE_TEST_ARTIFACT_RELATIVE_PATHS.includes("test-execute-result.json"));
  assert.ok(DURABLE_TEST_ARTIFACT_RELATIVE_PATHS.includes("tests/.raw/test-execution.log"));
  assert.ok(DURABLE_TEST_ARTIFACT_RELATIVE_PATHS.includes("scenario-validity-result.json"));
  assert.ok(DURABLE_TEST_ARTIFACT_RELATIVE_PATHS.includes("tests/.raw/scenario-validity.log"));
});

test("R11: skill template and installed skill mention scenario-validity after upgrade", () => {
  const template = readRepoFile("src/templates/skills/sdd-forge.flow/SKILL.md");
  const installed = readRepoFile(".agents/skills/sdd-forge.flow/SKILL.md");
  for (const content of [template, installed]) {
    assert.match(content, /scenario-validity/);
    assert.match(content, /flow run scenario-validity/);
    assert.match(content, /test[\s\S]*scenario-validity[\s\S]*review-test/);
  }
});

test("R11: sdd-forge upgrade installs scenario-validity guidance into a project skill", () => {
  const root = createTmpDir("scenario-validity-upgrade-");
  try {
    writeJson(root, ".sdd-forge/config.json", {
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
    });

    const res = spawnSync(process.execPath, [SDD_FORGE_CLI, "upgrade"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.equal(res.status, 0, res.stderr || res.stdout);
    const skill = fs.readFileSync(
      path.join(root, ".agents/skills/sdd-forge.flow/SKILL.md"),
      "utf8",
    );
    assert.match(skill, /scenario-validity/);
    assert.match(skill, /flow run scenario-validity/);
    assert.match(skill, /test[\s\S]*scenario-validity[\s\S]*review-test/);
  } finally {
    removeTmpDir(root);
  }
});

test("R12: scenario-validity artifacts coexist with test-execute artifact helper lists", () => {
  assert.ok(DURABLE_TEST_ARTIFACT_RELATIVE_PATHS.includes("scenario-validity-result.json"));
  assert.ok(DURABLE_TEST_ARTIFACT_RELATIVE_PATHS.includes("tests/.raw/scenario-validity.log"));
  assert.ok(DURABLE_TEST_ARTIFACT_RELATIVE_PATHS.includes("test-execute-result.json"));
  assert.ok(DURABLE_TEST_ARTIFACT_RELATIVE_PATHS.includes("tests/.raw/test-execution.log"));

  assert.ok(RESETTABLE_TEST_ARTIFACT_RELATIVE_PATHS.includes("scenario-validity-result.json"));
  assert.ok(RESETTABLE_TEST_ARTIFACT_RELATIVE_PATHS.includes("tests/.raw/scenario-validity.log"));
  assert.ok(RESETTABLE_TEST_ARTIFACT_RELATIVE_PATHS.includes("test-execute-result.json"));
  assert.ok(RESETTABLE_TEST_ARTIFACT_RELATIVE_PATHS.includes("tests/.raw/test-execution.log"));
});
