import fs from "node:fs";
import path from "node:path";
import { runGit } from "../../lib/git-helpers.js";
import { repairJson } from "../../lib/json-parse.js";
import { container } from "../../lib/container.js";
import { PromptBuilder } from "../../lib/prompt-builder.js";
import { FlowCommand } from "./base-command.js";
import {
  applyAcceptanceReviewResult,
  artifactFromAcceptanceJudgments,
  buildAcceptanceReviewContext,
} from "./acceptance-review-artifacts.js";
import {
  buildRepairFingerprint,
  ensureRepairFingerprintContract,
} from "./impl-repair-artifacts.js";
import { RepairArtifactRegistry } from "./repair-state-identity.js";

export const MAX_ACCEPTANCE_REQUEST_CHARS = 900_000;
export const MAX_ACCEPTANCE_RESPONSE_CHARS = 900_000;
const MAX_ACCEPTANCE_UNTRACKED_FILE_SIZE = 1024 * 1024;
const MAX_ACCEPTANCE_GIT_BUFFER_BYTES = (MAX_ACCEPTANCE_REQUEST_CHARS * 4) + 65_536;
const MAX_ACCEPTANCE_SCHEMA_ITEMS = MAX_ACCEPTANCE_RESPONSE_CHARS;
const MAX_ACCEPTANCE_SCHEMA_STRING_CHARS = MAX_ACCEPTANCE_RESPONSE_CHARS;
const ACCEPTANCE_RESPONSE_SCHEMA = Object.freeze({
  type: "object",
  required: ["requirementJudgments"],
  additionalProperties: false,
  properties: {
    requirementJudgments: {
      type: "array",
      items: {
        type: "object",
        required: [
          "requirementId",
          "status",
          "requestRefs",
          "requirementRefs",
          "diffRefs",
          "repairRefs",
          "testRefs",
          "missingEvidence",
        ],
        additionalProperties: false,
        properties: {
          requirementId: { type: "string", minLength: 1, maxLength: MAX_ACCEPTANCE_SCHEMA_STRING_CHARS },
          status: { type: "string", enum: ["met", "notMet", "notVerifiable"] },
          requestRefs: { type: "array", maxItems: MAX_ACCEPTANCE_SCHEMA_ITEMS, items: { type: "string", minLength: 1, maxLength: MAX_ACCEPTANCE_SCHEMA_STRING_CHARS } },
          requirementRefs: { type: "array", maxItems: MAX_ACCEPTANCE_SCHEMA_ITEMS, items: { type: "string", minLength: 1, maxLength: MAX_ACCEPTANCE_SCHEMA_STRING_CHARS } },
          diffRefs: { type: "array", maxItems: MAX_ACCEPTANCE_SCHEMA_ITEMS, items: { type: "string", minLength: 1, maxLength: MAX_ACCEPTANCE_SCHEMA_STRING_CHARS } },
          repairRefs: { type: "array", maxItems: MAX_ACCEPTANCE_SCHEMA_ITEMS, items: { type: "string", minLength: 1, maxLength: MAX_ACCEPTANCE_SCHEMA_STRING_CHARS } },
          testRefs: { type: "array", maxItems: MAX_ACCEPTANCE_SCHEMA_ITEMS, items: { type: "string", minLength: 1, maxLength: MAX_ACCEPTANCE_SCHEMA_STRING_CHARS } },
          missingEvidence: { type: "array", maxItems: MAX_ACCEPTANCE_SCHEMA_ITEMS, items: { type: "string", minLength: 1, maxLength: MAX_ACCEPTANCE_SCHEMA_STRING_CHARS } },
        },
      },
      maxItems: MAX_ACCEPTANCE_SCHEMA_ITEMS,
    },
  },
});

export class AcceptanceBudgetError extends Error {
  constructor(kind, components, limit) {
    const summary = Object.entries(components).map(([name, size]) => `${name}=${size}`).join(", ");
    super(`acceptance ${kind} exceeds ${limit} characters (${summary})`);
    this.name = "AcceptanceBudgetError";
    this.code = kind === "response" ? "ACCEPTANCE_RESPONSE_TOO_LARGE" : "ACCEPTANCE_REQUEST_TOO_LARGE";
    this.components = Object.freeze({ ...components });
    this.limit = limit;
  }
}

