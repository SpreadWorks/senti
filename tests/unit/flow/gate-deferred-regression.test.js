import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { validateIntegrationArtifactTrust } from "../../../src/flow/lib/test-artifacts.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../helpers/tmp-dir.js";

function writeJson(root, relPath, value) {
  writeFile(root, relPath, `${JSON.stringify(value, null, 2)}\n`);
}

describe("integration gate deferred regression evidence", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("accepts deferred full-regression evidence without blocking gate-impl", () => {
    tmp = createTmpDir("gate-deferred-regression-");
    const specDir = path.join(tmp, "specs/001-test");
    fs.mkdirSync(path.join(specDir, "tests/.raw"), { recursive: true });

    writeFile(tmp, "src/flow/lib/run-gate.js", "export function runGateFixture() {}\n");
    writeJson(tmp, "specs/001-test/spec.json", {
      requirements: [{ id: "R1", testable: true }],
    });
    writeJson(tmp, "specs/001-test/file-map.json", {
      R1: ["src/flow/lib/run-gate.js"],
    });
    writeFile(tmp, "specs/001-test/tests/deferred.test.js", [
      "test('R1: deferred regression evidence verified', () => {});",
      "",
    ].join("\n"));
    writeFile(tmp, "specs/001-test/tests/.raw/test-execution.log", [
      "R1: deferred regression evidence verified",
      "",
    ].join("\n"));
    writeJson(tmp, "specs/001-test/test-execute-result.json", {
      version: "2",
      raw_output_path: "specs/001-test/tests/.raw/test-execution.log",
      summary: [{
        id: "R1",
        result: "pass",
        evidence: {
          test_file: "specs/001-test/tests/deferred.test.js",
          test_name: "R1: deferred regression evidence verified",
          command: "node --test specs/001-test/tests/deferred.test.js",
          raw_output_lines: { start_line: 1, end_line: 1 },
        },
      }],
      regression: {
        required: false,
        category: "full-regression-deferred",
        reason: "full project regression deferred to final-regression",
        changed_files: [{ status: "modified", path: "src/flow/lib/run-gate.js" }],
        trigger_relevant_changed_files: [{ status: "modified", path: "src/flow/lib/run-gate.js" }],
        classified_paths: [{ path: "src/flow/lib/run-gate.js", category: "full-regression-deferred" }],
      },
    });
    writeJson(tmp, "specs/001-test/test-result-review.json", {
      verdict: "pass",
      checked_items: [{ check: "project_regression_verification", result: "pass", detail: "deferred regression evidence verified" }],
      result_file_path: "specs/001-test/test-execute-result.json",
      raw_output_path: "specs/001-test/tests/.raw/test-execution.log",
    });

    const result = validateIntegrationArtifactTrust({
      root: tmp,
      specDir,
      specPath: "specs/001-test/spec.json",
      state: { spec: "specs/001-test/spec.json", baseBranch: "main" },
    });

    assert.equal(result.ok, true, result.reason);
  });
});
