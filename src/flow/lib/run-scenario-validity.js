import fs from "fs";
import path from "path";
import { resolveSpecDir } from "../../lib/spec-json.js";
import { runCmdAsync } from "../../lib/process.js";
import { listChangedFilesDetailed, runGit } from "../../lib/git-helpers.js";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { DEFAULT_TEST_TIMEOUT_SECONDS } from "./test-regression.js";
import { RepairStateError, resolveRepairBaselineAuthority } from "./repair-state-identity.js";
import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";
import { SharedSpecTestExecution } from "./shared-spec-test-execution.js";
import { appendIssueLogEntry } from "./set-issue-log.js";
import {
  SCENARIO_VALIDITY_RAW_OUTPUT_RELATIVE,
  SCENARIO_VALIDITY_RESULT_FILE,
  readJsonStrict,
  validateScenarioValidityResult,
} from "./test-artifacts.js";
const SCENARIO_TEST_FILE_RE = /\.(test|spec)\.(js|ts|mjs)$/;

export { resolveRepairBaselineAuthority as resolveScenarioValidityBaselineAuthority } from "./repair-state-identity.js";

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
    ".senti/config.json",
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
        || normalized === ".senti/config.json";
    });
  return [...new Set([...diffFiles, ...statusFiles])].filter((filePath) => {
    const normalized = normalizePath(filePath);
    return normalized.startsWith("src/")
      || normalized.startsWith("tests/")
      || normalized === "package.json"
      || normalized === ".senti/config.json";
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

export function recordScenarioValidityRepairEvidence({
  root,
  state,
  summary,
  timestamp = new Date().toISOString(),
}) {
  const blocking = summary
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.classification !== "expected_fail");
  if (blocking.length === 0) return null;
  const testRevisionDigest = state.specTestArtifactRevision?.digest || null;
  const issueLogId = [
    "scenario-validity-test-repair",
    state.runId,
    testRevisionDigest || "unversioned",
  ].join("-");
  const observations = blocking.slice(0, 64).map(({ entry, index }) => ({
    kind: "violation",
    failureMode: entry.classification,
    requirementRef: entry.id,
    where: {
      file: entry.evidence.test_file,
      locator: entry.evidence.test_name,
    },
    observed: `Scenario validity classified ${entry.id} as ${entry.classification} before implementation.`,
    severity: "blocking",
    refs: [`scenario-validity-result.json#summary.${index}`],
  }));
  const stored = appendIssueLogEntry(root, relativeFlowSpecFile(state), {
    step: "scenario-validity",
    phase: "test",
    reason: blocking.map(({ entry }) => `${entry.id}=${entry.classification}`).join(", "),
    trigger: "scenario-validity found a test-design blocker before implementation",
    resolution: "Rewind to the governed test handoff and replace the invalid test premise.",
    sourceArtifact: "scenario-validity-result.json",
    testRevisionDigest,
    observations,
    timestamp,
  }, issueLogId);
  return stored.entry;
}

function writeScenarioValidityFallbackArtifacts({ root, specDir, resultPath, rawOutputPath, requirements, command, err }) {
  const rawLines = [
    "[senti] scenario-validity error",
    `error: ${err?.message || String(err)}`,
    ...requirements.filter((req) => req.testable !== false).map((req) => `[senti] requirement ${req.id} result invalid_test`),
    "[senti] scenario-validity error end",
  ];
  const range = { start_line: 1, end_line: rawLines.length };
  const summary = requirements
    .filter((req) => req.testable !== false)
    .map((req) => ({
      id: req.id,
      classification: "invalid_test",
      evidence: {
        test_file: normalizePath(path.relative(root, path.join(specDir, "tests", `${req.id.toLowerCase()}.test.js`))),
        test_name: `${req.id}: scenario-validity error`,
        command,
        raw_output_lines: range,
      },
    }));
  const artifact = {
    version: "1",
    raw_output_path: normalizePath(path.relative(root, rawOutputPath)),
    command,
    process: {
      started: false,
      exitCode: null,
      signal: null,
      timedOut: false,
      spawnError: err?.message || String(err),
    },
    result: "block",
    summary,
  };
    fs.writeFileSync(rawOutputPath, rawLines.join("\n") + "\n");
    fs.writeFileSync(resultPath, JSON.stringify(artifact, null, 2) + "\n");
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
    const { root } = ctx;
    const executionRoot = ctx.executionRoot || root;
    const state = ctx.flowState;
    const config = ctx.config || this.container?.get?.("config") || {};
    const specDir = resolveSpecDir(path.resolve(root, relativeFlowSpecFile(state)));
    const specId = state.specId;
    const resultPath = path.join(specDir, SCENARIO_VALIDITY_RESULT_FILE);
    const rawOutputPath = path.join(specDir, SCENARIO_VALIDITY_RAW_OUTPUT_RELATIVE);
    const blockedResult = (message, code = "SCENARIO_VALIDITY_BLOCKED", details = null) => Envelope.fail(
      "run",
      "scenario-validity",
      code,
      message,
      {
        result: "block",
        changed: [
          normalizePath(path.relative(root, resultPath)),
          normalizePath(path.relative(root, rawOutputPath)),
        ],
        artifacts: {
          result_path: normalizePath(path.relative(root, resultPath)),
          raw_output_path: normalizePath(path.relative(root, rawOutputPath)),
          completed: false,
          artifact_version: "1",
          result: "block",
        },
        ...(details ? { details } : {}),
        next: null,
      },
    );
    await fs.promises.mkdir(path.dirname(rawOutputPath), { recursive: true });
    await fs.promises.rm(resultPath, { force: true });
    await fs.promises.rm(rawOutputPath, { force: true });

    let requirements = [];
    let command = "node --test";
    try {
      const spec = readJsonStrict(path.join(specDir, "spec.json"));
      requirements = Array.isArray(spec.requirements) ? spec.requirements : [];
      const files = await discoverScenarioValidityTestFiles({ root, specDir });
      const testEntries = await loadScenarioTestEntries(files);
      const testFileSources = new Map(testEntries.flatMap((entry) => [
        [normalizePath(path.relative(root, entry.file)), entry.source],
        [entry.file, entry.source],
      ]));
      command = files.length > 0
        ? ["node", "--test", ...files.map((file) => normalizePath(path.relative(root, file)))].join(" ")
        : "node --test";
      const rawLines = [];

    let baseline;
    try {
      baseline = resolveRepairBaselineAuthority({ root: executionRoot, flowState: state });
    } catch (error) {
      if (!(error instanceof RepairStateError)) throw error;
      writeScenarioValidityFallbackArtifacts({
        root,
        specDir,
        resultPath,
        rawOutputPath,
        requirements,
        command,
        err: error,
      });
      return blockedResult(error.message, "SCENARIO_VALIDITY_BLOCKED", {
        baselineErrorCode: error.code,
        ...error.details,
      });
    }
    const baselineRef = baseline.ref;
    const changedFiles = listScenarioValidityPreflightFiles({ root: executionRoot, baselineRef });
    const preflight = validateScenarioValidityPreflightPaths({
      specDirectory: normalizePath(path.relative(root, specDir)),
      changedFiles,
    });
    if (!preflight.ok) {
      const range = appendRaw(rawLines, [
        "[senti] scenario-validity preflight block",
        `command: ${buildScenarioValidityDiffArgs(baselineRef).join(" ")}`,
        `invalid_paths: ${preflight.invalidPaths.join(", ")}`,
        ...requirements.filter((req) => req.testable !== false).map((req) => `[senti] requirement ${req.id} result invalid_test`),
        "[senti] scenario-validity preflight end",
      ]);
      const artifact = {
        version: "1",
        raw_output_path: normalizePath(path.relative(root, rawOutputPath)),
        command,
        process: { started: false, exitCode: null, signal: null, timedOut: false, spawnError: null },
        result: "block",
        summary: requirements
          .filter((req) => req.testable !== false)
          .map((req) => {
            const entry = findTestEntriesForReq(testEntries, req.id)[0];
            return {
              id: req.id,
              classification: "invalid_test",
              evidence: {
                test_file: entry ? normalizePath(path.relative(root, entry.file)) : normalizePath(path.relative(root, path.join(specDir, "tests", `${req.id.toLowerCase()}.test.js`))),
                test_name: entry ? extractRequirementTestName(entry, req.id) : `${req.id}: preflight invalid`,
                command,
                raw_output_lines: range,
              },
            };
          }),
        preflight: { invalid_paths: preflight.invalidPaths },
      };
      await fs.promises.writeFile(rawOutputPath, rawLines.join("\n") + "\n");
      validateScenarioValidityResult(artifact, { root, specDir, requirements, rawText: rawLines.join("\n"), rawLines, testFileSources });
      await fs.promises.writeFile(resultPath, JSON.stringify(artifact, null, 2) + "\n");
      return blockedResult(`scenario-validity blocked by implementation-target changes: ${preflight.invalidPaths.join(", ")}`);
    }

    const timeoutMs = (config?.test?.timeoutSeconds
      || config?.test?.timeout
      || config?.agent?.timeout
      || DEFAULT_TEST_TIMEOUT_SECONDS) * 1000;
    const executions = buildScenarioValidityExecutions({ testEntries, requirements });
    const fileRecords = await this.scenarioTestExecutor({
      root: executionRoot,
      repositoryRoot: root,
      specDir,
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
          exitCode: failedRecords.length === 0 ? 0 : failedRecords.find((record) => record.process.exitCode !== null)?.process.exitCode ?? null,
          signal: fileRecords.find((record) => record.process.signal)?.process.signal || null,
          timedOut: fileRecords.some((record) => record.process.timedOut),
          spawnError: spawnErrors.length > 0 ? spawnErrors.join("\n") : null,
          stdout: "",
          stderr: "",
        };
    appendRaw(rawLines, [
      "[senti] scenario-validity tests start",
      `command: ${command}`,
    ]);
    const recordRanges = new Map();
    for (const record of fileRecords) {
      const requirementLabel = record.requirementId || "unscoped";
      recordRanges.set(record, appendRaw(rawLines, [
        `[senti] scenario-validity requirement ${requirementLabel} file start command=${record.command}`,
        ...processLines(record.process),
        `[senti] scenario-validity requirement ${requirementLabel} file end command=${record.command}`,
      ]));
    }
    appendRaw(rawLines, [
      ...processLines(scenarioProcess),
      ...requirements.filter((req) => req.testable !== false).map((req) => {
        const entry = findTestEntriesForReq(testEntries, req.id)[0];
        const testName = entry ? extractRequirementTestName(entry, req.id) : `${req.id}: not run`;
        return `[senti] requirement ${req.id} observed: ${testName}`;
      }),
      "[senti] scenario-validity tests end",
    ]);
    const rawText = rawLines.join("\n");
    const range = { start_line: 1, end_line: rawLines.length };
    const summary = buildScenarioValiditySummary({
      root,
      files,
      testEntries,
      fileRecords,
      requirements,
      command,
      range,
      recordRanges,
    });
    const result = summary.every((entry) => entry.classification === "expected_fail") ? "pass" : "block";
    const artifact = {
      version: "1",
      raw_output_path: normalizePath(path.relative(root, rawOutputPath)),
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
    await fs.promises.writeFile(rawOutputPath, rawText + "\n");
    validateScenarioValidityResult(artifact, { root, specDir, requirements, rawText, rawLines, testFileSources });
    await fs.promises.writeFile(resultPath, JSON.stringify(artifact, null, 2) + "\n");

    const output = {
      result,
      changed: [
        normalizePath(path.relative(root, resultPath)),
        normalizePath(path.relative(root, rawOutputPath)),
      ],
      artifacts: {
        result_path: normalizePath(path.relative(root, resultPath)),
        raw_output_path: normalizePath(path.relative(root, rawOutputPath)),
        completed: result === "pass",
        artifact_version: "1",
        result,
      },
      next: result === "pass" ? "test-review" : null,
    };
    if (result !== "pass") {
      recordScenarioValidityRepairEvidence({ root, state, summary });
      output.changed.push(normalizePath(path.relative(root, path.join(specDir, "issue-log.json"))));
      return Envelope.fail(
        "run",
        "scenario-validity",
        "SCENARIO_VALIDITY_BLOCKED",
        `scenario-validity blocked: ${summary.map((entry) => `${entry.id}=${entry.classification}`).join(", ")}`,
        output,
      );
    }
    return output;
    } catch (err) {
      const artifactsExist = await Promise.all([
        fs.promises.access(resultPath).then(() => true, () => false),
        fs.promises.access(rawOutputPath).then(() => true, () => false),
      ]);
      if (artifactsExist.includes(false)) {
        writeScenarioValidityFallbackArtifacts({ root, specDir, resultPath, rawOutputPath, requirements, command, err });
      }
      throw err;
    }
  }
}
