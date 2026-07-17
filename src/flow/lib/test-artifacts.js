import fs from "fs";
import path from "path";
import crypto from "crypto";
import { StringDecoder } from "string_decoder";
import { sentiOutputDir } from "../../lib/config.js";
import { globToRegex } from "../../lib/glob.js";
import { listChangedFilesDetailed } from "../../lib/git-helpers.js";
import { classifyRegression, listRegressionChangedFiles } from "./test-regression.js";
import { RegressionFileSnapshotList } from "./regression-file-snapshot.js";
import {
  ArtifactCompletionMechanicalFailure,
  ArtifactCompletionSuccess,
} from "./artifact-completion.js";

export const TEST_EXECUTE_RESULT_FILE = "test-execute-result.json";
export const TEST_RESULT_REVIEW_FILE = "test-result-review.json";
export const TEST_RESULT_REVIEW_MD_FILE = "test-result-review.md";
export const FINAL_REGRESSION_RESULT_FILE = "final-regression-result.json";
export const IMPL_GATE_RESULT_FILE = "impl-gate-result.json";
export const TESTS_RAW_DIR_RELATIVE = "tests/.raw";
export const RAW_OUTPUT_RELATIVE = `${TESTS_RAW_DIR_RELATIVE}/test-execution.log`;
export const UPGRADE_RESULT_FILE = "upgrade-result.json";
export const UPGRADE_RAW_OUTPUT_RELATIVE = `${TESTS_RAW_DIR_RELATIVE}/upgrade.log`;
// Public durable path pattern: tests/.raw/final-regression-attempt-*.log
export const FINAL_REGRESSION_RAW_OUTPUT_PATTERN = `${TESTS_RAW_DIR_RELATIVE}/final-regression-attempt-*.log`;
export const TEMP_SUMMARY_RELATIVE = `${TESTS_RAW_DIR_RELATIVE}/requirement-summary.json`;
export const FILE_MAP_RELATIVE = "file-map.json";
export const PLACEHOLDER_PERMISSION_FILE = "placeholder-permission.json";
export const SCENARIO_VALIDITY_RESULT_FILE = "scenario-validity-result.json";
export const SCENARIO_VALIDITY_RAW_OUTPUT_RELATIVE = `${TESTS_RAW_DIR_RELATIVE}/scenario-validity.log`;
const ARTIFACT_PLACEHOLDER = "ARTIFACT_PLACEHOLDER";
// Spec R3 intentionally limits sentinel scans to the first 200 entries even
// when schema validation accepts larger bounded artifact arrays.
const SUMMARY_SENTINEL_SCAN_LIMIT = 200;
const REVIEW_SENTINEL_SCAN_LIMIT = 200;
const SENTINEL_TEXT_SCAN_CHAR_LIMIT = 1024 * 1024;
const MAX_JSON_ARTIFACT_BYTES = 16 * 1024 * 1024;
export const MAX_RAW_OUTPUT_BYTES = 64 * 1024 * 1024;
const MAX_RAW_OUTPUT_LINES = 200_000;
const MAX_EVIDENCE_RAW_OUTPUT_LINES = 2_000;
const MAX_TEST_SOURCE_BYTES = 4 * 1024 * 1024;
const MAX_SUMMARY_ITEMS = 500;
const MAX_REVIEW_CHECKED_ITEMS = 500;
const MAX_FILE_MAP_REQUIREMENTS = 500;
const MAX_FILE_MAP_PATHS_PER_REQUIREMENT = 500;
const MAX_ARTIFACT_PATTERN_COUNT = 500;
const MAX_COLLECTED_ARTIFACTS = 10_000;
const MAX_ARTIFACT_GLOB_ENTRIES = 10_000;
const MAX_PLACEHOLDER_PERMISSION_PATHS = 50;
const SUMMARY_RESULT_VALUES = Object.freeze(["pass", "fail", "not_applicable"]);
const SUMMARY_NO_TESTS_REASON = "no_tests_declared";
const FINAL_REGRESSION_SKIP_KINDS = Object.freeze([
  "covered_by_test_execute_full_regression",
  "risk_based_static_proof",
  "skipped_by_project_policy",
]);
// Spec R2 intentionally maps every impl-gate artifact trust failure to the
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
export const UPGRADE_REQUIRED_SOURCE_PATTERNS = Object.freeze([
  "src/upgrade.js",
  "src/skills/**",
  "src/presets/**",
  "src/templates/**",
  "src/lib/skills.js",
  "src/lib/include.js",
  "src/lib/skill-rules.js",
  "src/docs/lib/directive-parser.js",
  "src/lib/preset-deploy.js",
  "src/lib/presets.js",
  "src/lib/agent-defaults.js",
  "src/lib/config.js",
]);
const DURABLE_TEST_ARTIFACT_RELATIVE_PATTERNS = Object.freeze([
  UPGRADE_RESULT_FILE,
  SCENARIO_VALIDITY_RESULT_FILE,
  TEST_EXECUTE_RESULT_FILE,
  TEST_RESULT_REVIEW_FILE,
  TEST_RESULT_REVIEW_MD_FILE,
  IMPL_GATE_RESULT_FILE,
  FINAL_REGRESSION_RESULT_FILE,
  "retro.json",
  "report.json",
  UPGRADE_RAW_OUTPUT_RELATIVE,
  SCENARIO_VALIDITY_RAW_OUTPUT_RELATIVE,
  RAW_OUTPUT_RELATIVE,
  FINAL_REGRESSION_RAW_OUTPUT_PATTERN,
]);
const TEMP_TEST_ARTIFACT_RELATIVE_PATTERNS = Object.freeze([
  TEMP_SUMMARY_RELATIVE,
]);
const IMPLEMENTATION_COMMIT_EXCLUDED_TEST_ARTIFACT_RELATIVE_PATTERNS = Object.freeze([
  ...DURABLE_TEST_ARTIFACT_RELATIVE_PATTERNS,
  ...TEMP_TEST_ARTIFACT_RELATIVE_PATTERNS,
]);
const REBUILDABLE_TEST_ARTIFACT_RELATIVE_PATTERNS = Object.freeze([
  ...DURABLE_TEST_ARTIFACT_RELATIVE_PATTERNS.filter((pattern) => ![
    SCENARIO_VALIDITY_RESULT_FILE,
    SCENARIO_VALIDITY_RAW_OUTPUT_RELATIVE,
    FINAL_REGRESSION_RAW_OUTPUT_PATTERN,
  ].includes(pattern)),
  ...TEMP_TEST_ARTIFACT_RELATIVE_PATTERNS,
]);

