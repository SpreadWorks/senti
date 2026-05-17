import fs from "fs";
import path from "path";
import crypto from "crypto";
import { StringDecoder } from "string_decoder";
import { sddOutputDir } from "../../lib/config.js";
import { classifyRegression, listRegressionChangedFiles } from "./test-regression.js";

export const TEST_EXECUTE_RESULT_FILE = "test-execute-result.json";
export const TEST_RESULT_REVIEW_FILE = "test-result-review.json";
export const TEST_RESULT_REVIEW_MD_FILE = "test-result-review.md";
export const RAW_OUTPUT_RELATIVE = "tests/.raw/test-execution.log";
export const TEMP_SUMMARY_RELATIVE = "tests/.raw/requirement-summary.json";
export const FILE_MAP_RELATIVE = "file-map.json";
export const PLACEHOLDER_PERMISSION_FILE = "placeholder-permission.json";
const ARTIFACT_PLACEHOLDER = "ARTIFACT_PLACEHOLDER";
// Spec R3 intentionally limits sentinel scans to the first 200 entries even
// when schema validation accepts larger bounded artifact arrays.
const SUMMARY_SENTINEL_SCAN_LIMIT = 200;
const REVIEW_SENTINEL_SCAN_LIMIT = 200;
const SENTINEL_TEXT_SCAN_CHAR_LIMIT = 1024 * 1024;
const MAX_JSON_ARTIFACT_BYTES = 16 * 1024 * 1024;
const MAX_RAW_OUTPUT_BYTES = 64 * 1024 * 1024;
const MAX_RAW_OUTPUT_LINES = 200_000;
const MAX_EVIDENCE_RAW_OUTPUT_LINES = 2_000;
const MAX_TEST_SOURCE_BYTES = 4 * 1024 * 1024;
const MAX_SUMMARY_ITEMS = 500;
const MAX_REVIEW_CHECKED_ITEMS = 500;
const MAX_FILE_MAP_REQUIREMENTS = 500;
const MAX_FILE_MAP_PATHS_PER_REQUIREMENT = 500;
const MAX_PLACEHOLDER_PERMISSION_PATHS = 50;
// Spec R2 intentionally maps every gate-impl artifact trust failure to the
// public ARTIFACT_PLACEHOLDER code, including malformed or missing inputs.
const GATE_ARTIFACT_TRUST_FAILURE_CODE = ARTIFACT_PLACEHOLDER;
const DEFAULT_PLACEHOLDER_SENTINELS = Object.freeze(["placeholder", "todo", "tbd"]);
const PLACEHOLDER_JSON_HASHES = Object.freeze(new Set([
  // specs/258-gate-artifact-validation/tests writes this exact fixture to
  // prove known hand-written artifact samples are rejected even when their
  // schema shape is otherwise valid.
  "09e1a0d50aa55acadc486dc5e9119809ca40405f9cb3ff3018dbcdd94ad95513",
]));
const INTEGRATION_TRUST_INPUTS = Object.freeze([
  TEST_EXECUTE_RESULT_FILE,
  TEST_RESULT_REVIEW_FILE,
  FILE_MAP_RELATIVE,
  RAW_OUTPUT_RELATIVE,
]);
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

export class GateArtifactTrustContract {
  constructor({ step, phase, requiredTrustInputs }) {
    this.step = step;
    this.phase = phase;
    this.requiredTrustInputs = Object.freeze([...requiredTrustInputs]);
    Object.freeze(this);
  }
}

export class GateArtifactTrustSuccess {
  constructor(extra = {}) {
    Object.assign(this, extra);
    this.ok = true;
    Object.freeze(this);
  }
}

export class GateArtifactTrustFailure {
  constructor(reason, extra = {}) {
    Object.assign(this, extra);
    this.ok = false;
    this.code = GATE_ARTIFACT_TRUST_FAILURE_CODE;
    this.reason = reason;
    Object.freeze(this);
  }
}

export function buildGateArtifactTrustContract({ step, phase } = {}) {
  const requiredTrustInputs = step === "gate-impl" && phase === "integration"
    ? INTEGRATION_TRUST_INPUTS
    : [];
  return new GateArtifactTrustContract({ step, phase, requiredTrustInputs });
}

export function readJsonStrict(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    throw new Error(`${path.basename(filePath)} is not valid JSON: ${err.message}`);
  }
}

