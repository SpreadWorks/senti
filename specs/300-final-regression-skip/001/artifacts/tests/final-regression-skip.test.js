// spec: R1 R2 R3 R4 R5 R6 R7
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import RunFinalRegressionCommand from "../../../src/flow/lib/run-final-regression.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { contractFromFinalRegressionArtifact } from "../../../src/flow/lib/flow-judgment-contract.js";
import {
  durableTestArtifactPathspecs,
  validateFinalRegressionResult,
} from "../../../src/flow/lib/test-artifacts.js";
import { generateReport } from "../../../src/flow/commands/report.js";
import { validateSchema } from "../../../src/lib/schema-validate.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../../tests/helpers/tmp-dir.js";
import { initGitRepo, commitAll, checkoutNewBranch } from "../../../tests/helpers/git-repo.js";

const SPEC_DIR = "specs/300-final-regression-skip";
const SCRIPT_PATH = "final-regression-fixture.sh";
const COMMAND = `sh ${SCRIPT_PATH}`;

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function fingerprint(root, relPath) {
  return sha256(fs.readFileSync(path.join(root, relPath)));
}

function setupProject({
  scriptBody = "printf '%s\\n' SHOULD_NOT_RUN >&2\nexit 1\n",
  command = COMMAND,
  config = null,
  packageScript = null,
} = {}) {
  const tmp = createTmpDir("final-regression-skip-spec-");
  fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
  writeFile(tmp, `${SPEC_DIR}/spec.json`, JSON.stringify({ requirements: [] }) + "\n");
  writeFile(tmp, SCRIPT_PATH, scriptBody);
  if (packageScript) {
    writeFile(tmp, "package.json", JSON.stringify({ scripts: { test: packageScript } }, null, 2) + "\n");
  }
  writeFile(tmp, "src/runtime.js", "export const value = 1;\n");
  initGitRepo(tmp);
  commitAll(tmp, "initial");
  checkoutNewBranch(tmp, "feature/300-final-regression-skip");
  return {
    tmp,
    ctx: {
      root: tmp,
      config: config ?? { test: { command, timeout: 5 } },
      flowState: {
        spec: `${SPEC_DIR}/spec.json`,
        baseBranch: "main",
        featureBranch: "feature/300-final-regression-skip",
      },
    },
  };
}

function writeTestExecuteFullPassEvidence(root, relPaths, identity = {}) {
  const command = identity.command ?? COMMAND;
  const commandSource = identity.commandSource ?? "config";
  const argv = identity.argv ?? ["sh", SCRIPT_PATH];
  const env = identity.env ?? {};
  const source = identity.source ?? commandSource;
  const metadata = identity.metadata ?? {};
  const changedFiles = relPaths.map((relPath) => ({
    status: "modified",
    path: relPath,
    fingerprint: fingerprint(root, relPath),
  }));
  writeFile(root, `${SPEC_DIR}/test-execute-result.json`, JSON.stringify({
    version: "2",
    raw_output_path: `${SPEC_DIR}/tests/.raw/test-execution.log`,
    summary: [],
    regression: {
      required: true,
      mode: "full",
      result: "pass",
      root_test_command: command,
      root_test_command_source: commandSource,
      command,
      commandSource,
      argv,
      env,
      source,
      metadata,
      resolvedScriptDigest: null,
      resolvedConfigDigest: null,
      trigger_relevant_changed_files: changedFiles,
      changed_files: changedFiles,
      process: {
        started: true,
        exitCode: 0,
        signal: null,
        timedOut: false,
        spawnError: null,
      },
    },
  }, null, 2) + "\n");
}

function writeUpgradeEvidence(root, checkedPaths) {
  writeFile(root, `${SPEC_DIR}/tests/.raw/upgrade.log`, "upgrade complete\n");
  writeFile(root, `${SPEC_DIR}/upgrade-result.json`, JSON.stringify({
    version: 1,
    command: "senti upgrade",
    dryRun: false,
    exitCode: 0,
    result: "success-updated",
    summary: {},
    checkedPaths: [...checkedPaths].sort(),
    rawLogPath: "tests/.raw/upgrade.log",
  }, null, 2) + "\n");
}

function mutateTestExecuteEvidence(root, mutate) {
  const artifactPath = path.join(root, SPEC_DIR, "test-execute-result.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  mutate(artifact);
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2) + "\n");
}

