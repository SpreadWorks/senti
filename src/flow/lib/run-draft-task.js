/**
 * src/flow/lib/run-draft-task.js
 *
 * FlowCommand: `flow run draft-task` — generate an addition task's draft
 * via a tool-driven agent call, gate it, retry on FAIL, escalate on
 * retry-limit reach, and (when autoApprove is on) auto-approve on PASS.
 *
 * Trust point is gate PASS only (REQ-P3-2). AI-level self-approval is not
 * honored.
 *
 * The agent call is delegated to the binary pointed at by
 * SDD_FORGE_AGENT_STUB when set (test / local dev use), otherwise
 * through the standard `lib/agent.js` path.
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { FlowCommand } from "./base-command.js";
import { container } from "../../lib/container.js";

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

    const retryMax = Number(config?.flow?.retry?.max ?? DEFAULT_RETRY_MAX);
    const autoApprove = flowState?.autoApprove === true;

    let attempts = 0;
    let lastGate = null;
    let draft = "";
    while (attempts <= retryMax) {
      attempts += 1;
      draft = await invokeAgent(ctx, task);
      fs.writeFileSync(draftPath, draft);
      lastGate = simpleGate(draft);
      if (lastGate.result === "pass") break;
    }

    const relDraft = path.relative(root, draftPath);
    if (lastGate.result !== "pass") {
      const err = new Error(`draft gate failed after ${attempts} attempts`);
      err.code = "ESCALATE_RETRY_EXHAUSTED";
      err.data = { draftPath: relDraft, attempts, gate: lastGate };
      throw err;
    }

    // On gate PASS, persist task step transition: draft → done.
    // When autoApprove is on, also mark approval done so the next
    // addition task step can be picked up without a manual step.
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
 * draft string for the given addition task.
 */
async function invokeAgent(ctx, task) {
  const context = collectContext(ctx, task);
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
  let agent;
  try { agent = container.get("agent"); } catch { agent = null; }
  if (!agent?.resolve?.("flow.draft-task")) return "";
  const prompt = buildDraftPrompt(task, context);
  let response;
  try {
    response = await agent.call(prompt, { commandId: "flow.draft-task" });
  } catch (err) {
    process.stderr.write(`[sdd-forge] draft-task agent call failed: ${err.message}\n`);
    return "";
  }
  return extractDraft(response);
}

function buildDraftPrompt(task, context) {
  return [
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
    "",
    "## Rules",
    "- Output a Markdown draft starting with `# Draft: <title>` and containing `## Goal`, `## Scope`, `## Requirements`, `## Test Strategy`, `## Q&A`.",
    "- Do NOT copy spec text verbatim — synthesize this task's scope from the parent.",
    "- Do NOT self-approve; approval is the job of the gate downstream.",
  ].join("\n");
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

/**
 * Minimal gate: a non-empty draft that contains at least one `## Goal`
 * heading passes. Full gate integration (guardrail AI compliance) will be
 * layered on top once the agent path is wired.
 */
function simpleGate(draft) {
  const trimmed = (draft || "").trim();
  if (!trimmed) return { result: "fail", reason: "empty draft" };
  if (!/##\s+Goal\b/i.test(trimmed)) return { result: "fail", reason: "missing Goal section" };
  return { result: "pass" };
}

export default RunDraftTaskCommand;