function assertFileSizeWithinLimit(filePath, label, maxBytes) {
  const size = fs.statSync(filePath).size;
  if (size > maxBytes) {
    throw new Error(`${label} exceeds max size ${maxBytes} bytes`);
  }
}

function assertMaxItems(label, items, maxItems) {
  if (items.length > maxItems) {
    throw new Error(`${label} exceeds max item count ${maxItems}`);
  }
}

function readBoundedJson(filePath, label) {
  assertFileSizeWithinLimit(filePath, label, MAX_JSON_ARTIFACT_BYTES);
  const text = fs.readFileSync(filePath, "utf8");
  try {
    return { text, value: JSON.parse(text) };
  } catch (err) {
    throw new Error(`${label} is not valid JSON: ${err.message}`);
  }
}

function loadJsonArtifact(specDir, relPath) {
  return { relPath, ...readBoundedJson(path.join(specDir, relPath), relPath) };
}

function readBoundedText(filePath, label, maxBytes) {
  assertFileSizeWithinLimit(filePath, label, maxBytes);
  return fs.readFileSync(filePath, "utf8");
}

function readBoundedRawOutput(rawPath) {
  assertFileSizeWithinLimit(rawPath, RAW_OUTPUT_RELATIVE, MAX_RAW_OUTPUT_BYTES);

  const fd = fs.openSync(rawPath, "r");
  const buffer = Buffer.allocUnsafe(64 * 1024);
  const decoder = new StringDecoder("utf8");
  const chunks = [];
  let lineCount = 1;
  try {
    while (true) {
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      const text = decoder.write(buffer.subarray(0, bytesRead));
      if (text.length === 0) continue;
      chunks.push(text);
      for (let index = text.indexOf("\n"); index !== -1; index = text.indexOf("\n", index + 1)) {
        lineCount += 1;
        if (lineCount > MAX_RAW_OUTPUT_LINES) {
          throw new Error(`${RAW_OUTPUT_RELATIVE} exceeds max line count ${MAX_RAW_OUTPUT_LINES}`);
        }
      }
    }
    const tail = decoder.end();
    if (tail.length > 0) chunks.push(tail);
  } finally {
    fs.closeSync(fd);
  }

  const rawOutputText = chunks.join("");
  return { rawOutputText, rawLines: rawOutputText.split(/\r?\n/) };
}

