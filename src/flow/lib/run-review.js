/**
 * src/flow/lib/run-review.js
 *
 * FlowCommand: review — wraps `flow commands/review.js` for AI code quality review.
 * Runs review as a subprocess and parses its output.
 */

import { PKG_DIR } from "../../lib/cli.js";
import { runCmd } from "../../lib/process.js";
const DEFAULT_AGENT_TIMEOUT_MS = 300_000;
import { VALID_REVIEW_PHASES } from "../../lib/constants.js";
import { FlowCommand } from "./base-command.js";
import path from "path";

const PHASE_REVIEW_PARSERS = {
  test:  { countPattern: /gaps=(\d+)/,   countKey: "gapCount",   countWord: "gap(s)",   label: "Test review",  next: "implement" },
  spec:  { countPattern: /issues=(\d+)/, countKey: "issueCount", countWord: "issue(s)", label: "Spec review",  next: "approval" },
  draft: { countPattern: /issues=(\d+)/, countKey: "issueCount", countWord: "issue(s)", label: "Draft review", next: "gate-draft" },
};

function parsePhaseReviewOutput(res, stdout, stderr, { phase, countPattern, countKey, countWord, label, next }) {
  const verdictMatch = stderr.match(/verdict=(PASS|FAIL)/);
  const countMatch = stderr.match(countPattern);
  const reviewPathMatch = stderr.match(/Results saved to (\S+)/);

  const verdict = verdictMatch ? verdictMatch[1] : (res.ok ? "PASS" : "FAIL");
  const count = countMatch ? parseInt(countMatch[1], 10) : null;

  const changed = [];
  if (reviewPathMatch) changed.push(reviewPathMatch[1]);

  if (!res.ok) {
    const detail = count === 0
      ? `${label} subprocess error (0 ${countWord} reported but process exited with error)`
      : count !== null
        ? `${label} FAIL: ${count} ${countWord} remaining`
        : `${label} failed (subprocess error)`;
    throw new Error(
      [detail, ...(stderr ? [stderr] : []), ...(stdout ? [stdout] : [])].join("\n"),
    );
  }

  return {
    result: "ok",
    changed,
    artifacts: { phase, verdict, [countKey]: count ?? 0 },
    next,
    output: stdout,
  };
}

function parseTestReviewOutput(res, stdout, stderr) {
  return parsePhaseReviewOutput(res, stdout, stderr, { phase: "test", ...PHASE_REVIEW_PARSERS.test });
}

function parseSpecReviewOutput(res, stdout, stderr) {
  return parsePhaseReviewOutput(res, stdout, stderr, { phase: "spec", ...PHASE_REVIEW_PARSERS.spec });
}

function parseDraftReviewOutput(res, stdout, stderr) {
  return parsePhaseReviewOutput(res, stdout, stderr, { phase: "draft", ...PHASE_REVIEW_PARSERS.draft });
}

export { parseTestReviewOutput, parseSpecReviewOutput, parseDraftReviewOutput };

const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY_MS = 3000;

/**
 * Run a command function with retry logic.
 *
 * @param {function} cmdFn - Function that returns { ok, status, stdout, stderr, signal, killed }
 * @param {Object} [opts]
 * @param {number} [opts.retryCount=2] - Number of retries (total attempts = retryCount + 1)
 * @param {number} [opts.retryDelayMs=3000] - Delay between retries in milliseconds
 * @returns {Promise<{ ok: boolean, status: number, stdout: string, stderr: string, signal: string|null, killed: boolean }>}
 */
export async function runCmdWithRetry(cmdFn, opts = {}) {
  const retryCount = opts.retryCount ?? DEFAULT_RETRY_COUNT;
  const retryDelayMs = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  let lastRes;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    lastRes = cmdFn();
    if (lastRes.ok) return lastRes;

    // Do not retry on killed/signal (timeout, external termination)
    if (lastRes.signal || lastRes.killed) return lastRes;

    if (attempt < retryCount) {
      const next = attempt + 2;
      const total = retryCount + 1;
      process.stderr.write(`[review] retry ${next}/${total} after ${retryDelayMs}ms...\n`);
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
  return lastRes;
}

export class RunReviewCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const phase = ctx.phase || null;

    if (phase && !VALID_REVIEW_PHASES.includes(phase)) {
      throw new Error(`invalid phase: ${phase} (valid: ${VALID_REVIEW_PHASES.join(", ")})`);
    }

    const dryRun = ctx.dryRun || false;
    const skipConfirm = ctx.skipConfirm || false;

    const scriptPath = path.join(PKG_DIR, "flow", "commands", "review.js");
    const args = [];
    if (phase) args.push("--phase", phase);
    if (dryRun) args.push("--dry-run");
    if (skipConfirm) args.push("--skip-confirm");

    const agentTimeout = ctx.config?.agent?.timeout;
    const timeoutMs = agentTimeout != null ? Number(agentTimeout) * 1000 : DEFAULT_AGENT_TIMEOUT_MS;
    const res = await runCmdWithRetry(
      () => runCmd("node", [scriptPath, ...args], { cwd: root, timeout: timeoutMs }),
    );

    const stdout = (res.stdout || "").trim();
    const stderr = (res.stderr || "").trim();

    // Route to draft review parser
    if (phase === "draft") {
      return parseDraftReviewOutput(res, stdout, stderr);
    }

    // Route to test review parser
    if (phase === "test") {
      return parseTestReviewOutput(res, stdout, stderr);
    }

    // Route to spec review parser
    if (phase === "spec") {
      return parseSpecReviewOutput(res, stdout, stderr);
    }

    if (!res.ok) {
      throw new Error(
        ["review command failed", ...(stderr ? [stderr] : []), ...(stdout ? [stdout] : [])].join("\n"),
      );
    }

    // Parse proposal counts from stderr (review writes progress to stderr)
    const proposalMatch = stderr.match(/(\d+) proposal\(s\) generated/);
    const approvedMatch = stderr.match(/(\d+) approved/);
    const rejectedMatch = stderr.match(/(\d+) rejected/);
    const reviewPathMatch = stderr.match(/Results saved to (\S+)/);

    const proposalCount = proposalMatch ? parseInt(proposalMatch[1], 10) : 0;
    const approved = approvedMatch ? parseInt(approvedMatch[1], 10) : 0;
    const rejected = rejectedMatch ? parseInt(rejectedMatch[1], 10) : 0;
    const noChanges = /No changes detected/i.test(stdout);
    const noProposals = /No improvement proposals found/i.test(stdout) || /NO_PROPOSALS/.test(stdout);

    const changed = [];
    if (reviewPathMatch) changed.push(reviewPathMatch[1]);

    const next = noChanges || noProposals || approved === 0 ? "finalize" : "apply";

    return {
      result: noChanges ? "no-changes" : noProposals ? "no-proposals" : "ok",
      changed,
      artifacts: {
        proposalCount,
        approved,
        rejected,
      },
      next,
      output: stdout,
    };
  }
}

export default RunReviewCommand;
