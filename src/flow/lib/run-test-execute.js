/**
 * src/flow/lib/run-test-execute.js
 *
 * Deterministic test execution entry point. The runner owns project-level
 * regression execution and composes test-execute-result.json version "2".
 *
 * Root regression discovery is delegated to test-regression.js and follows:
 * test.command argv parsing with KEY=value env support and shell pipe /
 * semicolon / redirection / subshell / glob rejection, then package.json
 * scripts.test via npm test --, composer.json scripts.test via composer
 * run-script test --, and Makefile test via make test. Unknown analysis,
 * execution, config, or test-contract file changes are deferred to
 * final-regression by default. test.projectPaths drives targeted project
 * test-file classification for the normal repair loop.
 * Skipped categories are docs-only, spec-artifact-only, non-project-only, and
 * mixed-non-trigger. The temporary summary path lives under tests/.raw and is
 * deleted during cleanup.
 * Required regression raw output uses explicit start marker / end marker
 * sections. Started exit code 127, non-zero exit, signal, and timeout
 * outcomes become v2 fail artifacts.
 */

import fs from "fs";
import path from "path";
import { container } from "../../lib/container.js";
import { resolveSpecDir } from "../../lib/spec-json.js";
import { senrailOutputDir } from "../../lib/config.js";
import { listChangedFilesDetailed } from "../../lib/git-helpers.js";
import { FlowCommand } from "./base-command.js";
import { appendIssueLogEntry } from "./set-issue-log.js";
import {
  RAW_OUTPUT_RELATIVE,
  TEST_EXECUTE_RESULT_FILE,
  removeTempRequirementSummary,
  removeRebuildableTestArtifacts,
  readJsonStrict,
  tempRequirementSummaryPath,
  validateSummaryEvidence,
  writeTempRequirementSummary,
} from "./test-artifacts.js";
import {
  classifyRegression,
  commandIdentityFor,
  discoverRegressionCommand,
  listRegressionChangedFiles,
  planTestExecuteRegression,
  processOutputLines,
  processPassed,
  resolveTestTimeoutSeconds,
  runProcessDetailed,
} from "./test-regression.js";
import { RegressionFileSnapshotList } from "./regression-file-snapshot.js";
import {
  buildRepairFingerprint,
  ensureRepairFingerprintContract,
  recoverImplRepairTransaction,
  writeRepairEvidenceArtifact,
} from "./impl-repair-artifacts.js";
import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";
import { SharedSpecTestExecution } from "./shared-spec-test-execution.js";

const MAX_TEST_EXECUTE_REQUIREMENTS = 500;
const NO_TESTS_DECLARED_REASON = "no_tests_declared";

function recordPrerequisiteIssue(root, executionRoot, state, err) {
  let changedFileCount = null;
  try {
    changedFileCount = listChangedFilesDetailed({ cwd: executionRoot, baseBranch: state.baseBranch || "main" }).length;
  } catch (_) {
    changedFileCount = null;
  }
  appendIssueLogEntry(root, relativeFlowSpecFile(state), {
    step: "test-execute",
    reason: `test-execute prerequisite failed before normal v2 artifact creation: ${err.message || String(err)}`,
    failureKind: "prerequisite",
    message: err.message || String(err),
    commandSource: err.commandSource || null,
    commandCandidates: Array.isArray(err.commandCandidates) ? err.commandCandidates : [],
    changedFileCount,
    trigger: "senrail flow run test-execute",
    resolution: "fix the prerequisite failure and rerun test-execute",
    taskId: null,
    timestamp: new Date().toISOString(),
  });
}

function listSpecTestFiles(specDir) {
  const testsDir = path.join(specDir, "tests");
  if (!fs.existsSync(testsDir)) return [];
  return fs.readdirSync(testsDir)
    .filter((name) => /\.(test|spec)\.(js|mjs|ts)$/.test(name))
    .sort()
    .map((name) => path.join(testsDir, name));
}

