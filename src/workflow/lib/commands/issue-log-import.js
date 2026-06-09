/**
 * src/workflow/lib/commands/issue-log-import.js
 *
 * senti workflow issue-log-import --spec <path>
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

const BODY_LABELS = Object.freeze({
  ja: {
    target: "対象",
    problem: "問題",
    cause: "原因",
    improvement: "改善方向",
    boardReason: "ボード化する理由",
    currentResolution: "現在の対応",
    fallbackTitle: "再発防止候補",
    observed: "観測内容",
    evidence: "根拠",
    boardReasonWithGuardrail: "再発防止のための guardrail / 手順改善候補として記録されている。",
    boardReasonWithResolution: "再発時に同じ手動対応が必要になり、flow の停止や手戻りにつながる。",
  },
  en: {
    target: "Target",
    problem: "Problem",
    cause: "Cause",
    improvement: "Improvement direction",
    boardReason: "Reason to put on the board",
    currentResolution: "Current resolution",
    fallbackTitle: "follow-up candidate",
    observed: "Observed",
    evidence: "Evidence",
    boardReasonWithGuardrail: "Recorded as a guardrail or procedure improvement candidate to prevent recurrence.",
    boardReasonWithResolution: "Recurrence would require the same manual handling and can stop the flow or create rework.",
  },
});

function labelsFor(sourceLang) {
  return String(sourceLang || "").toLowerCase().startsWith("ja") ? BODY_LABELS.ja : BODY_LABELS.en;
}

function text(value) {
  const normalized = value == null ? "" : String(value).trim();
  return normalized === "" ? null : normalized;
}

function normalizeCategory(category) {
  return ["BUG", "ENHANCE", "OTHER"].includes(category) ? category : "OTHER";
}

function classifyCategory(entry) {
  const haystack = [
    entry?.reason,
    entry?.trigger,
    entry?.resolution,
    entry?.guardrailCandidate,
  ].map((v) => String(v || "").toLowerCase()).join("\n");

  if (/\b(bug|failed?|failure|blocked?|missing|invalid|schema|error|rejected|orphan|lost)\b/.test(haystack)) {
    return "BUG";
  }
  if (/\b(add|support|improve|enhance|guide|guidance|candidate)\b/.test(haystack)) {
    return "ENHANCE";
  }
  return "OTHER";
}

function knownJapaneseSummary(step, entry) {
  const normalizedReason = [
    entry?.reason,
    entry?.trigger,
    entry?.resolution,
    entry?.guardrailCandidate,
  ].map((v) => String(v || "").toLowerCase()).join("\n");
  if (/schema/.test(normalizedReason) && /json/.test(normalizedReason)) {
    return `${step} provider が必須 field を含む JSON を返せない`;
  }
  if (/file-map\.json/.test(normalizedReason) && /missing/.test(normalizedReason)) {
    return `${step} 前に file-map.json 作成手順が明示されない`;
  }
  if (/metric/.test(normalizedReason) && /phase/.test(normalizedReason)) {
    return `${step} の metric 記録 phase 案内が不一致`;
  }
  if (/approval\.approved|draft approval/.test(normalizedReason)) {
    return `${step} 前に draft approval 設定手順が明示されない`;
  }
  if (/priority/.test(normalizedReason)) {
    return `${step} 前に requirement priority 設定手順が明示されない`;
  }
  return null;
}

function buildTitle(entry, sourceLang) {
  const step = text(entry?.step) || "workflow";
  const reason = text(entry?.reason);
  if (String(sourceLang || "").toLowerCase().startsWith("ja")) {
    const known = knownJapaneseSummary(step, entry);
    return known ? `[${classifyCategory(entry)}] ${known}` : `[${classifyCategory(entry)}] ${step} の再発防止候補`;
  }
  const raw = reason || `${step} ${labelsFor(sourceLang).fallbackTitle}`;
  return raw.length > 80 ? `${raw.slice(0, 80)}...` : raw;
}

function buildTarget(entry) {
  const parts = [];
  const step = text(entry?.step);
  if (step) parts.push(`step: ${step}`);
  const phase = text(entry?.phase);
  if (phase) parts.push(`phase: ${phase}`);
  if (Array.isArray(entry?.observations)) {
    for (const observation of entry.observations) {
      const file = text(observation?.where?.file);
      const locator = text(observation?.where?.locator);
      if (file) {
        parts.push(locator ? `${file} (${locator})` : file);
        break;
      }
    }
  }
  return parts.join("\n") || null;
}

function buildProblem(entry, sourceLang, labels) {
  const reason = text(entry?.reason);
  if (!String(sourceLang || "").toLowerCase().startsWith("ja")) return reason;
  const step = text(entry?.step) || "workflow";
  const summary = knownJapaneseSummary(step, entry) || `${step} で再発防止が必要な問題が発生した`;
  return `${summary}。\n\n${labels.observed}: ${reason}`;
}

function buildCause(entry, sourceLang, labels) {
  const trigger = text(entry?.trigger);
  if (!String(sourceLang || "").toLowerCase().startsWith("ja")) return trigger;
  return `次の実行結果から確認できる。\n\n${labels.evidence}: ${trigger}`;
}

function buildImprovement(entry, labels) {
  const candidate = text(entry?.guardrailCandidate);
  const resolution = text(entry?.resolution);
  if (candidate && resolution) {
    return `${candidate}\n\n${labels.currentResolution}: ${resolution}`;
  }
  return candidate || resolution;
}

function isRawDiagnosticEntry(entry) {
  return Boolean(entry?.level || entry?.observations || entry?.failedEvaluations)
    && !text(entry?.guardrailCandidate)
    && !text(entry?.resolution);
}

function isDecisionReadyEntry(entry) {
  return Boolean(
    text(entry?.step)
    && text(entry?.reason)
    && text(entry?.trigger)
    && buildImprovement(entry, BODY_LABELS.en)
    && !isRawDiagnosticEntry(entry),
  );
}

class IssueLogBoardDraftCandidate {
  constructor({ title, body, category, source }) {
    this.title = title;
    this.body = body;
    this.category = normalizeCategory(category);
    this.source = source;
  }
}

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

function entryToCandidate(entry, sourceLang) {
  const labels = labelsFor(sourceLang);
  const target = buildTarget(entry);
  const problem = buildProblem(entry, sourceLang, labels);
  const cause = buildCause(entry, sourceLang, labels);
  let improvement = buildImprovement(entry, labels);
  if (String(sourceLang || "").toLowerCase().startsWith("ja")) {
    improvement = `次の再発防止策を検討する。\n\n${improvement}`;
  }
  const boardReason = text(entry?.guardrailCandidate)
    ? labels.boardReasonWithGuardrail
    : labels.boardReasonWithResolution;
  const body = [
    [`## ${labels.target}`, target],
    [`## ${labels.problem}`, problem],
    [`## ${labels.cause}`, cause],
    [`## ${labels.improvement}`, improvement],
    [`## ${labels.boardReason}`, boardReason],
  ].map(([heading, value]) => `${heading}\n${value}`).join("\n\n");

  return new IssueLogBoardDraftCandidate({
    title: buildTitle(entry, sourceLang),
    body,
    category: classifyCategory(entry),
    source: {
      step: entry?.step ?? null,
      timestamp: entry?.timestamp ?? null,
      target,
      problem,
      cause,
      improvement,
      boardReason,
    },
  });
}

/**
 * Build board-draft candidates from issue-log entries, bounded to `max`.
 * Pure: no board access, no AI. Returns the candidate list and the count of
 * entries omitted by the cap. Entries without enough decision material are
 * skipped instead of being proposed to the user.
 * @param {object[]} entries
 * @param {{max?: number, sourceLang?: string}} [options]
 * @returns {{candidates: object[], omitted: number, skipped: number}}
 */
