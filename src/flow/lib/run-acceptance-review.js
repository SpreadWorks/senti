import fs from "node:fs";
import path from "node:path";
import { runGit } from "../../lib/git-helpers.js";
import { repairJson } from "../../lib/json-parse.js";
import { container } from "../../lib/container.js";
import { PromptBuilder } from "../../lib/prompt-builder.js";
import { FlowCommand } from "./base-command.js";
import {
  AcceptanceEvidenceBindings,
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
export const MAX_ACCEPTANCE_DEFERRED_REPAIR_CALLS = 1;
const DEFERRED_FINDING_DISPOSITION_ITEM_SCHEMA = Object.freeze({
  type: "object",
  required: ["findingId", "finalDisposition", "evidenceRefs"],
  additionalProperties: false,
  properties: {
    findingId: { type: "string", minLength: 1, maxLength: MAX_ACCEPTANCE_SCHEMA_STRING_CHARS },
    finalDisposition: {
      type: "string",
      enum: ["fixed", "not_needed", "false_positive", "pre_existing", "still_open", "blocking"],
    },
    evidenceRefs: {
      type: "array",
      minItems: 1,
      maxItems: MAX_ACCEPTANCE_SCHEMA_ITEMS,
      items: { type: "string", minLength: 1, maxLength: MAX_ACCEPTANCE_SCHEMA_STRING_CHARS },
    },
  },
});
const ACCEPTANCE_RESPONSE_SCHEMA = Object.freeze({
  type: "object",
  required: ["requirementJudgments", "deferredFindingDispositions"],
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
          requestRefs: { type: "array", maxItems: MAX_ACCEPTANCE_SCHEMA_ITEMS, items: { type: "string", enum: ["flow.request"] } },
          requirementRefs: { type: "array", maxItems: MAX_ACCEPTANCE_SCHEMA_ITEMS, items: { type: "string", minLength: 1, maxLength: MAX_ACCEPTANCE_SCHEMA_STRING_CHARS } },
          diffRefs: { type: "array", maxItems: MAX_ACCEPTANCE_SCHEMA_ITEMS, items: { type: "string", minLength: 1, maxLength: MAX_ACCEPTANCE_SCHEMA_STRING_CHARS } },
          repairRefs: { type: "array", maxItems: MAX_ACCEPTANCE_SCHEMA_ITEMS, items: { type: "string", minLength: 1, maxLength: MAX_ACCEPTANCE_SCHEMA_STRING_CHARS } },
          testRefs: { type: "array", maxItems: MAX_ACCEPTANCE_SCHEMA_ITEMS, items: { type: "string", minLength: 1, maxLength: MAX_ACCEPTANCE_SCHEMA_STRING_CHARS } },
          missingEvidence: { type: "array", maxItems: MAX_ACCEPTANCE_SCHEMA_ITEMS, items: { type: "string", minLength: 1, maxLength: MAX_ACCEPTANCE_SCHEMA_STRING_CHARS } },
        },
      },
      maxItems: MAX_ACCEPTANCE_SCHEMA_ITEMS,
    },
    deferredFindingDispositions: {
      type: "array",
      items: DEFERRED_FINDING_DISPOSITION_ITEM_SCHEMA,
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
      "Emit exactly one deferredFindingDispositions[] entry for every deferred finding whose finalDisposition is still_open or blocking; omit findings that already have a resolved finalDisposition.",
      "Classify each deferred finding as fixed, not_needed, false_positive, pre_existing, still_open, or blocking.",
      "Every deferred disposition must cite its exact sourceRef from deferredFindingEvidence; additional refs must come from the current diff, repair evidence, or test evidence.",
      "A still_open or blocking deferred disposition is an unresolved acceptance risk and routes to explicit acceptance-decision; it is not a mechanical evidence blocker.",
    ].join("\n"))
    .setJsonSchema(ACCEPTANCE_RESPONSE_SCHEMA)
    .setFmtFallback(`Return only JSON matching this schema:\n${JSON.stringify(ACCEPTANCE_RESPONSE_SCHEMA)}`)
    .addUserPrompt("## Acceptance Evidence", evidence)
    .build();
  return assertAcceptancePromptBudget(prompt);
}

