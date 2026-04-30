/**
 * src/flow/lib/run-retro.js
 *
 * FlowCommand: retro — evaluate spec accuracy after implementation by comparing
 * spec requirements against git diff. Saves retro.json in the spec directory.
 */

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { runGit } from "../../lib/git-helpers.js";
import { container } from "../../lib/container.js";
import { repairJson } from "../../lib/json-parse.js";
import { getSpecName } from "../../lib/flow-helpers.js";
import { loadSpecJson, normalizeRequirements, resolveSpecDir } from "../../lib/spec-json.js";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { loadTestMap, isTestNotRequired, parseTapOutput, extractReqResults, evaluateReqByResults } from "./req-map.js";
import { PromptBuilder } from "../../lib/prompt-builder.js";

/**
 * Build the requirements text block from spec.json.requirements. Replaces the
 * former regex-based spec.md section extraction (spec 207 / T8).
 */
function requirementsAsText(reqs) {
  if (!Array.isArray(reqs) || reqs.length === 0) return "";
  return reqs
    .map((r) => `- ${r.id}${r.priority ? ` [${r.priority}]` : ""}: ${r.desc}`)
    .join("\n");
}

/**
 * Get git diff between base branch and HEAD.
 */
function getDiff(root, baseBranch) {
  const res = runGit(["diff", `${baseBranch}...HEAD`, "--stat"], { cwd: root });
  return res.ok ? res.stdout.trim() : "";
}

/**
 * Get detailed diff for AI evaluation.
 */
function getDetailedDiff(root, baseBranch) {
  const res = runGit(["diff", `${baseBranch}...HEAD`], { cwd: root });
  return res.ok ? res.stdout.trim() : "";
}

/**
 * Build the prompt for AI evaluation.
 */
const RETRO_SCHEMA = {
  type: "object",
  properties: {
    requirements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          desc: { type: "string" },
          status: { type: "string", enum: ["done", "partial", "not_done"] },
          note: { type: "string" },
        },
        required: ["desc", "status", "note"],
        additionalProperties: false,
      },
    },
    unplanned: {
      type: "array",
      items: {
        type: "object",
        properties: {
          file: { type: "string" },
          change: { type: "string" },
        },
        required: ["file", "change"],
        additionalProperties: false,
      },
    },
    summary: {
      type: "object",
      properties: { notes: { type: "string" } },
      required: ["notes"],
      additionalProperties: false,
    },
  },
  required: ["requirements", "unplanned", "summary"],
  additionalProperties: false,
};

const RETRO_FMT_FALLBACK = 'Output ONLY valid JSON in this exact format (no markdown fencing, no preamble):\n{"requirements": [{"desc": "...", "status": "done|partial|not_done", "note": "..."}], "unplanned": [{"file": "...", "change": "..."}], "summary": {"notes": "..."}}';

function buildRetroPrompt(requirementsText, requirements, diff) {
  const reqList = requirements.map((r, i) => `  ${i + 1}. ${r.desc}`).join("\n");

  const pb = new PromptBuilder();
  pb.setRole("You are evaluating the accuracy of a feature specification after implementation.\nCompare the spec requirements against the actual code changes (git diff) and produce a JSON evaluation.");

  const rules = [
    "For each requirement in the Requirements List, evaluate whether the diff satisfies it.",
    "Also identify any changes in the diff that are NOT covered by any requirement (unplanned changes).",
  ].join("\n");
  pb.setRules(rules);
  pb.setJsonSchema(RETRO_SCHEMA);
  pb.setFmtFallback(RETRO_FMT_FALLBACK);

  pb.add("## Spec Requirements", requirementsText);
  pb.add("## Requirements List (from flow.json)", reqList);
  pb.add("## Git Diff", diff);

  return pb;
}

/**
 * Parse AI response into retro data structure.
 * Adds computed summary fields.
 */
