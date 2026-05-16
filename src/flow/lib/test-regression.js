import fs from "fs";
import path from "path";
import { runCmdAsync } from "../../lib/process.js";
import { listChangedFilesDetailed } from "../../lib/git-helpers.js";
import { extractMakeTestTarget, readMakefile } from "../../lib/makefile.js";
import { collectTestCommandSources, selectTestCommandSource } from "../../lib/test-command-sources.js";
import { projectFilePathsFromAnalysis } from "../../docs/lib/analysis-entry.js";

export const DEFAULT_TEST_TIMEOUT_SECONDS = 600;

export class ParsedCommand {
  constructor({ env = {}, argv, source, metadata = {} }) {
    if (!Array.isArray(argv) || argv.length === 0) {
      throw new Error("regression command must have at least one argv token");
    }
    this.env = Object.freeze({ ...env });
    this.argv = Object.freeze([...argv]);
    this.source = source;
    this.metadata = Object.freeze({ ...metadata });
  }

  withTargets(targetPaths) {
    return new ParsedCommand({
      env: this.env,
      argv: [...this.argv, ...targetPaths],
      source: this.source,
      metadata: this.metadata,
    });
  }

  toString() {
    return this.argv.join(" ");
  }
}

export class RegressionClassification {
  constructor({ required, mode, category = null, reason, changedFiles, triggerRelevantChangedFiles = [], classifiedPaths = [], targetPaths = [] }) {
    this.required = Boolean(required);
    this.mode = mode;
    this.category = category;
    this.reason = reason;
    this.changedFiles = Object.freeze([...(changedFiles || [])]);
    this.triggerRelevantChangedFiles = Object.freeze([...(triggerRelevantChangedFiles || [])]);
    this.classifiedPaths = Object.freeze([...(classifiedPaths || [])]);
    this.targetPaths = Object.freeze([...(targetPaths || [])]);
  }
}

