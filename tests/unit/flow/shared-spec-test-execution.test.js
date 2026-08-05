import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import { runSpecLocalTests } from "../../../src/flow/lib/run-test-execute.js";
import {
  buildScenarioValidityExecutions,
  buildScenarioValiditySummary,
  runScenarioValidityTestFiles,
} from "../../../src/flow/lib/run-scenario-validity.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

let root;

afterEach(() => {
  if (root) removeTmpDir(root);
  root = null;
});

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

test("shared spec tests import repository modules from the execution worktree", async () => {
  root = createTmpDir("shared-spec-test-execution-");
  const repositoryRoot = path.join(root, "base");
  const executionRoot = path.join(root, "worktree");
  const specDir = path.join(repositoryRoot, "specs", "485-execution-root");
  for (const checkout of [repositoryRoot, executionRoot]) {
    write(path.join(checkout, "package.json"), "{\"type\":\"module\"}\n");
  }
  write(path.join(repositoryRoot, "src", "marker.js"), "export default 'base';\n");
  write(path.join(executionRoot, "src", "marker.js"), "export default 'execution';\n");
  write(path.join(executionRoot, "src", "execution-only.js"), "export default 485;\n");
  write(path.join(specDir, "tests", "execution-root.test.js"), [
    "import assert from 'node:assert/strict';",
    "import test from 'node:test';",
    "import marker from '../../../src/marker.js';",
    "import executionOnly from '../../../src/execution-only.js';",
    "test('uses worktree source', () => {",
    "  assert.equal(marker, 'execution');",
    "  assert.equal(executionOnly, 485);",
    "});",
    "",
  ].join("\n"));

  const result = await runSpecLocalTests({
    repositoryRoot,
    executionRoot,
    specDir,
    timeoutMs: 10_000,
  });

  assert.equal(result.result.exitCode, 0, result.result.stderr || result.result.stdout);
  assert.equal(result.result.spawnError, null);
});

test("scenario validity uses the same execution-root module authority", async () => {
  root = createTmpDir("shared-scenario-test-execution-");
  const repositoryRoot = path.join(root, "base");
  const executionRoot = path.join(root, "worktree");
  const specDir = path.join(repositoryRoot, "flow-artifacts", "specs", "485-scenario-root");
  for (const checkout of [repositoryRoot, executionRoot]) {
    write(path.join(checkout, "package.json"), "{\"type\":\"module\"}\n");
  }
  write(path.join(repositoryRoot, "src", "marker.js"), "export default 'base';\n");
  write(path.join(executionRoot, "src", "marker.js"), "export default 'execution';\n");
  const testFile = path.join(specDir, "tests", "scenario-root.test.js");
  write(testFile, [
    "import assert from 'node:assert/strict';",
    "import marker from '../../../../src/marker.js';",
    "assert.equal(marker, 'execution');",
    "",
  ].join("\n"));

  const [record] = await runScenarioValidityTestFiles({
    root: executionRoot,
    repositoryRoot,
    specDir,
    files: [testFile],
    timeoutMs: 10_000,
  });

  assert.equal(record.process.exitCode, 0, record.process.stderr || record.process.stdout);
  assert.equal(record.process.spawnError, null);
});

test("scenario validity classifies each R-N test independently within one file", async () => {
  root = createTmpDir("shared-scenario-requirement-execution-");
  const repositoryRoot = path.join(root, "base");
  const executionRoot = path.join(root, "worktree");
  const specDir = path.join(repositoryRoot, "specs", "486-requirement-results");
  for (const checkout of [repositoryRoot, executionRoot]) {
    write(path.join(checkout, "package.json"), "{\"type\":\"module\"}\n");
  }
  const testFile = path.join(specDir, "tests", "requirements.test.js");
  const source = [
    "// spec: R1 R2",
    "import assert from 'node:assert/strict';",
    "import test from 'node:test';",
    "test('R1: already implemented behavior', () => assert.equal(1, 1));",
    "test('R2: missing behavior', () => assert.equal(1, 2));",
    "",
  ].join("\n");
  write(testFile, source);
  const testEntries = [{ file: testFile, source, firstLine: "// spec: R1 R2" }];
  const requirements = [{ id: "R1" }, { id: "R2" }];
  const executions = buildScenarioValidityExecutions({ testEntries, requirements });

  const records = await runScenarioValidityTestFiles({
    root: executionRoot,
    repositoryRoot,
    specDir,
    files: [testFile],
    executions,
    timeoutMs: 10_000,
  });
  const summary = buildScenarioValiditySummary({
    root: repositoryRoot,
    files: [testFile],
    testEntries,
    fileRecords: records,
    requirements,
    command: "node --test",
    range: { start_line: 1, end_line: 1 },
  });

  assert.deepEqual(records.map((record) => record.requirementId), ["R1", "R2"]);
  assert.deepEqual(
    records.map((record) => record.process.exitCode),
    [0, 1],
    JSON.stringify(records.map((record) => ({
      command: record.command,
      stdout: record.process.stdout,
      stderr: record.process.stderr,
    })), null, 2),
  );
  assert.deepEqual(summary.map((entry) => entry.classification), ["unexpected_pass", "expected_fail"]);
  assert.match(summary[0].evidence.command, /--test-name-pattern=\^R1:/);
  assert.match(summary[1].evidence.command, /--test-name-pattern=\^R2:/);
});