function finalRegressionArtifact(root) {
  return JSON.parse(fs.readFileSync(path.join(root, SPEC_DIR, "final-regression-result.json"), "utf8"));
}

function assertFullRegressionRan(result, artifact) {
  assert.equal(result.result, "pass");
  assert.equal(artifact.result, "pass");
  assert.equal(artifact.process.started, true);
  assert.ok(!Object.hasOwn(artifact, "skipKind"));
}

function skippedArtifact(skipKind = "covered_by_test_execute_full_regression") {
  return {
    version: "1",
    completed: true,
    result: "skipped",
    failureKind: null,
    skipKind,
    reason: "same-flow full regression evidence already covers current changes",
    command: COMMAND,
    commandSource: "config",
    rawOutputPath: `${SPEC_DIR}/tests/.raw/final-regression-attempt-001.log`,
    rawOutputLines: { start: 1, end: 3 },
    process: {
      started: false,
      exitCode: null,
      signal: null,
      timedOut: false,
      spawnError: null,
    },
    changedFiles: [{ status: "modified", path: "src/runtime.js" }],
    retryable: false,
    nextAction: "report",
    proof: {
      kind: skipKind,
      reusedArtifactPath: `${SPEC_DIR}/test-execute-result.json`,
      commandIdentity: {
        command: COMMAND,
        commandSource: "config",
        argv: ["sh", SCRIPT_PATH],
        env: {},
        source: "config",
        metadata: {},
        resolvedScriptDigest: null,
        resolvedConfigDigest: null,
      },
      changedFileFingerprints: [{
        path: "src/runtime.js",
        fingerprint: "abc123",
      }],
      staleCheck: {
        sameFlow: true,
        commandIdentityMatched: true,
        changedFileFingerprintsMatched: true,
      },
    },
  };
}

function riskSkippedArtifact() {
  const artifact = skippedArtifact("risk_based_static_proof");
  artifact.reason = "all changed paths are explicit non-runtime paths";
  artifact.proof = {
    kind: "risk_based_static_proof",
    allowlistClassifications: [{
      path: "docs/final-regression-skip.md",
      category: "docs-only",
      fingerprint: "abc123",
    }],
    checkedSensitivePathClasses: [
      "package-config",
      "test-runner",
      "dependency",
      "runtime-source",
      "external-integration",
      "unknown",
    ],
    failClosedDecision: { eligible: true, fallbackReasons: [] },
    upgradeEvidencePath: null,
    testExecuteEvidencePath: null,
  };
  return artifact;
}

function assertRawDecisionLog(root, artifact) {
  const rawPath = path.join(root, artifact.rawOutputPath);
  assert.ok(fs.existsSync(rawPath), `raw decision log must exist: ${artifact.rawOutputPath}`);
  assert.equal(typeof artifact.rawOutputLines.start, "number");
  assert.equal(typeof artifact.rawOutputLines.end, "number");
  assert.ok(artifact.rawOutputLines.start >= 1);
  assert.ok(artifact.rawOutputLines.end >= artifact.rawOutputLines.start);
  const lines = fs.readFileSync(rawPath, "utf8").trimEnd().split(/\r?\n/);
  assert.ok(artifact.rawOutputLines.end <= lines.length);
  const decisionText = lines.slice(artifact.rawOutputLines.start - 1, artifact.rawOutputLines.end).join("\n");
  assert.match(decisionText, /skipped|skipKind|risk_based_static_proof|covered_by_test_execute_full_regression/);
}

