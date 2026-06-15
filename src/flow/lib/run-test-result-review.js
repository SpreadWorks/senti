/**
 * src/flow/lib/run-test-result-review.js
 *
 * Deterministically validates test-execute-result.json v2 against raw output,
 * spec-local test files, and the project regression contract.
 */

import fs from "fs";
import path from "path";
import { resolveSpecDir } from "../../lib/spec-json.js";
import { FlowCommand } from "./base-command.js";
import {
  MAX_RAW_OUTPUT_BYTES,
  RAW_OUTPUT_RELATIVE,
  TEST_EXECUTE_RESULT_FILE,
  TEST_RESULT_REVIEW_FILE,
  TEST_RESULT_REVIEW_MD_FILE,
  readJsonStrict,
  validateSummaryEvidence,
  validateTestExecuteResultEvidence,
  validateTestExecuteResultV2,
} from "./test-artifacts.js";
import { contractFromTestResultReviewArtifact } from "./flow-judgment-contract.js";

function pass(check, detail) {
  return { check, result: "pass", detail };
}

function fail(check, detail) {
  return { check, result: "fail", detail };
}

function validateSummary(result, { root, rawOutputText, rawLines, requirements }) {
  try {
    validateSummaryEvidence(result.summary, {
      root,
      rawText: rawOutputText,
      rawLines,
      requirements,
      validateRawOutputRange: true,
    });
  } catch (err) {
    return fail("summary_evidence", err.message);
  }
  return pass("summary_evidence", "summary membership, executable test evidence, no-tests decisions, commands, raw ranges, and output ids are valid");
}

function validateRegressionRawRange(result, rawLines) {
  const regression = result.regression;
  if (regression.required) {
    const range = regression.raw_output_lines;
    if (!range || range.end_line > rawLines.length) {
      return fail("project_regression_verification", "regression.raw_output_lines is outside raw output");
    }
  }
  return pass("raw_output_lines", "regression line range is within raw output");
}

function validateProjectRegression(result, { root, rawOutputText, rawLines, requirements }) {
  try {
    validateTestExecuteResultEvidence(result, { root, rawOutputText, rawLines, requirements, summary: false });
  } catch (err) {
    return fail("project_regression_verification", err.message);
  }
  return pass("project_regression_verification", "project regression evidence is valid; impl-gate owns blocking on regression.result fail");
}

function readRawOutputText(rawOutputPath) {
  const stat = fs.statSync(rawOutputPath);
  if (stat.size > MAX_RAW_OUTPUT_BYTES) {
    throw new Error(`${RAW_OUTPUT_RELATIVE} exceeds max size ${MAX_RAW_OUTPUT_BYTES} bytes`);
  }
  return fs.readFileSync(rawOutputPath, "utf8");
}

function writeMarkdown(specDir, review) {
  const lines = ["# Test Result Review", "", `**Verdict:** ${review.verdict}`, ""];
  if (review.invalid_reason) lines.push(`**Invalid reason:** ${review.invalid_reason}`, "");
  lines.push("## Checked Items", "");
  for (const item of review.checked_items) {
    lines.push(`- **${item.check}** — ${item.result}: ${item.detail}`);
  }
  lines.push("", `Result file: \`${review.result_file_path}\``, `Raw output: \`${review.raw_output_path}\``, "");
  fs.writeFileSync(path.join(specDir, TEST_RESULT_REVIEW_MD_FILE), lines.join("\n"));
}

function writeReviewArtifacts({ root, specDir, reviewPath, review }) {
  review.contractSummary = contractFromTestResultReviewArtifact(review, {
    artifactPath: path.relative(root, reviewPath).split(path.sep).join("/"),
  }).summary.toJSON();
  fs.writeFileSync(reviewPath, JSON.stringify(review, null, 2) + "\n");
  writeMarkdown(specDir, review);
}

export default class RunTestResultReviewCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const state = ctx.flowState;
    const specDir = resolveSpecDir(path.resolve(root, state.spec));
    const resultPath = path.join(specDir, TEST_EXECUTE_RESULT_FILE);
    const rawOutputPath = path.join(specDir, RAW_OUTPUT_RELATIVE);
    if (!fs.existsSync(resultPath)) throw new Error(`${TEST_EXECUTE_RESULT_FILE} not found at ${resultPath}: test-execute step has not been run`);
    if (!fs.existsSync(rawOutputPath)) throw new Error(`${RAW_OUTPUT_RELATIVE} not found at ${rawOutputPath}: test-execute raw log is missing`);

    const spec = readJsonStrict(path.join(specDir, "spec.json"));
    const loadedResult = readJsonStrict(resultPath);
    const rawOutputText = readRawOutputText(rawOutputPath);
    const rawLines = rawOutputText.split(/\r?\n/);
    const requirements = spec.requirements || [];
    const evidenceContext = { root, rawOutputText, rawLines, requirements };
    const reviewPath = path.join(specDir, TEST_RESULT_REVIEW_FILE);
    let result;
    try {
      result = validateTestExecuteResultV2(loadedResult);
    } catch (err) {
      const review = {
        verdict: "fail",
        checked_items: [fail("test_execute_artifact", `test artifact invalid: ${err.message}`)],
        invalid_reason: `test artifact invalid: ${err.message}`,
        result_file_path: path.relative(root, resultPath).split(path.sep).join("/"),
        raw_output_path: path.relative(root, rawOutputPath).split(path.sep).join("/"),
      };
      writeReviewArtifacts({ root, specDir, reviewPath, review });
      return {
        result: "fail",
        changed: [
          path.relative(root, reviewPath),
          path.relative(root, path.join(specDir, TEST_RESULT_REVIEW_MD_FILE)),
        ],
        artifacts: {
          verdict: review.verdict,
          review_path: path.relative(root, reviewPath),
        },
        next: null,
      };
    }

    const checked_items = [
      validateSummary(result, evidenceContext),
      validateRegressionRawRange(result, rawLines),
      validateProjectRegression(result, evidenceContext),
    ];
    const failed = checked_items.filter((item) => item.result !== "pass");
    const review = {
      verdict: failed.length === 0 ? "pass" : "fail",
      checked_items,
      ...(failed.length ? { invalid_reason: failed.map((item) => item.detail).join("; ") } : {}),
      result_file_path: path.relative(root, resultPath).split(path.sep).join("/"),
      raw_output_path: path.relative(root, rawOutputPath).split(path.sep).join("/"),
    };

    writeReviewArtifacts({ root, specDir, reviewPath, review });

    return {
      result: review.verdict === "pass" ? "ok" : "fail",
      changed: [
        path.relative(root, reviewPath),
        path.relative(root, path.join(specDir, TEST_RESULT_REVIEW_MD_FILE)),
      ],
      artifacts: {
        verdict: review.verdict,
        review_path: path.relative(root, reviewPath),
      },
      next: review.verdict === "pass" ? "impl-review" : null,
    };
  }
}
