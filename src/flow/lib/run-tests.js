/**
 * src/flow/lib/run-tests.js
 *
 * FlowCommand: `flow run tests [--baseline]` — execute the project's test
 * suite in a subprocess, capture its output to a log file, record
 * tool-measured exitCode + per-type counts, then delegate log summarization
 * to an external agent (spec 209). The structured summary is written to
 * `test.summary` (or `test.baseline` with --baseline).
 *
 * Scope (tool-measured part):
 *   - task   → state.currentTaskId != null (REQ-P1-2)
 *   - parent → otherwise
 *
 * Test command resolution order:
 *   1. config.commands.test.{task|parent}
 *   2. package.json scripts inference
 *
 * Log parsing (built-in):
 *   Only extracts total counts from labeled lines (unit / integration /
 *   acceptance). Individual failed test identification is delegated to the
 *   external summarizer agent (spec 209). Framework-specific log parsing
 *   presets have been removed — the agent handles the ambiguous portion.
 *
 * Exit code semantics:
 *   This command has two distinct responsibilities depending on mode, and
 *   the CLI exit code reflects the success/failure of that responsibility
 *   (consistent with exit-code-contract: non-zero on command failure):
 *
 *   - baseline mode (--baseline): the command's job is to capture and
 *     persist a test measurement snapshot. The command succeeds (exit 0)
 *     when the snapshot is written, and fails (non-zero) when the write
 *     itself fails. Test pass/fail is data, not a command outcome.
 *   - head mode (no --baseline): the command's job is to run tests and
 *     report the result. The command fails (non-zero) when tests fail
 *     (throws TESTS_FAILED).
 *
 *   The returned `result.exitCode` always carries the subprocess exit code
 *   (npm test, etc.) regardless of mode. Callers must read this field (or
 *   `result.summary.exitCode`) to determine actual test health.
 */

