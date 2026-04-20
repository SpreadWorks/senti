/**
 * src/flow/lib/run-draft-task.js
 *
 * FlowCommand: `flow run draft-task` — generate an addition task's draft
 * via a tool-driven agent call, gate it with the task-spec full gate,
 * retry on FAIL (feeding the prior gate reasons back into the next prompt),
 * escalate on retry-limit reach, and (when autoApprove is on) auto-approve
 * on PASS.
 *
 * Trust point is gate PASS only (REQ-P3-2). AI-level self-approval is not
 * honored.
 *
 * The agent call is delegated to the binary pointed at by
 * SDD_FORGE_AGENT_STUB when set (test / local dev use), otherwise through
 * the standard `lib/agent.js` path.
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { FlowCommand } from "./base-command.js";
import { container } from "../../lib/container.js";
import { RunGateCommand } from "./run-gate.js";

const DEFAULT_RETRY_MAX = 10;

export class RunDraftTaskCommand extends FlowCommand {
  async execute(ctx) {
    const { root, flowState, config } = ctx;
    const taskId = ctx["task-id"] || ctx.taskId;
    if (!taskId) {
      const e = new Error("missing --task-id");
      e.code = "ARGS_ERROR";
      throw e;
    }
    const task = Array.isArray(flowState?.tasks) ? flowState.tasks.find((t) => t.id === taskId) : null;
    if (!task) {
      const e = new Error(`task not found: ${taskId}`);
      e.code = "TASK_NOT_FOUND";
      throw e;
    }

    const specDir = path.dirname(path.isAbsolute(flowState.spec) ? flowState.spec : path.join(root, flowState.spec));
    const taskDir = path.join(specDir, "tasks", String(taskId));
    fs.mkdirSync(taskDir, { recursive: true });
    const draftPath = path.join(taskDir, "draft.md");
    const relDraft = path.relative(root, draftPath);

    const retryMax = Number(config?.flow?.retry?.max ?? DEFAULT_RETRY_MAX);
    const autoApprove = flowState?.autoApprove === true;

    const gate = new RunGateCommand();

    let attempts = 0;
    let lastGate = null;
    let priorReasons = null;
    while (attempts <= retryMax) {
      attempts += 1;
      const draft = await invokeAgent(ctx, task, priorReasons);
      fs.writeFileSync(draftPath, draft);
      lastGate = await gate.execute({
        ...ctx,
        phase: "task-spec",
        spec: relDraft,
      });
      if (lastGate.result === "pass") break;
      priorReasons = collectGateFeedback(lastGate);
    }

    if (lastGate.result !== "pass") {
      const err = new Error(`draft gate failed after ${attempts} attempts`);
      err.code = "ESCALATE_RETRY_EXHAUSTED";
      err.data = { draftPath: relDraft, attempts, gate: lastGate };
      throw err;
    }

    const fresh = ctx.flowManager.load();
    const t = fresh.tasks.find((x) => x.id === task.id);
    if (t) {
      const draftStep = t.steps.find((s) => s.id === "draft");
      if (draftStep) draftStep.status = "done";
      if (autoApprove) {
        const approvalStep = t.steps.find((s) => s.id === "approval");
        if (approvalStep) approvalStep.status = "done";
      }
      ctx.flowManager.save(fresh);
    }

    return {
      draftPath: relDraft,
      attempts,
      gate: lastGate,
      approvedBy: "gate",
      autoApproved: autoApprove,
      nextStep: autoApprove ? "gate" : "approval",
    };
  }
}

/**
 * Invoke the AI agent (or the stub in SDD_FORGE_AGENT_STUB) to produce a
 * draft string for the given addition task. When `reasons` is a non-empty
 * array of gate entries including FAIL verdicts, they are injected into the
 * prompt so the AI can correct the prior attempt's failures.
 */
async function invokeAgent(ctx, task, reasons) {
  const context = collectContext(ctx, task);
  const prompt = buildDraftPrompt(task, context, reasons);

  const stub = process.env.SDD_FORGE_AGENT_STUB;
  if (stub) {
    const r = spawnSync("node", [stub], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      env: {
        ...process.env,
        SDD_FORGE_TASK_ID: String(task.id),
        SDD_FORGE_TASK_TITLE: String(task.title || ""),
        SDD_FORGE_PARENT_SPEC: context.parentSpec,
        SDD_FORGE_SIBLING_TASKS: JSON.stringify(context.siblingTasks),
        SDD_FORGE_REQUEST: context.request,
        SDD_FORGE_STUB_PROMPT: prompt,
      },
    });
    try {
      const parsed = JSON.parse(r.stdout || "{}");
      return String(parsed.draft ?? "");
    } catch {
      return "";
    }
  }
  // Production path: route through the registered agent.
  let agent = null;
  try {
    agent = container.get("agent");
  } catch (err) {
    process.stderr.write(
      `[sdd-forge] draft-task: agent container.get failed — falling back to empty draft. Detail: ${err.message}\n`,
    );
  }
  if (!agent?.resolve?.("flow.draft-task")) {
    if (agent) {
      process.stderr.write(
        `[sdd-forge] draft-task: agent.resolve("flow.draft-task") returned null — check agent.default / agent.profiles config.\n`,
      );
    }
    return "";
  }
  let response;
  try {
    response = await agent.call(prompt, { commandId: "flow.draft-task" });
  } catch (err) {
    process.stderr.write(`[sdd-forge] draft-task agent call failed: ${err.message}\n`);
    return "";
  }
  return extractDraft(response);
}

