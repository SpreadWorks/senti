import fs from "fs";
import path from "path";
import { sddOutputDir } from "../../lib/config.js";
import { classifyRegression, listRegressionChangedFiles } from "./test-regression.js";

export const TEST_EXECUTE_RESULT_FILE = "test-execute-result.json";
export const TEST_RESULT_REVIEW_FILE = "test-result-review.json";
export const TEST_RESULT_REVIEW_MD_FILE = "test-result-review.md";
export const RAW_OUTPUT_RELATIVE = "tests/.raw/test-execution.log";
export const TEMP_SUMMARY_RELATIVE = "tests/.raw/requirement-summary.json";
export const DURABLE_TEST_ARTIFACT_RELATIVE_PATHS = Object.freeze([
  TEST_EXECUTE_RESULT_FILE,
  TEST_RESULT_REVIEW_FILE,
  TEST_RESULT_REVIEW_MD_FILE,
  "retro.json",
  "report.json",
  RAW_OUTPUT_RELATIVE,
]);
export const RESETTABLE_TEST_ARTIFACT_RELATIVE_PATHS = Object.freeze([
  TEST_EXECUTE_RESULT_FILE,
  TEST_RESULT_REVIEW_FILE,
  TEST_RESULT_REVIEW_MD_FILE,
  "retro.json",
  "report.json",
  RAW_OUTPUT_RELATIVE,
  TEMP_SUMMARY_RELATIVE,
]);

export function readJsonStrict(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    throw new Error(`${path.basename(filePath)} is not valid JSON: ${err.message}`);
  }
}

function assertRange(range, label) {
  if (!range || typeof range !== "object") throw new Error(`${label}.raw_output_lines must be an object`);
  if (!Number.isInteger(range.start_line) || !Number.isInteger(range.end_line)) {
    throw new Error(`${label}.raw_output_lines must contain integer start_line/end_line`);
  }
  if (range.start_line < 1 || range.end_line < range.start_line) {
    throw new Error(`${label}.raw_output_lines must be 1-based inclusive range`);
  }
}

export function validateTestExecuteResultV2(result) {
  if (!result || typeof result !== "object") throw new Error("test-execute-result.json must be an object");
  if (result.version !== "2") throw new Error(`test-execute-result.json version='${result.version}', expected '2'`);
  if (!Array.isArray(result.summary)) throw new Error("test-execute-result.json summary[] is required");
  if (!result.regression || typeof result.regression !== "object") throw new Error("regression object is required");
  for (const entry of result.summary) {
    if (typeof entry.id !== "string") throw new Error("summary[].id is required");
    if (entry.result !== "pass" && entry.result !== "fail") throw new Error(`summary[].result invalid for ${entry.id}`);
    if (!entry.evidence || typeof entry.evidence !== "object") throw new Error(`summary[].evidence missing for ${entry.id}`);
    assertRange(entry.evidence.raw_output_lines, `summary[${entry.id}].evidence`);
  }
  validateRegression(result.regression);
  return result;
}

function validateRegression(regression) {
  if (typeof regression.required !== "boolean") throw new Error("regression.required must be boolean");
  if (!Array.isArray(regression.changed_files)) throw new Error("regression.changed_files[] is required");
  if (!Array.isArray(regression.trigger_relevant_changed_files)) {
    throw new Error("regression.trigger_relevant_changed_files[] is required");
  }
  if (regression.required) {
    for (const key of ["mode", "root_test_command", "root_test_command_source", "command", "result", "raw_output_lines"]) {
      if (regression[key] == null) throw new Error(`regression.${key} is required`);
    }
    if (!["full", "targeted"].includes(regression.mode)) throw new Error("regression.mode must be full or targeted");
    if (!["pass", "fail"].includes(regression.result)) throw new Error("regression.result must be pass or fail");
    if (regression.mode === "targeted" && !Array.isArray(regression.target_paths)) {
      throw new Error("regression.target_paths[] is required for targeted mode");
    }
    assertRange(regression.raw_output_lines, "regression");
    if (!regression.process || typeof regression.process !== "object") throw new Error("regression.process is required");
    if (typeof regression.process.started !== "boolean") throw new Error("regression.process.started must be boolean");
    if (regression.process.exitCode !== null && !Number.isInteger(regression.process.exitCode)) {
      throw new Error("regression.process.exitCode must be integer or null");
    }
    if (regression.process.signal !== null && typeof regression.process.signal !== "string") {
      throw new Error("regression.process.signal must be string or null");
    }
    if (typeof regression.process.timedOut !== "boolean") throw new Error("regression.process.timedOut must be boolean");
    if (regression.process.spawnError !== null && typeof regression.process.spawnError !== "string") {
      throw new Error("regression.process.spawnError must be string or null");
    }
  } else {
    for (const key of ["category", "reason", "classified_paths"]) {
      if (regression[key] == null) throw new Error(`regression.${key} is required when required=false`);
    }
    if (!["docs-only", "spec-artifact-only", "non-project-only", "mixed-non-trigger"].includes(regression.category)) {
      throw new Error(`regression.category invalid: ${regression.category}`);
    }
  }
}