function readFixtureArtifact() {
  const file = process.env.SENTI_ACCEPTANCE_REVIEW_ARTIFACT;
  if (!file) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function appendWithinDiffBudget(current, addition, component) {
  const next = current + addition;
  if (next.length > MAX_ACCEPTANCE_REQUEST_CHARS) {
    throw new AcceptanceBudgetError("diff", {
      trackedAndPreviousUntracked: current.length,
      [component]: addition.length,
      total: next.length,
    }, MAX_ACCEPTANCE_REQUEST_CHARS);
  }
  return next;
}

function untrackedDiff(root, fingerprint, registry) {
  let result = "";
  const files = fingerprint.entries.filter((entry) => (
    entry.statuses.includes("worktree:untracked") && !registry.owns(entry.path)
  ));
  for (const entry of files) {
    const absolute = path.join(root, entry.path);
    const stat = fs.lstatSync(absolute, { throwIfNoEntry: false });
    if (!stat || (!stat.isFile() && !stat.isSymbolicLink())) continue;
    if (stat.size > MAX_ACCEPTANCE_UNTRACKED_FILE_SIZE) {
      throw new AcceptanceBudgetError("diff", {
        file: stat.size,
        accumulated: result.length,
      }, MAX_ACCEPTANCE_UNTRACKED_FILE_SIZE);
    }
    let body;
    if (stat.isSymbolicLink()) {
      body = `${fs.readlinkSync(absolute)}\n`;
    } else {
      const bytes = fs.readFileSync(absolute);
      if (bytes.includes(0)) {
        body = null;
      } else {
        const decoded = bytes.toString("utf8");
        body = Buffer.from(decoded, "utf8").equals(bytes) ? decoded : null;
      }
    }
    const header = `diff --git a/${entry.path} b/${entry.path}\nnew file mode ${entry.mode}\n`;
    const patch = body == null
      ? `${header}Binary files /dev/null and b/${entry.path} differ\n`
      : `${header}--- /dev/null\n+++ b/${entry.path}\n@@ -0,0 +1,${body === "" ? 0 : body.split("\n").length - (body.endsWith("\n") ? 1 : 0)} @@\n${body.split("\n").map((line, index, lines) => (
          index === lines.length - 1 && line === "" ? "" : `+${line}`
        )).join("\n")}${body.endsWith("\n") || body === "" ? "" : "\n\\ No newline at end of file"}\n`;
    result = appendWithinDiffBudget(result, patch, `untracked:${entry.path}`);
  }
  return result;
}

export function implementationDiff(root, state) {
  const fingerprint = buildRepairFingerprint({ root, specPath: state.spec, state });
  const registry = new RepairArtifactRegistry(state.spec);
  const result = runGit([
    "diff",
    "--no-ext-diff",
    "--no-color",
    fingerprint.baseline.commitOid,
    "--",
    ".",
    ...registry.gitPathspecExcludes(),
  ], { cwd: root, maxBuffer: MAX_ACCEPTANCE_GIT_BUFFER_BYTES });
  if (result.stdout.length > MAX_ACCEPTANCE_REQUEST_CHARS) {
    throw new AcceptanceBudgetError("diff", { tracked: result.stdout.length }, MAX_ACCEPTANCE_REQUEST_CHARS);
  }
  if (!result.ok) throw new Error(`failed to build acceptance diff: ${result.stderr || result.stdout}`);
  const diff = appendWithinDiffBudget(result.stdout, untrackedDiff(root, fingerprint, registry), "untrackedTotal");
  const verified = buildRepairFingerprint({ root, specPath: state.spec, state });
  if (verified.hash !== fingerprint.hash) {
    throw new Error("repair state changed while building acceptance diff");
  }
  return diff;
}

export function buildAcceptancePrompt(context) {
  const evidence = JSON.stringify(context.evidence, null, 2);
  const prompt = new PromptBuilder()
    .setRole("You are the semantic acceptance reviewer. Judge every requirement against the complete current evidence chain.")
    .setRules([
      "Return JSON only.",
      "Emit exactly one requirementJudgments[] entry for every requirement id in the evidence.",
      "Use status met only when request, requirement, diff, repair/no-repair, and fingerprint-matched test evidence support it.",
      "Use status notMet when the evidence contradicts or fails the requirement.",
      "Use status notVerifiable only when named evidence is unavailable, and list exact missingEvidence reasons.",
      "Every judgment must cite requestRefs, requirementRefs, repairRefs, and the available diffRefs/testRefs.",
    ].join("\n"))
    .setJsonSchema(ACCEPTANCE_RESPONSE_SCHEMA)
    .setFmtFallback(`Return only JSON matching this schema:\n${JSON.stringify(ACCEPTANCE_RESPONSE_SCHEMA)}`)
    .addUserPrompt("## Acceptance Evidence", evidence)
    .build();
  const components = {
    systemPrompt: prompt.systemPrompt?.length || 0,
    userPrompt: prompt.userPrompt.length,
    jsonSchema: JSON.stringify(prompt.jsonSchema).length,
    fmtFallback: prompt.fmtFallback?.length || 0,
  };
  const total = Object.values(components).reduce((sum, size) => sum + size, 0);
  if (total > MAX_ACCEPTANCE_REQUEST_CHARS) {
    throw new AcceptanceBudgetError("request", { ...components, total }, MAX_ACCEPTANCE_REQUEST_CHARS);
  }
  return prompt;
}

export function parseAcceptanceResponse(text) {
  const response = String(text);
  if (response.length > MAX_ACCEPTANCE_RESPONSE_CHARS) {
    throw new AcceptanceBudgetError("response", { response: response.length }, MAX_ACCEPTANCE_RESPONSE_CHARS);
  }
  try {
    return JSON.parse(response);
  } catch (_) {
    return JSON.parse(repairJson(response));
  }
}

export default class RunAcceptanceReviewCommand extends FlowCommand {
  async execute(ctx) {
    const state = ctx.flowManager.load();
    ensureRepairFingerprintContract({ root: ctx.root, state, flowManager: ctx.flowManager });
    const context = buildAcceptanceReviewContext({
      root: ctx.root,
      state,
      diff: implementationDiff(ctx.root, state),
    });
    const fixture = readFixtureArtifact();
    let artifact;
    if (fixture) {
      artifact = artifactFromAcceptanceJudgments({
        context,
        requirementJudgments: fixture.requirementJudgments || [],
      });
    } else if (context.mechanicalBlockers.length > 0) {
      artifact = artifactFromAcceptanceJudgments({ context, requirementJudgments: [] });
    } else {
      const agent = container.get("agent");
      if (!agent.resolve("flow.acceptance.review")) {
        throw new Error("no AI agent configured for flow.acceptance.review");
      }
      const prompt = buildAcceptancePrompt(context);
      const response = await agent.call(prompt.userPrompt, {
        commandId: "flow.acceptance.review",
        systemPrompt: prompt.systemPrompt,
        jsonSchema: prompt.jsonSchema,
        fmtFallback: prompt.fmtFallback,
      });
      const parsed = parseAcceptanceResponse(response);
      artifact = artifactFromAcceptanceJudgments({
        context,
        requirementJudgments: parsed.requirementJudgments,
      });
    }
    const result = applyAcceptanceReviewResult({
      root: ctx.root,
      flowManager: ctx.flowManager,
      artifact,
    });
    return {
      result: "ok",
      verdict: result.verdict,
      artifact_path: result.artifactPath,
      repairFingerprint: result.artifact.repairFingerprint,
      requirementJudgments: result.artifact.requirementJudgments,
      deferredFindings: result.artifact.deferredFindings,
      mechanicalBlockers: result.artifact.mechanicalBlockers,
      hardBlockers: result.artifact.hardBlockers,
      next: result.verdict === "pass"
        ? "final-regression"
        : result.verdict === "repair_required"
          ? "impl-triage"
          : result.verdict === "user_decision_required"
            ? "acceptance-decision"
            : null,
    };
  }
}