const SHELL_SYNTAX_RE = /(\|\||&&|[|&;<>`$()]|\*|\?|\[|\]|\{|\})/;
const ENV_ASSIGN_RE = /^[A-Za-z_][A-Za-z0-9_]*=/;

export function parseArgvCommand(command, source = "config") {
  if (typeof command !== "string" || command.trim() === "") {
    throw new Error("test.command must be a non-empty string");
  }
  const tokens = [];
  let current = "";
  let quote = null;
  let escaped = false;
  for (const ch of command.trim()) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === "'" || ch === "\"") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (escaped) current += "\\";
  if (quote) throw new Error("test.command has an unterminated quote");
  if (current) tokens.push(current);
  if (tokens.length === 0) throw new Error("test.command produced no argv tokens");
  if (tokens.some((token) => SHELL_SYNTAX_RE.test(token))) {
    throw new Error("test.command contains unsupported shell control or expansion syntax");
  }

  const env = {};
  while (tokens.length > 0 && ENV_ASSIGN_RE.test(tokens[0])) {
    const [key, ...rest] = tokens.shift().split("=");
    env[key] = rest.join("=");
  }
  if (tokens.length === 0) throw new Error("test.command must include a command after env assignments");
  return new ParsedCommand({ env, argv: tokens, source });
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function regressionCommandFromSource(source) {
  if (!source) {
    const err = new Error("no supported project-level regression command found");
    err.commandCandidates = [];
    throw err;
  }
  if (source.kind === "config") return parseArgvCommand(source.command, source.source);
  if (source.kind === "package") {
    return new ParsedCommand({
      argv: ["npm", "test", "--"],
      source: source.source,
      metadata: { script: source.script },
    });
  }
  if (source.kind === "composer") {
    return new ParsedCommand({
      argv: ["composer", "run-script", "test", "--"],
      source: source.source,
      metadata: { script: source.script },
    });
  }
  if (source.kind === "makefile") {
    return new ParsedCommand({
      argv: ["make", "test"],
      source: source.source,
      metadata: { target: source.target },
    });
  }
  throw new Error(`unsupported test command source: ${source.kind}`);
}

export function discoverRegressionCommand(root, config = {}) {
  const pkg = readJsonIfExists(path.join(root, "package.json"));
  const composer = readJsonIfExists(path.join(root, "composer.json"));
  const makefileTestTarget = extractMakeTestTarget(readMakefile(path.join(root, "Makefile")));
  const source = selectTestCommandSource(collectTestCommandSources({
    configuredTestCommand: config?.test?.command || null,
    scripts: pkg?.scripts || null,
    composerScripts: composer?.scripts || null,
    makefileTestTarget,
  }));
  return regressionCommandFromSource(source);
}

function normalizePath(p) {
  return p.split(path.sep).join("/");
}

function isTextLike(filePath) {
  return /\.(md|mdx|txt|json|ya?ml|toml|ini|csv|html?|css|scss|less|xml|svg|lock)$/i.test(filePath);
}

function isRegressionConfigPath(filePath) {
  const base = path.posix.basename(filePath);
  return filePath === ".sdd-forge/config.json" ||
    base === "package.json" ||
    base === "composer.json" ||
    base === "Makefile" ||
    base === "makefile";
}

function isGeneratedSddArtifact(filePath, activeSpec) {
  return filePath.startsWith(`${activeSpec}/`) || filePath.startsWith(".sdd-forge/");
}

function isDocumentationPath(filePath) {
  return /\.(md|mdx|txt|adoc)$/i.test(filePath) || filePath.startsWith("docs/");
}

function isTriggerRelevantFile(filePath, analysisFiles) {
  if (isRegressionConfigPath(filePath)) return true;
  if (analysisFiles.has(filePath) && !isTextLike(filePath)) return true;
  if (!analysisFiles.has(filePath) && !isTextLike(filePath) && !isDocumentationPath(filePath)) return true;
  return false;
}

function classifyNonTrigger(filePath, activeSpec) {
  const normalized = normalizePath(filePath);
  if (isGeneratedSddArtifact(normalized, activeSpec)) {
    return "spec-artifact-only";
  }
  if (isDocumentationPath(normalized)) {
    return "docs-only";
  }
  return "non-project-only";
}

export function isProjectTestPath(filePath, projectPaths = []) {
  const normalized = normalizePath(filePath);
  return projectPaths.some((entry) => {
    if (entry.endsWith("/")) return normalized.startsWith(entry);
    return normalized === entry;
  });
}

function categoryFor(classes) {
  const unique = [...new Set(classes)];
  return unique.length === 1 ? unique[0] : "mixed-non-trigger";
}

export function listRegressionChangedFiles({ root, state }) {
  return listChangedFilesDetailed({ cwd: root, baseBranch: state.baseBranch || "main" });
}

export function classifyRegression({ root, state, analysis, config, changedFiles = null }) {
  changedFiles ||= listRegressionChangedFiles({ root, state });
  const activeSpec = path.dirname(normalizePath(state.spec));
  const projectPaths = config?.test?.projectPaths || [];
  const analysisFiles = analysis && typeof analysis === "object"
    ? projectFilePathsFromAnalysis(analysis, { strict: true })
    : new Set();
  const triggerFiles = [];
  const projectTestFiles = [];
  const nonTrigger = [];

  for (const entry of changedFiles) {
    const p = normalizePath(entry.path);
    if (isProjectTestPath(p, projectPaths)) {
      triggerFiles.push(entry);
      projectTestFiles.push(p);
      continue;
    }
    if (p.startsWith(`${activeSpec}/tests/`)) {
      nonTrigger.push({ path: p, category: "spec-artifact-only" });
      continue;
    }
    if (isTriggerRelevantFile(p, analysisFiles)) {
      triggerFiles.push(entry);
      continue;
    }
    nonTrigger.push({ path: p, category: classifyNonTrigger(p, activeSpec) });
  }

  if (triggerFiles.length === 0) {
    const classes = nonTrigger.map((x) => x.category);
    const category = categoryFor(classes.length ? classes : ["non-project-only"]);
    return new RegressionClassification({
      required: false,
      mode: "none",
      category,
      reason: "no trigger-relevant project files changed",
      changedFiles,
      triggerRelevantChangedFiles: [],
      classifiedPaths: nonTrigger,
    });
  }

  if (triggerFiles.length === projectTestFiles.length && projectTestFiles.length > 0) {
    return new RegressionClassification({
      required: true,
      mode: "targeted",
      reason: "all trigger-relevant changes are configured project-level test files",
      changedFiles: triggerFiles,
      triggerRelevantChangedFiles: triggerFiles,
      targetPaths: projectTestFiles,
    });
  }

  return new RegressionClassification({
    required: true,
    mode: "full",
    reason: "project, config, execution, contract, or unknown files changed",
    changedFiles: triggerFiles,
    triggerRelevantChangedFiles: triggerFiles,
  });
}

export async function runProcessDetailed(command, opts = {}) {
  try {
    const result = await runCmdAsync(command.argv[0], command.argv.slice(1), {
      cwd: opts.cwd,
      timeout: opts.timeoutMs,
      env: { ...process.env, ...command.env },
      maxBuffer: opts.maxBuffer ?? 20 * 1024 * 1024,
    });
    const spawnError = result.errorCode && result.errorCode !== "ETIMEDOUT"
      ? `${result.errorCode}: ${result.stderr || command.argv[0]}`
      : null;
    return {
      started: !spawnError,
      exitCode: result.status,
      signal: result.signal,
      timedOut: Boolean(result.killed),
      spawnError,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (err) {
    return {
      started: false,
      exitCode: 1,
      signal: null,
      timedOut: false,
      spawnError: err.message,
      stdout: "",
      stderr: err.message,
    };
  }
}

export function resolveTestTimeoutSeconds(config = {}) {
  return config?.test?.timeout || config?.agent?.timeout || DEFAULT_TEST_TIMEOUT_SECONDS;
}
