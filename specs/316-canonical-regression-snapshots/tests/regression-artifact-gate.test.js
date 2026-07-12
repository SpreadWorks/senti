// spec: R2 R3 R4
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initGitRepo, commitAll, checkoutNewBranch } from "../../../tests/helpers/git-repo.js";
import RunTestExecuteCommand from "../../../src/flow/lib/run-test-execute.js";
import RunTestResultReviewCommand from "../../../src/flow/lib/run-test-result-review.js";
import {
  assertIntegrationRegressionEvidence,
  validateIntegrationArtifactTrust,
  validateTestExecuteResultV2,
} from "../../../src/flow/lib/test-artifacts.js";
import {
  classifyRegression,
  listRegressionChangedFiles,
  planTestExecuteRegression,
  withChangedFileFingerprints,
} from "../../../src/flow/lib/test-regression.js";
import { container } from "../../../src/lib/container.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const TEST_TMP_ROOT = path.join(
  REPO_ROOT,
  "specs/316-canonical-regression-snapshots/tests/.tmp",
);
const SPEC_RELATIVE = "specs/316-canonical-regression-snapshots/spec.json";
const fixtures = [];

function fixtureRoot(prefix = "artifact-") {
  fs.mkdirSync(TEST_TMP_ROOT, { recursive: true });
  const root = fs.mkdtempSync(path.join(TEST_TMP_ROOT, prefix));
  fixtures.push(root);
  return root;
}

function writeFile(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");
}