function parseRetroResponse(response, requirements) {
  const cleaned = response.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim();
  let data;
  try {
    data = JSON.parse(cleaned);
  } catch (_) {
    data = JSON.parse(repairJson(cleaned));
  }

  // Ensure requirements array matches flow.json length
  const reqs = (data.requirements || []).slice(0, requirements.length);
  while (reqs.length < requirements.length) {
    reqs.push({ desc: requirements[reqs.length].desc, status: "not_done", note: "not evaluated" });
  }

  // Compute summary stats
  const total = reqs.length;
  const done = reqs.filter((r) => r.status === "done").length;
  const partial = reqs.filter((r) => r.status === "partial").length;
  const notDone = reqs.filter((r) => r.status === "not_done").length;
  const rate = total > 0 ? (done + partial * 0.5) / total : 0;

  return {
    requirements: reqs,
    unplanned: data.unplanned || [],
    summary: {
      total,
      done,
      partial,
      not_done: notDone,
      rate: Math.round(rate * 100) / 100,
      notes: data.summary?.notes || "",
    },
  };
}

export class RunRetroCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const force = ctx.force || false;
    const dryRun = ctx.dryRun || false;

    const state = ctx.flowState;

    const specPath = state.spec;
    const specDir = path.resolve(root, path.dirname(specPath));
    const retroPath = path.join(specDir, "retro.json");

    // Check existing retro.json
    if (fs.existsSync(retroPath) && !force) {
      return Envelope.fail(
        "run",
        "retro",
        "RETRO_EXISTS",
        [
          "retro.json already exists.",
          "Pass --force to overwrite.",
        ],
      );
    }

    // Read spec from spec.json — the single source of truth for requirements.
    // specPath may point to .md, .json, or dir; loadSpecJson resolves all three.
    const absSpecInput = path.resolve(root, specPath);
    const specJson = loadSpecJson(absSpecInput);
    const requirements = normalizeRequirements(specJson.requirements);
    if (requirements.length === 0) {
      return Envelope.fail("run", "retro", "NO_REQUIREMENTS", `no requirements found in spec.json at ${specPath}`);
    }
    const requirementsText = requirementsAsText(requirements);

    // Get diff
    const baseBranch = state.baseBranch;
    if (!baseBranch) {
      return Envelope.fail("run", "retro", "NO_BASE_BRANCH", "baseBranch not set in flow.json");
    }

    const diffStat = getDiff(root, baseBranch);
    const detailedDiff = getDetailedDiff(root, baseBranch);

    if (!detailedDiff) {
      return Envelope.fail(
        "run",
        "retro",
        "NO_CHANGES",
        [
          "no diff found between base branch and HEAD",
          "Commit your changes before re-running retro.",
        ],
      );
    }

    if (dryRun) {
      return {
        result: "dry-run",
        artifacts: {
          spec: specPath,
          baseBranch,
          retroPath: path.relative(root, retroPath),
          requirementsCount: requirements.length,
          diffStat,
        },
      };
    }

    // spec 241 R6: static evaluation via test-map.json
    const staticResult = this.tryStaticEvaluation(root, specPath, requirements);
    if (staticResult) {
      const retro = {
        spec: specPath,
        date: new Date().toISOString(),
        mode: "static",
        ...staticResult,
      };
      fs.mkdirSync(specDir, { recursive: true });
      fs.writeFileSync(retroPath, JSON.stringify(retro, null, 2) + "\n", "utf8");
      return {
        result: "ok",
        changed: [path.relative(root, retroPath)],
        artifacts: {
          spec: specPath,
          retroPath: path.relative(root, retroPath),
          summary: retro.summary,
          requirements: retro.requirements,
          mode: "static",
        },
      };
    }

    // Resolve AI agent
    const config = ctx.config;
    if (!config) {
      return Envelope.fail("run", "retro", "NO_CONFIG", "failed to load config");
    }

    const agent = container.get("agent");
    if (!agent.resolve("flow.finalize.retro")) {
      return Envelope.fail("run", "retro", "NO_AGENT", "no AI agent configured (agent.default or agent.profiles.<name>.flow.finalize.retro)");
    }

    // Build prompt and call AI
    const retroPb = buildRetroPrompt(requirementsText, requirements, detailedDiff);
    const retroBuilt = retroPb.build();

    let response;
    try {
      response = await agent.call(retroBuilt.userPrompt, {
        commandId: "flow.finalize.retro",
        systemPrompt: retroBuilt.systemPrompt,
        jsonSchema: retroBuilt.jsonSchema,
        fmtFallback: retroBuilt.fmtFallback,
      });
    } catch (e) {
      throw new Error(`AI agent call failed: ${e.message}`);
    }

    // Parse response
    let retroData;
    try {
      retroData = parseRetroResponse(response, requirements);
    } catch (e) {
      throw new Error(`failed to parse AI response: ${e.message}`);
    }

    // Build retro.json
    const retro = {
      spec: specPath,
      date: new Date().toISOString(),
      ...retroData,
    };

    // Write retro.json
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(retroPath, JSON.stringify(retro, null, 2) + "\n", "utf8");

    return {
      result: "ok",
      changed: [path.relative(root, retroPath)],
      artifacts: {
        spec: specPath,
        retroPath: path.relative(root, retroPath),
        summary: retro.summary,
        requirements: retro.requirements,
      },
    };
  }

  tryStaticEvaluation(root, specPath, requirements) {
    const specDir = resolveSpecDir(path.resolve(root, specPath));
    const testMap = loadTestMap(specDir);
    if (Object.keys(testMap).length === 0) return null;

    const testsDir = path.join(specDir, "tests");

    const mappedFileNames = new Set();
    for (const tests of Object.values(testMap)) {
      if (isTestNotRequired(tests)) continue;
      for (const t of tests) {
        const file = t.split(" > ")[0]?.trim();
        if (file) mappedFileNames.add(file);
      }
    }

    let reqResults = new Map();
    if (mappedFileNames.size > 0) {
      const fullPaths = [...mappedFileNames]
        .map((f) => path.join(testsDir, f))
        .filter((p) => fs.existsSync(p));
      if (fullPaths.length === 0) return null;

      let tapOutput = "";
      try {
        const env = { ...process.env };
        delete env.NODE_TEST_CONTEXT;
        tapOutput = execFileSync("node", ["--test", "--test-reporter", "tap", ...fullPaths], {
          encoding: "utf8",
          timeout: 60000,
          env,
        });
      } catch (err) {
        if (err.stdout) tapOutput = err.stdout;
        else return null;
      }

      const tapResults = parseTapOutput(tapOutput);
      reqResults = extractReqResults(tapResults);
      if (reqResults.size === 0) return null;
    }

    const reqs = requirements.map((r) => {
      if (isTestNotRequired(testMap[r.id])) {
        return { desc: r.desc, status: "n/a", note: "testing not required" };
      }
      const counts = reqResults.get(r.id) || null;
      const status = evaluateReqByResults(counts);
      const note = !counts ? "no tests mapped" : `${counts.passed + counts.failed} test(s)`;
      return { desc: r.desc, status, note };
    });

    const evaluated = reqs.filter((r) => r.status !== "n/a");
    const naCount = reqs.length - evaluated.length;
    const total = evaluated.length;
    const done = evaluated.filter((r) => r.status === "done").length;
    const partial = evaluated.filter((r) => r.status === "partial").length;
    const notDone = evaluated.filter((r) => r.status === "not_done").length;
    const rate = total > 0 ? (done + partial * 0.5) / total : 0;

    return {
      requirements: reqs,
      unplanned: [],
      summary: {
        total,
        done,
        partial,
        not_done: notDone,
        na_count: naCount,
        rate: Math.round(rate * 100) / 100,
        notes: "static evaluation from test-map.json",
      },
    };
  }
}

export default RunRetroCommand;
export { requirementsAsText, buildRetroPrompt, parseRetroResponse };