/**
 * Build the AI prompt for drafting an addition task.
 *
 * When `reasons` contains one or more `{verdict: "FAIL", ...}` entries from a
 * previous gate attempt, a dedicated `## Previous attempt failed — reasons`
 * section is appended so the AI can correct the prior failures. Non-FAIL
 * entries (PASS / SKIP) are not injected. The initial call (reasons is null
 * or has no FAIL entries) produces a prompt without that section.
 *
 * @param {{id: string, title?: string}} task
 * @param {{parentSpec: string, siblingTasks: Array, request: string}} context
 * @param {Array<{verdict: string, guardrail_id?: string, detail?: string}>|null} [reasons]
 * @returns {string}
 */
export function buildDraftPrompt(task, context, reasons) {
  const header = [
    "You are drafting the requirements document for an addition task in a Spec-Driven Development flow.",
    "",
    "## Addition task",
    `id: ${task.id}`,
    `title: ${task.title || ""}`,
    "",
    "## Parent spec (full text)",
    context.parentSpec,
    "",
    "## Sibling tasks",
    JSON.stringify(context.siblingTasks, null, 2),
    "",
    "## Original request",
    context.request || "(none)",
  ].join("\n");

  const rules = [
    "## Rules",
    "- Output a Markdown document starting with `# Spec: <title>` and containing these headings in order:",
    "  `## Goal`, `## Scope`, `## Requirements`, `## Acceptance Criteria`, `## Clarifications`, `## Open Questions`, `## User Confirmation`, `## Test Strategy`.",
    "- Each requirement must pair a trigger condition (When/If) with an expected behavior (shall).",
    "- Do NOT copy spec text verbatim — synthesize this task's scope from the parent.",
    "- Do NOT self-approve; approval is the job of the gate downstream.",
  ].join("\n");

  const failReasons = Array.isArray(reasons)
    ? reasons.filter((r) => r && r.verdict === "FAIL")
    : [];

  if (failReasons.length === 0) {
    return `${header}\n\n${rules}`;
  }

  const feedback = [
    "## Previous attempt failed — reasons",
    "The prior attempt at this draft failed the task-spec gate on the following guardrails.",
    "Correct these failures in the new draft; do not repeat the same violations.",
    "",
    ...failReasons.map((r) =>
      `- [FAIL] ${r.guardrail_id || "unknown"}: ${r.detail || ""}`.trimEnd(),
    ),
  ].join("\n");

  // Layout is crafted so that removing /## Previous...[\s\S]*?(?=\n## |$)/
  // from the retry prompt yields the initial prompt exactly — the single `\n`
  // before `## Previous` plus the single `\n` at the feedback tail combine
  // into the `\n\n` separator that precedes `## Rules` in the initial prompt.
  return `${header}\n${feedback}\n\n${rules}`;
}

/**
 * Merge gate textCheck issues and guardrail AI reasons into a unified list
 * of FAIL entries for the retry prompt. Text-check issues are wrapped as
 * synthetic FAIL entries with guardrail_id `text-check`.
 */
function collectGateFeedback(gateResult) {
  const reasons = gateResult.artifacts?.reasons ?? [];
  const issues = gateResult.artifacts?.issues ?? [];
  return [
    ...reasons,
    ...issues.map((issue) => ({
      verdict: "FAIL",
      guardrail_id: "text-check",
      detail: String(issue),
    })),
  ];
}

function extractDraft(response) {
  const s = String(response || "").trim();
  const fenced = /```(?:md|markdown)?\s*([\s\S]*?)```/.exec(s);
  if (fenced) return fenced[1].trim();
  return s;
}

function collectContext(ctx, task) {
  const { root, flowState } = ctx;
  const parentSpecPath = path.isAbsolute(flowState.spec)
    ? flowState.spec
    : path.join(root, flowState.spec);
  let parentSpec = "";
  try { parentSpec = fs.readFileSync(parentSpecPath, "utf8"); } catch { parentSpec = ""; }
  const siblings = (flowState.tasks || [])
    .filter((t) => t.id !== task.id)
    .map((t) => ({ id: t.id, title: t.title, origin: t.origin, status: t.status }));
  return {
    parentSpec,
    siblingTasks: siblings,
    request: String(flowState.request || ""),
  };
}

export default RunDraftTaskCommand;