export function buildCandidates(entries, { max = DEFAULT_MAX_CANDIDATES, sourceLang = "en" } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const eligible = list.filter(isDecisionReadyEntry);
  const capped = eligible.slice(0, max);
  return {
    candidates: capped.map((entry) => entryToCandidate(entry, sourceLang)),
    omitted: Math.max(0, eligible.length - capped.length),
    skipped: list.length - eligible.length,
  };
}

async function refineWithAi(candidates, entries, sourceLang) {
  let agent;
  try {
    agent = container.get("agent");
  } catch {
    return; // no agent wired — keep heuristic candidates
  }
  for (let i = 0; i < candidates.length; i++) {
    const entry = entries[i];
    const fields = `step: ${entry?.step || ""}\nreason: ${entry?.reason || ""}\ntrigger: ${entry?.trigger || ""}\nresolution: ${entry?.resolution || ""}\nguardrailCandidate: ${entry?.guardrailCandidate || ""}`;
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
          [
            `Compose a concise board-draft title and body in ${sourceLang}.`,
            "Only keep follow-up items that are worth tracking on a board.",
            "The body must contain these sections in this order: target, problem, cause, improvement direction, reason to put on the board.",
            "Explain whether the issue is a bug, a missing procedure/feature, or an agent mistake when the evidence supports it.",
            'Output ONLY JSON {"title": "...", "body": "..."}.\n',
            fields,
          ].join("\n"),
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
    const sourceLang = ctx.config?.workflow?.languages?.source ?? ctx.config?.lang ?? "en";

    const { candidates, omitted, skipped } = buildCandidates(entries, { max: DEFAULT_MAX_CANDIDATES, sourceLang });
    if (omitted > 0) {
      console.error(`[workflow issue-log-import] issue-log has ${entries.length} entries; emitting first ${DEFAULT_MAX_CANDIDATES} eligible candidates, omitting ${omitted}.`);
    }

    await refineWithAi(candidates, entries.filter(isDecisionReadyEntry).slice(0, candidates.length), sourceLang);

    // No board writes: approval + `workflow add` creation happen in the skill.
    return { spec: ctx.spec, total: entries.length, skipped, omitted, candidates, boardWrite: false };
  }
}
