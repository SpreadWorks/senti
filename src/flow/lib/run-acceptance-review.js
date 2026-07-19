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
import { collectUntrackedDiff } from "./run-gate.js";

const MAX_ACCEPTANCE_PROMPT_CHARS = 900_000;
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
          requirementId: { type: "string", minLength: 1 },
          status: { type: "string", enum: ["met", "notMet", "notVerifiable"] },
          requestRefs: { type: "array", items: { type: "string", minLength: 1 } },
          requirementRefs: { type: "array", items: { type: "string", minLength: 1 } },
          diffRefs: { type: "array", items: { type: "string", minLength: 1 } },
          repairRefs: { type: "array", items: { type: "string", minLength: 1 } },
          testRefs: { type: "array", items: { type: "string", minLength: 1 } },
          missingEvidence: { type: "array", items: { type: "string", minLength: 1 } },
        },
      },
    },
  },
});

function readFixtureArtifact() {
  const file = process.env.SENTI_ACCEPTANCE_REVIEW_ARTIFACT;
  if (!file) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function isAcceptanceDiffPath(file, state) {
  const normalized = String(file || "").replace(/\\/g, "/");
  const specPath = state.spec.replace(/\\/g, "/");
  const specDir = path.posix.dirname(specPath);
  const specTests = `${specDir}/tests/`;
  const rawEvidence = `${specTests}.raw/`;
  return normalized === ".senti/config.json"
    || normalized === specPath
    || normalized.startsWith("src/")
    || normalized.startsWith("plugins/")
    || (normalized.startsWith(specTests) && !normalized.startsWith(rawEvidence));
}

async function implementationDiff(root, state) {
  const specPath = state.spec.replace(/\\/g, "/");
  const specDir = path.posix.dirname(specPath);
  const result = runGit([
    "diff",
    "--no-ext-diff",
    state.baseBranch || "main",
    "--",
    "src/",
    "plugins/",
    ".senti/config.json",
    specPath,
    `${specDir}/tests/`,
  ], { cwd: root });
  if (!result.ok) throw new Error(`failed to build acceptance diff: ${result.stderr || result.stdout}`);
  const untracked = await collectUntrackedDiff(root, {
    maxFiles: 500,
    maxFileSize: 1024 * 1024,
    excludeFile: (file) => !isAcceptanceDiffPath(file, state),
  });
  const diff = `${result.stdout}${untracked}`;
  if (diff.length > MAX_ACCEPTANCE_PROMPT_CHARS) {
    throw new Error(`acceptance diff exceeds ${MAX_ACCEPTANCE_PROMPT_CHARS} characters`);
  }
  return diff;
}

function buildAcceptancePrompt(context) {
  const evidence = JSON.stringify(context.evidence, null, 2);
  if (evidence.length > MAX_ACCEPTANCE_PROMPT_CHARS) {
    throw new Error(`acceptance evidence exceeds ${MAX_ACCEPTANCE_PROMPT_CHARS} characters`);
  }
  return new PromptBuilder()
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
}

function parseAcceptanceResponse(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return JSON.parse(repairJson(text));
  }
}

export default class RunAcceptanceReviewCommand extends FlowCommand {
  async execute(ctx) {
    const state = ctx.flowManager.load();
    const context = buildAcceptanceReviewContext({
      root: ctx.root,
      state,
      diff: await implementationDiff(ctx.root, state),
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