function testArtifactPathspecs(specId, relativePatterns) {
  const base = path.posix.join("specs", specId);
  return relativePatterns.map((p) => path.posix.join(base, p));
}

function normalizeRepoPath(filePath) {
  return String(filePath || "").split(path.sep).join("/");
}

const UPGRADE_REQUIRED_SOURCE_MATCHERS = Object.freeze(
  UPGRADE_REQUIRED_SOURCE_PATTERNS.map((pattern) => globToRegex(pattern)),
);

export function matchUpgradeRequiredSourcePaths(filePaths = []) {
  return [...new Set(filePaths
    .map(normalizeRepoPath)
    .filter((filePath) => UPGRADE_REQUIRED_SOURCE_MATCHERS.some((matcher) => matcher.test(filePath))))]
    .sort();
}

export function listUpgradeRequiredChangedPaths({ root, baseBranch }) {
  if (!baseBranch) return [];
  const files = listChangedFilesDetailed({ cwd: root, baseBranch })
    .flatMap((entry) => [entry.path, entry.old_path].filter(Boolean));
  return matchUpgradeRequiredSourcePaths(files);
}

export function upgradeResultPath(specDir) {
  return path.join(specDir, UPGRADE_RESULT_FILE);
}

export function upgradeRawLogPath(specDir) {
  return path.join(specDir, UPGRADE_RAW_OUTPUT_RELATIVE);
}

function upgradeResultFailure(reason, extra = {}) {
  return { ok: false, reason, ...extra };
}

function upgradeResultSuccess(extra = {}) {
  return { ok: true, ...extra };
}

function validateUpgradeSummary(summary) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    throw new Error("summary must be an object");
  }
}

export function validateUpgradeResultArtifact(specDir, artifact) {
  try {
    if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
      throw new Error(`${UPGRADE_RESULT_FILE} must be an object`);
    }
    if (artifact.version !== 1) throw new Error("version must be 1");
    if (typeof artifact.command !== "string" || artifact.command.length === 0) {
      throw new Error("command must be a non-empty string");
    }
    if (typeof artifact.dryRun !== "boolean") throw new Error("dryRun must be boolean");
    if (!Number.isInteger(artifact.exitCode)) throw new Error("exitCode must be integer");
    if (!["success-no-change", "success-updated", "failed"].includes(artifact.result)) {
      throw new Error("result must be success-no-change, success-updated, or failed");
    }
    validateUpgradeSummary(artifact.summary);
    if (!Array.isArray(artifact.checkedPaths) || artifact.checkedPaths.some((p) => typeof p !== "string" || p.length === 0)) {
      throw new Error("checkedPaths must be an array of non-empty strings");
    }
    const sortedUnique = [...new Set(artifact.checkedPaths)].sort();
    if (JSON.stringify(sortedUnique) !== JSON.stringify(artifact.checkedPaths)) {
      throw new Error("checkedPaths must be sorted and unique");
    }
    const rawPath = resolveRepoRelativePathInside({
      root: specDir,
      allowedBaseDir: specDir,
      relPath: artifact.rawLogPath,
      label: "rawLogPath",
    });
    if (!fs.existsSync(rawPath)) {
      throw new Error("rawLogPath points to missing upgrade raw log");
    }
    return upgradeResultSuccess({ artifact, rawPath });
  } catch (err) {
    return upgradeResultFailure(err.message);
  }
}

function readUpgradeResultArtifact(specDir) {
  const filePath = upgradeResultPath(specDir);
  if (!fs.existsSync(filePath)) return upgradeResultFailure(`${UPGRADE_RESULT_FILE} missing`);
  try {
    return upgradeResultSuccess({ artifact: readBoundedJson(filePath, UPGRADE_RESULT_FILE).value });
  } catch (err) {
    return upgradeResultFailure(err.message);
  }
}

export function writeUpgradeResultArtifact({
  root,
  specDir,
  baseBranch,
  command,
  dryRun,
  exitCode,
  result,
  summary,
  rawOutput,
}) {
  const checkedPaths = listUpgradeRequiredChangedPaths({ root, baseBranch });
  const rawLog = upgradeRawLogPath(specDir);
  fs.mkdirSync(path.dirname(rawLog), { recursive: true });
  fs.writeFileSync(rawLog, String(rawOutput ?? ""), "utf8");

  const artifact = {
    version: 1,
    command,
    dryRun,
    exitCode,
    result,
    summary,
    checkedPaths,
    rawLogPath: UPGRADE_RAW_OUTPUT_RELATIVE,
  };
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(upgradeResultPath(specDir), JSON.stringify(artifact, null, 2) + "\n", "utf8");
  return { artifact, path: upgradeResultPath(specDir), rawLogPath: rawLog };
}

export function validateUpgradeEvidenceForGate({ root = null, specDir, baseBranch = null, currentRequiredPaths = null }) {
  const requiredPaths = currentRequiredPaths
    ? matchUpgradeRequiredSourcePaths(currentRequiredPaths)
    : listUpgradeRequiredChangedPaths({ root, baseBranch });
  if (requiredPaths.length === 0) return upgradeResultSuccess({ currentRequiredPaths: requiredPaths });

  const loaded = readUpgradeResultArtifact(specDir);
  if (!loaded.ok) return upgradeResultFailure(loaded.reason, { currentRequiredPaths: requiredPaths });

  const validation = validateUpgradeResultArtifact(specDir, loaded.artifact);
  if (!validation.ok) return upgradeResultFailure(validation.reason, { currentRequiredPaths: requiredPaths });
  if (validation.artifact.result === "failed") {
    return upgradeResultFailure("upgrade-result.json result=failed", { currentRequiredPaths: requiredPaths });
  }
  if (JSON.stringify(validation.artifact.checkedPaths) !== JSON.stringify(requiredPaths)) {
    return upgradeResultFailure("upgrade-result.json checkedPaths is stale", {
      currentRequiredPaths: requiredPaths,
      checkedPaths: validation.artifact.checkedPaths,
    });
  }
  return upgradeResultSuccess({ currentRequiredPaths: requiredPaths, artifact: validation.artifact });
}

export function durableTestArtifactPathspecs(specId) {
  return testArtifactPathspecs(specId, DURABLE_TEST_ARTIFACT_RELATIVE_PATTERNS);
}

export function implementationCommitExcludedTestArtifactPathspecs(specId) {
  return testArtifactPathspecs(specId, IMPLEMENTATION_COMMIT_EXCLUDED_TEST_ARTIFACT_RELATIVE_PATTERNS);
}

