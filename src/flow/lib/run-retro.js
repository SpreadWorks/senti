/**
 * src/flow/lib/run-retro.js
 *
 * FlowCommand: retro — aggregate per-requirement pass/fail from the artifacts
 * produced by test-execute and verified by test-result-review. Reads
 * test-result-review.json (verdict gate) and test-execute-result.json (summary)
 * and writes retro.json. v2 raw_output_lines are range objects with start_line
 * and end_line. Performs no test execution.
 */

import fs from "fs";
import path from "path";
import { loadSpecJson, normalizeRequirements, resolveSpecDir } from "../../lib/spec-json.js";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { validateTestExecuteResultV2, validateTestResultReview } from "./test-artifacts.js";

const TEST_EXECUTE_RESULT_FILE = "test-execute-result.json";
const TEST_RESULT_REVIEW_FILE = "test-result-review.json";
const RETRO_FILE = "retro.json";

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    throw new Error(`failed to read JSON at ${filePath}: ${err.message}`);
  }
}

function aggregate(requirements, summary) {
  const summaryById = new Map();
  for (const entry of summary || []) {
    if (entry?.id) summaryById.set(entry.id, entry);
  }

  const testableReqs = requirements.filter((r) => r.testable !== false);
  const naCount = requirements.length - testableReqs.length;

  const reqs = testableReqs.map((r) => {
    const entry = summaryById.get(r.id);
    if (!entry) {
      return { desc: r.desc, status: "not_done", note: "missing from test-execute-result.json summary[]" };
    }
    if (entry.result === "pass") {
      return { desc: r.desc, status: "done", note: entry.evidence?.test_name || "" };
    }
    if (entry.result === "not_applicable") {
      return { desc: r.desc, status: "not_applicable", note: entry.reason || "no_tests_declared" };
    }
    return { desc: r.desc, status: "not_done", note: entry.error || entry.evidence?.test_name || "" };
  });

  const total = reqs.length;
  const done = reqs.filter((x) => x.status === "done").length;
  const notApplicable = reqs.filter((x) => x.status === "not_applicable").length;
  const notDone = total - done - notApplicable;
  const rate = total > 0 ? done / total : 0;

  return {
    requirements: reqs,
    unplanned: [],
    summary: {
      total,
      done,
      partial: 0,
      not_done: notDone,
      not_applicable_count: notApplicable,
      na_count: naCount,
      not_testable_count: naCount,
      rate: Math.round(rate * 100) / 100,
      notes: "aggregated from test-execute-result.json",
    },
  };
}

export class RunRetroCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const dryRun = ctx.dryRun || false;
    const state = ctx.flowState;
    const specPath = state.spec;
    const specDir = resolveSpecDir(path.resolve(root, specPath));
    const retroPath = path.join(specDir, RETRO_FILE);

    const reviewPath = path.join(specDir, TEST_RESULT_REVIEW_FILE);
    const resultPath = path.join(specDir, TEST_EXECUTE_RESULT_FILE);

    if (!fs.existsSync(reviewPath)) {
      return Envelope.fail(
        "run",
        "retro",
        "TEST_RESULT_REVIEW_MISSING",
        `${TEST_RESULT_REVIEW_FILE} not found at ${path.relative(root, reviewPath)}: test-result-review step has not been run`,
      );
    }
    if (!fs.existsSync(resultPath)) {
      return Envelope.fail(
        "run",
        "retro",
        "TEST_EXECUTE_RESULT_MISSING",
        `${TEST_EXECUTE_RESULT_FILE} not found at ${path.relative(root, resultPath)}: test-execute step has not been run`,
      );
    }

    const review = readJson(reviewPath);
    if (review.verdict !== "pass") {
      return Envelope.fail(
        "run",
        "retro",
        "TEST_RESULT_REVIEW_NOT_PASSED",
        `${TEST_RESULT_REVIEW_FILE} verdict is '${review.verdict}', expected 'pass'. Cannot aggregate untrusted results.`,
      );
    }

    const result = readJson(resultPath);
    try {
      validateTestResultReview(review);
      validateTestExecuteResultV2(result);
    } catch (err) {
      return Envelope.fail(
        "run",
        "retro",
        "TEST_ARTIFACT_INVALID",
        err.message,
      );
    }

    const specJson = loadSpecJson(path.resolve(root, specPath));
    const requirements = normalizeRequirements(specJson.requirements);
    if (requirements.length === 0) {
      return Envelope.fail("run", "retro", "NO_REQUIREMENTS", `no requirements found in spec.json at ${specPath}`);
    }

    const aggregated = aggregate(requirements, result.summary);

    const retro = {
      spec: specPath,
      date: new Date().toISOString(),
      mode: "result-file",
      ...aggregated,
    };

    if (dryRun) {
      return {
        result: "dry-run",
        artifacts: {
          spec: specPath,
          retroPath: path.relative(root, retroPath),
          summary: retro.summary,
          requirements: retro.requirements,
        },
      };
    }

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
        mode: "result-file",
      },
    };
  }
}

export default RunRetroCommand;
