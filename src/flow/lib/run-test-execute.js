/**
 * src/flow/lib/run-test-execute.js
 *
 * FlowCommand: test-execute — invoke an AI agent to discover the project's
 * test command, execute it, and persist a structured result file plus the raw
 * stdout/stderr log. This is the single execution point for tests during the
 * impl phase; downstream steps (test-result-review, review-impl, gate-impl,
 * retro) read the persisted artifacts and MUST NOT rerun tests.
 */

import fs from "fs";
import path from "path";
import { container } from "../../lib/container.js";
import { repairJson } from "../../lib/json-parse.js";
import { resolveSpecDir } from "../../lib/spec-json.js";
import { FlowCommand } from "./base-command.js";

const RESULT_FILENAME = "test-execute-result.json";
const RAW_OUTPUT_RELATIVE = "tests/.raw/test-execution.log";

const SYSTEM_PROMPT = [
  "You are a test execution agent.",
  "1. Discover the project's test runner from declarative config (package.json scripts.test, composer.json, Makefile, pyproject.toml, .sdd-forge/config.json's commands.test, README).",
  "2. Run the test command with verbose flags so individual test names appear.",
  "3. Capture full stdout/stderr verbatim (no AI summarization).",
  "4. Write specs/<spec>/test-execute-result.json (machine summary) and specs/<spec>/tests/.raw/test-execution.log (raw output).",
  "5. Output JSON: { completed: boolean, result_path: string, raw_output_path: string }.",
  "If no test command can be determined, return { completed: false } with error details written into summary[0].error.",
].join("\n");

function ensureAgent(commandId) {
  const agent = container.get("agent");
  if (!agent.resolve(commandId)) {
    throw new Error(`no AI agent configured for ${commandId} (set agent.default in config.json)`);
  }
  return agent;
}

function buildPrompt(specDir, requirements) {
  const reqText = (requirements || [])
    .filter((r) => r.testable !== false)
    .map((r) => `- ${r.id}: ${r.desc}`)
    .join("\n");
  return [
    `Spec directory: ${specDir}`,
    `Result file path: ${path.join(specDir, RESULT_FILENAME)}`,
    `Raw output path: ${path.join(specDir, RAW_OUTPUT_RELATIVE)}`,
    "",
    "Testable requirements (must each appear in summary[]):",
    reqText || "(none)",
    "",
    "Discover the test command, execute it verbosely, and write the artifacts.",
    "Return ONLY a JSON object: { \"completed\": true, \"result_path\": \"...\", \"raw_output_path\": \"...\" }.",
  ].join("\n");
}

export default class RunTestExecuteCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const state = ctx.flowState;
    const specDir = resolveSpecDir(path.resolve(root, state.spec));
    const rawOutputDir = path.join(specDir, "tests", ".raw");
    fs.mkdirSync(rawOutputDir, { recursive: true });

    const specJsonPath = path.join(specDir, "spec.json");
    const spec = JSON.parse(fs.readFileSync(specJsonPath, "utf8"));
    const requirements = Array.isArray(spec.requirements) ? spec.requirements : [];

    const agent = ensureAgent("flow.test.execute");
    const prompt = buildPrompt(specDir, requirements);
    const reply = await agent.call(prompt, {
      commandId: "flow.test.execute",
      systemPrompt: SYSTEM_PROMPT,
    });

    const text = typeof reply === "string" ? reply : (reply?.text ?? "");
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = repairJson(text);
    }

    const resultPath = path.join(specDir, RESULT_FILENAME);
    const rawOutputPath = path.join(specDir, RAW_OUTPUT_RELATIVE);
    const exists = fs.existsSync(resultPath);

    return {
      result: parsed?.completed && exists ? "ok" : "fail",
      changed: exists ? [path.relative(root, resultPath)] : [],
      artifacts: {
        result_path: parsed?.result_path || path.relative(root, resultPath),
        raw_output_path: parsed?.raw_output_path || path.relative(root, rawOutputPath),
        completed: !!parsed?.completed,
      },
      next: parsed?.completed ? "test-result-review" : null,
    };
  }
}
