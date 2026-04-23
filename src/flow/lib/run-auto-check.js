/**
 * src/flow/lib/run-auto-check.js
 *
 * `sdd-forge flow run auto-check` — hybrid eligibility check for auto mode.
 *
 * Flow: static gates (keyword match, sync) → AI scoring (1 stateless call) →
 *       compose eligible verdict → persist to active flow.json `autoCheck`
 *       OR to the preparing flow state (.active-flow.<runId>) when no active
 *       flow exists. Persisting to the preparing state is what allows the
 *       subsequent `flow set auto on` to trust this verdict instead of
 *       re-invoking the AI with a different input (spec 218).
 *
 * Spec 208: R1 / R2 / R3 / R4 / R5 / R6 / R13.
 * Spec 218: preparing-flow persistence for split-brain elimination.
 *
 * ctx inputs (merged from CLI by FlowCommand base):
 *   - input: optional --input <text>. Falls back to flow state (request + issue).
 *   - runId: optional --run-id <id>. Selects a specific preparing flow when no
 *            active flow exists and multiple preparing flows are present. When
 *            exactly one preparing flow exists, it is auto-detected.
 */

import { FlowCommand } from "./base-command.js";
import { evaluateStaticGates } from "./auto-check-static.js";
import { resolvePreparingRunId } from "./resolve-preparing-run-id.js";

const PROMPT_TEMPLATE = `You evaluate whether a feature request can safely proceed in SDD "auto mode" —
meaning the AI drafts, specs, and implements without human confirmation loops.

Score the following request on six dimensions (0/1/2 each). Output JSON only,
no prose. Use these exact keys and integer scores:

- specBuildability (weight 3) — can Goal / Scope / Acceptance be derived?
  0 = cannot determine Goal or Acceptance without clarification
  1 = main requirements derivable but some inference needed
  2 = Goal / Scope / Acceptance all directly derivable
- ambiguity (weight 3) — is the input unambiguous?
  0 = multiple plausible interpretations
  1 = minor ambiguity survivable with defaults
  2 = no meaningful ambiguity
- verifiability (weight 2) — can success be verified mechanically?
  0 = no observable criterion
  1 = partially subjective
  2 = clear, testable criterion
- scopeBoundedness (weight 2) — is the scope bounded?
  0 = open-ended
  1 = mostly bounded
  2 = clearly bounded
- targetSpecificity (weight 1) — are the targets specified?
  0 = unclear
  1 = partially specified
  2 = specific files/modules/commands identified
- precedent (weight 1) — is there similar prior work?
  0 = novel
  1 = partial precedent
  2 = clear precedent

Also include a reason field (short string, under 200 chars, Japanese).

Input text (request / Issue body):
---
{{INPUT}}
---

Output JSON shape (no markdown fence, no prose):
{"specBuildability": N, "ambiguity": N, "verifiability": N, "scopeBoundedness": N, "targetSpecificity": N, "precedent": N, "reason": "..."}
`;

const WEIGHTS = {
  specBuildability: 3,
  ambiguity: 3,
  verifiability: 2,
  scopeBoundedness: 2,
  targetSpecificity: 1,
  precedent: 1,
};
const MAX_SCORE = Object.values(WEIGHTS).reduce((a, b) => a + b, 0) * 2; // 24
const THRESHOLD = 18;
const HARD_GATE_KEYS = ["specBuildability", "ambiguity", "verifiability"];
const CATEGORY_KEYS = Object.keys(WEIGHTS);

export function computeScore(breakdown) {
  let total = 0;
  for (const key of CATEGORY_KEYS) {
    const v = Number(breakdown?.[key] ?? 0);
    total += v * WEIGHTS[key];
  }
  return total;
}

export function hardGateFailed(breakdown) {
  return HARD_GATE_KEYS.some((k) => Number(breakdown?.[k] ?? 0) === 0);
}

function resolveInputText(ctx) {
  if (typeof ctx.input === "string" && ctx.input.trim()) return ctx.input.trim();
  const state = ctx.flowState || {};
  const parts = [];
  if (state.request) parts.push(String(state.request));
  if (state.issue) parts.push(`Issue #${state.issue}`);
  return parts.join("\n").trim();
}


