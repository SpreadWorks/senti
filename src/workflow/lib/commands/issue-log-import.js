/**
 * src/workflow/lib/commands/issue-log-import.js
 *
 * sdd-forge workflow issue-log-import --spec <path>
 *
 * Read a spec's issue-log.json and emit its entries as board-draft *candidates*
 * (JSON only — this command performs NO board writes). User approval and the
 * actual `workflow add` draft creation are orchestrated by the finalize-cleanup
 * skill, which keeps the interactive approval boundary outside this single-shot,
 * non-interactive command.
 *
 * AI (classify / compose) is used best-effort to refine candidate category and
 * title/body; its accuracy is not part of the acceptance contract. The
 * `similarity` commandId is reserved for skill-side dedup against existing board
 * items (the board is not loaded here).
 */

import fs from "node:fs";
import path from "node:path";
import { WorkflowCommand } from "../base-command.js";
import { parseJsonResponse } from "../board-helpers.js";
import { container } from "../../../lib/container.js";

export const DEFAULT_MAX_CANDIDATES = 200;

export const ISSUE_LOG_IMPORT_COMMAND_IDS = Object.freeze([
  "workflow.issue-log-import.classify",
  "workflow.issue-log-import.similarity",
  "workflow.issue-log-import.compose",
]);

const [CLASSIFY_ID, , COMPOSE_ID] = ISSUE_LOG_IMPORT_COMMAND_IDS;

/**
 * Validate the --spec argument and resolve the issue-log.json path under it.
 * Accepts either the spec directory or a file inside it.
 * @param {string} specPath
 * @param {string} [root]
 * @returns {string} absolute path to the spec's issue-log.json
 * @throws {Error} with code INVALID_ARGS when the path or log file is missing
 */
export function validateSpecPath(specPath, root = process.cwd()) {
  if (typeof specPath !== "string" || specPath.trim() === "") {
    const err = new Error("--spec <path> is required");
    err.code = "INVALID_ARGS";
    throw err;
  }
  const resolved = path.resolve(root, specPath);
  const dir = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()
    ? resolved
    : path.dirname(resolved);
  const logPath = path.join(dir, "issue-log.json");
  if (!fs.existsSync(logPath)) {
    const err = new Error(`issue-log.json not found for --spec "${specPath}" (looked in ${dir})`);
    err.code = "INVALID_ARGS";
    throw err;
  }
  return logPath;
}

function entryToCandidate(entry) {
  const reason = String(entry?.reason || "").trim();
  const title = reason.length > 60 ? `${reason.slice(0, 60)}…` : reason || "(no reason)";
  const parts = [];
  if (entry?.reason) parts.push(`reason: ${entry.reason}`);
  if (entry?.trigger) parts.push(`trigger: ${entry.trigger}`);
  if (entry?.resolution) parts.push(`resolution: ${entry.resolution}`);
  if (entry?.guardrailCandidate) parts.push(`guardrail-candidate: ${entry.guardrailCandidate}`);
  return {
    title,
    body: parts.join("\n\n"),
    category: "OTHER",
    source: { step: entry?.step ?? null, timestamp: entry?.timestamp ?? null },
  };
}

/**
 * Build board-draft candidates from issue-log entries, bounded to `max`.
 * Pure: no board access, no AI. Returns the candidate list and the count of
 * entries omitted by the cap.
 * @param {object[]} entries
 * @param {{max?: number}} [options]
 * @returns {{candidates: object[], omitted: number}}
 */
export function buildCandidates(entries, { max = DEFAULT_MAX_CANDIDATES } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const capped = list.slice(0, max);
  return {
    candidates: capped.map(entryToCandidate),
    omitted: Math.max(0, list.length - capped.length),
  };
}

async function refineWithAi(candidates, entries) {
  let agent;
  try {
    agent = container.get("agent");
  } catch {
    return; // no agent wired — keep heuristic candidates
  }
  for (let i = 0; i < candidates.length; i++) {
    const entry = entries[i];
    const fields = `reason: ${entry?.reason || ""}\ntrigger: ${entry?.trigger || ""}\nresolution: ${entry?.resolution || ""}`;
    try {
      if (agent.resolve(CLASSIFY_ID)) {
        const out = await agent.call(
          `Classify this engineering log entry as exactly one of BUG, ENHANCE, or OTHER. Output only the label.\n\n${fields}`,
          { commandId: CLASSIFY_ID, retryCount: 1 },
        );
        const label = String(out).trim().toUpperCase();
        if (["BUG", "ENHANCE", "OTHER"].includes(label)) candidates[i].category = label;
      }
    } catch { /* keep heuristic category */ }
    try {
      if (agent.resolve(COMPOSE_ID)) {
        const out = await agent.call(
          `Compose a concise board-draft title and body (in the log's own language) summarizing this engineering log entry. Output ONLY JSON {"title": "...", "body": "..."}.\n\n${fields}`,
          { commandId: COMPOSE_ID, retryCount: 1 },
        );
        const j = parseJsonResponse(out);
        if (j?.title) candidates[i].title = j.title;
        if (j?.body) candidates[i].body = j.body;
      }
    } catch { /* keep heuristic title/body */ }
  }
}

export default class IssueLogImportCommand extends WorkflowCommand {
  async execute(ctx) {
    const logPath = validateSpecPath(ctx.spec, ctx.root);
    const raw = JSON.parse(fs.readFileSync(logPath, "utf8"));
    const entries = Array.isArray(raw.entries) ? raw.entries : [];

    const { candidates, omitted } = buildCandidates(entries, { max: DEFAULT_MAX_CANDIDATES });
    if (omitted > 0) {
      console.error(`[workflow issue-log-import] issue-log has ${entries.length} entries; emitting first ${DEFAULT_MAX_CANDIDATES}, omitting ${omitted}.`);
    }

    await refineWithAi(candidates, entries.slice(0, candidates.length));

    // No board writes: approval + `workflow add` creation happen in the skill.
    return { spec: ctx.spec, total: entries.length, omitted, candidates, boardWrite: false };
  }
}
