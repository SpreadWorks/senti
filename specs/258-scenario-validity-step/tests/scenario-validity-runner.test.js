// spec: R3 R4 R5 R6 R7 R8 R12
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { findStepById } from "../../../src/flow/definition.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import { checkoutNewBranch, commitAll, initGitRepo } from "../../../tests/helpers/git-repo.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";

const SPEC_ID = "258-scenario-validity-step";
const SPEC_REL = `specs/${SPEC_ID}/spec.json`;
const FLOW_CLI = path.join(process.cwd(), "src/flow.js");

async function loadScenarioModule() {
  return import("../../../src/flow/lib/run-scenario-validity.js");
}

async function loadCommand() {
  const mod = await loadScenarioModule();
  return mod.default;
}

async function loadArtifactValidator() {
  const mod = await import("../../../src/flow/lib/test-artifacts.js");
  return mod.validateScenarioValidityResult;
}

function failingSpecTest(reqId, message = "missing implementation behavior") {
  return [
    `// spec: ${reqId}`,
    'import { test } from "node:test";',
    'import assert from "node:assert/strict";',
    `test("${reqId}: ${message}", () => {`,
    '  assert.equal("before", "after");',
    "});",
    "",
  ].join("\n");
}

function passingSpecTest(reqId) {
  return [
    `// spec: ${reqId}`,
    'import { test } from "node:test";',
    'import assert from "node:assert/strict";',
    `test("${reqId}: already passes before implementation", () => {`,
    "  assert.equal(1, 1);",
    "});",
    "",
  ].join("\n");
}

function skippedSpecTest(reqId) {
  return [
    `// spec: ${reqId}`,
    'import { test } from "node:test";',
    `test("${reqId}: skipped scenario", { skip: true }, () => {`,
    '  throw new Error("skipped test body must not run");',
    "});",
    "",
  ].join("\n");
}

function syntaxErrorSpecTest(reqId) {
  return [
    `// spec: ${reqId}`,
    'import { test } from "node:test";',
    `test("${reqId}: syntax failure", () => {`,
    "  const broken = ;",
    "});",
    "",
  ].join("\n");
}

function hangingSpecTest(reqId) {
  return [
    `// spec: ${reqId}`,
    'import { test } from "node:test";',
    `test("${reqId}: hangs until scenario-validity timeout", async () => {`,
    "  await new Promise((resolve) => setTimeout(resolve, 10_000));",
    "});",
    "",
  ].join("\n");
}

function rootRegressionTest() {
  return [
    'import { test } from "node:test";',
    'import assert from "node:assert/strict";',
    'test("root regression must not run during scenario-validity", () => {',
    "  assert.equal(1, 2);",
    "});",
    "",
  ].join("\n");
}

function setupFixture({
  requirements = null,
  files = null,
  reqId = "R3",
  specTest = null,
  implementationChange = false,
  rootRegressionFixture = false,
  rootTestChange = false,
  packageChange = false,
  configChange = false,
  allowedArtifactChanges = false,
  staleArtifacts = false,
  testExecuteArtifacts = false,
  timeoutSeconds = 10,
} = {}) {
  const root = createTmpDir("scenario-validity-runner-");
  initGitRepo(root);
  writeJson(root, ".sdd-forge/config.json", {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    test: { timeoutSeconds },
  });
  writeJson(root, "package.json", { scripts: { test: "node --test" } });
  writeFile(root, "src/existing.js", "export const existing = true;\n");
  if (rootRegressionFixture) {
    writeFile(root, "tests/root-regression.test.js", rootRegressionTest());
  }
  commitAll(root, "base");
  checkoutNewBranch(root, "feature/scenario-validity");

  const specRequirements = requirements || [{ id: reqId, desc: `${reqId} fixture requirement` }];
  const spec = { requirements: specRequirements };
  writeJson(root, SPEC_REL, spec);

  const testFiles = files || (specTest == null ? [] : [[`tests/${reqId.toLowerCase()}.test.js`, specTest]]);
  for (const [rel, content] of testFiles) {
    writeFile(root, `specs/${SPEC_ID}/${rel}`, content);
  }
  writeFile(root, `specs/${SPEC_ID}/tests/${reqId.toLowerCase()}-ignored.js`, [
    'throw new Error("ignored spec-local non-test file ran");',
    "",
  ].join("\n"));

  if (allowedArtifactChanges) {
    writeJson(root, `specs/${SPEC_ID}/draft.json`, { body: "draft" });
    writeJson(root, `specs/${SPEC_ID}/issue-log.json`, { entries: [] });
    writeFile(root, `specs/${SPEC_ID}/spec-review.md`, "# review\n");
    writeFile(root, `specs/${SPEC_ID}/draft-review-1.md`, "# draft review\n");
  }
  if (implementationChange) {
    writeFile(root, "src/implementation-started.js", "export const changed = true;\n");
  }
  if (rootTestChange) {
    writeFile(root, "tests/regression.test.js", rootRegressionTest());
  }
  if (packageChange) {
    writeJson(root, "package.json", { scripts: { test: "node --test" }, changed: true });
  }
  if (configChange) {
    writeJson(root, ".sdd-forge/config.json", {
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
      test: { timeoutSeconds },
      changed: true,
    });
  }
  if (staleArtifacts) {
    writeJson(root, `specs/${SPEC_ID}/scenario-validity-result.json`, { stale: "STALE_RESULT_CONTENT" });
    writeFile(root, `specs/${SPEC_ID}/tests/.raw/scenario-validity.log`, "STALE_RAW_CONTENT\n");
  }
  if (testExecuteArtifacts) {
    writeJson(root, `specs/${SPEC_ID}/test-execute-result.json`, { version: "2", preserved: true });
    writeFile(root, `specs/${SPEC_ID}/tests/.raw/test-execution.log`, "PRESERVED_TEST_EXECUTE_RAW\n");
  }

  const state = {
    spec: SPEC_REL,
    baseBranch: "main",
    featureBranch: "feature/scenario-validity",
    requirements: spec.requirements,
    steps: buildInitialSteps(),
    tasks: [],
    currentTaskId: null,
  };
  for (const id of [
    "branch",
    "prepare-spec",
    "draft",
    "review-draft-questions",
    "draft-refine",
    "review-draft-coverage",
    "gate-draft",
    "spec",
    "review-spec",
    "spec-review-triage",
    "spec-repair",
    "gate",
    "approval",
    "test",
  ]) {
    const prerequisite = findStepById(state.steps, id);
    if (prerequisite) prerequisite.status = "done";
  }
  const step = findStepById(state.steps, "scenario-validity");
  if (step) step.status = "in_progress";

  const flowManager = makeFlowManager(root);
  flowManager.save(state);
  flowManager.addActiveFlow(SPEC_ID, "local");
  return { root, state, flowManager, timeoutSeconds };
}