export function tempRequirementSummaryPath(specDir) {
  return path.join(specDir, TEMP_SUMMARY_RELATIVE);
}

export function writeTempRequirementSummary(specDir, summary) {
  fs.writeFileSync(tempRequirementSummaryPath(specDir), JSON.stringify(summary, null, 2) + "\n");
}

export function removeTempRequirementSummary(specDir) {
  fs.rmSync(tempRequirementSummaryPath(specDir), { force: true });
}

function addCollectedArtifactPathspec(existing, pathspec) {
  existing.add(pathspec);
  if (existing.size > MAX_COLLECTED_ARTIFACTS) {
    throw new Error(`collected artifact path count exceeds max ${MAX_COLLECTED_ARTIFACTS}`);
  }
}

// Supports literal POSIX-relative pathspecs and basename globs such as dir/*.log.
export function collectExistingArtifactPathspecs(root, pathspecPatterns) {
  assertMaxItems("artifact patterns", pathspecPatterns, MAX_ARTIFACT_PATTERN_COUNT);
  const existing = new Set();
  const globPatternsByDir = new Map();
  for (const pathspec of pathspecPatterns) {
    if (!pathspec.includes("*")) {
      const absolutePath = path.join(root, pathspec);
      if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
        addCollectedArtifactPathspec(existing, pathspec);
      }
      continue;
    }
    const dir = path.posix.dirname(pathspec);
    if (dir.includes("*")) {
      throw new Error(`artifact glob supports basename wildcards only: ${pathspec}`);
    }
    if (!globPatternsByDir.has(dir)) globPatternsByDir.set(dir, []);
    globPatternsByDir.get(dir).push(globToRegex(path.posix.basename(pathspec)));
  }
  for (const [dir, matchers] of globPatternsByDir) {
    const absoluteDir = path.join(root, dir);
    if (!fs.existsSync(absoluteDir)) continue;
    const handle = fs.opendirSync(absoluteDir);
    let seen = 0;
    try {
      let entry;
      while ((entry = handle.readSync())) {
        if (++seen > MAX_ARTIFACT_GLOB_ENTRIES) {
          throw new Error(`artifact glob directory exceeds max entry count ${MAX_ARTIFACT_GLOB_ENTRIES}: ${dir}`);
        }
        if (entry.isFile() && matchers.some((re) => re.test(entry.name))) {
          addCollectedArtifactPathspec(existing, path.posix.join(dir, entry.name));
        }
      }
    } finally {
      handle.closeSync();
    }
  }
  return [...existing].sort();
}

export function removeRebuildableTestArtifacts(specDir) {
  for (const existing of collectExistingArtifactPathspecs(specDir, REBUILDABLE_TEST_ARTIFACT_RELATIVE_PATTERNS)) {
    fs.rmSync(path.join(specDir, existing), { force: true });
  }
}
export const SCENARIO_VALIDITY_CLASSIFICATIONS = Object.freeze(new Set([
  "expected_fail",
  "unexpected_pass",
  "invalid_test",
  "skipped",
  "not_run",
]));
const SCENARIO_VALIDITY_EVIDENCE_FIELDS = Object.freeze([
  "test_file",
  "test_name",
  "command",
  "raw_output_lines",
]);
const SCENARIO_VALIDITY_CLASSIFICATIONS_REQUIRING_TEST_FILE = Object.freeze(new Set([
  "expected_fail",
  "unexpected_pass",
  "skipped",
]));
const MAX_SCENARIO_VALIDITY_RAW_OUTPUT_CHARS = 20 * 1024 * 1024;
const MAX_SCENARIO_VALIDITY_SUMMARY_ENTRIES = 500;
const SCENARIO_VALIDITY_TEST_FILE_RE = /\.(test|spec)\.(js|ts|mjs)$/;

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
  const requiredTrustInputs = step === "impl-gate" && phase === "integration"
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

function assertCamelRange(range, label) {
  if (!range || typeof range !== "object") throw new Error(`${label}.rawOutputLines must be an object`);
  if (!Number.isInteger(range.start) || !Number.isInteger(range.end)) {
    throw new Error(`${label}.rawOutputLines must contain integer start/end`);
  }
  if (range.start < 1 || range.end < range.start) {
    throw new Error(`${label}.rawOutputLines must be 1-based inclusive range`);
  }
}

function assertEvidenceRangeWithinLimit(range, label) {
  const lineCount = range.end_line - range.start_line + 1;
  if (lineCount > MAX_EVIDENCE_RAW_OUTPUT_LINES) {
    throw new Error(`${label}.raw_output_lines exceeds max evidence range ${MAX_EVIDENCE_RAW_OUTPUT_LINES}`);
  }
}

function scenarioValidityRawOutputPath(root, specDir) {
  return path.posix.join(
    path.relative(root, specDir).split(path.sep).join("/"),
    SCENARIO_VALIDITY_RAW_OUTPUT_RELATIVE,
  );
}

export function validateTestExecuteResultV2(result) {
  if (!result || typeof result !== "object") throw new Error("test-execute-result.json must be an object");
  if (result.version !== "2") throw new Error(`test-execute-result.json version='${result.version}', expected '2'`);
  if (!Array.isArray(result.summary)) throw new Error("test-execute-result.json summary[] is required");
  assertMaxItems("test-execute-result.json summary[]", result.summary, MAX_SUMMARY_ITEMS);
  if (!result.regression || typeof result.regression !== "object") throw new Error("regression object is required");
  for (const entry of result.summary) {
    if (typeof entry.id !== "string") throw new Error("summary[].id is required");
    if (!SUMMARY_RESULT_VALUES.includes(entry.result)) throw new Error(`summary[].result invalid for ${entry.id}`);
    if (!entry.evidence || typeof entry.evidence !== "object") throw new Error(`summary[].evidence missing for ${entry.id}`);
    if (typeof entry.evidence.command !== "string" || entry.evidence.command.length === 0) {
      throw new Error(`summary[${entry.id}].evidence.command is required`);
    }
    assertRange(entry.evidence.raw_output_lines, `summary[${entry.id}].evidence`);
    assertEvidenceRangeWithinLimit(entry.evidence.raw_output_lines, `summary[${entry.id}].evidence`);
    if (entry.result === "not_applicable") {
      if (entry.reason !== SUMMARY_NO_TESTS_REASON) {
        throw new Error(`summary[${entry.id}].reason must be ${SUMMARY_NO_TESTS_REASON}`);
      }
      continue;
    }
    if (typeof entry.evidence.test_file !== "string" || entry.evidence.test_file.length === 0) {
      throw new Error(`summary[${entry.id}].evidence.test_file is required`);
    }
    if (typeof entry.evidence.test_name !== "string" || entry.evidence.test_name.length === 0) {
      throw new Error(`summary[${entry.id}].evidence.test_name is required`);
    }
  }
  validateRegression(result.regression);
  return result;
}

