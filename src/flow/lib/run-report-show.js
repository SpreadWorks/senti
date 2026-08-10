/**
 * src/flow/lib/run-report-show.js
 *
 * `sennel flow report show` — stream the most recent finalize Report text
 * to stdout.
 *
 * Source of truth is `<configured-spec-root>/<id>/report.json` (generated from validated
 * test-execute-result.json v2 and test-result-review.json artifacts by the
 * finalize post-commit hook and merged into the base branch). `finalize` writes the
 * specId of the latest finalized spec to
 * `.sennel/last-finalized-spec` in the main repo; this command reads that
 * pointer and echoes the report's `text` field.
 */

import fs from "node:fs";
import path from "node:path";
import { Command } from "../../lib/command.js";
import { loadValidatedTestArtifacts } from "./test-artifacts.js";
import { PRODUCT } from "../../lib/product.js";
import {
  DEFAULT_FLOW_SPEC_DIR,
  FlowSpecLocation,
} from "../../lib/flow-workspace.js";

export const POINTER_REL_PATH = PRODUCT.managedPath("last-finalized-spec");

function reportShowError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/**
 * Resolve the absolute path of the most recent `report.json` using the
 * pointer file.
 *
 * @param {string} mainRoot - absolute main repo root (workdir-level).
 * @returns {string} absolute path to `report.json`.
 * @throws {Error} with `.code` set to `NO_POINTER`, `EMPTY_POINTER`,
 *   `INVALID_POINTER`, or `NO_REPORT` when the underlying resource is missing.
 */
export function resolveLatestReportPath(mainRoot, specRoot = DEFAULT_FLOW_SPEC_DIR) {
  const pointerPath = path.join(mainRoot, POINTER_REL_PATH);
  if (!fs.existsSync(pointerPath)) {
    throw reportShowError("NO_POINTER", `pointer not found: ${POINTER_REL_PATH} (run finalize first)`);
  }
  const specId = fs.readFileSync(pointerPath, "utf8").trim();
  if (!specId) {
    throw reportShowError("EMPTY_POINTER", `pointer is empty: ${POINTER_REL_PATH}`);
  }
  let reportPath;
  try {
    reportPath = new FlowSpecLocation({
      repositoryRoot: mainRoot,
      specRoot,
      specId,
    }).artifact("report.json");
  } catch {
    throw reportShowError("INVALID_POINTER", `pointer has an invalid specId: ${specId}`);
  }
  if (!fs.existsSync(reportPath)) {
    throw reportShowError("NO_REPORT", `report.json not found at ${path.relative(mainRoot, reportPath)}`);
  }
  return reportPath;
}

/**
 * Read the `text` field from a `report.json` file.
 *
 * @param {string} reportPath - absolute path to `report.json`.
 * @returns {string}
 * @throws {Error} with `.code` set to `PARSE_ERROR` or `NO_TEXT`.
 */
export function readReportText(reportPath) {
  let json;
  try {
    json = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  } catch (e) {
    throw reportShowError("PARSE_ERROR", `failed to parse ${path.basename(reportPath)}: ${e.message}`);
  }
  if (typeof json.text !== "string") {
    throw reportShowError("NO_TEXT", `${path.basename(reportPath)} has no 'text' string field`);
  }
  const tests = json.data?.tests;
  if (tests && (typeof tests !== "object" || !("projectRegression" in tests))) {
    throw reportShowError("NO_PROJECT_REGRESSION", `${path.basename(reportPath)} has test data without projectRegression`);
  }
  if (tests) loadValidatedTestArtifacts(path.dirname(reportPath));
  return json.text;
}

export default class RunReportShowCommand extends Command {
  static outputMode = "raw";

  async execute() {
    const mainRoot = this.container.get("mainRoot");
    const reportPath = resolveLatestReportPath(mainRoot, this.container.get("flowSpecRoot"));
    const text = readReportText(reportPath);
    process.stdout.write(text);
  }
}