function extractRequirementTestName(filePath, reqId) {
  const src = fs.readFileSync(filePath, "utf8");
  const re = new RegExp(`(?:it|test)\\(\\s*["'\`](${reqId}: [^"'\`]+)["'\`]`);
  return src.match(re)?.[1] || `${reqId}: requirement verification`;
}

function findSpecTestFileForReq(specDir, reqId) {
  for (const file of listSpecTestFiles(specDir)) {
    const firstLine = fs.readFileSync(file, "utf8").split(/\r?\n/, 1)[0];
    if (new RegExp(`\\b${reqId}\\b`).test(firstLine)) return file;
  }
  return listSpecTestFiles(specDir)[0] || null;
}

function appendRaw(lines, sectionLines) {
  const start = lines.length + 1;
  lines.push(...sectionLines);
  return { start_line: start, end_line: lines.length };
}

export async function runSpecLocalTests({ repositoryRoot, executionRoot, specDir, timeoutMs }) {
  const files = listSpecTestFiles(specDir);
  if (files.length === 0) {
    return {
      command: "node --test",
      noTestsDeclared: true,
      result: { started: true, exitCode: 0, signal: null, timedOut: false, spawnError: null, stdout: "", stderr: "" },
    };
  }
  const execution = new SharedSpecTestExecution({
    repositoryRoot,
    executionRoot,
    specRoot: path.dirname(specDir),
  });
  const argv = execution.nodeArgv(["--test", ...files.map((file) => path.relative(executionRoot, file))]);
  const result = await runProcessDetailed(
    { argv, env: execution.environment, source: "spec-local-tests" },
    { cwd: executionRoot, timeoutMs },
  );
  return { command: argv.join(" "), noTestsDeclared: false, result };
}

function testableRequirementsForSummary(requirements) {
  const testable = requirements.filter((r) => r.testable !== false);
  if (testable.length > MAX_TEST_EXECUTE_REQUIREMENTS) {
    throw new Error(`test-execute requirement count exceeds max ${MAX_TEST_EXECUTE_REQUIREMENTS}`);
  }
  return testable;
}

function extractRequirementIds(text) {
  return [...String(text || "").matchAll(/\bR\d+\b/g)].map((match) => match[0]);
}

export function failedRequirementIdsFromSpecLocal(specLocal, testableRequirements) {
  if (specLocalPassed(specLocal)) return new Set();

  const validIds = new Set(testableRequirements.map((req) => req.id));
  const failedIds = new Set();
  for (const line of processOutputLines(specLocal.result)) {
    if (!/^not ok\b/.test(line)) continue;
    for (const id of extractRequirementIds(line)) {
      if (validIds.has(id)) failedIds.add(id);
    }
  }
  return failedIds.size > 0 ? failedIds : null;
}

function requirementResult(reqId, failedIds) {
  if (failedIds == null) return "fail";
  return failedIds.has(reqId) ? "fail" : "pass";
}

function requirementSummaryResult(reqId, specLocal, failedIds) {
  return specLocal.noTestsDeclared ? "not_applicable" : requirementResult(reqId, failedIds);
}

function requirementRawResultLine(req, specLocal, failedIds) {
  const result = requirementSummaryResult(req.id, specLocal, failedIds);
  return result === "not_applicable"
    ? `[senrail] requirement ${req.id} result not_applicable reason ${NO_TESTS_DECLARED_REASON}`
    : `[senrail] requirement ${req.id} result ${result}`;
}

function buildSummary({ root, specDir, testableRequirements, specLocal, range, failedIds = null }) {
  const resolvedFailedIds = failedIds ?? failedRequirementIdsFromSpecLocal(specLocal, testableRequirements);
  return testableRequirements.map((req) => {
    const result = requirementSummaryResult(req.id, specLocal, resolvedFailedIds);
    if (result === "not_applicable") {
      return {
        id: req.id,
        result,
        reason: NO_TESTS_DECLARED_REASON,
        evidence: {
          command: specLocal.command,
          raw_output_lines: range,
        },
      };
    }
    const file = findSpecTestFileForReq(specDir, req.id);
    if (!file) throw new Error(`spec-local test file missing for ${req.id}`);
    return {
      id: req.id,
      result,
      ...(result === "pass" ? {} : { error: "spec-local requirement tests failed" }),
      evidence: {
        test_file: path.relative(root, file).split(path.sep).join("/"),
        test_name: extractRequirementTestName(file, req.id),
        command: specLocal.command,
        raw_output_lines: range,
      },
    };
  });
}