function assertProcessMetadata(processMetadata, label = "process") {
  if (!processMetadata || typeof processMetadata !== "object") throw new Error(`${label} is required`);
  if (typeof processMetadata.started !== "boolean") throw new Error(`${label}.started must be boolean`);
  if (processMetadata.exitCode !== null && !Number.isInteger(processMetadata.exitCode)) {
    throw new Error(`${label}.exitCode must be integer or null`);
  }
  if (processMetadata.signal !== null && typeof processMetadata.signal !== "string") {
    throw new Error(`${label}.signal must be string or null`);
  }
  if (typeof processMetadata.timedOut !== "boolean") throw new Error(`${label}.timedOut must be boolean`);
  if (processMetadata.spawnError !== null && typeof processMetadata.spawnError !== "string") {
    throw new Error(`${label}.spawnError must be string or null`);
  }
}

function assertRequiredFields(value, fields, label) {
  if (!value || typeof value !== "object") throw new Error(`${label} is required`);
  for (const field of fields) {
    if (value[field] == null) throw new Error(`${label}.${field} is required`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertScenarioValidityEvidence(evidence, label) {
  assertRequiredFields(evidence, SCENARIO_VALIDITY_EVIDENCE_FIELDS, label);
  assertNonEmptyString(evidence.test_file, `${label}.test_file`);
  assertNonEmptyString(evidence.test_name, `${label}.test_name`);
  assertNonEmptyString(evidence.command, `${label}.command`);
  assertRange(evidence.raw_output_lines, `${label}.raw_output_lines`);
}

function assertScenarioValidityTestFilePath(root, specDir, testFile) {
  const testPath = path.resolve(root, testFile);
  const testDir = path.join(specDir, "tests");
  const relative = path.relative(testDir, testPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`test file must be under specs/<spec>/tests: ${testFile}`);
  }
  if (!SCENARIO_VALIDITY_TEST_FILE_RE.test(path.basename(testPath))) {
    throw new Error(`test file must match scenario-validity test pattern: ${testFile}`);
  }
  return testPath;
}

function assertScenarioValiditySummaryEntry(entry) {
  if (!entry || typeof entry !== "object") throw new Error("summary[] entry must be an object");
  if (typeof entry.id !== "string" || entry.id.length === 0) throw new Error("summary[].id is required");
}

export function validateScenarioValidityResult(result, { root, specDir, requirements = [], rawText = "", rawLines = [], testFileSources = new Map() } = {}) {
  if (!result || typeof result !== "object") throw new Error("scenario-validity-result.json must be an object");
  if (typeof root !== "string" || root.length === 0) throw new Error("root is required");
  if (typeof specDir !== "string" || specDir.length === 0) throw new Error("specDir is required");
  if (result.version !== "1") throw new Error(`scenario-validity-result.json version='${result.version}', expected '1'`);
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    if (typeof rawText !== "string" || rawText.length === 0) {
      throw new Error("scenario-validity rawText or rawLines is required");
    }
    rawLines = rawText.split(/\r?\n/);
  }
  if (typeof rawText !== "string" || rawText.length === 0) {
    rawText = rawLines.join("\n");
  }
  if (rawText.length > MAX_SCENARIO_VALIDITY_RAW_OUTPUT_CHARS) {
    throw new Error(`scenario-validity raw output exceeds ${MAX_SCENARIO_VALIDITY_RAW_OUTPUT_CHARS} characters`);
  }
  if (result.raw_output_path !== scenarioValidityRawOutputPath(root, specDir)) {
    throw new Error("raw_output_path must point to tests/.raw/scenario-validity.log");
  }
  if (typeof result.command !== "string" || result.command.length === 0) {
    throw new Error("command is required");
  }
  assertProcessMetadata(result.process);
  if (result.result !== "pass" && result.result !== "block") {
    throw new Error("result must be pass or block");
  }
  if (!Array.isArray(result.summary)) throw new Error("summary[] is required");
  if (requirements.length > MAX_SCENARIO_VALIDITY_SUMMARY_ENTRIES) {
    throw new Error(`requirements exceeds scenario-validity maximum ${MAX_SCENARIO_VALIDITY_SUMMARY_ENTRIES}`);
  }
  if (result.summary.length > MAX_SCENARIO_VALIDITY_SUMMARY_ENTRIES) {
    throw new Error(`summary exceeds scenario-validity maximum ${MAX_SCENARIO_VALIDITY_SUMMARY_ENTRIES}`);
  }

  const expected = requirements.filter((r) => r.testable !== false).map((r) => r.id);
  if (result.summary.length > expected.length) {
    throw new Error("summary contains more entries than testable requirements");
  }
  const expectedSet = new Set(expected);
  const seen = new Set();
  const duplicates = [];
  const unknown = [];
  for (const entry of result.summary) {
    assertScenarioValiditySummaryEntry(entry);
    if (seen.has(entry.id)) duplicates.push(entry.id);
    seen.add(entry.id);
    if (!expectedSet.has(entry.id)) unknown.push(entry.id);
  }
  const missing = expected.filter((id) => !seen.has(id));
  if (missing.length || unknown.length || duplicates.length) {
    throw new Error(`summary membership invalid: missing=${missing.join(",")} unknown=${unknown.join(",")} duplicate=${duplicates.join(",")}`);
  }

  for (const entry of result.summary) {
    if (!SCENARIO_VALIDITY_CLASSIFICATIONS.has(entry.classification)) {
      throw new Error(`${entry.id}: classification invalid: ${entry.classification}`);
    }
    const evidence = entry.evidence;
    assertScenarioValidityEvidence(evidence, `${entry.id}: evidence`);
    if (evidence.raw_output_lines.end_line > rawLines.length) {
      throw new Error(`${entry.id}: raw_output_lines is outside raw output`);
    }
    if (SCENARIO_VALIDITY_CLASSIFICATIONS_REQUIRING_TEST_FILE.has(entry.classification)) {
      const testPath = assertScenarioValidityTestFilePath(root, specDir, evidence.test_file);
      const source = testFileSources.get(evidence.test_file) || testFileSources.get(testPath);
      if (source && !source.includes(evidence.test_name)) {
        throw new Error(`${entry.id}: test name not found in ${evidence.test_file}: ${evidence.test_name}`);
      }
    }
    if (rawText && !rawText.includes(entry.id)) {
      throw new Error(`${entry.id}: raw output does not contain requirement id`);
    }
  }
  return result;
}

function validateRegression(regression) {
  if (typeof regression.required !== "boolean") throw new Error("regression.required must be boolean");
  if (!Array.isArray(regression.changed_files)) throw new Error("regression.changed_files[] is required");
  if (!Array.isArray(regression.trigger_relevant_changed_files)) {
    throw new Error("regression.trigger_relevant_changed_files[] is required");
  }
  RegressionFileSnapshotList.fromJSON(
    regression.changed_files,
    "regression.changed_files",
  );
  RegressionFileSnapshotList.fromJSON(
    regression.trigger_relevant_changed_files,
    "regression.trigger_relevant_changed_files",
  );
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
    assertProcessMetadata(regression.process, "regression.process");
  } else {
    assertRequiredFields(regression, ["category", "reason", "classified_paths"], "regression");
    if (![
      "docs-only",
      "spec-artifact-only",
      "non-project-only",
      "mixed-non-trigger",
      "full-regression-deferred",
      "project-regression-skipped",
    ].includes(regression.category)) {
      throw new Error(`regression.category invalid: ${regression.category}`);
    }
  }
}

