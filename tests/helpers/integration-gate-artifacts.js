import { writeFile, writeJson } from "./tmp-dir.js";
import { buildRepairFingerprint } from "../../src/flow/lib/impl-repair-artifacts.js";

export function writeIntegrationGateTrustArtifacts(root, { specId, requirementIds }) {
  const rawOutputPath = `specs/${specId}/tests/.raw/test-execution.log`;
  const testFilePath = `specs/${specId}/tests/integration-gate-trust.test.js`;

  writeFile(root, testFilePath, [
    "import { test } from 'node:test';",
    ...requirementIds.map((id) => `test('${id}: validates integration gate trust', () => {});`),
    "",
  ].join("\n"));
  writeFile(root, rawOutputPath, [
    "TAP version 13",
    ...requirementIds.map((id, index) => `ok ${index + 1} - ${id}: validates integration gate trust`),
    "",
  ].join("\n"));
  const repairFingerprint = buildRepairFingerprint({
    root,
    specPath: `specs/${specId}/spec.json`,
  }).hash;
  writeJson(root, `specs/${specId}/test-execute-result.json`, {
    version: "2",
    raw_output_path: rawOutputPath,
    summary: requirementIds.map((id, index) => ({
      id,
      result: "pass",
      evidence: {
        test_file: testFilePath,
        test_name: `${id}: validates integration gate trust`,
        command: `node --test ${testFilePath}`,
        raw_output_lines: { start_line: index + 2, end_line: index + 2 },
      },
    })),
    regression: {
      required: false,
      result: "skipped",
      mode: "none",
      category: "full-regression-deferred",
      reason: "fixture full regression is deferred",
      classified_paths: [],
      trigger_relevant_changed_files: [],
      changed_files: [],
    },
    repairFingerprint,
  });
  writeJson(root, `specs/${specId}/test-result-review.json`, {
    verdict: "pass",
    checked_items: [
      { check: "project_regression_verification", result: "pass", detail: "fixture evidence verified" },
    ],
    result_file_path: `specs/${specId}/test-execute-result.json`,
    raw_output_path: rawOutputPath,
    repairFingerprint,
  });
}