function specLocalPassed(specLocal) {
  return processPassed(specLocal.result);
}

function buildRegressionSnapshots(root, classification) {
  return {
    changedFiles: RegressionFileSnapshotList
      .fromChangedFiles(root, classification.changedFiles)
      .toJSON(),
    triggerRelevantChangedFiles: RegressionFileSnapshotList
      .fromChangedFiles(root, classification.triggerRelevantChangedFiles)
      .toJSON(),
  };
}

function buildSkippedRegression(root, classification) {
  const snapshots = buildRegressionSnapshots(root, classification);
  return {
    required: false,
    result: "skipped",
    mode: "none",
    category: classification.category,
    reason: classification.reason,
    classified_paths: classification.classifiedPaths,
    trigger_relevant_changed_files: snapshots.triggerRelevantChangedFiles,
    changed_files: snapshots.changedFiles,
  };
}

function buildRequiredRegression({ root, classification, rootCommand, command, result, range }) {
  const pass = processPassed(result);
  const commandIdentity = commandIdentityFor(command).toJSON();
  const snapshots = buildRegressionSnapshots(root, classification);
  return {
    required: true,
    mode: classification.mode,
    root_test_command: rootCommand.toString(),
    root_test_command_source: commandIdentity.commandSource,
    command: command.toString(),
    ...commandIdentity,
    result: pass ? "pass" : "fail",
    raw_output_lines: range,
    trigger_relevant_changed_files: snapshots.triggerRelevantChangedFiles,
    changed_files: snapshots.changedFiles,
    ...(classification.mode === "targeted" ? { target_paths: [...classification.targetPaths] } : {}),
    process: {
      started: result.started,
      exitCode: result.exitCode,
      signal: result.signal,
      timedOut: result.timedOut,
      spawnError: result.spawnError,
    },
  };
}

