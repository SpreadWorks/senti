/**
 * src/flow/lib/set-issue-log.js
 *
 * Record an issue-log entry in specs/<spec>/issue-log.json.
 *
 * ctx.step               — step ID (required)
 * ctx.reason             — why the entry was recorded (required)
 * ctx.trigger            — what triggered the issue (optional)
 * ctx.resolution         — how the issue was resolved (optional)
 * ctx.guardrailCandidate — potential guardrail article to add (optional)
 * ctx.normalizedFindingId — normalized review finding id addressed by repair (optional)
 * ctx.repairRef          — commit hash or changed file references (optional object)
 */

import fs from "fs";
import path from "path";
import { FlowCommand, resolveExplicitTaskOption } from "./base-command.js";
import { resolveTaskIdForEntry } from "../../lib/flow-store.js";
import { Envelope } from "../../lib/flow-envelope.js";

/**
 * Load issue-log.json from specs/<spec>/ directory.
 * @param {string} root - project root
 * @param {string} specPath - relative spec path
 * @returns {{ entries: Object[] }}
 */
export function loadIssueLog(root, specPath) {
  const specDir = path.dirname(path.resolve(root, specPath));
  const logPath = path.join(specDir, "issue-log.json");
  if (fs.existsSync(logPath)) {
    const raw = JSON.parse(fs.readFileSync(logPath, "utf8"));
    if (!raw.entries || !Array.isArray(raw.entries)) {
      throw new Error('Invalid issue-log.json: "entries" must be an array');
    }
    return raw;
  }
  return { entries: [] };
}

/**
 * Save issue-log.json to specs/<spec>/ directory.
 * @param {string} root - project root
 * @param {string} specPath - relative spec path
 * @param {{ entries: Object[] }} issueLog
 */
export function saveIssueLog(root, specPath, issueLog) {
  const specDir = path.dirname(path.resolve(root, specPath));
  const logPath = path.join(specDir, "issue-log.json");
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(logPath, JSON.stringify(issueLog, null, 2) + "\n");
}

const MIN_REASON_LENGTH = 20;
const MIN_OPTIONAL_FIELD_LENGTH = 10;
const COMMIT_HASH_RE = /^[0-9a-f]{7,40}$/i;

function validateReason(reason) {
  if ((reason ?? "").trim().length < MIN_REASON_LENGTH) {
    return Envelope.fail(
      "set",
      "issue-log",
      "INVALID_REASON",
      `--reason must be at least ${MIN_REASON_LENGTH} characters (trimmed). ` +
        `Provide a specific, descriptive reason — placeholder text is rejected.`,
    );
  }
  return null;
}

function validateOptionalIssueLogField(name, value) {
  if (value == null) return null;
  if (value.trim().length < MIN_OPTIONAL_FIELD_LENGTH) {
    return Envelope.fail(
      "set",
      "issue-log",
      "INVALID_FIELD",
      `--${name} must be at least ${MIN_OPTIONAL_FIELD_LENGTH} characters (trimmed) when provided.`,
    );
  }
  return null;
}

function normalizeRepairRef(ctx) {
  if (ctx.repairRef && typeof ctx.repairRef === "object") return ctx.repairRef;
  if (ctx.repairRefCommit) return { commit: String(ctx.repairRefCommit).trim() };
  if (ctx.repairRefFile) return { files: [String(ctx.repairRefFile).trim()] };
  return null;
}

function validateRepairRef(repairRef) {
  if (repairRef == null) return null;
  if (typeof repairRef !== "object") {
    return Envelope.fail("set", "issue-log", "INVALID_REPAIR_REF", "repairRef must be an object");
  }
  if (repairRef.commit != null && !COMMIT_HASH_RE.test(String(repairRef.commit).trim())) {
    return Envelope.fail("set", "issue-log", "INVALID_REPAIR_REF", "--repair-ref-commit must be a commit hash");
  }
  if (repairRef.files != null) {
    if (!Array.isArray(repairRef.files) || repairRef.files.some((file) => String(file || "").trim() === "")) {
      return Envelope.fail("set", "issue-log", "INVALID_REPAIR_REF", "--repair-ref-file values must be non-empty paths");
    }
  }
  if (repairRef.commit == null && repairRef.files == null) {
    return Envelope.fail("set", "issue-log", "INVALID_REPAIR_REF", "repairRef requires commit or files");
  }
  return null;
}

export default class SetIssueLogCommand extends FlowCommand {
  execute(ctx) {
    const { root } = ctx;

    if (!ctx.step || !ctx.reason) {
      return Envelope.fail("set", "issue-log", "INVALID_USAGE", "--step and --reason are required");
    }
    const reasonFail = validateReason(ctx.reason);
    if (reasonFail) return reasonFail;
    const optionalFields = [
      ["trigger", ctx.trigger],
      ["resolution", ctx.resolution],
      ["guardrail-candidate", ctx.guardrailCandidate],
    ];
    for (const [name, value] of optionalFields) {
      const fail = validateOptionalIssueLogField(name, value);
      if (fail) return fail;
    }
    const repairRef = normalizeRepairRef(ctx);
    const repairRefFail = validateRepairRef(repairRef);
    if (repairRefFail) return repairRefFail;

    const state = ctx.flowState;
    const taskId = resolveTaskIdForEntry(state, resolveExplicitTaskOption(ctx));

    const entry = {
      step: ctx.step,
      reason: ctx.reason,
      ...(ctx.trigger && { trigger: ctx.trigger }),
      ...(ctx.resolution && { resolution: ctx.resolution }),
      ...(ctx.guardrailCandidate && { guardrailCandidate: ctx.guardrailCandidate }),
      ...(ctx.normalizedFindingId && { normalizedFindingId: String(ctx.normalizedFindingId).trim() }),
      ...(repairRef && { repairRef }),
      taskId,
      timestamp: new Date().toISOString(),
    };

    const issueLog = loadIssueLog(root, state.spec);
    issueLog.entries.push(entry);
    saveIssueLog(root, state.spec, issueLog);

    return { entry, total: issueLog.entries.length };
  }
}