function validateFinalRegressionFailureKind(result) {
  if (result.result === "skipped") {
    if (result.failureKind !== null) throw new Error("final-regression failureKind must be null on skipped");
    return;
  }
  if (result.result === "pass") {
    if (result.failureKind !== null) throw new Error("final-regression failureKind must be null on pass");
    return;
  }
  const allowed = [
    "caused_by_current_change",
    "unattributed_existing_failure",
    "infra_failure",
    "timeout",
    "dependency_failure",
    "sandbox_restriction",
    "permission_error",
    "child_process_eperm",
    "invalid_project_test",
  ];
  if (!allowed.includes(result.failureKind)) {
    throw new Error(`final-regression failureKind invalid: ${result.failureKind}`);
  }
}

function validateFinalRegressionRecordAndProceed(result) {
  const recommended = ["fix-and-rerun", "record-and-proceed", "stop"];
  if (Object.hasOwn(result, "nextRecommendedAction") && !recommended.includes(result.nextRecommendedAction)) {
    throw new Error(`final-regression nextRecommendedAction invalid: ${result.nextRecommendedAction}`);
  }
  if (!Array.isArray(result.changedFileFingerprints)) {
    throw new Error("final-regression changedFileFingerprints must be array");
  }
  if (result.result !== "fail") {
    if (result.completed === true && result.selectedAction === "record-and-proceed") {
      throw new Error("final-regression record-and-proceed is only valid on fail");
    }
    return;
  }
  if (typeof result.failureCategory !== "string" || result.failureCategory.length === 0) {
    throw new Error("final-regression failureCategory is required on fail");
  }
  if (![
    "caused_by_current_change",
    "existing_failure",
    "environment",
    "sandbox",
    "timeout",
    "dependency",
    "out_of_scope",
    "flaky_suspected",
  ].includes(result.failureCategory)) {
    throw new Error(`final-regression failureCategory invalid: ${result.failureCategory}`);
  }
  if (!["assertion", "execution"].includes(result.failureNature)) {
    throw new Error("final-regression failureNature must be assertion or execution");
  }
  if (!Number.isInteger(result.fixAttempts) || result.fixAttempts < 0) {
    throw new Error("final-regression fixAttempts must be a non-negative integer");
  }
  if (result.recordAndProceed?.eligible === true || result.completed === true) {
    if (!result.commandIdentity || typeof result.commandIdentity !== "object" || Array.isArray(result.commandIdentity)) {
      throw new Error("final-regression commandIdentity is required on eligible fail");
    }
    for (const field of ["command", "commandSource", "argv", "env", "source", "metadata", "resolvedScriptDigest", "resolvedConfigDigest"]) {
      if (!Object.hasOwn(result.commandIdentity, field)) throw new Error(`final-regression commandIdentity missing ${field}`);
    }
    if (!Array.isArray(result.commandIdentity.argv) || result.commandIdentity.argv.some((entry) => typeof entry !== "string")) {
      throw new Error("final-regression commandIdentity.argv must be string array");
    }
  }
  if (!result.recordAndProceed || typeof result.recordAndProceed !== "object" || Array.isArray(result.recordAndProceed)) {
    throw new Error("final-regression record-and-proceed evidence is required on fail");
  }
  if (typeof result.recordAndProceed.eligible !== "boolean") {
    throw new Error("final-regression record-and-proceed eligible must be boolean");
  }
  if (typeof result.recordAndProceed.validated !== "boolean") {
    throw new Error("final-regression record-and-proceed validated must be boolean");
  }
  if (result.completed === true) {
    if (result.selectedAction !== "record-and-proceed") {
      throw new Error("final-regression completed fail requires selectedAction=record-and-proceed");
    }
    if (result.nextAction !== "report") {
      throw new Error("final-regression completed failed-recorded nextAction must be report");
    }
    if (result.nextRecommendedAction !== "record-and-proceed") {
      throw new Error("final-regression completed failed-recorded nextRecommendedAction must be record-and-proceed");
    }
    if (result.recordAndProceed.eligible !== true || result.recordAndProceed.validated !== true) {
      throw new Error("final-regression completed fail requires validated failed-recorded record-and-proceed evidence");
    }
    if (typeof result.recordAndProceed.evidence !== "string" || result.recordAndProceed.evidence.trim().length === 0) {
      throw new Error("final-regression record-and-proceed evidence must be non-empty");
    }
    if (typeof result.remainingRisk !== "string" || result.remainingRisk.trim().length === 0) {
      throw new Error("final-regression remainingRisk is required for record-and-proceed");
    }
  } else if (result.selectedAction === "record-and-proceed") {
    throw new Error("final-regression record-and-proceed selection requires completed fail");
  }
}