export default class RunTestExecuteCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const executionRoot = ctx.executionRoot || root;
    const config = container.get("config") || {};
    recoverImplRepairTransaction({
      root: executionRoot,
      state: ctx.flowState,
      flowManager: ctx.flowManager,
    });
    const { state } = ensureRepairFingerprintContract({
      root: executionRoot,
      artifactRoot: root,
      state: ctx.flowState,
      flowManager: ctx.flowManager,
      continueAfterMigration: true,
    });
    const specPath = relativeFlowSpecFile(state);
    const specDir = resolveSpecDir(path.resolve(root, specPath));
    const rawOutputPath = path.join(specDir, RAW_OUTPUT_RELATIVE);
    fs.mkdirSync(path.dirname(rawOutputPath), { recursive: true });
    let tempSummaryWritten = false;

    // Reset downstream test artifacts before rebuilding spec-local evidence.
    removeRebuildableTestArtifacts(specDir);

    try {
      const spec = readJsonStrict(path.join(specDir, "spec.json"));
      const requirements = Array.isArray(spec.requirements) ? spec.requirements : [];
      const testableRequirements = testableRequirementsForSummary(requirements);
      const analysisPath = path.join(senrailOutputDir(executionRoot), "analysis.json");
      if (!fs.existsSync(analysisPath)) {
        throw new Error(`analysis.json not found at ${analysisPath}: run docs scan before test-execute`);
      }
      const analysis = readJsonStrict(analysisPath);

      const timeoutMs = resolveTestTimeoutSeconds(config) * 1000;
      const rawLines = [];
      const specLocal = await runSpecLocalTests({
        repositoryRoot: root,
        executionRoot,
        specDir,
        timeoutMs,
      });
      if (specLocal.result.spawnError && !specLocal.result.started) {
        throw new Error(`spec-local test command failed to start: ${specLocal.result.spawnError}`);
      }
      const specLocalFailedIds = failedRequirementIdsFromSpecLocal(specLocal, testableRequirements);
      const specRange = appendRaw(rawLines, [
        "[senrail] spec-local tests start",
        `command: ${specLocal.command}`,
        ...processOutputLines(specLocal.result),
        ...testableRequirements
          .map((req) => requirementRawResultLine(req, specLocal, specLocalFailedIds)),
        "[senrail] spec-local tests end",
      ]);
      const summary = buildSummary({
        root,
        specDir,
        testableRequirements,
        specLocal,
        range: specRange,
        failedIds: specLocalFailedIds,
      });
      writeTempRequirementSummary(specDir, summary);
      tempSummaryWritten = true;
      const persistedSummary = readJsonStrict(tempRequirementSummaryPath(specDir));
      validateSummaryEvidence(persistedSummary, {
        root,
        rawText: rawLines.join("\n"),
        rawLines,
        requirements,
      });

      const changedFiles = listRegressionChangedFiles({ root: executionRoot, state });
      const classification = classifyRegression({ root: executionRoot, state, analysis, config, changedFiles });
      const regressionPlan = planTestExecuteRegression(classification, config);
      let regression;
      if (!regressionPlan.run) {
        regression = buildSkippedRegression(executionRoot, regressionPlan.classification);
      } else {
        const rootCommand = discoverRegressionCommand(executionRoot, config);
        const command = regressionPlan.classification.mode === "targeted"
          ? rootCommand.withTargets(regressionPlan.classification.targetPaths)
          : rootCommand;
        const result = await runProcessDetailed(command, { cwd: executionRoot, timeoutMs });
        if (result.spawnError && !result.started) {
          throw new Error(`project regression command failed to start: ${result.spawnError}`);
        }
        const regressionResult = processPassed(result) ? "pass" : "fail";
        const range = appendRaw(rawLines, [
          `[senrail] project regression start command=${command.toString()} mode=${regressionPlan.classification.mode}`,
          `command: ${command.toString()}`,
          `mode: ${regressionPlan.classification.mode}`,
          ...processOutputLines(result),
          `result: ${regressionResult}`,
          `[senrail] project regression end result=${regressionResult}`,
        ]);
        regression = buildRequiredRegression({ root: executionRoot, classification: regressionPlan.classification, rootCommand, command, result, range });
      }

      fs.writeFileSync(rawOutputPath, rawLines.join("\n") + "\n");
      const resultPath = path.join(specDir, TEST_EXECUTE_RESULT_FILE);
      const artifact = {
        version: "2",
        raw_output_path: path.relative(root, rawOutputPath).split(path.sep).join("/"),
        summary: persistedSummary,
        regression,
      };
      const fingerprint = buildRepairFingerprint({
        root: executionRoot,
        artifactRoot: root,
        specPath,
        state,
      });
      writeRepairEvidenceArtifact({
        specDir,
        stepId: "test-execute",
        artifact,
        fingerprint,
      });
      removeTempRequirementSummary(specDir);
      tempSummaryWritten = false;

      return {
        result: "ok",
        changed: [
          path.relative(root, resultPath),
          path.relative(root, rawOutputPath),
        ],
        artifacts: {
          result_path: path.relative(root, resultPath),
          raw_output_path: path.relative(root, rawOutputPath),
          completed: true,
          artifact_version: "2",
          regression: regression.result,
        },
        next: "test-result-review",
      };
    } catch (err) {
      const resultPath = path.join(specDir, TEST_EXECUTE_RESULT_FILE);
      if (!fs.existsSync(resultPath)) {
        recordPrerequisiteIssue(root, executionRoot, state, err);
      }
      throw err;
    } finally {
      if (tempSummaryWritten) removeTempRequirementSummary(specDir);
    }
  }
}
