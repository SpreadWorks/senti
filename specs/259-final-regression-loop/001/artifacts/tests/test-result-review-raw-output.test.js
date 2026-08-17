// spec: R6 R10
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import RunTestResultReviewCommand from "../../../src/flow/lib/run-test-result-review.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeReviewFixture(tmp) {
  const command = "node project-regression.js";
  const rawLines = [
    `[sdd-forge] project regression start command=${command} mode=full`,
    "command: node project-regression.js",
    "mode: full",
    "exitCode: 0",
    "result: pass",
    "[sdd-forge] project regression end result=pass",
  ];
  writeJson(tmp, "specs/001-test/spec.json", { requirements: [] });
  writeFile(tmp, "specs/001-test/tests/.raw/test-execution.log", `${rawLines.join("\n")}\n`);
  writeJson(tmp, "specs/001-test/test-execute-result.json", {
    version: "2",
    raw_output_path: "specs/001-test/tests/.raw/test-execution.log",
    summary: [],
    regression: {
      required: true,
      mode: "full",
      root_test_command: command,
      root_test_command_source: "config",
      command,
      result: "pass",
      raw_output_lines: { start_line: 1, end_line: rawLines.length },
      trigger_relevant_changed_files: [{ status: "modified", path: "src/app.js" }],
      changed_files: [{ status: "modified", path: "src/app.js" }],
      process: {
        started: true,
        exitCode: 0,
        signal: null,
        timedOut: false,
        spawnError: null,
      },
    },
  });
}

let tmp;

afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

test("R6: test-result-review validates full regression markers from rawOutputText", async () => {
  tmp = createTmpDir("spec259-test-result-review-");
  writeReviewFixture(tmp);

  const result = await new RunTestResultReviewCommand().execute({
    root: tmp,
    flowState: { spec: "specs/001-test/spec.json" },
  });
  const review = readJson(path.join(tmp, "specs/001-test/test-result-review.json"));

  assert.equal(result.result, "ok");
  assert.equal(review.verdict, "pass");
  assert.equal(
    review.checked_items.find((item) => item.check === "project_regression_verification").result,
    "pass",
  );
});

test("R10: spec-local headers cover every testable requirement", () => {
  const specDir = path.resolve("specs/259-final-regression-loop");
  const spec = readJson(path.join(specDir, "spec.json"));
  const expected = spec.requirements
    .filter((req) => req.testable !== false)
    .map((req) => req.id)
    .sort();
  const files = fs.readdirSync(path.join(specDir, "tests"))
    .filter((name) => /\.(test|spec)\.(js|mjs|ts)$/.test(name))
    .map((name) => path.join(specDir, "tests", name));
  const covered = new Set();

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const firstLine = source.split(/\r?\n/, 1)[0];
    const match = firstLine.match(/^\/\/ spec: (.+)$/);
    if (!match) continue;
    const ids = match[1].trim().split(/\s+/);
    for (const id of ids) {
      assert.match(source, new RegExp(`(?:it|test)\\(\\s*["'\`]${id}:`));
      covered.add(id);
    }
  }

  assert.deepEqual([...covered].sort(), expected);
});
