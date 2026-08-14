import fs from "fs";
import path from "path";
import { runCmdAsync } from "../../lib/process.js";
import { listChangedFilesDetailed, runGit } from "../../lib/git-helpers.js";
import { FlowCommand } from "./base-command.js";
import { DEFAULT_TEST_TIMEOUT_SECONDS } from "./test-regression.js";
import { SharedSpecTestExecution } from "./shared-spec-test-execution.js";
import { PRODUCT } from "../../lib/product.js";
import { validateScenarioValidityResult } from "./test-artifacts.js";
import {
  CanonicalTestSourceRevision,
  CanonicalTestArtifactStore,
  isCanonicalFlowState,
} from "./canonical-test-artifacts.js";
import { attachCanonicalCommandResultArtifact } from "./canonical-command-result.js";
const SCENARIO_TEST_FILE_RE = /\.(test|spec)\.(js|ts|mjs)$/;


function normalizePath(p) {
  return p.split(path.sep).join("/");
}

export class ScenarioValidityExecution {
  constructor({ file, requirementId = null }) {
    if (typeof file !== "string" || file === "") {
      throw new Error("scenario-validity execution file is required");
    }
    if (requirementId !== null && (typeof requirementId !== "string" || requirementId === "")) {
      throw new Error("scenario-validity requirement id must be null or a non-empty string");
    }
    this.file = file;
    this.requirementId = requirementId;
    Object.freeze(this);
  }

  nodeArguments(relativeFile) {
    return [
      "--test",
      ...(this.requirementId ? [`--test-name-pattern=^${escapeRegExp(this.requirementId)}:`] : []),
      relativeFile,
    ];
  }
}

class ScenarioValidityExecutionRecord {
  constructor({ execution, rel, command, process }) {
    if (!(execution instanceof ScenarioValidityExecution)) {
      throw new Error("scenario-validity record requires an execution");
    }
    this.file = execution.file;
    this.requirementId = execution.requirementId;
    this.rel = rel;
    this.command = command;
    this.process = process;
    this.rawText = processLines(process).join("\n");
    Object.freeze(this);
  }
}

async function walkFiles(dir) {
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "ENOTDIR") return [];
    throw err;
  }
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

export async function discoverScenarioValidityTestFiles({ specDir }) {
  return (await walkFiles(path.join(specDir, "tests")))
    .filter((file) => SCENARIO_TEST_FILE_RE.test(path.basename(file)))
    .sort();
}