export function validateSummaryEvidence(summary, { root, rawText = "", rawLines, requirements = [] }) {
  const expected = requirements.filter((r) => r.testable !== false).map((r) => r.id);
  const actual = summary.map((entry) => entry.id);
  const missing = expected.filter((id) => !actual.includes(id));
  const unknown = actual.filter((id) => !expected.includes(id));
  const duplicates = actual.filter((id, index) => actual.indexOf(id) !== index);
  if (missing.length || unknown.length || duplicates.length) {
    throw new Error(`summary membership invalid: missing=${missing.join(",")} unknown=${unknown.join(",")} duplicate=${duplicates.join(",")}`);
  }

  for (const entry of summary) {
    const evidence = entry.evidence;
    if (typeof evidence.command !== "string" || evidence.command.length === 0) {
      throw new Error(`${entry.id}: evidence.command is required`);
    }
    if (evidence.raw_output_lines.end_line > rawLines.length) {
      throw new Error(`${entry.id}: summary raw_output_lines is outside raw output`);
    }
    const testPath = path.resolve(root, evidence.test_file);
    if (!fs.existsSync(testPath)) throw new Error(`${entry.id}: test file missing: ${evidence.test_file}`);
    const src = fs.readFileSync(testPath, "utf8");
    if (!src.includes(evidence.test_name)) {
      throw new Error(`${entry.id}: test name not found in ${evidence.test_file}: ${evidence.test_name}`);
    }
    if (rawText && entry.result === "pass" && !rawText.includes(entry.id)) {
      throw new Error(`${entry.id}: raw output does not contain requirement id`);
    }
  }

  return summary;
}

export function validateTestExecuteResultEvidence(result, { root, rawText, rawLines, requirements = [], summary = true }) {
  if (summary) validateSummaryEvidence(result.summary, { root, rawText, rawLines, requirements });

  const regression = result.regression;
  if (regression.required) {
    if (regression.raw_output_lines.end_line > rawLines.length) {
      throw new Error("regression.raw_output_lines is outside raw output");
    }
    const startMarker = `[sdd-forge] project regression start command=${regression.command} mode=${regression.mode}`;
    const endMarker = `[sdd-forge] project regression end result=${regression.result}`;
    if (!rawText.includes(startMarker) || !rawText.includes(endMarker)) {
      throw new Error("raw output missing project regression start/end markers matching artifact command/result");
    }
  }

  return result;
}

export function validateTestResultReview(review) {
  if (!review || typeof review !== "object") throw new Error("test-result-review.json must be an object");
  if (review.verdict !== "pass" && review.verdict !== "fail") throw new Error("test-result-review verdict must be pass or fail");
  if (!Array.isArray(review.checked_items)) throw new Error("checked_items[] is required");
  const regressionCheck = review.checked_items.find((item) => item?.check === "project_regression_verification");
  if (!regressionCheck || regressionCheck.result !== "pass") {
    throw new Error("checked_items[] must include project_regression_verification pass");
  }
  return review;
}

export function loadValidatedTestArtifacts(specDir) {
  const resultPath = path.join(specDir, TEST_EXECUTE_RESULT_FILE);
  const reviewPath = path.join(specDir, TEST_RESULT_REVIEW_FILE);
  if (!fs.existsSync(resultPath)) throw new Error(`${TEST_EXECUTE_RESULT_FILE} missing`);
  if (!fs.existsSync(reviewPath)) throw new Error(`${TEST_RESULT_REVIEW_FILE} missing`);
  const result = validateTestExecuteResultV2(readJsonStrict(resultPath));
  const review = validateTestResultReview(readJsonStrict(reviewPath));
  return { result, review, resultPath, reviewPath };
}

export function buildTestResultsFromArtifacts(specDir) {
  const { result, review } = loadValidatedTestArtifacts(specDir);
  return {
    testExecute: {
      status: "done",
      version: result.version,
      rawOutputPath: result.raw_output_path,
      summary: result.summary,
      projectRegression: result.regression,
    },
    testResultReview: {
      status: "done",
      verdict: review.verdict,
      checkedItems: review.checked_items,
      invalidReason: review.invalid_reason,
    },
  };
}

export function assertIntegrationRegressionEvidence({ root, state, specDir, config = {} }) {
  const { result, review } = loadValidatedTestArtifacts(specDir);
  if (review.verdict !== "pass") {
    const reason = review?.invalid_reason || "verdict is not 'pass'";
    throw new Error(`test-result-review verdict='${review?.verdict}' (${reason}); test artifacts cannot be trusted`);
  }

  const failedSummary = result.summary.filter((entry) => entry.result === "fail");
  if (failedSummary.length > 0) {
    throw new Error(`spec-local requirement tests failed: ${failedSummary.map((entry) => entry.id).join(", ")}`);
  }

  const regression = result.regression;
  if (regression.required && regression.result !== "pass") {
    throw new Error(`project regression result='${regression.result}', expected 'pass'`);
  }

  if (regression.required) {
    const analysisPath = path.join(sddOutputDir(root), "analysis.json");
    const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
    const changedFiles = listRegressionChangedFiles({ root, state });
    const current = classifyRegression({ root, state, analysis, config, changedFiles });
    if (JSON.stringify(current.changedFiles) !== JSON.stringify(regression.changed_files)) {
      throw new Error("project regression changed_files snapshot is stale; rerun test-execute");
    }
    if (JSON.stringify(current.triggerRelevantChangedFiles) !== JSON.stringify(regression.trigger_relevant_changed_files)) {
      throw new Error("project regression trigger_relevant_changed_files snapshot is stale; rerun test-execute");
    }
  }

  return { result, review };
}