function validateFinalRegressionSkipKind(result) {
  if (result.result !== "skipped") {
    if (Object.hasOwn(result, "skipKind")) throw new Error("final-regression skipKind is only valid on skipped");
    if (Object.hasOwn(result, "proof")) throw new Error("final-regression proof is only valid on skipped");
    return;
  }
  if (!FINAL_REGRESSION_SKIP_KINDS.includes(result.skipKind)) throw new Error(`final-regression skipKind invalid: ${result.skipKind}`);
  if (typeof result.reason !== "string" || result.reason.length === 0) throw new Error("final-regression skipped reason is required");
  if (result.retryable !== false) throw new Error("final-regression skipped retryable must be false");
  if (result.nextAction !== "report") throw new Error("final-regression skipped nextAction must be report");
  if (result.completed !== true) throw new Error("final-regression skipped completed must be true");
  if (!result.proof || typeof result.proof !== "object" || Array.isArray(result.proof)) {
    throw new Error("final-regression skipped proof is required");
  }
  if (result.proof.kind !== result.skipKind) throw new Error("final-regression skipped proof.kind must match skipKind");
  if (result.skipKind === "covered_by_test_execute_full_regression") {
    for (const field of ["reusedArtifactPath", "commandIdentity", "changedFileFingerprints", "staleCheck"]) {
      if (!Object.hasOwn(result.proof, field)) throw new Error(`final-regression covered proof missing ${field}`);
    }
    const identity = result.proof.commandIdentity;
    for (const field of ["command", "commandSource", "argv", "env", "source", "metadata", "resolvedScriptDigest", "resolvedConfigDigest"]) {
      if (!Object.hasOwn(identity, field)) throw new Error(`final-regression commandIdentity missing ${field}`);
    }
    if (!Array.isArray(identity.argv) || identity.argv.some((entry) => typeof entry !== "string")) {
      throw new Error("final-regression commandIdentity.argv must be string array");
    }
    if (!Array.isArray(result.proof.changedFileFingerprints)) {
      throw new Error("final-regression changedFileFingerprints must be array");
    }
    if (JSON.stringify(result.proof.staleCheck) !== JSON.stringify({
      sameFlow: true,
      commandIdentityMatched: true,
      changedFileFingerprintsMatched: true,
    })) {
      throw new Error("final-regression staleCheck must prove same-flow matched evidence");
    }
  } else if (result.skipKind === "risk_based_static_proof") {
    for (const field of ["allowlistClassifications", "checkedSensitivePathClasses", "failClosedDecision", "upgradeEvidencePath", "testExecuteEvidencePath"]) {
      if (!Object.hasOwn(result.proof, field)) throw new Error(`final-regression risk proof missing ${field}`);
    }
    if (!Array.isArray(result.proof.allowlistClassifications)) {
      throw new Error("final-regression allowlistClassifications must be array");
    }
    if (!Array.isArray(result.proof.checkedSensitivePathClasses)) {
      throw new Error("final-regression checkedSensitivePathClasses must be array");
    }
    if (JSON.stringify(result.proof.failClosedDecision) !== JSON.stringify({ eligible: true, fallbackReasons: [] })) {
      throw new Error("final-regression risk proof failClosedDecision must be eligible");
    }
  } else {
    const discovery = result.proof.commandDiscovery;
    if (!discovery || typeof discovery !== "object" || Array.isArray(discovery)) {
      throw new Error("final-regression project policy proof missing commandDiscovery");
    }
    if (!Array.isArray(discovery.checkedSources) || discovery.checkedSources.length === 0) {
      throw new Error("final-regression project policy checkedSources must be a non-empty array");
    }
    if (discovery.checkedSources.some((entry) => typeof entry !== "string" || entry.length === 0)) {
      throw new Error("final-regression project policy checkedSources must contain non-empty strings");
    }
    if (discovery.supportedCommandFound !== false) {
      throw new Error("final-regression project policy supportedCommandFound must be false");
    }
    if (discovery.invalidConfiguredCommand !== false) {
      throw new Error("final-regression project policy invalidConfiguredCommand must be false");
    }
    if (typeof discovery.reason !== "string" || discovery.reason.length === 0) {
      throw new Error("final-regression project policy reason is required");
    }
  }
}

export function validateFinalRegressionResult(result) {
  if (!result || typeof result !== "object") throw new Error("final-regression-result.json must be an object");
  if (result.version !== "1") throw new Error(`final-regression-result.json version='${result.version}', expected '1'`);
  if (!["pass", "fail", "skipped"].includes(result.result)) throw new Error("final-regression result must be pass, fail, or skipped");
  if (typeof result.completed !== "boolean") throw new Error("final-regression completed must be boolean");
  if (typeof result.command !== "string" && result.command !== null) throw new Error("final-regression command must be string or null");
  if (typeof result.commandSource !== "string" && result.commandSource !== null) throw new Error("final-regression commandSource must be string or null");
  if (typeof result.rawOutputPath !== "string" || result.rawOutputPath.length === 0) throw new Error("final-regression rawOutputPath is required");
  if (typeof result.retryable !== "boolean") throw new Error("final-regression retryable must be boolean");
  if (typeof result.nextAction !== "string" || result.nextAction.length === 0) throw new Error("final-regression nextAction is required");
  if (!Array.isArray(result.changedFiles)) throw new Error("final-regression changedFiles[] is required");
  if (result.result === "skipped") assertCamelRange(result.rawOutputLines, "final-regression");
  else assertRange(result.rawOutputLines, "final-regression");
  assertProcessMetadata(result.process, "final-regression.process");
  validateFinalRegressionFailureKind(result);
  validateFinalRegressionSkipKind(result);
  validateFinalRegressionRecordAndProceed(result);
  return result;
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
    if (!evidence || typeof evidence !== "object") {
      throw new Error(`${entry.id}: evidence is required`);
    }
    assertRange(evidence.raw_output_lines, `${entry.id}: evidence`);
    assertEvidenceRangeWithinLimit(evidence.raw_output_lines, `${entry.id}: evidence`);
    if (typeof evidence.command !== "string" || evidence.command.length === 0) {
      throw new Error(`${entry.id}: evidence.command is required`);
    }
    if (evidence.raw_output_lines.end_line > rawLines.length) {
      throw new Error(`${entry.id}: summary raw_output_lines is outside raw output`);
    }
    if (entry.result === "not_applicable") {
      if (entry.reason !== SUMMARY_NO_TESTS_REASON) {
        throw new Error(`${entry.id}: reason must be ${SUMMARY_NO_TESTS_REASON}`);
      }
      if (validateRawOutputRange) {
        const rawRangeText = rawLines
          .slice(evidence.raw_output_lines.start_line - 1, evidence.raw_output_lines.end_line)
          .join("\n");
        if (!rawRangeText.includes(entry.id)
          || !rawRangeText.includes("not_applicable")
          || !rawRangeText.includes(SUMMARY_NO_TESTS_REASON)) {
          throw new Error(`${entry.id}: raw output range does not contain no-tests decision evidence`);
        }
      }
      continue;
    }
    if (entry.result !== "pass" && entry.result !== "fail") {
      throw new Error(`${entry.id}: result invalid: ${entry.result}`);
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
    const startMarker = `[senti] project regression start command=${regression.command} mode=${regression.mode}`;
    const endMarker = `[senti] project regression end result=${regression.result}`;
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
  const finalRegressionPath = path.join(specDir, FINAL_REGRESSION_RESULT_FILE);
  const finalRegression = fs.existsSync(finalRegressionPath)
    ? validateFinalRegressionResult(readJsonStrict(finalRegressionPath))
    : null;
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
    ...(finalRegression
      ? {
          finalRegression: {
            status: "done",
            result: finalRegression.result,
            failureKind: finalRegression.failureKind,
            failureCategory: finalRegression.failureCategory || null,
            failureNature: finalRegression.failureNature || null,
            skipKind: finalRegression.skipKind || null,
            rawOutputPath: finalRegression.rawOutputPath,
            command: finalRegression.command,
            process: finalRegression.process,
            exitCode: finalRegression.process?.exitCode ?? null,
            failureSummary: finalRegression.failureSummary || null,
            currentDiffRelationship: finalRegression.currentDiffRelationship || null,
            changedFiles: finalRegression.changedFiles || [],
            changedFileFingerprints: finalRegression.changedFileFingerprints || [],
            fixAttempts: finalRegression.fixAttempts ?? null,
            selectedAction: finalRegression.selectedAction || null,
            remainingRisk: finalRegression.remainingRisk || null,
            retryable: finalRegression.retryable,
            nextAction: finalRegression.nextAction,
            nextRecommendedAction: finalRegression.nextRecommendedAction || null,
            recordAndProceed: finalRegression.recordAndProceed || null,
            humanSummary: finalRegression.humanSummary || null,
          },
        }
      : {}),
  };
}