import { spawnSync, execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { FlowCommand } from "./base-command.js";
import { resolveWorkDir } from "../../lib/config.js";
import { summarizeTestLog } from "./summarize-test-log.js";

const TYPES = ["unit", "integration", "acceptance"];

const LOG_REL = "logs/test-output.log";
const BASELINE_LOG_REL = "logs/baseline-test-output.log";
const BASELINE_WORKTREE_DIR = "baseline-worktree";

function parseCountsFromLog(text) {
  const out = {};
  for (const type of TYPES) {
    const m = new RegExp(`^\\s*${type}\\s*[:=]\\s*(\\d+)\\s*$`, "im").exec(text);
    if (m) out[type] = Number(m[1]);
  }
  if (out.unit == null) {
    const pass = /^\s*#\s*pass\s+(\d+)\s*$/m.exec(text);
    if (pass) out.unit = Number(pass[1]);
    else {
      const mocha = /(\d+)\s+passing/.exec(text);
      if (mocha) out.unit = Number(mocha[1]);
    }
  }
  return out;
}

async function runTestPipeline({ command, cwd, logPath, baseline, flowManager, container }) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });

  const child = spawnSync(command, {
    cwd,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const combined = (child.stdout || "") + (child.stderr || "");
  fs.writeFileSync(logPath, combined);

  const exitCode = child.status ?? 1;
  const counts = parseCountsFromLog(combined);
  flowManager.setTestSummary({ ...counts, exitCode }, { baseline });

  let summarized = "skipped";
  let summarizeError = null;
  let failed = [];
  const agent = container?.get?.("agent");
  if (agent && typeof agent.call === "function") {
    const res = await summarizeTestLog({ agent, log: combined, exitCode, counts });
    if (res.ok) {
      summarized = "ok";
      failed = res.failed;
      flowManager.setTestSummary({ failed }, { baseline, mode: "fallback" });
    } else {
      summarized = "failed";
      summarizeError = res.reason;
    }
  }

  return { exitCode, counts, combined, summarized, summarizeError, failed };
}

function removeWorktreeSafe(wtPath) {
  try {
    execFileSync("git", ["worktree", "remove", "--force", wtPath], { stdio: "ignore" });
  } catch (gitErr) {
    try {
      fs.rmSync(wtPath, { recursive: true, force: true });
    } catch (rmErr) {
      process.stderr.write(`[sdd-forge] warning: failed to clean up baseline worktree at ${wtPath}: ${rmErr.message}\n`);
    }
  }
}

async function withDetachedWorktree(root, baseBranch, workDir, fn) {
  const absWork = path.isAbsolute(workDir) ? workDir : path.join(root, workDir);
  const wtPath = path.join(absWork, BASELINE_WORKTREE_DIR);

  if (fs.existsSync(wtPath)) removeWorktreeSafe(wtPath);

  execFileSync("git", ["worktree", "add", "--detach", wtPath, baseBranch], {
    cwd: root,
    stdio: "ignore",
  });

  try {
    return await fn(wtPath);
  } finally {
    removeWorktreeSafe(wtPath);
  }
}

async function captureBaselineInWorktree(ctx) {
  const { root, flowState, flowManager, config, container } = ctx;
  const baseBranch = flowState?.baseBranch;
  if (!baseBranch) throw new Error("baseBranch not available in flow state");

  const scope = flowState?.currentTaskId != null ? "task" : "parent";
  const command = resolveTestCommand({ root, config, scope });
  if (!command) throw new Error("no test command resolvable for baseline");

  const workDir = resolveWorkDir(root, config);
  const absWork = path.isAbsolute(workDir) ? workDir : path.join(root, workDir);
  const logPath = path.join(absWork, BASELINE_LOG_REL);

  await withDetachedWorktree(root, baseBranch, workDir, async (wtPath) => {
    await runTestPipeline({
      command,
      cwd: wtPath,
      logPath,
      baseline: true,
      flowManager,
      container,
    });
  });
}

export class RunTestsCommand extends FlowCommand {
  async execute(ctx) {
    const { root, flowState, flowManager, config, container } = ctx;
    const baseline = Boolean(ctx.baseline);

    if (!baseline && !flowState?.test?.baseline) {
      try {
        await captureBaselineInWorktree(ctx);
      } catch (err) {
        process.stderr.write(`[sdd-forge] warning: baseline auto-capture failed: ${err.message}\n`);
      }
    }

    const scope = flowState?.currentTaskId != null ? "task" : "parent";
    const command = resolveTestCommand({ root, config, scope });
    if (!command) {
      const err = new Error(
        "no test command resolvable: neither config.commands.test nor package.json scripts.test is set",
      );
      err.code = "NO_TEST_COMMAND";
      throw err;
    }

    const workDir = resolveWorkDir(root, config);
    const absWork = path.isAbsolute(workDir) ? workDir : path.join(root, workDir);
    const logRel = baseline ? BASELINE_LOG_REL : LOG_REL;
    const logPath = path.join(absWork, logRel);

    const pipeResult = await runTestPipeline({
      command,
      cwd: root,
      logPath,
      baseline,
      flowManager,
      container,
    });

    const result = {
      scope,
      command,
      exitCode: pipeResult.exitCode,
      logPath: path.relative(root, logPath),
      summary: { ...pipeResult.counts, exitCode: pipeResult.exitCode, ...(pipeResult.failed.length ? { failed: pipeResult.failed } : {}) },
      summarized: pipeResult.summarized,
      baseline,
    };
    if (pipeResult.summarizeError) result.summarizeError = pipeResult.summarizeError;

    if (pipeResult.exitCode !== 0 && !baseline) {
      const err = new Error(`tests failed with exit code ${pipeResult.exitCode}`);
      err.code = "TESTS_FAILED";
      err.data = result;
      err.exitCode = pipeResult.exitCode;
      throw err;
    }
    return result;
  }
}

function resolveTestCommand({ root, config, scope }) {
  const explicit = config?.commands?.test?.[scope];
  if (explicit) return explicit;
  const pkg = readPkgScripts(root);
  if (scope === "task") {
    if (pkg["test:unit"]) return "npm run test:unit";
    if (pkg.test) return "npm test";
    return null;
  }
  return pkg.test ? "npm test" : null;
}

function readPkgScripts(root) {
  const p = path.join(root, "package.json");
  if (!fs.existsSync(p)) return {};
  try {
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    return j.scripts || {};
  } catch {
    return {};
  }
}

export default RunTestsCommand;