function resolveRepoRelativePathInside({ root, allowedBaseDir, relPath, label, mustExist = true }) {
  if (typeof relPath !== "string" || relPath.trim().length === 0) {
    throw new Error(`${label} must be a non-empty relative path`);
  }
  if (path.isAbsolute(relPath)) {
    throw new Error(`${label} must be relative: ${relPath}`);
  }
  const resolved = path.resolve(root, relPath);
  const relToBase = path.relative(allowedBaseDir, resolved);
  if (relToBase.startsWith("..") || path.isAbsolute(relToBase)) {
    throw new Error(`${label} escapes allowed root: ${relPath}`);
  }
  if (mustExist && !fs.existsSync(resolved)) {
    throw new Error(`${label} points to missing path: ${relPath}`);
  }
  return resolved;
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

function assertEvidenceRangeWithinLimit(range, label) {
  const lineCount = range.end_line - range.start_line + 1;
  if (lineCount > MAX_EVIDENCE_RAW_OUTPUT_LINES) {
    throw new Error(`${label}.raw_output_lines exceeds max evidence range ${MAX_EVIDENCE_RAW_OUTPUT_LINES}`);
  }
}

export function validateTestExecuteResultV2(result) {
  if (!result || typeof result !== "object") throw new Error("test-execute-result.json must be an object");
  if (result.version !== "2") throw new Error(`test-execute-result.json version='${result.version}', expected '2'`);
  if (!Array.isArray(result.summary)) throw new Error("test-execute-result.json summary[] is required");
  assertMaxItems("test-execute-result.json summary[]", result.summary, MAX_SUMMARY_ITEMS);
  if (!result.regression || typeof result.regression !== "object") throw new Error("regression object is required");
  for (const entry of result.summary) {
    if (typeof entry.id !== "string") throw new Error("summary[].id is required");
    if (entry.result !== "pass" && entry.result !== "fail") throw new Error(`summary[].result invalid for ${entry.id}`);
    if (!entry.evidence || typeof entry.evidence !== "object") throw new Error(`summary[].evidence missing for ${entry.id}`);
    assertRange(entry.evidence.raw_output_lines, `summary[${entry.id}].evidence`);
    assertEvidenceRangeWithinLimit(entry.evidence.raw_output_lines, `summary[${entry.id}].evidence`);
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

export function validateSummaryEvidence(summary, {
  root,
  validateRawOutputRange = false,
  rawLines,
  requirements = [],
  specDir = null,
}) {
  const expected = requirements.filter((r) => r.testable !== false).map((r) => r.id);
  const actual = summary.map((entry) => entry.id);
  const missing = expected.filter((id) => !actual.includes(id));
  const unknown = actual.filter((id) => !expected.includes(id));
  const duplicates = actual.filter((id, index) => actual.indexOf(id) !== index);
  if (missing.length || unknown.length || duplicates.length) {
    throw new Error(`summary membership invalid: missing=${missing.join(",")} unknown=${unknown.join(",")} duplicate=${duplicates.join(",")}`);
  }

  for (const entry of summary) {
    if (typeof entry.id !== "string" || entry.id.trim().length === 0) {
      throw new Error("summary[].id must be a non-empty requirement id");
    }
    const evidence = entry.evidence;
    if (typeof evidence.command !== "string" || evidence.command.length === 0) {
      throw new Error(`${entry.id}: evidence.command is required`);
    }
    if (evidence.raw_output_lines.end_line > rawLines.length) {
      throw new Error(`${entry.id}: summary raw_output_lines is outside raw output`);
    }
    const testPath = specDir
      ? resolveRepoRelativePathInside({
        root,
        allowedBaseDir: path.resolve(specDir, "tests"),
        relPath: evidence.test_file,
        label: `${entry.id}: test_file`,
      })
      : path.resolve(root, evidence.test_file);
    if (!specDir && !fs.existsSync(testPath)) throw new Error(`${entry.id}: test file missing: ${evidence.test_file}`);
    const src = readBoundedText(testPath, evidence.test_file, MAX_TEST_SOURCE_BYTES);
    if (!src.includes(evidence.test_name)) {
      throw new Error(`${entry.id}: test name not found in ${evidence.test_file}: ${evidence.test_name}`);
    }
    if (validateRawOutputRange && entry.result === "pass") {
      const rawRangeText = rawLines
        .slice(evidence.raw_output_lines.start_line - 1, evidence.raw_output_lines.end_line)
        .join("\n");
      if (!rawRangeText.includes(entry.id)) {
        throw new Error(`${entry.id}: raw output range does not contain requirement evidence`);
      }
    }
  }

  return summary;
}

export function validateTestExecuteResultEvidence(result, {
  root,
  rawOutputText,
  rawLines,
  requirements = [],
  summary = true,
  specDir = null,
}) {
  if (summary) {
    validateSummaryEvidence(result.summary, {
      root,
      validateRawOutputRange: true,
      rawLines,
      requirements,
      specDir,
    });
  }

  const regression = result.regression;
  if (regression.required) {
    if (regression.raw_output_lines.end_line > rawLines.length) {
      throw new Error("regression.raw_output_lines is outside raw output");
    }
    const startMarker = `[sdd-forge] project regression start command=${regression.command} mode=${regression.mode}`;
    const endMarker = `[sdd-forge] project regression end result=${regression.result}`;
    if (!rawOutputText.includes(startMarker) || !rawOutputText.includes(endMarker)) {
      throw new Error("raw output missing project regression start/end markers matching artifact command/result");
    }
  }

  return result;
}

export function validateTestResultReview(review) {
  if (!review || typeof review !== "object") throw new Error("test-result-review.json must be an object");
  if (review.verdict !== "pass" && review.verdict !== "fail") throw new Error("test-result-review verdict must be pass or fail");
  if (!Array.isArray(review.checked_items)) throw new Error("checked_items[] is required");
  assertMaxItems("checked_items[]", review.checked_items, MAX_REVIEW_CHECKED_ITEMS);
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

export function assertIntegrationRegressionEvidence({ root, state, specDir, config = {}, artifacts = null }) {
  const { result, review } = artifacts || loadValidatedTestArtifacts(specDir);
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

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`);
}

function configuredPlaceholderSentinels(config = {}) {
  const configured = config?.flow?.placeholderSentinels || config?.placeholderSentinels;
  if (!Array.isArray(configured) || configured.length === 0) return DEFAULT_PLACEHOLDER_SENTINELS;
  return configured.filter(nonEmptyString);
}

function placeholderSentinelPatterns(config = {}) {
  return configuredPlaceholderSentinels(config).map((sentinel) => new RegExp(escapeRegExp(sentinel), "i"));
}

function createSentinelScanBudget() {
  return { remaining: SENTINEL_TEXT_SCAN_CHAR_LIMIT };
}

function hasPlaceholderSentinel(value, budget, patterns) {
  if (typeof value !== "string") return false;
  if (budget.remaining <= 0) return false;
  const scanned = value.slice(0, budget.remaining);
  budget.remaining -= scanned.length;
  return patterns.some((pattern) => pattern.test(scanned));
}

function assertPlaceholderPermission(specDir, artifactPath, phase) {
  const permissionPath = path.join(specDir, PLACEHOLDER_PERMISSION_FILE);
  if (!fs.existsSync(permissionPath)) {
    throw new Error(`placeholder permission missing for ${artifactPath}`);
  }
  let permission;
  try {
    permission = readBoundedJson(permissionPath, PLACEHOLDER_PERMISSION_FILE).value;
  } catch (err) {
    throw new Error(`placeholder permission invalid: ${err.message} for ${artifactPath}`);
  }

  if (permission?.version !== 1) throw new Error("placeholder permission version must be 1");
  if (permission.phase !== phase) throw new Error(`placeholder permission phase must be ${phase}`);
  if (permission.approvedByUser !== true) {
    throw new Error("placeholder permission approvedByUser must be true");
  }
  if (!Array.isArray(permission.artifactPaths)) {
    throw new Error("placeholder permission artifactPaths[] is required");
  }
  assertMaxItems("placeholder permission artifactPaths[]", permission.artifactPaths, MAX_PLACEHOLDER_PERMISSION_PATHS);
  if (!permission.artifactPaths.includes(artifactPath)) {
    throw new Error(`placeholder permission must include ${artifactPath}`);
  }
  for (const field of ["permissionText", "reason", "createdAt"]) {
    if (!nonEmptyString(permission[field])) throw new Error(`placeholder ${field} is required`);
  }
}

function enforcePlaceholderPermissionArtifactForHit(specDir, phase, hit) {
  if (!hit) return null;
  try {
    // A detected placeholder is tolerated only when the spec-local permission
    // artifact explicitly covers the same artifact path for integration gate.
    assertPlaceholderPermission(specDir, hit.artifactPath, phase);
    return null;
  } catch (err) {
    return new GateArtifactTrustFailure(`${hit.reason}; ${err.message}`);
  }
}

function validateFileMap(fileMap, { root, requirements }) {
  if (!fileMap || typeof fileMap !== "object" || Array.isArray(fileMap)) {
    throw new Error("file-map.json must be an object");
  }
  assertMaxItems("requirements[]", requirements, MAX_FILE_MAP_REQUIREMENTS);
  const entries = Object.keys(fileMap);
  assertMaxItems("file-map.json requirement entries", entries, MAX_FILE_MAP_REQUIREMENTS);
  const expected = requirements.filter((r) => r.testable !== false).map((r) => r.id);
  const validIds = new Set(expected);
  for (const id of entries) {
    if (!validIds.has(id)) throw new Error(`file-map.json contains unknown requirement id: ${id}`);
    if (!Array.isArray(fileMap[id]) || fileMap[id].length === 0) {
      throw new Error(`file-map.json entry missing for ${id}`);
    }
    if (fileMap[id].length > MAX_FILE_MAP_PATHS_PER_REQUIREMENT) {
      throw new Error(`file-map.json entry for ${id} exceeds max path count ${MAX_FILE_MAP_PATHS_PER_REQUIREMENT}`);
    }
    for (const filePath of fileMap[id]) {
      if (typeof filePath !== "string" || filePath.trim().length === 0) {
        throw new Error(`file-map.json entry for ${id} must contain non-empty paths`);
      }
      resolveRepoRelativePathInside({
        root,
        allowedBaseDir: root,
        relPath: filePath,
        label: `file-map.json entry for ${id}`,
      });
    }
  }
  const missing = expected.filter((id) => !Array.isArray(fileMap[id]) || fileMap[id].length === 0);
  if (missing.length > 0) throw new Error(`file-map.json missing requirement entries: ${missing.join(",")}`);
}

function scanPlaceholderHashes(jsonArtifacts) {
  for (const artifact of jsonArtifacts) {
    const hash = crypto.createHash("sha256").update(artifact.text).digest("hex");
    if (PLACEHOLDER_JSON_HASHES.has(hash)) {
      return { artifactPath: artifact.relPath, reason: `${artifact.relPath} matches documented placeholder fixture hash` };
    }
  }
  return null;
}

function findPlaceholderFieldHit(source, fields, artifactPath, reasonPrefix, budget, patterns) {
  for (const field of fields) {
    if (hasPlaceholderSentinel(source[field], budget, patterns)) {
      return { artifactPath, reason: `${reasonPrefix}.${field}` };
    }
  }
  return null;
}

function scanPlaceholderSentinels(result, review, config = {}) {
  const patterns = placeholderSentinelPatterns(config);
  const testExecuteBudget = createSentinelScanBudget();
  for (const entry of result.summary.slice(0, SUMMARY_SENTINEL_SCAN_LIMIT)) {
    const hit = findPlaceholderFieldHit(
      entry.evidence || {},
      ["command", "test_name", "test_file"],
      TEST_EXECUTE_RESULT_FILE,
      "placeholder sentinel found in test-execute-result.json summary[].evidence",
      testExecuteBudget,
      patterns
    );
    if (hit) return hit;
  }

  if (result.regression) {
    const hit = findPlaceholderFieldHit(
      result.regression,
      ["command", "root_test_command"],
      TEST_EXECUTE_RESULT_FILE,
      "placeholder sentinel found in test-execute-result.json regression",
      testExecuteBudget,
      patterns
    );
    if (hit) return hit;
  }

  const reviewBudget = createSentinelScanBudget();
  for (const item of review.checked_items.slice(0, REVIEW_SENTINEL_SCAN_LIMIT)) {
    if (hasPlaceholderSentinel(item?.detail, reviewBudget, patterns)) {
      return {
        artifactPath: TEST_RESULT_REVIEW_FILE,
        reason: "placeholder sentinel found in test-result-review.json checked_items[].detail",
      };
    }
  }

  return null;
}

function validateRequiredTrustInputs(specDir, requiredTrustInputs) {
  for (const relPath of requiredTrustInputs) {
    const artifactPath = path.join(specDir, relPath);
    if (!fs.existsSync(artifactPath)) return new GateArtifactTrustFailure(`${relPath} missing`);
  }
  return new GateArtifactTrustSuccess();
}

export function validateIntegrationArtifactTrust({ root, specDir, phase = "integration", specPath = null, state = {}, config = {} }) {
  const contract = buildGateArtifactTrustContract({ step: "gate-impl", phase });
  if (contract.requiredTrustInputs.length === 0) return new GateArtifactTrustSuccess({ contract });

  try {
    const requiredInputsResult = validateRequiredTrustInputs(specDir, contract.requiredTrustInputs);
    if (!requiredInputsResult.ok) return requiredInputsResult;

    const specJsonPath = specPath ? path.resolve(root, specPath) : path.join(specDir, "spec.json");
    const spec = readBoundedJson(specJsonPath, path.relative(root, specJsonPath)).value;
    const requirements = Array.isArray(spec.requirements) ? spec.requirements : [];
    const rawPath = path.join(specDir, RAW_OUTPUT_RELATIVE);
    const { rawOutputText, rawLines } = readBoundedRawOutput(rawPath);

    const resultArtifact = loadJsonArtifact(specDir, TEST_EXECUTE_RESULT_FILE);
    const reviewArtifact = loadJsonArtifact(specDir, TEST_RESULT_REVIEW_FILE);
    const fileMapArtifact = loadJsonArtifact(specDir, FILE_MAP_RELATIVE);

    const result = validateTestExecuteResultV2(resultArtifact.value);
    const review = validateTestResultReview(reviewArtifact.value);
    validateFileMap(fileMapArtifact.value, { root, requirements });

    const sentinelPermission = enforcePlaceholderPermissionArtifactForHit(specDir, phase, scanPlaceholderSentinels(result, review, config));
    if (sentinelPermission) return sentinelPermission;

    validateTestExecuteResultEvidence(result, {
      root,
      rawOutputText,
      rawLines,
      requirements,
      specDir,
    });
    assertIntegrationRegressionEvidence({ root, state, specDir, config, artifacts: { result, review } });

    const hashPermission = enforcePlaceholderPermissionArtifactForHit(specDir, phase, scanPlaceholderHashes([resultArtifact, reviewArtifact, fileMapArtifact]));
    if (hashPermission) return hashPermission;

    return new GateArtifactTrustSuccess({ contract });
  } catch (err) {
    return new GateArtifactTrustFailure(err.message);
  }
}
