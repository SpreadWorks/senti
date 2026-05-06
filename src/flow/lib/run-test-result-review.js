/**
 * src/flow/lib/run-test-result-review.js
 *
 * FlowCommand: test-result-review — verify integrity of test-execute-result.json
 * against the raw output log and actual code (hallucination detection +
 * summary completeness). Runs in a separate AI agent session from test-execute
 * to avoid prompt context sharing.
 */

import fs from "fs";
import path from "path";
import { container } from "../../lib/container.js";
import { repairJson } from "../../lib/json-parse.js";
import { resolveSpecDir } from "../../lib/spec-json.js";
import { FlowCommand } from "./base-command.js";

const REVIEW_FILENAME = "test-result-review.json";
const REVIEW_MD_FILENAME = "test-result-review.md";

const SYSTEM_PROMPT = [
  "You are a test result verification agent. You operate in a SEPARATE session from the executor and must not infer the executor's intermediate state.",
  "Read the persisted artifacts only.",
  "Verify ALL of:",
  " 1. file_path_exists — every evidence.test_file exists; evidence.test_name appears in that file.",
  " 2. req_id_in_output — every requirement reported as pass has its R-ID in the raw output.",
  " 3. test_count_consistency — sum of summary[] entries matches test count in raw output.",
  " 4. stack_trace_validity — fail entries' stack traces reference real code locations.",
  " 5. summary_completeness — every testable requirement (from spec.json) appears in summary[] exactly once. No missing, duplicate, or unknown IDs.",
  "Verdict 'pass' iff all 5 checks pass. Otherwise 'fail' with invalid_reason.",
  "Output JSON: { verdict: 'pass'|'fail', checked_items: [...], invalid_reason?, result_file_path, raw_output_path }.",
].join("\n");

function ensureAgent(commandId) {
  const agent = container.get("agent");
  if (!agent.resolve(commandId)) {
    throw new Error(`no AI agent configured for ${commandId} (set agent.default in config.json)`);
  }
  return agent;
}

function buildPrompt(specDir, resultPath, rawOutputPath, requirements) {
  const reqText = (requirements || [])
    .filter((r) => r.testable !== false)
    .map((r) => `- ${r.id}`)
    .join(", ");
  return [
    `Spec directory: ${specDir}`,
    `Result file: ${resultPath}`,
    `Raw output: ${rawOutputPath}`,
    `Testable requirement IDs: ${reqText || "(none)"}`,
    "",
    "Read the result file and raw output. Run all 5 verification checks. Write the review JSON to:",
    `  ${path.join(specDir, REVIEW_FILENAME)}`,
    "And a human-readable Markdown summary to:",
    `  ${path.join(specDir, REVIEW_MD_FILENAME)}`,
    "",
    "Return ONLY the review JSON.",
  ].join("\n");
}

function writeMarkdown(specDir, review) {
  const lines = ["# Test Result Review", "", `**Verdict:** ${review.verdict}`, ""];
  if (review.invalid_reason) {
    lines.push(`**Invalid reason:** ${review.invalid_reason}`, "");
  }
  lines.push("## Checked Items", "");
  for (const item of review.checked_items || []) {
    lines.push(`- **${item.check}** — ${item.result}: ${item.detail}`);
  }
  lines.push("", `Result file: \`${review.result_file_path}\``, `Raw output: \`${review.raw_output_path}\``, "");
  fs.writeFileSync(path.join(specDir, REVIEW_MD_FILENAME), lines.join("\n"));
}

export default class RunTestResultReviewCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const state = ctx.flowState;
    const specDir = resolveSpecDir(path.resolve(root, state.spec));

    const resultPath = path.join(specDir, "test-execute-result.json");
    if (!fs.existsSync(resultPath)) {
      throw new Error(`test-execute-result.json not found at ${resultPath}: test-execute step has not been run`);
    }
    const rawOutputPath = path.join(specDir, "tests", ".raw", "test-execution.log");

    const specJsonPath = path.join(specDir, "spec.json");
    const spec = JSON.parse(fs.readFileSync(specJsonPath, "utf8"));
    const requirements = Array.isArray(spec.requirements) ? spec.requirements : [];

    const agent = ensureAgent("flow.test.result-review");
    const prompt = buildPrompt(specDir, resultPath, rawOutputPath, requirements);
    const reply = await agent.call(prompt, {
      commandId: "flow.test.result-review",
      systemPrompt: SYSTEM_PROMPT,
    });

    const text = typeof reply === "string" ? reply : (reply?.text ?? "");
    let review;
    try {
      review = JSON.parse(text);
    } catch {
      review = repairJson(text);
    }

    if (!review?.verdict || (review.verdict !== "pass" && review.verdict !== "fail")) {
      throw new Error(`test-result-review agent returned invalid verdict: ${JSON.stringify(review).slice(0, 200)}`);
    }

    const reviewPath = path.join(specDir, REVIEW_FILENAME);
    fs.writeFileSync(reviewPath, JSON.stringify(review, null, 2) + "\n");
    writeMarkdown(specDir, review);

    return {
      result: review.verdict === "pass" ? "ok" : "fail",
      changed: [
        path.relative(root, reviewPath),
        path.relative(root, path.join(specDir, REVIEW_MD_FILENAME)),
      ],
      artifacts: {
        verdict: review.verdict,
        review_path: path.relative(root, reviewPath),
      },
      next: review.verdict === "pass" ? "review" : null,
    };
  }
}