function parseAiResponse(text) {
  const cleaned = String(text || "").trim().replace(/^```(?:json)?|```$/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("no JSON object in AI response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function emptyBreakdown() {
  const b = {};
  for (const k of CATEGORY_KEYS) b[k] = 0;
  return b;
}

function sanitizeBreakdown(raw) {
  const b = {};
  for (const k of CATEGORY_KEYS) {
    const v = Number(raw?.[k]);
    b[k] = Number.isFinite(v) ? Math.max(0, Math.min(2, Math.floor(v))) : 0;
  }
  return b;
}

async function scoreWithAi(container, inputText) {
  let agent;
  try {
    agent = container.get("agent");
  } catch (err) {
    return { breakdown: emptyBreakdown(), reason: `agent unavailable: ${err.message}`, ok: false };
  }
  if (!agent?.resolve?.("flow.auto-check")) {
    return { breakdown: emptyBreakdown(), reason: "no agent profile for auto-check", ok: false };
  }
  const prompt = PROMPT_TEMPLATE.replace("{{INPUT}}", inputText);
  let responseText;
  try {
    responseText = await agent.call(prompt, { commandId: "flow.auto-check" });
  } catch (err) {
    return { breakdown: emptyBreakdown(), reason: `agent call failed: ${err.message}`, ok: false };
  }
  let parsed;
  try {
    parsed = parseAiResponse(responseText);
  } catch (err) {
    return { breakdown: emptyBreakdown(), reason: `parse error: ${err.message}`, ok: false };
  }
  return {
    breakdown: sanitizeBreakdown(parsed),
    reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 300) : "",
    ok: true,
  };
}

/**
 * Pure function: given input text and an optional AI result, compute the
 * final autoCheck envelope. Kept separate so set-auto.js can re-use the
 * same shape without re-invoking the CLI.
 */
export function composeAutoCheck({ staticGates, aiBreakdown, aiReason, aiOk }) {
  const staticFail = !staticGates.eligible;
  const breakdown = staticFail ? emptyBreakdown() : aiBreakdown;
  const score = computeScore(breakdown);
  const hardFail = staticFail ? false : hardGateFailed(breakdown);
  const eligible = !staticFail && aiOk && !hardFail && score >= THRESHOLD;
  const reasonParts = [];
  if (staticFail) {
    const hits = ["G", "H", "I"].filter((k) => staticGates[k]);
    reasonParts.push(`static gate hit: ${hits.join(", ")}`);
  }
  if (!staticFail && !aiOk) reasonParts.push(aiReason || "ai call failed");
  if (!staticFail && aiOk && hardFail) {
    const zeros = HARD_GATE_KEYS.filter((k) => Number(breakdown[k]) === 0);
    reasonParts.push(`hard-gate zero: ${zeros.join(", ")}`);
  }
  if (!staticFail && aiOk && !hardFail && score < THRESHOLD) {
    reasonParts.push(`score ${score}/${MAX_SCORE} below threshold ${THRESHOLD}`);
  }
  if (reasonParts.length === 0 && aiReason) reasonParts.push(aiReason);
  return {
    eligible,
    score,
    maxScore: MAX_SCORE,
    threshold: THRESHOLD,
    breakdown,
    staticGates: { G: !!staticGates.G, H: !!staticGates.H, I: !!staticGates.I },
    reason: reasonParts.join("; "),
  };
}

export async function runAutoCheckCore(container, inputText) {
  const staticGates = evaluateStaticGates(inputText);
  let aiResult = { breakdown: emptyBreakdown(), reason: "", ok: true };
  if (staticGates.eligible) {
    aiResult = await scoreWithAi(container, inputText);
  }
  return composeAutoCheck({
    staticGates,
    aiBreakdown: aiResult.breakdown,
    aiReason: aiResult.reason,
    aiOk: aiResult.ok,
  });
}

export default class RunAutoCheckCommand extends FlowCommand {
  constructor() {
    super({ requiresFlow: false });
  }

  async execute(ctx) {
    const input = resolveInputText(ctx);
    const result = await runAutoCheckCore(this.container, input);

    if (ctx.flowManager && ctx.flowState) {
      ctx.flowManager.mutate((state) => {
        state.autoCheck = result;
      });
      return result;
    }

    if (ctx.flowManager) {
      const resolved = resolvePreparingRunId(ctx.flowManager, ctx.runId, {
        type: "run",
        key: "auto-check",
      });
      if (resolved.fail) return resolved.fail;
      if (resolved.runId) {
        ctx.flowManager.mutatePreparingFlow(resolved.runId, (state) => {
          state.autoCheck = result;
        });
      }
    }
    return result;
  }
}
