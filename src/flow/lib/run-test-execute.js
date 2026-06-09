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
import { sentiOutputDir } from "../../lib/config.js";
import { listChangedFilesDetailed } from "../../lib/git-helpers.js";
import { FlowCommand } from "./base-command.js";
import { loadIssueLog, saveIssueLog } from "./set-issue-log.js";
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
  discoverRegressionCommand,
  listRegressionChangedFiles,
  planTestExecuteRegression,
  processOutputLines,
  processPassed,
  resolveTestTimeoutSeconds,
  runProcessDetailed,
} from "./test-regression.js";

const MAX_TEST_EXECUTE_REQUIREMENTS = 500;

function recordPrerequisiteIssue(root, state, err) {
  const issueLog = loadIssueLog(root, state.spec);
  let changedFileCount = null;
  try {
    changedFileCount = listChangedFilesDetailed({ cwd: root, baseBranch: state.baseBranch || "main" }).length;
  } catch (_) {
    changedFileCount = null;
  }
  issueLog.entries.push({
    step: "test-execute",
    reason: `test-execute prerequisite failed before normal v2 artifact creation: ${err.message || String(err)}`,
    failureKind: "prerequisite",
    message: err.message || String(err),
    commandSource: err.commandSource || null,
    commandCandidates: Array.isArray(err.commandCandidates) ? err.commandCandidates : [],
    changedFileCount,
    trigger: "senti flow run test-execute",
    resolution: "fix the prerequisite failure and rerun test-execute",
    taskId: null,
    timestamp: new Date().toISOString(),
  });
  saveIssueLog(root, state.spec, issueLog);
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
  return listSpecTestFiles(specDir)[0] || path.join(specDir, "tests", "missing.test.js");
}

function appendRaw(lines, sectionLines) {
  const start = lines.length + 1;
  lines.push(...sectionLines);
  return { start_line: start, end_line: lines.length };
}

async function runSpecLocalTests(root, specDir, timeoutMs) {
  const files = listSpecTestFiles(specDir);
  if (files.length === 0) {
    return {
      command: "node --test",
      result: { started: true, exitCode: 0, signal: null, timedOut: false, spawnError: null, stdout: "", stderr: "" },
    };
  }
  const argv = ["node", "--test", ...files.map((file) => path.relative(root, file))];
  const result = await runProcessDetailed({ argv, env: {}, source: "spec-local-tests" }, { cwd: root, timeoutMs });
  return { command: argv.join(" "), result };
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

function buildSummary({ root, specDir, testableRequirements, specLocal, range, failedIds = null }) {
  const resolvedFailedIds = failedIds ?? failedRequirementIdsFromSpecLocal(specLocal, testableRequirements);
  return testableRequirements.map((req) => {
    const file = findSpecTestFileForReq(specDir, req.id);
    const result = requirementResult(req.id, resolvedFailedIds);
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

function buildSkippedRegression(classification) {
  return {
    required: false,
    result: "skipped",
    mode: "none",
    category: classification.category,
    reason: classification.reason,
    classified_paths: classification.classifiedPaths,
    trigger_relevant_changed_files: classification.triggerRelevantChangedFiles,
    changed_files: classification.changedFiles,
  };
}

function buildRequiredRegression({ classification, rootCommand, command, result, range }) {
  const pass = processPassed(result);
  return {
    required: true,
    mode: classification.mode,
    root_test_command: rootCommand.toString(),
    root_test_command_source: rootCommand.source,
    command: command.toString(),
    result: pass ? "pass" : "fail",
    raw_output_lines: range,
    trigger_relevant_changed_files: classification.triggerRelevantChangedFiles,
    changed_files: classification.changedFiles,
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
    const config = container.get("config") || {};
    const state = ctx.flowState;
    const specDir = resolveSpecDir(path.resolve(root, state.spec));
    const rawOutputPath = path.join(specDir, RAW_OUTPUT_RELATIVE);
    fs.mkdirSync(path.dirname(rawOutputPath), { recursive: true });
    let tempSummaryWritten = false;

    // Reset downstream test artifacts before rebuilding spec-local evidence.
    removeRebuildableTestArtifacts(specDir);

    try {
      const spec = readJsonStrict(path.join(specDir, "spec.json"));
      const requirements = Array.isArray(spec.requirements) ? spec.requirements : [];
      const testableRequirements = testableRequirementsForSummary(requirements);
      const analysisPath = path.join(sentiOutputDir(root), "analysis.json");
      if (!fs.existsSync(analysisPath)) {
        throw new Error(`analysis.json not found at ${analysisPath}: run docs scan before test-execute`);
      }
      const analysis = readJsonStrict(analysisPath);

      const timeoutMs = resolveTestTimeoutSeconds(config) * 1000;
      const rawLines = [];
      const specLocal = await runSpecLocalTests(root, specDir, timeoutMs);
      if (specLocal.result.spawnError && !specLocal.result.started) {
        throw new Error(`spec-local test command failed to start: ${specLocal.result.spawnError}`);
      }
      const specLocalFailedIds = failedRequirementIdsFromSpecLocal(specLocal, testableRequirements);
      const specRange = appendRaw(rawLines, [
        "[senti] spec-local tests start",
        `command: ${specLocal.command}`,
        ...processOutputLines(specLocal.result),
        ...testableRequirements
          .map((req) => `[senti] requirement ${req.id} result ${requirementResult(req.id, specLocalFailedIds)}`),
        "[senti] spec-local tests end",
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

      const changedFiles = listRegressionChangedFiles({ root, state });
      const classification = classifyRegression({ root, state, analysis, config, changedFiles });
      const regressionPlan = planTestExecuteRegression(classification, config);
      let regression;
      if (!regressionPlan.run) {
        regression = buildSkippedRegression(regressionPlan.classification);
      } else {
        const rootCommand = discoverRegressionCommand(root, config);
        const command = regressionPlan.classification.mode === "targeted"
          ? rootCommand.withTargets(regressionPlan.classification.targetPaths)
          : rootCommand;
        const result = await runProcessDetailed(command, { cwd: root, timeoutMs });
        if (result.spawnError && !result.started) {
          throw new Error(`project regression command failed to start: ${result.spawnError}`);
        }
        const regressionResult = processPassed(result) ? "pass" : "fail";
        const range = appendRaw(rawLines, [
          `[senti] project regression start command=${command.toString()} mode=${regressionPlan.classification.mode}`,
          `command: ${command.toString()}`,
          `mode: ${regressionPlan.classification.mode}`,
          ...processOutputLines(result),
          `result: ${regressionResult}`,
          `[senti] project regression end result=${regressionResult}`,
        ]);
        regression = buildRequiredRegression({ classification: regressionPlan.classification, rootCommand, command, result, range });
      }

      fs.writeFileSync(rawOutputPath, rawLines.join("\n") + "\n");
      const resultPath = path.join(specDir, TEST_EXECUTE_RESULT_FILE);
      const artifact = {
        version: "2",
        raw_output_path: path.relative(root, rawOutputPath).split(path.sep).join("/"),
        summary: persistedSummary,
        regression,
      };
      fs.writeFileSync(resultPath, JSON.stringify(artifact, null, 2) + "\n");
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
        recordPrerequisiteIssue(root, state, err);
      }
      throw err;
    } finally {
      if (tempSummaryWritten) removeTempRequirementSummary(specDir);
    }
  }
}