function completionFailure(artifactName, issueCodes, artifact = null) {
  return new ArtifactCompletionMechanicalFailure({
    artifactName,
    artifact,
    issueCodes,
    issues: issueCodes.map((code) => `${artifactName}: ${code}`),
  });
}

function completionSuccess(artifactName, artifact) {
  return new ArtifactCompletionSuccess({ artifactName, artifact });
}

function addCompletionIssue(issueCodes, code) {
  if (!issueCodes.includes(code)) issueCodes.push(code);
}

function addMappedValidationIssue(issueCodes, err, fallbackCode) {
  const message = String(err?.message || err || "");
  if (/raw_output_lines|raw output|range/i.test(message)) addCompletionIssue(issueCodes, "raw-evidence-range-invalid");
  else if (/file-map/i.test(message)) addCompletionIssue(issueCodes, "file-map-missing");
  else if (/regression/i.test(message)) addCompletionIssue(issueCodes, "regression-evidence-missing");
  else if (/checked_items|verdict|test-result-review/i.test(message)) addCompletionIssue(issueCodes, "test-result-review-schema-invalid");
  else addCompletionIssue(issueCodes, fallbackCode);
}

function rawLineCount(file) {
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  return text.split(/\r?\n/).length;
}

function resolveRawFile(root, specDir, rawOutputPath) {
  if (!rawOutputPath) return null;
  if (path.isAbsolute(rawOutputPath)) return rawOutputPath;
  if (rawOutputPath.startsWith("specs/")) return path.resolve(root || process.cwd(), rawOutputPath);
  return path.resolve(specDir || root || process.cwd(), rawOutputPath);
}

function loadSpecTestableRequirements(specDir, fallbackEntries = []) {
  try {
    const spec = JSON.parse(fs.readFileSync(path.join(specDir, "spec.json"), "utf8"));
    if (Array.isArray(spec.requirements)) {
      return spec.requirements
        .filter((requirement) => requirement.testable !== false)
        .map((requirement) => ({ id: requirement.id }));
    }
  } catch (_) {
    // Completion adapters can be exercised as public surfaces without a spec.
  }
  return fallbackEntries
    .filter((entry) => typeof entry?.id === "string" && entry.id.length > 0)
    .map((entry) => ({ id: entry.id }));
}

function hasMissingRequirementEvidence(requirements, entries) {
  if (!Array.isArray(requirements) || requirements.length === 0) return false;
  const actual = new Set(entries.map((entry) => entry?.id).filter(Boolean));
  return requirements.some((requirement) => !actual.has(requirement.id));
}

export async function completeScenarioValidityArtifactChange({ root, specDir, artifact } = {}) {
  const issueCodes = [];
  const rawFile = resolveRawFile(root, specDir, artifact?.raw_output_path);
  const entries = Array.isArray(artifact?.summary) ? artifact.summary : (Array.isArray(artifact?.requirements) ? artifact.requirements : []);
  const requirements = loadSpecTestableRequirements(specDir, entries);
  if (!rawFile || !fs.existsSync(rawFile)) {
    addCompletionIssue(issueCodes, "scenario-validity-schema-invalid");
  } else {
    try {
      const rawText = fs.readFileSync(rawFile, "utf8");
      validateScenarioValidityResult(artifact, {
        root,
        specDir,
        requirements,
        rawText,
      });
    } catch (err) {
      addMappedValidationIssue(issueCodes, err, "scenario-validity-schema-invalid");
    }
  }
  if (hasMissingRequirementEvidence(requirements, entries)) addCompletionIssue(issueCodes, "scenario-validity-schema-invalid");
  if (artifact?.version !== "1") addCompletionIssue(issueCodes, "scenario-validity-schema-invalid");
  if (entries.length === 0 || entries.some((entry) => entry.classification !== "expected_fail")) {
    addCompletionIssue(issueCodes, "scenario-validity-classification-not-expected-fail");
  }
  return issueCodes.length
    ? completionFailure(SCENARIO_VALIDITY_RESULT_FILE, issueCodes, artifact)
    : completionSuccess(SCENARIO_VALIDITY_RESULT_FILE, artifact);
}

function testExecuteEntries(artifact) {
  return Array.isArray(artifact?.summary) ? artifact.summary : (Array.isArray(artifact?.requirements) ? artifact.requirements : []);
}

function testExecuteEvidenceRange(entry) {
  return entry?.evidence?.raw_output_lines || entry?.rawOutputLines || entry?.rawOutputLines || entry?.raw_output_lines;
}