function assertCoveredByTestExecuteProof(root, artifact) {
  const expectedFingerprint = fingerprint(root, "src/runtime.js");
  assert.equal(artifact.version, "1");
  assert.equal(artifact.result, "skipped");
  assert.equal(artifact.completed, true);
  assert.equal(artifact.failureKind, null);
  assert.equal(artifact.skipKind, "covered_by_test_execute_full_regression");
  assert.equal(typeof artifact.reason, "string");
  assert.ok(artifact.reason.length > 0);
  assert.equal(artifact.command, COMMAND);
  assert.equal(artifact.commandSource, "config");
  assert.deepEqual(artifact.changedFiles.map((entry) => entry.path), ["src/runtime.js"]);
  assert.match(artifact.rawOutputPath, /specs\/300-final-regression-skip\/tests\/\.raw\/final-regression-attempt-\d+\.log/);
  assert.deepEqual(Object.keys(artifact.rawOutputLines).sort(), ["end", "start"]);
  assertRawDecisionLog(root, artifact);
  assert.deepEqual(artifact.process, {
    started: false,
    exitCode: null,
    signal: null,
    timedOut: false,
    spawnError: null,
  });
  assert.equal(artifact.retryable, false);
  assert.equal(artifact.nextAction, "report");
  assert.equal(artifact.proof.kind, "covered_by_test_execute_full_regression");
  assert.equal(artifact.proof.reusedArtifactPath, `${SPEC_DIR}/test-execute-result.json`);
  assert.deepEqual(Object.keys(artifact.proof.commandIdentity).sort(), [
    "argv",
    "command",
    "commandSource",
    "env",
    "metadata",
    "resolvedConfigDigest",
    "resolvedScriptDigest",
    "source",
  ]);
  assert.deepEqual(artifact.proof.commandIdentity, {
    command: COMMAND,
    commandSource: "config",
    argv: ["sh", SCRIPT_PATH],
    env: {},
    source: "config",
    metadata: {},
    resolvedScriptDigest: null,
    resolvedConfigDigest: null,
  });
  assert.deepEqual(artifact.proof.staleCheck, {
    sameFlow: true,
    commandIdentityMatched: true,
    changedFileFingerprintsMatched: true,
  });
  assert.deepEqual(artifact.proof.changedFileFingerprints, [{
    path: "src/runtime.js",
    fingerprint: expectedFingerprint,
  }]);
}

function assertRiskBasedProof(root, artifact, expectedPath, expectedCategory) {
  const expectedFingerprint = fingerprint(root, expectedPath);
  assert.equal(artifact.version, "1");
  assert.equal(artifact.result, "skipped");
  assert.equal(artifact.completed, true);
  assert.equal(artifact.failureKind, null);
  assert.equal(artifact.skipKind, "risk_based_static_proof");
  assert.equal(typeof artifact.reason, "string");
  assert.ok(artifact.reason.length > 0);
  assert.equal(artifact.command, COMMAND);
  assert.equal(artifact.commandSource, "config");
  assert.ok(artifact.changedFiles.some((entry) => entry.path === expectedPath));
  assert.match(artifact.rawOutputPath, /specs\/300-final-regression-skip\/tests\/\.raw\/final-regression-attempt-\d+\.log/);
  assert.deepEqual(Object.keys(artifact.rawOutputLines).sort(), ["end", "start"]);
  assertRawDecisionLog(root, artifact);
  assert.deepEqual(artifact.process, {
    started: false,
    exitCode: null,
    signal: null,
    timedOut: false,
    spawnError: null,
  });
  assert.equal(artifact.retryable, false);
  assert.equal(artifact.nextAction, "report");
  assert.equal(artifact.proof.kind, "risk_based_static_proof");
  assert.deepEqual(artifact.proof.failClosedDecision, { eligible: true, fallbackReasons: [] });
  assert.ok(Array.isArray(artifact.proof.checkedSensitivePathClasses));
  assert.ok(Object.hasOwn(artifact.proof, "upgradeEvidencePath"));
  assert.ok(Object.hasOwn(artifact.proof, "testExecuteEvidencePath"));
  assert.ok(
    artifact.proof.allowlistClassifications.some((entry) =>
      entry.path === expectedPath && entry.category === expectedCategory && entry.fingerprint === expectedFingerprint,
    ),
  );
}