function artifactPaths(root) {
  const specDir = path.join(root, "specs", SPEC_ID);
  return {
    specDir,
    resultPath: path.join(specDir, "scenario-validity-result.json"),
    rawPath: path.join(specDir, "tests/.raw/scenario-validity.log"),
  };
}

function readOutcome(root) {
  const paths = artifactPaths(root);
  assert.equal(fs.existsSync(paths.resultPath), true, "scenario-validity-result.json is written");
  assert.equal(fs.existsSync(paths.rawPath), true, "scenario-validity.log is written");
  return {
    artifact: JSON.parse(fs.readFileSync(paths.resultPath, "utf8")),
    raw: fs.readFileSync(paths.rawPath, "utf8"),
    ...paths,
  };
}

async function executeFixture(fixture) {
  const Command = await loadCommand();
  const command = new Command();
  let result = null;
  let error = null;
  try {
    result = await command.execute({
      root: fixture.root,
      flowState: fixture.state,
      flowManager: fixture.flowManager,
      config: { test: { timeoutSeconds: fixture.timeoutSeconds } },
    });
  } catch (err) {
    error = err;
  }
  return { result, error, ...readOutcome(fixture.root) };
}

function runScenarioValidityCli(fixture, extraArgs = []) {
  const res = spawnSync(process.execPath, [FLOW_CLI, "run", "scenario-validity", ...extraArgs], {
    cwd: fixture.root,
    encoding: "utf8",
  });
  return { ...res, ...readOutcome(fixture.root) };
}

function spawnScenarioValidity(cwd, extraArgs = []) {
  return spawnSync(process.execPath, [FLOW_CLI, "run", "scenario-validity", ...extraArgs], {
    cwd,
    encoding: "utf8",
  });
}