function canonicalTestExecuteArtifact(artifact) {
  if (Array.isArray(artifact?.summary)) return artifact;
  const entries = Array.isArray(artifact?.requirements) ? artifact.requirements : [];
  return {
    ...artifact,
    raw_output_path: artifact?.raw_output_path || artifact?.rawOutputPath,
    summary: entries.map((entry) => ({
      id: entry.id,
      result: entry.result || entry.status || "fail",
      evidence: {
        command: entry.command || "node --test",
        test_file: entry.test_file || entry.testFile || "specs/fixture/tests/fixture.test.js",
        test_name: entry.test_name || entry.testName || `${entry.id}: fixture`,
        raw_output_lines: testExecuteEvidenceRange(entry),
      },
    })),
    regression: artifact?.regression?.required == null
      ? {
        required: false,
        category: "full-regression-deferred",
        reason: "full project regression deferred to final-regression",
        classified_paths: [],
        ...artifact?.regression,
      }
      : artifact.regression,
  };
}

export async function completeTestExecuteArtifactChange({ root, specDir, artifact } = {}) {
  const issueCodes = [];
  const rawOutputPath = artifact?.rawOutputPath || artifact?.raw_output_path;
  const rawFile = resolveRawFile(root, specDir, rawOutputPath);
  const entries = testExecuteEntries(artifact);
  const requirements = loadSpecTestableRequirements(specDir, entries);
  const hasSummaryArray = Array.isArray(artifact?.summary) || Array.isArray(artifact?.requirements);
  const lineCount = rawFile ? rawLineCount(rawFile) : null;
  if (hasSummaryArray && artifact?.regression) {
    const canonical = canonicalTestExecuteArtifact(artifact);
    try {
      validateTestExecuteResultV2(canonical);
      if (rawFile && lineCount != null && canonical.summary.every((entry) => entry?.evidence?.test_file && entry?.evidence?.test_name)) {
        const rawText = fs.readFileSync(rawFile, "utf8");
        validateTestExecuteResultEvidence(canonical, {
          root: root || path.dirname(specDir || process.cwd()),
          specDir,
          rawOutputText: rawText,
          rawLines: rawText.split(/\r?\n/),
          requirements,
        });
      }
    } catch (err) {
      addMappedValidationIssue(issueCodes, err, "requirement-summary-missing");
    }
  }

  if (hasMissingRequirementEvidence(requirements, entries)) addCompletionIssue(issueCodes, "requirement-summary-missing");
  if (!rawFile || lineCount == null) addCompletionIssue(issueCodes, "raw-output-missing");
  if (!specDir || !fs.existsSync(path.join(specDir, FILE_MAP_RELATIVE))) addCompletionIssue(issueCodes, "file-map-missing");
  if (!hasSummaryArray || entries.length === 0) addCompletionIssue(issueCodes, "requirement-summary-missing");
  if (!artifact?.regression) addCompletionIssue(issueCodes, "regression-evidence-missing");
  if (rawOutputPath
    && !rawOutputPath.startsWith(`${TESTS_RAW_DIR_RELATIVE}/`)
    && !rawOutputPath.startsWith("specs/")) {
    addCompletionIssue(issueCodes, "placeholder-permission-missing");
  }

  if (lineCount != null && entries.length > 0) {
    const invalidRange = entries.some((entry) => {
      const range = testExecuteEvidenceRange(entry);
      return !range
        || !Number.isInteger(range.start_line)
        || !Number.isInteger(range.end_line)
        || range.start_line < 1
        || range.end_line < range.start_line
        || range.end_line > lineCount;
    });
    if (invalidRange) addCompletionIssue(issueCodes, "raw-evidence-range-invalid");
  }

  return issueCodes.length
    ? completionFailure(TEST_EXECUTE_RESULT_FILE, issueCodes, artifact)
    : completionSuccess(TEST_EXECUTE_RESULT_FILE, artifact);
}

export async function completeTestResultReviewArtifactChange({ specDir, artifact } = {}) {
  const issueCodes = [];
  if (Array.isArray(artifact?.checked_items)) {
    try {
      validateTestResultReview(artifact);
    } catch (err) {
      addMappedValidationIssue(issueCodes, err, "test-result-review-schema-invalid");
    }
  }
  const checked = Array.isArray(artifact?.checked_items) ? artifact.checked_items : artifact?.checkedItems;
  if (!Array.isArray(artifact?.checked_items) || artifact?.verdict !== "pass") addCompletionIssue(issueCodes, "test-result-review-schema-invalid");
  if (!Array.isArray(checked) || checked.length === 0) addCompletionIssue(issueCodes, "checked-items-empty");
  if (!specDir || !fs.existsSync(path.join(specDir, FILE_MAP_RELATIVE))) addCompletionIssue(issueCodes, "file-map-missing");
  const regressionPass = Array.isArray(checked)
    && checked.some((item) => item?.check === "project_regression_verification" && item?.result === "pass");
  if (!regressionPass) addCompletionIssue(issueCodes, "regression-evidence-missing");
  return issueCodes.length
    ? completionFailure(TEST_RESULT_REVIEW_FILE, issueCodes, artifact)
    : completionSuccess(TEST_RESULT_REVIEW_FILE, artifact);
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
    const savedChangedFiles = RegressionFileSnapshotList.fromJSON(
      regression.changed_files,
      "regression.changed_files",
    );
    const savedTriggerFiles = RegressionFileSnapshotList.fromJSON(
      regression.trigger_relevant_changed_files,
      "regression.trigger_relevant_changed_files",
    );
    const analysisPath = path.join(sentiOutputDir(root), "analysis.json");
    const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
    const changedFiles = listRegressionChangedFiles({ root, state });
    const current = classifyRegression({ root, state, analysis, config, changedFiles });
    const currentChangedFiles = RegressionFileSnapshotList.fromChangedFiles(
      root,
      current.changedFiles,
    );
    const currentTriggerFiles = RegressionFileSnapshotList.fromChangedFiles(
      root,
      current.triggerRelevantChangedFiles,
    );
    if (!savedChangedFiles.equals(currentChangedFiles)) {
      throw new Error("project regression changed_files snapshot is stale; rerun test-execute");
    }
    if (!savedTriggerFiles.equals(currentTriggerFiles)) {
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

export function validateIntegrationArtifactTrust({
  root,
  specDir,
  phase = "integration",
  specPath = null,
  state = {},
  baseBranch = state?.baseBranch ?? null,
  config = {},
}) {
  const contract = buildGateArtifactTrustContract({ step: "impl-gate", phase });
  if (contract.requiredTrustInputs.length === 0) return new GateArtifactTrustSuccess({ contract });

  try {
    const upgradeEvidence = validateUpgradeEvidenceForGate({
      root,
      specDir,
      baseBranch,
    });
    if (!upgradeEvidence.ok) return new GateArtifactTrustFailure(upgradeEvidence.reason);

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