function assertAcceptancePromptBudget(prompt) {
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

export class DeferredDispositionCoverage {
  #expectedById;
  #judgments;

  constructor(context, judgments = []) {
    this.#expectedById = new Map(context.deferredFindings
      .filter((finding) => ["still_open", "blocking"].includes(finding.finalDisposition))
      .map((finding) => [finding.findingId, finding]));
    this.#judgments = new Map();
    this.add(judgments);
  }

  add(judgments) {
    if (!Array.isArray(judgments)) throw new Error("deferredFindingDispositions must be an array");
    for (const judgment of judgments) {
      if (!this.#expectedById.has(judgment?.findingId)) {
        throw new Error(`unknown deferred finding disposition: ${judgment?.findingId || "missing-id"}`);
      }
      if (this.#judgments.has(judgment.findingId)) {
        throw new Error(`duplicate deferred finding disposition: ${judgment.findingId}`);
      }
      this.#judgments.set(judgment.findingId, judgment);
    }
    return this;
  }

  get missingFindings() {
    return [...this.#expectedById]
      .filter(([findingId]) => !this.#judgments.has(findingId))
      .map(([, finding]) => finding);
  }

  requireComplete() {
    const [missing] = this.missingFindings;
    if (missing) throw new Error(`missing deferred finding disposition: ${missing.findingId}`);
    return [...this.#expectedById.keys()].map((findingId) => this.#judgments.get(findingId));
  }
}

export function buildDeferredDispositionRepairPrompt(context, missingFindings) {
  if (!Array.isArray(missingFindings) || missingFindings.length === 0) {
    throw new Error("missing deferred findings are required for disposition repair");
  }
  const missingIds = new Set(missingFindings.map((finding) => finding.findingId));
  const evidence = JSON.stringify({
    originalRequest: context.evidence.originalRequest,
    requirements: context.evidence.requirements,
    diff: context.evidence.diff,
    repairEvidence: context.evidence.repairEvidence,
    testEvidence: context.evidence.testEvidence,
    deferredFindings: missingFindings,
    deferredFindingEvidence: context.evidence.deferredFindingEvidence.filter((entry) => (
      missingIds.has(entry.findingId)
    )),
  }, null, 2);
  const schema = {
    type: "object",
    required: ["deferredFindingDispositions"],
    additionalProperties: false,
    properties: {
      deferredFindingDispositions: {
        type: "array",
        minItems: missingFindings.length,
        maxItems: missingFindings.length,
        items: {
          ...DEFERRED_FINDING_DISPOSITION_ITEM_SCHEMA,
          properties: {
            ...DEFERRED_FINDING_DISPOSITION_ITEM_SCHEMA.properties,
            findingId: { type: "string", enum: [...missingIds] },
          },
        },
      },
    },
  };
  const prompt = new PromptBuilder()
    .setRole("You are the semantic acceptance reviewer repairing incomplete deferred-finding coverage without changing prior requirement judgments.")
    .setRules([
      "Return JSON only.",
      "Emit exactly one deferredFindingDispositions[] entry for every supplied deferred finding id.",
      "Classify each finding as fixed, not_needed, false_positive, pre_existing, still_open, or blocking.",
      "Cite the exact sourceRef from deferredFindingEvidence in every entry.",
      `This is the only bounded coverage-repair call; the CLI permits ${MAX_ACCEPTANCE_DEFERRED_REPAIR_CALLS}.`,
    ].join("\n"))
    .setJsonSchema(schema)
    .setFmtFallback(`Return only JSON matching this schema:\n${JSON.stringify(schema)}`)
    .addUserPrompt("## Missing Deferred Finding Evidence", evidence)
    .build();
  return assertAcceptancePromptBudget(prompt);
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

export class AcceptanceResponseBinding {
  constructor(context) {
    this.context = context;
    this.evidenceBindings = new AcceptanceEvidenceBindings(context);
    this.deferredById = new Map(
      context.deferredFindings.map((finding) => [finding.findingId, finding]),
    );
    Object.freeze(this);
  }

  bind(response) {
    if (!Array.isArray(response.requirementJudgments)) {
      throw new Error("requirementJudgments must be an array");
    }
    const deferredFindingDispositions = response.deferredFindingDispositions ?? [];
    if (!Array.isArray(deferredFindingDispositions)) {
      throw new Error("deferredFindingDispositions must be an array");
    }
    const repairRef = this.context.evidence.repairEvidence.ref;
    return {
      requirementJudgments: response.requirementJudgments.map((judgment) => {
        const diffRefs = (judgment.diffRefs || []).filter((ref) => (
          this.evidenceBindings.diffRefs.includes(ref)
        ));
        return {
          ...judgment,
          requestRefs: ["flow.request"],
          requirementRefs: [`spec.json#${judgment.requirementId}`],
          diffRefs: judgment.status !== "notVerifiable" && diffRefs.length === 0
            ? [...this.evidenceBindings.diffRefs]
            : diffRefs,
          repairRefs: [repairRef],
          testRefs: judgment.status === "notVerifiable"
            ? []
            : [`test-execute-result.json#${judgment.requirementId}`, "test-result-review.json"],
        };
      }),
      deferredFindingDispositions: this.bindDeferredFindingDispositions(deferredFindingDispositions),
    };
  }

  bindDeferredFindingDispositions(judgments) {
    if (!Array.isArray(judgments)) throw new Error("deferredFindingDispositions must be an array");
    return judgments.map((judgment) => {
        const finding = this.deferredById.get(judgment.findingId);
        if (!finding) return judgment;
        const sourceRef = `${finding.sourceArtifact}#${finding.sourceFindingId}`;
        const allowedRefs = new Set([
          sourceRef,
          ...this.evidenceBindings.diffRefs,
          ...this.evidenceBindings.repairRefs,
          ...this.evidenceBindings.testRefs,
        ]);
        return {
          ...judgment,
          evidenceRefs: [
            sourceRef,
            ...(judgment.evidenceRefs || []).filter((ref) => ref !== sourceRef && allowedRefs.has(ref)),
          ],
        };
      });
  }
}

export function bindAcceptanceResponse(context, response) {
  return new AcceptanceResponseBinding(context).bind(response);
}

async function callAcceptanceAgent(agent, prompt) {
  const response = await agent.call(prompt.userPrompt, {
    commandId: "flow.acceptance.review",
    systemPrompt: prompt.systemPrompt,
    jsonSchema: prompt.jsonSchema,
    fmtFallback: prompt.fmtFallback,
  });
  return parseAcceptanceResponse(response);
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
        deferredFindingDispositions: fixture.deferredFindingDispositions || [],
      });
    } else if (context.mechanicalBlockers.length > 0) {
      artifact = artifactFromAcceptanceJudgments({ context, requirementJudgments: [] });
    } else {
      const agent = container.get("agent");
      if (!agent.resolve("flow.acceptance.review")) {
        throw new Error("no AI agent configured for flow.acceptance.review");
      }
      const parsed = await callAcceptanceAgent(agent, buildAcceptancePrompt(context));
      const bound = bindAcceptanceResponse(context, parsed);
      const deferredCoverage = new DeferredDispositionCoverage(
        context,
        bound.deferredFindingDispositions,
      );
      const missingFindings = deferredCoverage.missingFindings;
      if (missingFindings.length > 0) {
        const repairParsed = await callAcceptanceAgent(
          agent,
          buildDeferredDispositionRepairPrompt(context, missingFindings),
        );
        const repairBound = new AcceptanceResponseBinding(context)
          .bindDeferredFindingDispositions(repairParsed.deferredFindingDispositions ?? []);
        deferredCoverage.add(repairBound);
      }
      artifact = artifactFromAcceptanceJudgments({
        context,
        requirementJudgments: bound.requirementJudgments,
        deferredFindingDispositions: deferredCoverage.requireComplete(),
      });
    }
    const result = applyAcceptanceReviewResult({
      root: ctx.root,
      flowManager: ctx.flowManager,
      artifact,
      evidenceRefresh: context.evidenceRefresh,
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
      evidenceRefresh: result.evidenceRefresh || null,
      next: result.evidenceRefresh
        ? result.evidenceRefresh.activeStep
        : result.verdict === "pass"
        ? "final-regression"
        : result.verdict === "repair_required"
          ? "impl-triage"
          : result.verdict === "user_decision_required"
            ? "acceptance-decision"
            : null,
    };
  }
}