function runNextAction(root) {
  const res = spawnSync(process.execPath, [FLOW_CLI, "get", "next-action"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(res.status, 0, res.stderr || res.stdout);
  return JSON.parse(res.stdout);
}

function summaryById(artifact, id) {
  return artifact.summary.find((entry) => entry.id === id);
}

function validScenarioArtifact(id = "R7") {
  return {
    version: "1",
    raw_output_path: `specs/${SPEC_ID}/tests/.raw/scenario-validity.log`,
    command: `node --test specs/${SPEC_ID}/tests/${id.toLowerCase()}.test.js`,
    process: { started: true, exitCode: 1, signal: null, timedOut: false, spawnError: null },
    result: "pass",
    summary: [{
      id,
      classification: "expected_fail",
      evidence: {
        test_file: `specs/${SPEC_ID}/tests/${id.toLowerCase()}.test.js`,
        test_name: `${id}: missing implementation behavior`,
        command: `node --test specs/${SPEC_ID}/tests/${id.toLowerCase()}.test.js`,
        raw_output_lines: { start_line: 1, end_line: 2 },
      },
    }],
  };
}

function validScenarioContext(root, id = "R7") {
  return {
    root,
    specDir: path.join(root, "specs", SPEC_ID),
    requirements: [{ id, desc: `${id} validator requirement` }],
    rawText: `${id}: missing implementation behavior\nexitCode: 1\n`,
    rawLines: [`${id}: missing implementation behavior`, "exitCode: 1"],
  };
}

function assertBlockedPreflightMetadata(artifact) {
  assert.ok(artifact.command, "blocked artifact records command context");
  assert.equal(typeof artifact.process.started, "boolean");
  assert.ok(Object.hasOwn(artifact.process, "exitCode"));
  assert.ok(Object.hasOwn(artifact.process, "signal"));
  assert.ok(Object.hasOwn(artifact.process, "timedOut"));
  assert.ok(Object.hasOwn(artifact.process, "spawnError"));
}

function scenarioStepStatus(fixture) {
  return findStepById(fixture.flowManager.load().steps, "scenario-validity")?.status;
}

function relativeFiles(root, files) {
  return files.map((file) => path.relative(root, file).split(path.sep).join("/"));
}

test("R3: discovery returns only active spec-local tests", async () => {
  const root = createTmpDir("scenario-validity-discovery-");
  try {
    const specDir = path.join(root, "specs", "active");
    writeFile(root, "specs/active/tests/a.test.js", "");
    writeFile(root, "specs/active/tests/nested/b.spec.js", "");
    writeFile(root, "specs/active/not-tests/c.test.js", "");
    writeFile(root, "specs/other/tests/d.test.js", "");
    writeFile(root, "tests/root.test.js", "");

    const { discoverScenarioValidityTestFiles } = await loadScenarioModule();
    assert.deepEqual(relativeFiles(root, await discoverScenarioValidityTestFiles({ root, specDir })), [
      "specs/active/tests/a.test.js",
      "specs/active/tests/nested/b.spec.js",
    ]);
  } finally {
    removeTmpDir(root);
  }
});

test("R3: discovery includes every valid scenario test filename pattern", async () => {
  const root = createTmpDir("scenario-validity-valid-patterns-");
  try {
    const specDir = path.join(root, "specs", "active");
    for (const name of ["a.test.js", "b.spec.js", "c.test.ts", "d.spec.ts", "e.test.mjs", "f.spec.mjs"]) {
      writeFile(root, `specs/active/tests/${name}`, "");
    }

    const { discoverScenarioValidityTestFiles } = await loadScenarioModule();
    assert.deepEqual(relativeFiles(root, await discoverScenarioValidityTestFiles({ root, specDir })), [
      "specs/active/tests/a.test.js",
      "specs/active/tests/b.spec.js",
      "specs/active/tests/c.test.ts",
      "specs/active/tests/d.spec.ts",
      "specs/active/tests/e.test.mjs",
      "specs/active/tests/f.spec.mjs",
    ]);
  } finally {
    removeTmpDir(root);
  }
});

test("R3: discovery excludes invalid scenario test filename patterns", async () => {
  const root = createTmpDir("scenario-validity-invalid-patterns-");
  try {
    const specDir = path.join(root, "specs", "active");
    for (const name of [
      "helper.js",
      "a.js",
      "a.tests.js",
      "a.test.jsx",
      "a.spec.cjs",
      "b.test.cjs",
      "c.spec.jsx",
      "d.tests.js",
      "e.test.txt",
      "README.md",
      "test.js",
    ]) {
      writeFile(root, `specs/active/tests/${name}`, "");
    }

    const { discoverScenarioValidityTestFiles } = await loadScenarioModule();
    assert.deepEqual(await discoverScenarioValidityTestFiles({ root, specDir }), []);
  } finally {
    removeTmpDir(root);
  }
});

test("R3: runtime execution ignores matching tests from other specs", async () => {
  const fixture = setupFixture({
    reqId: "R3",
    specTest: failingSpecTest("R3"),
  });
  try {
    writeFile(fixture.root, "specs/other/tests/other.test.js", [
      'import { test } from "node:test";',
      'test("other spec marker must not run", () => {',
      '  throw new Error("OTHER_SPEC_MARKER");',
      "});",
      "",
    ].join("\n"));
    const outcome = await executeFixture(fixture);
    assert.equal(outcome.error, null);
    assert.equal(summaryById(outcome.artifact, "R3").classification, "expected_fail");
    assert.doesNotMatch(outcome.raw, /OTHER_SPEC_MARKER|other spec marker must not run/);
  } finally {
    removeTmpDir(fixture.root);
  }
});

test("R3: scenario-validity runs only matching spec-local tests and ignores root regression", async () => {
  const fixture = setupFixture({
    reqId: "R3",
    specTest: failingSpecTest("R3"),
    rootRegressionFixture: true,
  });
  try {
    const outcome = await executeFixture(fixture);
    assert.equal(outcome.error, null);
    assert.equal(summaryById(outcome.artifact, "R3").classification, "expected_fail");
    assert.match(outcome.raw, /R3: missing implementation behavior/);
    assert.doesNotMatch(outcome.raw, /root regression must not run/);
    assert.doesNotMatch(outcome.raw, /ignored spec-local non-test file ran/);
  } finally {
    removeTmpDir(fixture.root);
  }
});

test("R4: preflight allows spec-local test and spec artifact changes and proceeds to runtime execution", async () => {
  const fixture = setupFixture({
    reqId: "R4",
    specTest: failingSpecTest("R4"),
    allowedArtifactChanges: true,
  });
  try {
    const outcome = await executeFixture(fixture);
    assert.equal(outcome.error, null);
    assert.equal(summaryById(outcome.artifact, "R4").classification, "expected_fail");
    assert.match(outcome.raw, /R4: missing implementation behavior/);
  } finally {
    removeTmpDir(fixture.root);
  }
});

test("R4: implementation-target changes block as invalid_test before tests execute", async () => {
  const fixture = setupFixture({
    reqId: "R4",
    specTest: failingSpecTest("R4"),
    implementationChange: true,
  });
  try {
    const outcome = await executeFixture(fixture);
    assert.ok(outcome.error, "blocking result returns through failure path");
    assert.equal(summaryById(outcome.artifact, "R4").classification, "invalid_test");
    assertBlockedPreflightMetadata(outcome.artifact);
    assert.doesNotMatch(outcome.raw, /R4: missing implementation behavior/);
  } finally {
    removeTmpDir(fixture.root);
  }
});

test("R4: mixed allowed spec artifacts and disallowed implementation paths still block before tests execute", async () => {
  const fixture = setupFixture({
    reqId: "R4",
    specTest: failingSpecTest("R4"),
    allowedArtifactChanges: true,
    implementationChange: true,
  });
  try {
    const outcome = await executeFixture(fixture);
    assert.ok(outcome.error, "mixed allowed and disallowed changes block scenario-validity");
    assert.equal(summaryById(outcome.artifact, "R4").classification, "invalid_test");
    assertBlockedPreflightMetadata(outcome.artifact);
    assert.doesNotMatch(outcome.raw, /R4: missing implementation behavior/);
    assert.match(JSON.stringify(outcome.artifact), /src\/implementation-started\.js/);
  } finally {
    removeTmpDir(fixture.root);
  }
});

test("R4: changed root tests block as invalid_test before runtime execution", async () => {
  const fixture = setupFixture({
    reqId: "R4",
    specTest: failingSpecTest("R4"),
    rootTestChange: true,
  });
  try {
    const outcome = await executeFixture(fixture);
    assert.ok(outcome.error, "root test changes block scenario-validity");
    assert.equal(summaryById(outcome.artifact, "R4").classification, "invalid_test");
    assertBlockedPreflightMetadata(outcome.artifact);
    assert.doesNotMatch(outcome.raw, /R4: missing implementation behavior/);
    assert.match(JSON.stringify(outcome.artifact), /tests\/regression\.test\.js/);
  } finally {
    removeTmpDir(fixture.root);
  }
});

for (const [name, flag] of [["package.json", "packageChange"], [".sdd-forge/config.json", "configChange"]]) {
  test(`R4: changed ${name} blocks as invalid_test before runtime execution`, async () => {
    const fixture = setupFixture({
      reqId: "R4",
      specTest: failingSpecTest("R4"),
      [flag]: true,
    });
    try {
      const outcome = await executeFixture(fixture);
      assert.ok(outcome.error, `${name} changes block scenario-validity`);
      assert.equal(summaryById(outcome.artifact, "R4").classification, "invalid_test");
      assertBlockedPreflightMetadata(outcome.artifact);
      assert.doesNotMatch(outcome.raw, /R4: missing implementation behavior/);
      assert.match(JSON.stringify(outcome.artifact), new RegExp(name.replace(/[.]/g, "\\.")));
    } finally {
      removeTmpDir(fixture.root);
    }
  });
}

test("R4: preflight allow-list rejects nearby invalid paths", async () => {
  const { validateScenarioValidityPreflightPaths } = await loadScenarioModule();
  const allowed = validateScenarioValidityPreflightPaths({
    specId: "x",
    changedFiles: [
      "specs/x/tests/a.test.js",
      "specs/x/spec.json",
      "specs/x/draft.json",
      "specs/x/issue-log.json",
      "specs/x/spec-review.md",
      "specs/x/draft-review-1.md",
    ],
  });
  assert.equal(allowed.ok, true);
  assert.deepEqual(allowed.invalidPaths, []);

  const invalid = validateScenarioValidityPreflightPaths({
    specId: "x",
    changedFiles: [
      "specs/x/tests-extra/a.test.js",
      "specs/x/draft-review.md",
      "specs/x/draft-review-not-number.md",
    ],
  });
  assert.equal(invalid.ok, false);
  assert.deepEqual(invalid.invalidPaths, [
    "specs/x/tests-extra/a.test.js",
    "specs/x/draft-review.md",
    "specs/x/draft-review-not-number.md",
  ]);
});

test("R4: preflight diff command uses the exact implementation-target pathspec", async () => {
  const { buildScenarioValidityDiffArgs } = await loadScenarioModule();
  assert.deepEqual(buildScenarioValidityDiffArgs("main"), [
    "diff",
    "--name-only",
    "main",
    "--",
    "src/",
    "tests/",
    "package.json",
    ".sdd-forge/config.json",
  ]);
});

test("R5: scenario-validity artifact records command and process fields", async () => {
  const fixture = setupFixture({ reqId: "R5", specTest: failingSpecTest("R5") });
  try {
    const outcome = await executeFixture(fixture);
    assert.equal(outcome.error, null);
    assert.equal(outcome.artifact.version, "1");
    assert.match(outcome.artifact.raw_output_path, /tests\/\.raw\/scenario-validity\.log$/);
    assert.match(outcome.artifact.command, /^node --test /);
    assert.equal(typeof outcome.artifact.process.started, "boolean");
    assert.ok(Object.hasOwn(outcome.artifact.process, "exitCode"));
    assert.ok(Object.hasOwn(outcome.artifact.process, "signal"));
    assert.ok(Object.hasOwn(outcome.artifact.process, "timedOut"));
    assert.ok(Object.hasOwn(outcome.artifact.process, "spawnError"));
    assert.equal(outcome.artifact.summary.length, 1);
  } finally {
    removeTmpDir(fixture.root);
  }
});

test("R5: result contains one summary entry per testable requirement only", async () => {
  const fixture = setupFixture({
    requirements: [
      { id: "R20A", desc: "first testable requirement" },
      { id: "R20B", desc: "second testable requirement" },
      { id: "R20D", desc: "third testable requirement" },
      { id: "R20C", desc: "non-testable requirement", testable: false },
    ],
    files: [
      ["tests/r20a.test.js", failingSpecTest("R20A")],
      ["tests/r20b.test.js", failingSpecTest("R20B")],
      ["tests/r20d.test.js", failingSpecTest("R20D")],
    ],
  });
  try {
    const outcome = await executeFixture(fixture);
    assert.equal(outcome.error, null);
    assert.deepEqual(outcome.artifact.summary.map((entry) => entry.id).sort(), ["R20A", "R20B", "R20D"]);
    assert.ok(outcome.artifact.summary.every((entry) => entry.classification === "expected_fail"));
  } finally {
    removeTmpDir(fixture.root);
  }
});

test("R5: stale scenario-validity artifacts are removed before rerun", async () => {
  const fixture = setupFixture({
    reqId: "R5",
    specTest: failingSpecTest("R5", "fresh missing behavior"),
    staleArtifacts: true,
  });
  try {
    const outcome = await executeFixture(fixture);
    assert.equal(outcome.error, null);
    assert.doesNotMatch(JSON.stringify(outcome.artifact), /STALE_RESULT_CONTENT/);
    assert.doesNotMatch(outcome.raw, /STALE_RAW_CONTENT/);
    assert.match(outcome.raw, /R5: fresh missing behavior/);
  } finally {
    removeTmpDir(fixture.root);
  }
});

test("R5: process failure writes result metadata and raw log", async () => {
  const fixture = setupFixture({
    reqId: "R5",
    specTest: syntaxErrorSpecTest("R5"),
  });
  try {
    const outcome = await executeFixture(fixture);
    assert.ok(outcome.error, "process failure blocks scenario-validity");
    assert.equal(outcome.artifact.process.started, true);
    assert.notEqual(outcome.artifact.process.exitCode, 0);
    assert.equal(outcome.artifact.process.signal, null);
    assert.equal(typeof outcome.artifact.process.timedOut, "boolean");
    assert.ok(Object.hasOwn(outcome.artifact.process, "spawnError"));
    assert.match(outcome.raw, /SyntaxError|Unexpected token/);
  } finally {
    removeTmpDir(fixture.root);
  }
});

test("R5: timeout writes timedOut process metadata and blocks progress", async () => {
  const fixture = setupFixture({
    reqId: "R5",
    specTest: hangingSpecTest("R5"),
    timeoutSeconds: 0.01,
  });
  try {
    const outcome = await executeFixture(fixture);
    assert.ok(outcome.error, "timeout blocks scenario-validity");
    assert.equal(outcome.artifact.process.started, true);
    assert.equal(outcome.artifact.process.timedOut, true);
    assert.notEqual(scenarioStepStatus(fixture), "done");
    assert.match(outcome.raw, /timeout|timed out|SIGTERM|AbortError/i);
  } finally {
    removeTmpDir(fixture.root);
  }
});

test("R5: artifact validator accepts captured spawn error and timeout process metadata", async () => {
  const validateScenarioValidityResult = await loadArtifactValidator();
  const root = createTmpDir("scenario-validity-process-validator-");
  try {
    writeFile(root, `specs/${SPEC_ID}/tests/r5.test.js`, failingSpecTest("R5"));
    const base = {
      version: "1",
      raw_output_path: `specs/${SPEC_ID}/tests/.raw/scenario-validity.log`,
      command: "node --test specs/258-scenario-validity-step/tests/r5.test.js",
      result: "block",
      summary: [{
        id: "R5",
        classification: "invalid_test",
        evidence: {
          test_file: `specs/${SPEC_ID}/tests/r5.test.js`,
          test_name: "R5: missing implementation behavior",
          command: "node --test specs/258-scenario-validity-step/tests/r5.test.js",
          raw_output_lines: { start_line: 1, end_line: 2 },
        },
      }],
    };
    const ctx = {
      root,
      specDir: path.join(root, "specs", SPEC_ID),
      requirements: [{ id: "R5", desc: "process metadata requirement" }],
      rawText: "R5: missing implementation behavior\nprocess failed\n",
      rawLines: ["R5: missing implementation behavior", "process failed"],
    };

    assert.doesNotThrow(() => validateScenarioValidityResult({
      ...base,
      process: { started: false, exitCode: null, signal: null, timedOut: false, spawnError: "ENOENT" },
    }, ctx));
    assert.doesNotThrow(() => validateScenarioValidityResult({
      ...base,
      process: { started: true, exitCode: null, signal: "SIGTERM", timedOut: true, spawnError: null },
    }, ctx));
  } finally {
    removeTmpDir(root);
  }
});

test("R5: artifact validator rejects missing top-level and process metadata fields", async () => {
  const validateScenarioValidityResult = await loadArtifactValidator();
  const root = createTmpDir("scenario-validity-required-fields-validator-");
  try {
    writeFile(root, `specs/${SPEC_ID}/tests/r5.test.js`, failingSpecTest("R5"));
    const valid = validScenarioArtifact("R5");
    const ctx = validScenarioContext(root, "R5");

    for (const field of ["raw_output_path", "command", "process"]) {
      const malformed = structuredClone(valid);
      delete malformed[field];
      assert.throws(
        () => validateScenarioValidityResult(malformed, ctx),
        new RegExp(`${field}|scenario-validity-result\\.json`),
      );
    }

    for (const field of ["started", "exitCode", "signal", "timedOut", "spawnError"]) {
      const malformed = structuredClone(valid);
      delete malformed.process[field];
      assert.throws(
        () => validateScenarioValidityResult(malformed, ctx),
        new RegExp(`process\\.${field}|${field}`),
      );
    }
  } finally {
    removeTmpDir(root);
  }
});

test("R5: process helper captures a real spawn error", async () => {
  const { runScenarioValidityProcess } = await loadScenarioModule();
  const root = createTmpDir("scenario-validity-spawn-error-");
  try {
    const result = await runScenarioValidityProcess({
      argv: ["definitely-missing-sdd-forge-scenario-validity-binary"],
      cwd: root,
      timeoutMs: 1000,
    });
    assert.equal(result.started, false);
    assert.equal(result.exitCode, null);
    assert.equal(result.signal, null);
    assert.equal(result.timedOut, false);
    assert.match(result.spawnError, /ENOENT|not found|no such file/i);
  } finally {
    removeTmpDir(root);
  }
});

test("R6: real command flow marks scenario-validity done on expected_fail pass", () => {
  const fixture = setupFixture({ reqId: "R6", specTest: failingSpecTest("R6") });
  try {
    const outcome = runScenarioValidityCli(fixture);
    assert.equal(outcome.status, 0, outcome.stderr || outcome.stdout);
    assert.equal(summaryById(outcome.artifact, "R6").classification, "expected_fail");
    assert.equal(scenarioStepStatus(fixture), "done");
  } finally {
    removeTmpDir(fixture.root);
  }
});

test("R6: real CLI rejects scenario-validity when no active flow exists", () => {
  const root = createTmpDir("scenario-validity-no-active-flow-");
  try {
    writeJson(root, ".sdd-forge/config.json", {
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
    });
    const res = spawnScenarioValidity(root);
    assert.notEqual(res.status, 0, res.stderr || res.stdout);
    assert.equal(fs.existsSync(path.join(root, "specs", SPEC_ID, "scenario-validity-result.json")), false);
  } finally {
    removeTmpDir(root);
  }
});

test("R6: real CLI rejects positional args before scenario-validity execution", () => {
  const fixture = setupFixture({ reqId: "R6", specTest: failingSpecTest("R6") });
  try {
    const res = spawnScenarioValidity(fixture.root, ["extra"]);
    assert.notEqual(res.status, 0, res.stderr || res.stdout);
    const paths = artifactPaths(fixture.root);
    assert.equal(fs.existsSync(paths.resultPath), false);
    assert.equal(fs.existsSync(paths.rawPath), false);
    assert.notEqual(scenarioStepStatus(fixture), "done");
  } finally {
    removeTmpDir(fixture.root);
  }
});

for (const { name, reqId, specTest, expectedClassification } of [
  {
    name: "unexpected_pass",
    reqId: "R6U",
    specTest: passingSpecTest("R6U"),
    expectedClassification: "unexpected_pass",
  },
  {
    name: "invalid_test",
    reqId: "R6I",
    specTest: failingSpecTest("R6I"),
    expectedClassification: "invalid_test",
  },
  {
    name: "skipped",
    reqId: "R6S",
    specTest: skippedSpecTest("R6S"),
    expectedClassification: "skipped",
  },
  {
    name: "not_run",
    reqId: "R6N",
    specTest: null,
    expectedClassification: "not_run",
  },
]) {
  test(`R6: blocking classification ${name} fails and leaves scenario-validity incomplete`, () => {
    const fixture = setupFixture({
      reqId,
      specTest,
      implementationChange: expectedClassification === "invalid_test",
    });
    try {
      const outcome = runScenarioValidityCli(fixture);
      assert.notEqual(outcome.status, 0, outcome.stderr || outcome.stdout);
      assert.equal(summaryById(outcome.artifact, reqId).classification, expectedClassification);
      assert.notEqual(scenarioStepStatus(fixture), "done");
    } finally {
      removeTmpDir(fixture.root);
    }
  });
}

test("R7: summary evidence points to the scenario-validity raw output", async () => {
  const fixture = setupFixture({ reqId: "R7", specTest: failingSpecTest("R7") });
  try {
    const outcome = await executeFixture(fixture);
    const entry = summaryById(outcome.artifact, "R7");
    assert.equal(entry.classification, "expected_fail");
    assert.match(entry.evidence.test_file, /specs\/258-scenario-validity-step\/tests\/r7\.test\.js$/);
    assert.equal(entry.evidence.test_name, "R7: missing implementation behavior");
    assert.match(entry.evidence.command, /^node --test /);
    assert.equal(Number.isInteger(entry.evidence.raw_output_lines.start_line), true);
    assert.equal(Number.isInteger(entry.evidence.raw_output_lines.end_line), true);
    const rawLineCount = outcome.raw.trimEnd().split(/\r?\n/).length;
    assert.ok(entry.evidence.raw_output_lines.start_line >= 1);
    assert.ok(entry.evidence.raw_output_lines.end_line <= rawLineCount);
  } finally {
    removeTmpDir(fixture.root);
  }
});

test("R7: artifact validator rejects missing mandatory evidence fields", async () => {
  const validateScenarioValidityResult = await loadArtifactValidator();
  const root = createTmpDir("scenario-validity-validator-");
  try {
    writeFile(root, `specs/${SPEC_ID}/tests/r7.test.js`, failingSpecTest("R7"));
    const valid = {
      version: "1",
      raw_output_path: `specs/${SPEC_ID}/tests/.raw/scenario-validity.log`,
      command: "node --test specs/258-scenario-validity-step/tests/r7.test.js",
      process: { started: true, exitCode: 1, signal: null, timedOut: false, spawnError: null },
      result: "pass",
      summary: [{
        id: "R7",
        classification: "expected_fail",
        evidence: {
          test_file: `specs/${SPEC_ID}/tests/r7.test.js`,
          test_name: "R7: missing implementation behavior",
          command: "node --test specs/258-scenario-validity-step/tests/r7.test.js",
          raw_output_lines: { start_line: 1, end_line: 2 },
        },
      }],
    };
    const ctx = {
      root,
      specDir: path.join(root, "specs", SPEC_ID),
      requirements: [{ id: "R7", desc: "evidence requirement" }],
      rawText: "R7: missing implementation behavior\nexitCode: 1\n",
      rawLines: ["R7: missing implementation behavior", "exitCode: 1"],
    };

    assert.doesNotThrow(() => validateScenarioValidityResult(valid, ctx));

    for (const field of ["test_file", "test_name", "command", "raw_output_lines"]) {
      const malformed = structuredClone(valid);
      delete malformed.summary[0].evidence[field];
      assert.throws(
        () => validateScenarioValidityResult(malformed, ctx),
        new RegExp(`evidence\\.${field}|${field} is required`),
      );
    }
  } finally {
    removeTmpDir(root);
  }
});

test("R7: artifact validator accepts supported classifications and rejects unknown ones", async () => {
  const validateScenarioValidityResult = await loadArtifactValidator();
  const root = createTmpDir("scenario-validity-classification-validator-");
  try {
    writeFile(root, `specs/${SPEC_ID}/tests/r7.test.js`, failingSpecTest("R7"));
    const valid = {
      version: "1",
      raw_output_path: `specs/${SPEC_ID}/tests/.raw/scenario-validity.log`,
      command: "node --test specs/258-scenario-validity-step/tests/r7.test.js",
      process: { started: true, exitCode: 1, signal: null, timedOut: false, spawnError: null },
      result: "block",
      summary: [{
        id: "R7",
        classification: "expected_fail",
        evidence: {
          test_file: `specs/${SPEC_ID}/tests/r7.test.js`,
          test_name: "R7: missing implementation behavior",
          command: "node --test specs/258-scenario-validity-step/tests/r7.test.js",
          raw_output_lines: { start_line: 1, end_line: 2 },
        },
      }],
    };
    const ctx = {
      root,
      specDir: path.join(root, "specs", SPEC_ID),
      requirements: [{ id: "R7", desc: "classification requirement" }],
      rawText: "R7: missing implementation behavior\nexitCode: 1\n",
      rawLines: ["R7: missing implementation behavior", "exitCode: 1"],
    };

    for (const classification of ["expected_fail", "unexpected_pass", "invalid_test", "skipped", "not_run"]) {
      const artifact = structuredClone(valid);
      artifact.summary[0].classification = classification;
      assert.doesNotThrow(() => validateScenarioValidityResult(artifact, ctx));
    }

    const unknown = structuredClone(valid);
    unknown.summary[0].classification = "unknown";
    assert.throws(() => validateScenarioValidityResult(unknown, ctx), /classification|unknown/);
  } finally {
    removeTmpDir(root);
  }
});

test("R7: artifact validator rejects wrong raw log path and invalid line ranges", async () => {
  const validateScenarioValidityResult = await loadArtifactValidator();
  const root = createTmpDir("scenario-validity-line-validator-");
  try {
    writeFile(root, `specs/${SPEC_ID}/tests/r7.test.js`, failingSpecTest("R7"));
    const valid = {
      version: "1",
      raw_output_path: `specs/${SPEC_ID}/tests/.raw/scenario-validity.log`,
      command: "node --test specs/258-scenario-validity-step/tests/r7.test.js",
      process: { started: true, exitCode: 1, signal: null, timedOut: false, spawnError: null },
      result: "pass",
      summary: [{
        id: "R7",
        classification: "expected_fail",
        evidence: {
          test_file: `specs/${SPEC_ID}/tests/r7.test.js`,
          test_name: "R7: missing implementation behavior",
          command: "node --test specs/258-scenario-validity-step/tests/r7.test.js",
          raw_output_lines: { start_line: 1, end_line: 2 },
        },
      }],
    };
    const ctx = {
      root,
      specDir: path.join(root, "specs", SPEC_ID),
      requirements: [{ id: "R7", desc: "evidence requirement" }],
      rawText: "R7: missing implementation behavior\nexitCode: 1\n",
      rawLines: ["R7: missing implementation behavior", "exitCode: 1"],
    };

    const wrongLog = structuredClone(valid);
    wrongLog.raw_output_path = `specs/${SPEC_ID}/tests/.raw/test-execution.log`;
    assert.throws(() => validateScenarioValidityResult(wrongLog, ctx), /scenario-validity\.log|raw_output_path/);

    const missingRange = structuredClone(valid);
    missingRange.summary[0].evidence.raw_output_lines = {};
    assert.throws(() => validateScenarioValidityResult(missingRange, ctx), /raw_output_lines|start_line|end_line/);

    const outsideRange = structuredClone(valid);
    outsideRange.summary[0].evidence.raw_output_lines.end_line = 99;
    assert.throws(() => validateScenarioValidityResult(outsideRange, ctx), /outside raw output|line range|raw_output_lines/);

    for (const raw_output_lines of [
      { start_line: 2, end_line: 1 },
      { start_line: 0, end_line: 1 },
      { start_line: -1, end_line: 1 },
      { start_line: 1, end_line: 0 },
    ]) {
      const malformed = structuredClone(valid);
      malformed.summary[0].evidence.raw_output_lines = raw_output_lines;
      assert.throws(
        () => validateScenarioValidityResult(malformed, ctx),
        /range|raw_output_lines|start_line|end_line/,
      );
    }
  } finally {
    removeTmpDir(root);
  }
});

test("R8: scenario-validity rerun preserves existing test-execute artifacts", async () => {
  const fixture = setupFixture({
    reqId: "R8",
    specTest: failingSpecTest("R8", "fresh missing behavior"),
    staleArtifacts: true,
    testExecuteArtifacts: true,
  });
  try {
    const outcome = await executeFixture(fixture);
    assert.equal(outcome.error, null);
    assert.doesNotMatch(JSON.stringify(outcome.artifact), /STALE_RESULT_CONTENT/);
    assert.doesNotMatch(outcome.raw, /STALE_RAW_CONTENT/);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(outcome.specDir, "test-execute-result.json"), "utf8")),
      { version: "2", preserved: true },
    );
    assert.equal(
      fs.readFileSync(path.join(outcome.specDir, "tests/.raw/test-execution.log"), "utf8"),
      "PRESERVED_TEST_EXECUTE_RAW\n",
    );
  } finally {
    removeTmpDir(fixture.root);
  }
});