function activeSpecPrefix(specDirectory) {
  const normalized = normalizePath(specDirectory).replace(/\/$/, "");
  return `${normalized}/`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAllowedScenarioValidityPath(specDirectory, filePath) {
  const normalized = normalizePath(filePath);
  const prefix = activeSpecPrefix(specDirectory);
  if (normalized.startsWith(`${prefix}tests/`)) return true;
  if (normalized === `${prefix}spec.json`) return true;
  if (normalized === `${prefix}draft.json`) return true;
  if (normalized === `${prefix}issue-log.json`) return true;
  if (normalized === `${prefix}spec-review.md`) return true;
  return new RegExp(`^${escapeRegExp(prefix)}draft-review-\\d+\\.md$`).test(normalized);
}

export function validateScenarioValidityPreflightPaths({ specDirectory, changedFiles }) {
  const invalidPaths = changedFiles
    .map((entry) => typeof entry === "string" ? entry : entry.path)
    .filter(Boolean)
    .map(normalizePath)
    .filter((filePath) => !isAllowedScenarioValidityPath(specDirectory, filePath));
  return { ok: invalidPaths.length === 0, invalidPaths };
}

export function buildScenarioValidityDiffArgs(baseBranch = "main") {
  return [
    "diff",
    "--name-only",
    baseBranch,
    "--",
    "src/",
    "tests/",
    "package.json",
    PRODUCT.managedPath("config.json"),
  ];
}

export function listScenarioValidityPreflightFiles({ root, baselineRef }) {
  const diff = runGit(buildScenarioValidityDiffArgs(baselineRef), { cwd: root });
  if (!diff.ok) throw new Error(`scenario-validity preflight diff failed: ${diff.stderr || diff.stdout}`);
  const diffFiles = diff.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const statusFiles = listChangedFilesDetailed({ cwd: root, untrackedFiles: "all", maxChangedFileEntries: 2000 })
    .map((entry) => entry.path)
    .filter((filePath) => {
      const normalized = normalizePath(filePath);
      return normalized.startsWith("src/")
        || normalized.startsWith("tests/")
        || normalized === "package.json"
        || normalized === PRODUCT.managedPath("config.json");
    });
  return [...new Set([...diffFiles, ...statusFiles])].filter((filePath) => {
    const normalized = normalizePath(filePath);
    return normalized.startsWith("src/")
      || normalized.startsWith("tests/")
      || normalized === "package.json"
      || normalized === PRODUCT.managedPath("config.json");
  });
}

export async function runScenarioValidityProcess({ argv, cwd, timeoutMs, env = {} }) {
  try {
    const { NODE_TEST_CONTEXT: _nodeTestContext, ...environment } = process.env;
    const result = await runCmdAsync(argv[0], argv.slice(1), {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 20 * 1024 * 1024,
      env: { ...environment, ...env },
    });
    const spawnError = result.errorCode && result.errorCode !== "ETIMEDOUT"
      ? `${result.errorCode}: ${result.stderr || argv[0]}`
      : null;
    return {
      started: !spawnError,
      exitCode: spawnError ? null : result.status,
      signal: result.signal,
      timedOut: Boolean(result.killed),
      spawnError,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (err) {
    return {
      started: false,
      exitCode: null,
      signal: null,
      timedOut: false,
      spawnError: err.message,
      stdout: "",
      stderr: err.message,
    };
  }
}

function processLines(process) {
  const lines = [];
  if (process.stdout) lines.push(...process.stdout.split(/\r?\n/).filter((line) => line.length > 0));
  if (process.stderr) lines.push(...process.stderr.split(/\r?\n/).filter((line) => line.length > 0));
  if (process.spawnError) lines.push(`spawnError: ${process.spawnError}`);
  if (process.signal) lines.push(`signal: ${process.signal}`);
  if (process.timedOut) lines.push("timeout: true");
  lines.push(`exitCode: ${process.exitCode}`);
  return lines;
}

function appendRaw(lines, sectionLines) {
  const start = lines.length + 1;
  lines.push(...sectionLines);
  return { start_line: start, end_line: Math.max(start, lines.length) };
}

async function loadScenarioTestEntries(files) {
  const entries = [];
  for (const file of files) {
    const source = await fs.promises.readFile(file, "utf8");
    entries.push({
      file,
      source,
      firstLine: source.split(/\r?\n/, 1)[0],
    });
  }
  return entries;
}

function findTestEntriesForReq(entries, reqId) {
  return entries.filter((entry) => new RegExp(`\\b${reqId}\\b`).test(entry.firstLine));
}

export function buildScenarioValidityExecutions({ testEntries, requirements }) {
  return requirements
    .filter((requirement) => requirement.testable !== false)
    .flatMap((requirement) => findTestEntriesForReq(testEntries, requirement.id).map((entry) => (
      new ScenarioValidityExecution({ file: entry.file, requirementId: requirement.id })
    )));
}

function extractRequirementTestName(entry, reqId) {
  const src = entry.source;
  const re = new RegExp(`(?:it|test)\\(\\s*["'\`](${reqId}: [^"'\`]+)["'\`]`);
  return src.match(re)?.[1] || `${reqId}: requirement verification`;
}

function sourceLooksSkipped(entry, reqId) {
  const src = entry.source;
  const quotedNameThenOptions = new RegExp(`${reqId}: [^"'\\x60]+["'\\x60]\\s*,\\s*\\{[^}]*\\bskip\\s*:`);
  const testSkipCall = new RegExp(`(?:it|test)\\.skip\\(\\s*["'\\x60]${reqId}:`);
  return quotedNameThenOptions.test(src) || testSkipCall.test(src);
}

function processPassed(process) {
  return process.exitCode === 0 && !process.signal && !process.timedOut && !process.spawnError;
}

function processInvalid(process, rawText) {
  return Boolean(process.spawnError || process.signal || process.timedOut || /SyntaxError|ERR_MODULE|Cannot find module|ReferenceError/i.test(rawText));
}

export async function runScenarioValidityTestFiles({
  root,
  repositoryRoot = root,
  specDir,
  files,
  executions = null,
  timeoutMs,
}) {
  const execution = new SharedSpecTestExecution({
    repositoryRoot,
    executionRoot: root,
    specRoot: path.dirname(specDir),
  });
  const targets = executions ?? files.map((file) => new ScenarioValidityExecution({ file }));
  const records = [];
  for (const target of targets) {
    const rel = normalizePath(path.relative(root, target.file));
    const argv = execution.nodeArgv(target.nodeArguments(rel));
    const process = await runScenarioValidityProcess({
      argv,
      cwd: root,
      timeoutMs,
      env: execution.environment,
    });
    records.push(new ScenarioValidityExecutionRecord({
      execution: target,
      rel,
      command: argv.join(" "),
      process,
    }));
  }
  return records;
}

function evidenceRange(records, recordRanges, fallback) {
  const ranges = records.map((record) => recordRanges?.get(record)).filter(Boolean);
  if (ranges.length === 0) return fallback;
  return {
    start_line: Math.min(...ranges.map((range) => range.start_line)),
    end_line: Math.max(...ranges.map((range) => range.end_line)),
  };
}

export function buildScenarioValiditySummary({
  root,
  files,
  testEntries,
  fileRecords,
  requirements,
  command,
  range,
  recordRanges = new Map(),
}) {
  return requirements
    .filter((req) => req.testable !== false)
    .map((req) => {
      const reqEntries = findTestEntriesForReq(testEntries, req.id);
      const entry = reqEntries[0];
      const requirementRecords = fileRecords.filter((record) => record.requirementId === req.id);
      const reqRecords = requirementRecords.length > 0
        ? requirementRecords
        : reqEntries.map((reqEntry) => fileRecords.find((record) => record.file === reqEntry.file)).filter(Boolean);
      const classification = (() => {
        if (reqEntries.length === 0) return "not_run";
        if (reqEntries.some((candidate) => sourceLooksSkipped(candidate, req.id))) return "skipped";
        if (reqRecords.some((record) => processInvalid(record.process, record.rawText))) return "invalid_test";
        if (reqRecords.every((record) => processPassed(record.process))) return "unexpected_pass";
        return "expected_fail";
      })();
      return {
        id: req.id,
        classification,
        evidence: {
          test_file: entry ? normalizePath(path.relative(root, entry.file)) : normalizePath(path.relative(root, path.join(path.dirname(files[0] || root), `${req.id.toLowerCase()}.test.js`))),
          test_name: entry ? extractRequirementTestName(entry, req.id) : `${req.id}: not run`,
          command: reqRecords[0]?.command || command,
          raw_output_lines: evidenceRange(reqRecords, recordRanges, range),
        },
      };
    });
}

/**
 * One immutable, catalog-bound scenario-validity blocker fact.
 *
 * The old root issue-log writer used a filename as its source identity.  V1
 * keeps that fact in the cataloged issue log and refers to the producer's
 * logical artifact identity instead.  The source test-tree revision makes a
 * repair fail closed if the tests change before the gate rewind.
 */
export class CanonicalScenarioValidityRepairEvidence {
  constructor({ state, summary, testSourceRevision, timestamp = new Date().toISOString() } = {}) {
    if (state?.schemaRevision !== 3) throw new Error("canonical scenario-validity repair evidence requires a Version-1 Flow");
    if (!Array.isArray(summary)) throw new Error("canonical scenario-validity repair evidence summary must be an array");
    if (!(testSourceRevision instanceof CanonicalTestSourceRevision)) {
      throw new Error("canonical scenario-validity repair evidence requires a catalog test revision");
    }
    if (testSourceRevision.runId !== state.runId || testSourceRevision.specId !== state.specId) {
      throw new Error("canonical scenario-validity repair evidence test revision does not match the Flow");
    }
    if (!Number.isFinite(Date.parse(timestamp))) {
      throw new Error("canonical scenario-validity repair evidence timestamp must be ISO-8601");
    }
    this.runId = state.runId;
    this.specId = state.specId;
    this.testRevisionDigest = testSourceRevision.digest;
    this.timestamp = timestamp;
    this.blocking = Object.freeze(summary
      .map((entry, index) => Object.freeze({ entry, index }))
      .filter(({ entry }) => entry.classification !== "expected_fail"));
    Object.freeze(this);
  }

  get exists() { return this.blocking.length > 0; }

  get idempotencyKey() {
    return ["scenario-validity-test-repair", this.runId, this.testRevisionDigest].join("-");
  }

  toIssueLogEntry() {
    if (!this.exists) return null;
    return {
      step: "scenario-validity",
      phase: "test",
      reason: this.blocking.map(({ entry }) => `${entry.id}=${entry.classification}`).join(", "),
      trigger: "scenario-validity found a test-design blocker before implementation",
      resolution: "Rewind to the governed test handoff and replace the invalid test premise.",
      sourceArtifact: "scenario.validity",
      testRevisionDigest: this.testRevisionDigest,
      observations: this.blocking.slice(0, 64).map(({ entry, index }) => ({
        kind: "violation",
        failureMode: entry.classification,
        requirementRef: entry.id,
        where: {
          file: entry.evidence.test_file,
          locator: entry.evidence.test_name,
        },
        observed: `Scenario validity classified ${entry.id} as ${entry.classification} before implementation.`,
        severity: "blocking",
        refs: [`scenario.validity#summary.${index}`],
      })),
      timestamp: this.timestamp,
    };
  }
}

export function recordCanonicalScenarioValidityRepairEvidence({
  flowManager,
  state,
  summary,
  testSourceRevision,
  timestamp = new Date().toISOString(),
} = {}) {
  if (!flowManager || typeof flowManager.appendIssueLog !== "function") {
    throw new Error("canonical scenario-validity repair evidence requires FlowManager.appendIssueLog");
  }
  const evidence = new CanonicalScenarioValidityRepairEvidence({
    state,
    summary,
    testSourceRevision,
    timestamp,
  });
  if (!evidence.exists) return null;
  const stored = flowManager.appendIssueLog({
    specId: state.specId,
    entry: evidence.toIssueLogEntry(),
    idempotencyKey: evidence.idempotencyKey,
  });
  return stored.entry;
}

/**
 * V1 execution path.  It reads only cataloged tests/source Spec, retains the
 * diagnostic output as a typed transient, and leaves the durable attempts[]
 * result for the registry confirmation transaction.
 */
async function executeCanonicalScenarioValidity(ctx, scenarioTestExecutor, config) {
  const state = ctx.flowState;
  const executionRoot = ctx.executionRoot || ctx.root;
  const store = new CanonicalTestArtifactStore({ flowManager: ctx.flowManager, state });
  const repositoryRoot = store.location.repositoryRoot;
  const spec = store.readSpec("scenario-validity");
  const requirements = Array.isArray(spec.requirements) ? spec.requirements : [];
  const sources = store.testSources("scenario-validity");
  const testSourceRevision = store.testSourceRevision();
  const files = sources
    .map((source) => source.absolutePath)
    .filter((file) => SCENARIO_TEST_FILE_RE.test(path.basename(file)));
  const testEntries = await loadScenarioTestEntries(files);
  const testFileSources = new Map(testEntries.flatMap((entry) => [
    [normalizePath(path.relative(repositoryRoot, entry.file)), entry.source],
    [entry.file, entry.source],
  ]));
  const command = files.length > 0
    ? ["node", "--test", ...files.map((file) => normalizePath(path.relative(executionRoot, file)))].join(" ")
    : "node --test";
  const timeoutMs = (config?.test?.timeoutSeconds
    || config?.test?.timeout
    || config?.agent?.timeout
    || DEFAULT_TEST_TIMEOUT_SECONDS) * 1000;
  const executions = buildScenarioValidityExecutions({ testEntries, requirements });
  const fileRecords = await scenarioTestExecutor({
    root: executionRoot,
    repositoryRoot,
    specDir: store.directory,
    files,
    executions,
    timeoutMs,
  });
  const failedRecords = fileRecords.filter((record) => !processPassed(record.process));
  const spawnErrors = fileRecords.map((record) => record.process.spawnError).filter(Boolean);
  const scenarioProcess = fileRecords.length === 0
    ? { started: true, exitCode: 0, signal: null, timedOut: false, spawnError: null, stdout: "", stderr: "" }
    : {
        started: fileRecords.some((record) => record.process.started),
        exitCode: failedRecords.length === 0 ? 0 : fileRecords.find((record) => record.process.exitCode !== null)?.process.exitCode ?? null,
        signal: fileRecords.find((record) => record.process.signal)?.process.signal || null,
        timedOut: fileRecords.some((record) => record.process.timedOut),
        spawnError: spawnErrors.length > 0 ? spawnErrors.join("\n") : null,
        stdout: "",
        stderr: "",
      };
  const rawLines = [
    "[sennel] scenario-validity tests start",
    `command: ${command}`,
  ];
  const recordRanges = new Map();
  for (const record of fileRecords) {
    const requirementLabel = record.requirementId || "unscoped";
    recordRanges.set(record, appendRaw(rawLines, [
      `[sennel] scenario-validity requirement ${requirementLabel} file start command=${record.command}`,
      ...processLines(record.process),
      `[sennel] scenario-validity requirement ${requirementLabel} file end command=${record.command}`,
    ]));
  }
  appendRaw(rawLines, [
    ...processLines(scenarioProcess),
    ...requirements.filter((req) => req.testable !== false).map((req) => {
      const entry = findTestEntriesForReq(testEntries, req.id)[0];
      const testName = entry ? extractRequirementTestName(entry, req.id) : `${req.id}: not run`;
      return `[sennel] requirement ${req.id} observed: ${testName}`;
    }),
    "[sennel] scenario-validity tests end",
  ]);
  const rawText = rawLines.join("\n");
  const range = { start_line: 1, end_line: rawLines.length };
  const summary = buildScenarioValiditySummary({
    root: repositoryRoot,
    files,
    testEntries,
    fileRecords,
    requirements,
    command,
    range,
    recordRanges,
  });
  const result = summary.every((entry) => entry.classification === "expected_fail") ? "pass" : "block";
  const rawRelativePath = store.location.relativeArtifact("scenario.validity.raw-log");
  const artifact = {
    version: "1",
    raw_output_path: rawRelativePath,
    command,
    process: {
      started: scenarioProcess.started,
      exitCode: scenarioProcess.exitCode,
      signal: scenarioProcess.signal,
      timedOut: scenarioProcess.timedOut,
      spawnError: scenarioProcess.spawnError,
    },
    result,
    summary,
  };
  validateScenarioValidityResult(artifact, {
    root: repositoryRoot,
    specDir: store.directory,
    requirements,
    rawText,
    rawLines,
    testFileSources,
    expectedRawOutputPath: rawRelativePath,
    testDirectory: "artifacts/tests",
  });
  store.writeRaw({
    nodeId: "scenario-validity",
    logicalKey: "scenario.validity.raw-log",
    bytes: `${rawText}\n`,
  });
  const resultRelativePath = store.location.relativeArtifact("scenario.validity");
  const output = attachCanonicalCommandResultArtifact({
    result,
    changed: [resultRelativePath, rawRelativePath],
    artifacts: {
      result_path: resultRelativePath,
      raw_output_path: rawRelativePath,
      completed: result === "pass",
      artifact_version: "1",
      result,
    },
    next: result === "pass" ? "test-review" : null,
  }, {
    logicalKey: "scenario.validity",
    payload: artifact,
  });
  if (result !== "pass") {
    // A blocked command is not confirmed, but its observed attempt must still
    // be durable for retry/recovery and for subsequent human diagnosis.
    ctx.flowManager.publishCurrentAttemptResult({ specId: state.specId, commandResult: output });
    recordCanonicalScenarioValidityRepairEvidence({
      flowManager: ctx.flowManager,
      state,
      summary,
      testSourceRevision,
    });
  }
  return output;
}

export default class RunScenarioValidityCommand extends FlowCommand {
  constructor({ scenarioTestExecutor = runScenarioValidityTestFiles } = {}) {
    super();
    if (typeof scenarioTestExecutor !== "function") {
      throw new Error("scenarioTestExecutor must be a function");
    }
    this.scenarioTestExecutor = scenarioTestExecutor;
  }

  async execute(ctx) {
    const state = ctx.flowState;
    const config = ctx.config || this.container?.get?.("config") || {};
    if (!isCanonicalFlowState(state)) {
      throw new Error("scenario-validity requires a Version-1 Flow");
    }
    return executeCanonicalScenarioValidity(ctx, this.scenarioTestExecutor, config);
  }
}