function writeJson(root, relativePath, value) {
  writeFile(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function validProcess() {
  return {
    started: true,
    exitCode: 0,
    signal: null,
    timedOut: false,
    spawnError: null,
  };
}

function requiredRegression(changedFiles, mode = "full") {
  return {
    required: true,
    mode,
    root_test_command: "node --test",
    root_test_command_source: "package.json:scripts.test",
    command: "node --test",
    result: "pass",
    raw_output_lines: { start_line: 1, end_line: 1 },
    changed_files: changedFiles,
    trigger_relevant_changed_files: changedFiles,
    ...(mode === "targeted" ? { target_paths: changedFiles.map((entry) => entry.path) } : {}),
    process: validProcess(),
  };
}

function resultArtifact(regression) {
  return {
    version: "2",
    raw_output_path: "specs/316-canonical-regression-snapshots/tests/.raw/test-execution.log",
    summary: [],
    regression,
  };
}

function setupChangedProject({ deleted = false, untracked = false } = {}) {
  const root = fixtureRoot("git-");
  writeFile(root, "src/a.js", "export const a = 0;\n");
  writeFile(root, "src/b.js", "export const b = 0;\n");
  writeFile(root, ".senti/output/analysis.json", "{}\n");
  writeFile(root, SPEC_RELATIVE, "{}\n");
  initGitRepo(root);
  commitAll(root, "initial");
  checkoutNewBranch(root, "feature/snapshot");
  writeFile(root, "src/a.js", "export const a = 1;\n");
  if (deleted) fs.rmSync(path.join(root, "src/b.js"));
  else writeFile(root, "src/b.js", "export const b = 1;\n");
  if (untracked) writeFile(root, "scratch/nested.js", "export const nested = 1;\n");

  const state = { baseBranch: "main", spec: SPEC_RELATIVE };
  const config = {};
  const changedFiles = listRegressionChangedFiles({ root, state });
  const analysis = {};
  const classification = classifyRegression({
    root,
    state,
    analysis,
    config,
    changedFiles,
  });
  const savedChangedFiles = withChangedFileFingerprints(root, classification.changedFiles);
  const savedTriggerFiles = withChangedFileFingerprints(
    root,
    classification.triggerRelevantChangedFiles,
  );
  const regression = {
    ...requiredRegression(savedChangedFiles, classification.mode),
    trigger_relevant_changed_files: savedTriggerFiles,
  };
  const artifacts = {
    result: resultArtifact(regression),
    review: { verdict: "pass" },
  };
  return { root, state, config, artifacts };
}

function validateFreshProject(fixture) {
  return assertIntegrationRegressionEvidence({
    root: fixture.root,
    state: fixture.state,
    specDir: path.join(fixture.root, path.dirname(SPEC_RELATIVE)),
    config: fixture.config,
    artifacts: fixture.artifacts,
  });
}

function setupExecutionProject(kind) {
  const root = fixtureRoot(`execute-${kind}-`);
  const specDir = path.dirname(SPEC_RELATIVE);
  const fixtureTest = `${specDir}/tests/fixture.test.js`;
  writeJson(root, ".senti/output/analysis.json", {});
  writeJson(root, "package.json", { type: "module" });
  writeFile(root, "project-regression.js", "process.stdout.write('project regression pass\\n');\n");
  writeFile(root, "src/a.js", "export const a = 0;\n");
  writeFile(root, "docs/guide.md", "base\n");
  writeJson(root, SPEC_RELATIVE, {
    goal: "fixture",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [
      { id: "R2", desc: "fixture behavior", priority: "must", status: "pending" },
    ],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  });
  writeFile(root, fixtureTest, [
    "// spec: R2",
    "import { test } from 'node:test';",
    "import assert from 'node:assert/strict';",
    "test('R2: fixture behavior', () => assert.equal(1, 1));",
    "",
  ].join("\n"));
  initGitRepo(root);
  commitAll(root, "initial");
  checkoutNewBranch(root, `feature/${kind}`);
  if (kind === "required") writeFile(root, "src/a.js", "export const a = 1;\n");
  else writeFile(root, "docs/guide.md", "changed\n");

  const state = {
    baseBranch: "main",
    featureBranch: `feature/${kind}`,
    spec: SPEC_RELATIVE,
  };
  const config = {
    test: {
      command: "node project-regression.js",
      testExecuteRegression: "full",
      timeout: 30,
    },
  };
  container.reset();
  container.set("config", config);
  return { root, specDir, fixtureTest, state, config };
}

async function executeTestProject(kind) {
  const fixture = setupExecutionProject(kind);
  const output = await new RunTestExecuteCommand().execute({
    root: fixture.root,
    flowState: fixture.state,
  });
  assert.equal(output.result, "ok");
  const artifact = readJson(
    fixture.root,
    `${fixture.specDir}/test-execute-result.json`,
  );
  return { ...fixture, artifact };
}

afterEach(() => {
  container.reset();
  for (const root of fixtures.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  fs.rmSync(TEST_TMP_ROOT, { recursive: true, force: true });
});

describe("Issue #410 regression artifact and gate integration", () => {
  it("R2: schema and deterministic validation reject legacy no-fingerprint snapshots", () => {
    const legacyEntry = { status: "modified", path: "src/a.js" };
    assert.throws(
      () => validateTestExecuteResultV2(resultArtifact(requiredRegression([legacyEntry]))),
      /rerun test-execute/i,
    );

    const schema = JSON.parse(fs.readFileSync(
      path.join(REPO_ROOT, "src/flow/schemas/test-execute-result.schema.json"),
      "utf8",
    ));
    for (const field of ["changed_files", "trigger_relevant_changed_files"]) {
      const item = schema.properties.regression.properties[field].items;
      assert.ok(item.required.includes("fingerprint"), `${field} must require fingerprint`);
      assert.deepEqual(item.properties.fingerprint.type, ["string", "null"]);
    }
  });

  it("R2: required and skipped RunTestExecuteCommand paths persist canonical fingerprinted lists", async () => {
    const required = await executeTestProject("required");
    const skipped = await executeTestProject("skipped");

    assert.equal(required.artifact.regression.required, true);
    assert.equal(skipped.artifact.regression.required, false);
    assert.ok(required.artifact.regression.changed_files.length > 0);
    assert.ok(required.artifact.regression.trigger_relevant_changed_files.length > 0);
    assert.ok(skipped.artifact.regression.changed_files.length > 0);
    assert.deepEqual(skipped.artifact.regression.trigger_relevant_changed_files, []);
    for (const artifact of [required.artifact, skipped.artifact]) {
      for (const field of ["changed_files", "trigger_relevant_changed_files"]) {
        for (const entry of artifact.regression[field]) {
          assert.equal(Object.hasOwn(entry, "fingerprint"), true, `${field}:${entry.path}`);
          assert.ok(entry.fingerprint === null || /^[a-f0-9]{64}$/.test(entry.fingerprint));
        }
      }
      assert.doesNotThrow(() => validateTestExecuteResultV2(artifact));
    }
  });

  it("R3: required evidence passes immediately after save regardless of saved ordering", () => {
    const fixture = setupChangedProject();
    fixture.artifacts.result.regression.changed_files.reverse();
    fixture.artifacts.result.regression.trigger_relevant_changed_files.reverse();
    assert.doesNotThrow(() => validateFreshProject(fixture));
  });

  it("R3: unchanged deleted-file evidence remains fresh with an explicit null fingerprint", () => {
    const fixture = setupChangedProject({ deleted: true });
    const deleted = fixture.artifacts.result.regression.changed_files.find(
      (entry) => entry.status === "deleted",
    );
    assert.ok(deleted, "saved evidence must include the deleted file");
    assert.equal(deleted.fingerprint, null);
    assert.doesNotThrow(() => validateFreshProject(fixture));
  });

  it("R3: one-byte add delete rename and nested-untracked changes require rerun", () => {
    const mutations = [
      {
        name: "one-byte",
        setup: {},
        mutate: (root) => writeFile(root, "src/a.js", "export const a = 2;\n"),
      },
      {
        name: "add",
        setup: {},
        mutate: (root) => writeFile(root, "src/added.js", "added\n"),
      },
      {
        name: "delete",
        setup: {},
        mutate: (root) => fs.rmSync(path.join(root, "src/b.js")),
      },
      {
        name: "rename",
        setup: {},
        mutate: (root) => fs.renameSync(
          path.join(root, "src/b.js"),
          path.join(root, "src/renamed.js"),
        ),
      },
      {
        name: "nested-untracked",
        setup: { untracked: true },
        mutate: (root) => writeFile(root, "scratch/nested.js", "export const nested = 2;\n"),
      },
    ];

    for (const mutation of mutations) {
      const fixture = setupChangedProject(mutation.setup);
      mutation.mutate(fixture.root);
      assert.throws(
        () => validateFreshProject(fixture),
        /snapshot is stale|rerun test-execute/i,
        mutation.name,
      );
    }
  });

  it("R4: commands config process artifacts gate hooks and planning retain production behavior", async () => {
    const fixture = await executeTestProject("required");
    assert.equal(fixture.artifact.regression.mode, "full");
    assert.equal(fixture.artifact.regression.root_test_command, "node project-regression.js");
    assert.equal(fixture.artifact.regression.root_test_command_source, "config");
    assert.equal(fixture.artifact.regression.command, "node project-regression.js");
    assert.deepEqual(fixture.artifact.regression.process, validProcess());
    assert.deepEqual(fixture.artifact.summary.map((entry) => [entry.id, entry.result]), [
      ["R2", "pass"],
    ]);
    const rawLog = fs.readFileSync(
      path.join(fixture.root, fixture.specDir, "tests/.raw/test-execution.log"),
      "utf8",
    );
    assert.match(rawLog, /project regression start/);
    assert.match(rawLog, /project regression pass/);
    assert.match(rawLog, /project regression end result=pass/);

    writeJson(fixture.root, `${fixture.specDir}/file-map.json`, {
      R2: [fixture.fixtureTest],
    });
    const statusUpdates = [];
    const hookContext = {
      root: fixture.root,
      flowState: fixture.state,
      flowManager: {
        updateStepStatus(id, status) {
          statusUpdates.push([id, status]);
        },
      },
    };
    await FLOW_COMMANDS.run["test-execute"].post(hookContext);
    const reviewOutput = await new RunTestResultReviewCommand().execute({
      root: fixture.root,
      flowState: fixture.state,
    });
    assert.equal(reviewOutput.result, "ok");
    const review = readJson(fixture.root, `${fixture.specDir}/test-result-review.json`);
    assert.equal(review.verdict, "pass");
    assert.ok(review.checked_items.every((item) => item.result === "pass"));
    await FLOW_COMMANDS.run["test-result-review"].post(hookContext);
    assert.deepEqual(statusUpdates, [
      ["test-execute", "done"],
      ["test-result-review", "done"],
    ]);

    const trust = validateIntegrationArtifactTrust({
      root: fixture.root,
      specDir: path.join(fixture.root, fixture.specDir),
      specPath: SPEC_RELATIVE,
      state: fixture.state,
      config: fixture.config,
    });
    assert.equal(trust.ok, true, trust.reason);

    const targeted = classifyRegression({
      root: REPO_ROOT,
      state: { spec: SPEC_RELATIVE },
      analysis: {},
      config: { test: { projectPaths: ["tests/project.test.js"] } },
      changedFiles: [{ status: "modified", path: "tests/project.test.js" }],
    });
    assert.equal(targeted.required, true);
    assert.equal(targeted.mode, "targeted");
    assert.equal(planTestExecuteRegression(targeted, {}).run, true);

    const skipped = classifyRegression({
      root: REPO_ROOT,
      state: { spec: SPEC_RELATIVE },
      analysis: {},
      config: {},
      changedFiles: [{ status: "modified", path: "docs/guide.md" }],
    });
    assert.equal(skipped.required, false);
    assert.equal(skipped.category, "docs-only");
    assert.equal(planTestExecuteRegression(skipped, {}).run, false);
  });
});