test("R12: expected_fail scenario-validity run marks scenario-validity complete", () => {
  const fixture = setupFixture({ reqId: "R12", specTest: failingSpecTest("R12") });
  try {
    const outcome = runScenarioValidityCli(fixture);
    assert.equal(outcome.status, 0, outcome.stderr || outcome.stdout);
    assert.equal(scenarioStepStatus(fixture), "done");
  } finally {
    removeTmpDir(fixture.root);
  }
});

test("R12: full acceptance run records every expected_fail requirement and ignores non-scenario tests", async () => {
  const validateScenarioValidityResult = await loadArtifactValidator();
  const fixture = setupFixture({
    requirements: [
      { id: "R12A", desc: "first accepted requirement" },
      { id: "R12B", desc: "second accepted requirement" },
      { id: "R12C", desc: "non-testable acceptance note", testable: false },
    ],
    files: [
      ["tests/r12a.test.js", failingSpecTest("R12A")],
      ["tests/nested/r12b.spec.mjs", failingSpecTest("R12B")],
    ],
    rootRegressionFixture: true,
  });
  try {
    writeFile(fixture.root, "specs/other/tests/other.test.js", [
      'import { test } from "node:test";',
      'test("other spec must not run during acceptance", () => {',
      '  throw new Error("OTHER_SPEC_ACCEPTANCE_MARKER");',
      "});",
      "",
    ].join("\n"));

    const outcome = runScenarioValidityCli(fixture);
    assert.equal(outcome.status, 0, outcome.stderr || outcome.stdout);
    assert.equal(outcome.artifact.result, "pass");
    assert.deepEqual(outcome.artifact.summary.map((entry) => entry.id).sort(), ["R12A", "R12B"]);
    assert.ok(outcome.artifact.summary.every((entry) => entry.classification === "expected_fail"));
    assert.doesNotMatch(outcome.raw, /root regression must not run|OTHER_SPEC_ACCEPTANCE_MARKER/);
    assert.equal(scenarioStepStatus(fixture), "done");

    assert.doesNotThrow(() => validateScenarioValidityResult(outcome.artifact, {
      root: fixture.root,
      specDir: outcome.specDir,
      requirements: fixture.state.requirements,
      rawText: outcome.raw,
      rawLines: outcome.raw.trimEnd().split(/\r?\n/),
    }));
  } finally {
    removeTmpDir(fixture.root);
  }
});

test("R12: unexpected_pass scenario-validity run leaves scenario-validity incomplete", () => {
  const fixture = setupFixture({ reqId: "R12", specTest: passingSpecTest("R12") });
  try {
    const outcome = runScenarioValidityCli(fixture);
    assert.notEqual(outcome.status, 0, outcome.stderr || outcome.stdout);
    assert.equal(summaryById(outcome.artifact, "R12").classification, "unexpected_pass");
    assert.notEqual(scenarioStepStatus(fixture), "done");
  } finally {
    removeTmpDir(fixture.root);
  }
});