describe("final-regression skip behavior", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R1: skips when same-flow full/pass test-execute evidence matches command identity and changed-file fingerprints", async () => {
    const setup = setupProject();
    tmp = setup.tmp;
    writeFile(tmp, "src/runtime.js", "export const value = 2;\n");
    writeTestExecuteFullPassEvidence(tmp, ["src/runtime.js"]);

    const result = await new RunFinalRegressionCommand().execute(setup.ctx);
    const artifact = finalRegressionArtifact(tmp);

    assert.equal(result.result, "skipped");
    assertCoveredByTestExecuteProof(tmp, artifact);
  });

  it("R1: runs full regression when any same-flow full regression evidence identity or fingerprint check is stale", async () => {
    const staleMutations = [
      (artifact) => { artifact.version = "1"; },
      (artifact) => { artifact.regression.required = false; },
      (artifact) => { artifact.regression.mode = "targeted"; },
      (artifact) => { artifact.regression.result = "fail"; },
      (artifact) => { artifact.regression.command = "node other.js"; },
      (artifact) => { artifact.regression.commandSource = "package"; },
      (artifact) => { artifact.regression.argv = ["sh"]; },
      (artifact) => { artifact.regression.argv = ["sh", "different-fixture.sh"]; },
      (artifact) => { artifact.regression.env = { CI: "true" }; },
      (artifact) => { artifact.regression.source = "package.json"; },
      (artifact) => { artifact.regression.metadata = { script: "test" }; },
      (artifact) => { artifact.regression.resolvedScriptDigest = "different"; },
      (artifact) => { artifact.regression.resolvedConfigDigest = "different"; },
      (artifact) => { artifact.regression.trigger_relevant_changed_files[0].fingerprint = "stale"; },
    ];

    for (const mutate of staleMutations) {
      const setup = setupProject({ scriptBody: "printf '%s\\n' full regression ran\n" });
      tmp = setup.tmp;
      writeFile(tmp, "src/runtime.js", "export const value = 2;\n");
      writeTestExecuteFullPassEvidence(tmp, ["src/runtime.js"]);
      mutateTestExecuteEvidence(tmp, mutate);

      const result = await new RunFinalRegressionCommand().execute(setup.ctx);
      assertFullRegressionRan(result, finalRegressionArtifact(tmp));
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("R1: compares env and metadata primitive values for identical key sets", async () => {
    {
      const envCommand = `CI=true sh ${SCRIPT_PATH}`;
      const setup = setupProject({
        command: envCommand,
        scriptBody: "printf '%s\\n' env full regression ran\n",
      });
      tmp = setup.tmp;
      writeFile(tmp, "src/runtime.js", "export const value = 2;\n");
      writeTestExecuteFullPassEvidence(tmp, ["src/runtime.js"], {
        command: envCommand,
        argv: ["sh", SCRIPT_PATH],
        env: { CI: "true" },
      });
      mutateTestExecuteEvidence(tmp, (artifact) => {
        artifact.regression.env = { CI: "false" };
      });

      const result = await new RunFinalRegressionCommand().execute(setup.ctx);
      assertFullRegressionRan(result, finalRegressionArtifact(tmp));
      removeTmpDir(tmp);
      tmp = null;
    }

    {
      const packageScript = "node final-regression-fixture.cjs";
      const setup = setupProject({
        config: {},
        packageScript,
        scriptBody: "printf '%s\\n' shell fixture unused\n",
      });
      tmp = setup.tmp;
      writeFile(tmp, "final-regression-fixture.cjs", "console.log('metadata full regression ran');\n");
      writeFile(tmp, "src/runtime.js", "export const value = 2;\n");
      writeTestExecuteFullPassEvidence(tmp, ["src/runtime.js"], {
        command: "npm test --",
        commandSource: "package.json",
        argv: ["npm", "test", "--"],
        source: "package.json",
        metadata: { script: packageScript },
      });
      mutateTestExecuteEvidence(tmp, (artifact) => {
        artifact.regression.metadata = { script: "node other-fixture.cjs" };
      });

      const result = await new RunFinalRegressionCommand().execute(setup.ctx);
      assertFullRegressionRan(result, finalRegressionArtifact(tmp));
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("R1: requires exact changed-file fingerprint set equality with no missing, extra, or mismatched paths", async () => {
    const cases = [
      {
        name: "missing current trigger-relevant file",
        setup(root) {
          writeFile(root, "src/runtime.js", "export const value = 2;\n");
          writeFile(root, "src/second.js", "export const second = 2;\n");
          writeTestExecuteFullPassEvidence(root, ["src/runtime.js"]);
        },
      },
      {
        name: "extra stale evidence file",
        setup(root) {
          writeFile(root, "src/runtime.js", "export const value = 2;\n");
          writeFile(root, "src/extra.js", "export const extra = 1;\n");
          writeTestExecuteFullPassEvidence(root, ["src/runtime.js", "src/extra.js"]);
          writeFile(root, "src/extra.js", "export const extra = 0;\n");
        },
      },
      {
        name: "path mismatch",
        setup(root) {
          writeFile(root, "src/runtime.js", "export const value = 2;\n");
          writeTestExecuteFullPassEvidence(root, ["src/runtime.js"]);
          mutateTestExecuteEvidence(root, (artifact) => {
            artifact.regression.trigger_relevant_changed_files[0].path = "src/renamed.js";
            artifact.regression.changed_files[0].path = "src/renamed.js";
          });
        },
      },
    ];

    for (const item of cases) {
      const setup = setupProject({ scriptBody: `printf '%s\\n' ${JSON.stringify(item.name)}\n` });
      tmp = setup.tmp;
      item.setup(tmp);

      const result = await new RunFinalRegressionCommand().execute(setup.ctx);
      assertFullRegressionRan(result, finalRegressionArtifact(tmp));
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("R2: writes a risk-based static proof skip for explicit non-runtime-only changes", async () => {
    const setup = setupProject();
    tmp = setup.tmp;
    writeFile(tmp, "docs/final-regression-skip.md", "non-runtime documentation change\n");

    const result = await new RunFinalRegressionCommand().execute(setup.ctx);
    const artifact = finalRegressionArtifact(tmp);

    assert.equal(result.result, "skipped");
    assertRiskBasedProof(tmp, artifact, "docs/final-regression-skip.md", "docs-only");
  });

  it("R2: supports every explicit non-runtime allowlist family, including upgrade-backed template and preset sources", async () => {
    const cases = [
      { path: `${SPEC_DIR}/notes.md`, category: "spec-artifact-only" },
      { path: "docs/final-regression-skip.mdx", category: "docs-only" },
      { path: "CHANGELOG.mdx", category: "docs-only" },
      { path: "README.md", category: "docs-only" },
      { path: "src/flow/prompts/impl/final-regression.md", category: "flow-prompt" },
      {
        path: "src/skills/example/SKILL.md",
        category: "upgrade-source",
        beforeRun(root) {
          writeUpgradeEvidence(root, ["src/skills/example/SKILL.md"]);
        },
      },
      {
        path: "src/presets/example/preset.json",
        category: "upgrade-source",
        beforeRun(root) {
          writeUpgradeEvidence(root, ["src/presets/example/preset.json"]);
        },
      },
      {
        path: "src/templates/example/template.md",
        category: "upgrade-source",
        beforeRun(root) {
          writeUpgradeEvidence(root, ["src/templates/example/template.md"]);
        },
      },
    ];

    for (const item of cases) {
      const setup = setupProject();
      tmp = setup.tmp;
      writeFile(tmp, item.path, `${item.path} changed\n`);
      item.beforeRun?.(tmp);

      const result = await new RunFinalRegressionCommand().execute(setup.ctx);
      assert.equal(result.result, "skipped");
      assertRiskBasedProof(tmp, finalRegressionArtifact(tmp), item.path, item.category);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("R2: runs full regression for sensitive, excluded, outside-spec, and uncovered generic test-only changes", async () => {
    const cases = [
      {
        path: "src/runtime.js",
        write(root) {
          writeFile(root, "src/runtime.js", "export const value = 2;\n");
        },
      },
      {
        path: "package.json",
        write(root) {
          writeFile(root, "package.json", JSON.stringify({
            scripts: { test: COMMAND },
            dependencies: { changed: "1.0.0" },
          }, null, 2) + "\n");
        },
      },
      {
        path: ".senti/config.json",
        write(root) {
          writeFile(root, ".senti/config.json", JSON.stringify({
            test: { command: COMMAND, timeout: 5 },
            changed: true,
          }, null, 2) + "\n");
        },
      },
      { path: "scripts/external-integration.js" },
      { path: "src/skills/example/SKILL.md" },
      { path: "specs/other-flow/outside.md" },
      { path: "tests/new-policy.test.js" },
    ];

    for (const item of cases) {
      const setup = setupProject({ scriptBody: "printf '%s\\n' full regression ran\n" });
      tmp = setup.tmp;
      if (item.write) {
        item.write(tmp);
      } else {
        writeFile(tmp, item.path, `${item.path} changed\n`);
      }

      const result = await new RunFinalRegressionCommand().execute(setup.ctx);
      assertFullRegressionRan(result, finalRegressionArtifact(tmp));
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("R2: skips generic test-only changes only with exact same-flow path-plus-fingerprint evidence", async () => {
    for (const testPath of [
      "tests/final-regression-policy.test.js",
      "test/support.js",
      "lib/final-regression-policy.test.js",
      "lib/final-regression-policy.spec.js",
    ]) {
      const setup = setupProject();
      tmp = setup.tmp;
      writeFile(tmp, testPath, "import { test } from 'node:test';\ntest('policy', () => {});\n");
      writeTestExecuteFullPassEvidence(tmp, [testPath]);
      mutateTestExecuteEvidence(tmp, (artifact) => {
        artifact.regression.mode = "targeted";
      });

      const result = await new RunFinalRegressionCommand().execute(setup.ctx);
      const artifact = finalRegressionArtifact(tmp);

      assert.equal(result.result, "skipped");
      assertRiskBasedProof(tmp, artifact, testPath, "test-only");
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("R2: runs full regression for generic test-only changes with stale or invalid same-flow evidence", async () => {
    const testPath = "tests/final-regression-policy.test.js";
    const invalidEvidence = [
      (artifact) => { artifact.version = "1"; },
      (artifact) => { artifact.regression.result = "fail"; },
      (artifact) => { artifact.regression.mode = "none"; },
      (artifact) => { artifact.regression.changed_files = []; },
      (artifact) => { artifact.regression.changed_files[0].path = "tests/other-policy.test.js"; },
      (artifact) => { artifact.regression.changed_files[0].fingerprint = "stale"; },
    ];

    for (const mutate of invalidEvidence) {
      const setup = setupProject({ scriptBody: "printf '%s\\n' full regression ran\n" });
      tmp = setup.tmp;
      writeFile(tmp, testPath, "import { test } from 'node:test';\ntest('policy', () => {});\n");
      writeTestExecuteFullPassEvidence(tmp, [testPath]);
      mutateTestExecuteEvidence(tmp, (artifact) => {
        artifact.regression.mode = "targeted";
        mutate(artifact);
      });

      const result = await new RunFinalRegressionCommand().execute(setup.ctx);
      assertFullRegressionRan(result, finalRegressionArtifact(tmp));
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("R3: validates skipped final-regression artifacts with required proof and non-started process metadata", () => {
    const artifact = validateFinalRegressionResult(skippedArtifact());

    assert.equal(artifact.completed, true);
    assert.equal(artifact.failureKind, null);
    assert.equal(artifact.retryable, false);
    assert.equal(artifact.nextAction, "report");
    assert.equal(artifact.proof.kind, "covered_by_test_execute_full_regression");
    assert.deepEqual(artifact.rawOutputLines, { start: 1, end: 3 });
  });

  it("R3: validates risk-based skipped artifacts without requiring covered-by-test-execute proof fields", () => {
    const artifact = validateFinalRegressionResult(riskSkippedArtifact());

    assert.equal(artifact.skipKind, "risk_based_static_proof");
    assert.equal(artifact.proof.kind, "risk_based_static_proof");
    assert.equal(artifact.proof.upgradeEvidencePath, null);
    assert.equal(artifact.proof.testExecuteEvidencePath, null);
    assert.ok(!Object.hasOwn(artifact.proof, "commandIdentity"));
    assert.ok(!Object.hasOwn(artifact.proof, "staleCheck"));
  });

  it("R4: treats valid skipped final-regression artifacts as completed flow-judgment evidence", () => {
    const artifact = validateFinalRegressionResult(skippedArtifact());
    const contract = contractFromFinalRegressionArtifact(artifact, {
      artifactPath: `${SPEC_DIR}/final-regression-result.json`,
    });

    assert.equal(contract.verdict, "skipped");
    assert.equal(contract.failureKind, null);
    assert.equal(contract.nextAction, "report");
    assert.deepEqual(contract.blockingFindings, []);
    assert.equal(contract.summary.completionKind, "normal");
  });

  it("R4: accepts skipped final-regression artifacts through next-action schema and registry post-hook completion", async () => {
    const schema = JSON.parse(fs.readFileSync("src/flow/schemas/next-action/final-regression.schema.json", "utf8"));
    const output = {
      completed: true,
      result_path: `${SPEC_DIR}/final-regression-result.json`,
      raw_output_path: `${SPEC_DIR}/tests/.raw/final-regression-attempt-001.log`,
      result: "skipped",
      failureKind: null,
      skipKind: "covered_by_test_execute_full_regression",
      retryable: false,
      nextAction: "report",
    };
    assert.deepEqual(validateSchema(output, schema), []);

    tmp = createTmpDir("final-regression-post-hook-skip-");
    writeFile(tmp, `${SPEC_DIR}/final-regression-result.json`, JSON.stringify(skippedArtifact(), null, 2) + "\n");
    const updates = [];
    await FLOW_COMMANDS.run["final-regression"].post({
      root: tmp,
      flowState: { spec: `${SPEC_DIR}/spec.json` },
      flowManager: {
        updateStepStatus(stepId, status) {
          updates.push({ stepId, status });
        },
      },
    }, { result: "skipped" });
    assert.deepEqual(updates, [{ stepId: "final-regression", status: "done" }]);
  });

  it("R5: report and durable artifact handling preserve skipped final-regression result, skipKind, and raw log path", () => {
    const artifact = skippedArtifact("risk_based_static_proof");
    const report = generateReport({
      state: { spec: `${SPEC_DIR}/spec.json`, metrics: [] },
      results: { finalRegression: artifact, sync: { status: "skipped" } },
      issueLog: { entries: [] },
      implDiffStat: "",
      commitMessages: [],
    });

    assert.equal(report.data.tests.finalRegression.result, "skipped");
    assert.equal(report.data.tests.finalRegression.skipKind, "risk_based_static_proof");
    assert.match(report.text, /Final regression: result=skipped/);
    assert.match(report.text, /skipKind=risk_based_static_proof/);
    assert.ok(durableTestArtifactPathspecs("300-final-regression-skip").includes(`${SPEC_DIR}/final-regression-result.json`));
    assert.ok(durableTestArtifactPathspecs("300-final-regression-skip").includes(`${SPEC_DIR}/tests/.raw/final-regression-attempt-*.log`));
  });

  it("R6: prompts document test-execute responsibilities and final-regression skipped outcomes", () => {
    const testExecutePrompt = fs.readFileSync("src/flow/prompts/impl/test-execute.md", "utf8");
    const finalRegressionPrompt = fs.readFileSync("src/flow/prompts/impl/final-regression.md", "utf8");

    for (const term of ["spec-local", "targeted", "explicit-full", "deferred final-regression"]) {
      assert.match(testExecutePrompt, new RegExp(term.replace("-", "[- ]")));
    }
    for (const term of [
      "executed",
      "covered_by_test_execute_full_regression",
      "risk_based_static_proof",
      "skipKind",
      "rawOutputPath",
      "rawOutputLines",
      "process",
      "changedFiles",
      "retryable",
      "nextAction",
      "proof",
    ]) {
      assert.match(finalRegressionPrompt, new RegExp(term));
    }
  });

  it("R7: rejects stale or prior-flow full regression evidence instead of reusing it", async () => {
    const setup = setupProject({ scriptBody: "printf '%s\\n' current full regression ran\n" });
    tmp = setup.tmp;
    writeFile(tmp, "src/runtime.js", "export const value = 2;\n");
    writeTestExecuteFullPassEvidence(tmp, ["src/runtime.js"]);
    const artifactPath = path.join(tmp, SPEC_DIR, "test-execute-result.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    artifact.regression.command = "node prior-flow-test.js";
    artifact.regression.argv = ["node", "prior-flow-test.js"];
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2) + "\n");

    const result = await new RunFinalRegressionCommand().execute(setup.ctx);
    const finalArtifact = finalRegressionArtifact(tmp);

    assertFullRegressionRan(result, finalArtifact);
  });

  it("R7: ignores valid full/pass evidence that exists only in a different flow directory", async () => {
    const setup = setupProject({ scriptBody: "printf '%s\\n' current flow full regression ran\n" });
    tmp = setup.tmp;
    writeFile(tmp, "src/runtime.js", "export const value = 2;\n");
    writeFile(tmp, "specs/299-prior-flow/spec.json", JSON.stringify({ requirements: [] }) + "\n");
    const currentSpec = SPEC_DIR;
    const priorSpec = "specs/299-prior-flow";
    writeTestExecuteFullPassEvidence(tmp, ["src/runtime.js"]);
    fs.mkdirSync(path.join(tmp, priorSpec), { recursive: true });
    fs.renameSync(
      path.join(tmp, currentSpec, "test-execute-result.json"),
      path.join(tmp, priorSpec, "test-execute-result.json"),
    );

    const result = await new RunFinalRegressionCommand().execute(setup.ctx);
    assertFullRegressionRan(result, finalRegressionArtifact(tmp));
  });
});
