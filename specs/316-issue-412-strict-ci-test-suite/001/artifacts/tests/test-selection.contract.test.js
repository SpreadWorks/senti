// spec: R1 R2 R5
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";

const selectionModule = new URL("../../../tests/helpers/test-selection.js", import.meta.url);
const runnerModule = new URL("../../../tests/helpers/test-runner.js", import.meta.url);
const root = resolve(import.meta.dirname, "..", "..", "..");

async function loadSelectionModule() {
  try {
    return await import(selectionModule);
  } catch {
    return null;
  }
}

async function loadRunnerModule() {
  try {
    return await import(runnerModule);
  } catch {
    return null;
  }
}

test("R1: TestSelection rejects every invalid single-value or conflicting selector without discovery", async () => {
  const module = await loadSelectionModule();
  assert.ok(module, "TestSelection must provide an isolated selector parser");
  const { TestSelection } = module;
  const options = { presetNames: ["base"] };

  for (const args of [
    ["--unknown"],
    ["--preset"],
    ["--scope"],
    ["--file"],
    ["--pattern"],
    ["--preset", "missing"],
    ["--preset", "base", "--scope", "unit"],
    ["--agent", "--all"],
    ["--file", "a.test.js", "--scope", "unit"],
    ["--pattern", "*.test.js", "--agent"],
    ["path", "--all"],
    ["--scope", "unit", "--scope", "e2e"],
    ["--preset", "base", "--preset", "base"],
    ["--agent", "--agent"],
    ["--all", "--all"],
  ]) {
    assert.throws(() => TestSelection.parse(args, options));
  }

  const suiteSelectors = [
    ["--preset", "base"],
    ["--scope", "unit"],
    ["--agent"],
    ["--all"],
  ];
  const fileSelectors = [
    ["--file", "tests/unit/a.test.js"],
    ["--pattern", "tests/unit/*.test.js"],
    ["tests/unit/a.test.js"],
  ];
  for (let left = 0; left < suiteSelectors.length; left += 1) {
    for (let right = left + 1; right < suiteSelectors.length; right += 1) {
      assert.throws(() => TestSelection.parse([...suiteSelectors[left], ...suiteSelectors[right]], options));
    }
    for (const fileSelector of fileSelectors) {
      assert.throws(() => TestSelection.parse([...suiteSelectors[left], ...fileSelector], options));
    }
  }

  const files = TestSelection.parse(["--file", "a.test.js", "--file", "b.test.js", "path"]);
  assert.equal(files.mode, "files");
  assert.deepEqual(files.fileArgs, ["a.test.js", "b.test.js"]);
  assert.deepEqual(files.positionalArgs, ["path"]);
  assert.equal(TestSelection.parse(["--pattern", "*.test.js", "--pattern", "*.spec.js"]).patternArgs.length, 2);
});

test("R1: file unions preserve duplicate inputs until the shared resolver deduplicates resolved files", async () => {
  const module = await loadSelectionModule();
  assert.ok(module, "TestSelection must provide an isolated selector parser");
  const { TestSelection, resolveTestFiles } = module;
  const selection = TestSelection.parse([
    "--file", "tests/unit/same.test.js",
    "--file", "tests/unit/same.test.js",
    "--pattern", "tests/unit/*.test.js",
    "tests/unit/same.test.js",
  ]);

  assert.deepEqual(selection.fileArgs, ["tests/unit/same.test.js", "tests/unit/same.test.js"]);
  assert.deepEqual(selection.patternArgs, ["tests/unit/*.test.js"]);
  assert.deepEqual(selection.positionalArgs, ["tests/unit/same.test.js"]);
  const files = resolveTestFiles(selection, {
    root: "/repo",
    existsSync: () => true,
    statSync: () => ({ isDirectory: () => false }),
    globSync: () => ["tests/unit/same.test.js"],
  });
  assert.deepEqual(files, ["tests/unit/same.test.js"]);
});

test("R5: every retained valid selector parses alone and supports JSON listing", async () => {
  const module = await loadSelectionModule();
  assert.ok(module, "TestSelection must provide retained selector behavior");
  const { TestSelection } = module;
  const options = { presetNames: ["base"] };
  const selectors = [
    [[], "default"],
    [["--preset", "base"], "preset"],
    [["--scope", "unit"], "scope"],
    [["--agent"], "agent"],
    [["--all"], "all"],
    [["--file", "tests/unit/a.test.js"], "files"],
    [["--pattern", "tests/unit/*.test.js"], "files"],
    [["tests/unit/a.test.js"], "files"],
  ];

  for (const [args, mode] of selectors) {
    const execution = TestSelection.parse(args, options);
    const listing = TestSelection.parse(["--list", "--json", ...args], options);
    assert.equal(execution.mode, mode);
    assert.equal(listing.mode, mode);
    assert.equal(listing.list, true);
    assert.equal(listing.json, true);
  }
});

test("R2: TestRunner keeps help discovery-free and emits only the versioned JSON listing", async () => {
  const module = await loadRunnerModule();
  assert.ok(module?.TestRunner, "tests/run.js must delegate command behavior to an injectable TestRunner");
  let resolved = 0;
  let executed = 0;
  const runner = new module.TestRunner({
    presetNames: ["base"],
    resolveFiles: () => {
      resolved += 1;
      return ["tests/unit/z.test.js", "tests/unit/a.test.js"];
    },
    executeFiles: () => {
      executed += 1;
      return 0;
    },
  });

  const help = runner.run(["--help"]);
  assert.equal(help.exitCode, 0);
  assert.match(help.stdout, /Usage:/);
  assert.equal(resolved, 0);
  assert.equal(executed, 0);

  const listing = runner.run(["--list", "--json", "--scope", "unit"]);
  assert.equal(listing.exitCode, 0);
  assert.equal(listing.stderr, "");
  assert.equal(executed, 0);
  const json = JSON.parse(listing.stdout);
  assert.equal(json.version, 1);
  assert.deepEqual(json.selection, { mode: "scope", preset: null, scope: "unit" });
  assert.deepEqual(json.suites, [
    { category: "unit", files: ["tests/unit/a.test.js", "tests/unit/z.test.js"], count: 2 },
    { category: "integration", files: [], count: 0 },
    { category: "acceptance", files: [], count: 0 },
    { category: "other", files: [], count: 0 },
  ]);
  assert.equal(json.totalFiles, 2);
  assert.equal(resolved, 1);

  for (const [args, expected] of [
    [["--preset", "base"], { mode: "preset", preset: "base", scope: null }],
    [["--all"], { mode: "all", preset: null, scope: null }],
    [["--file", "tests/unit/a.test.js"], { mode: "files", preset: null, scope: null }],
  ]) {
    const result = runner.run(["--list", "--json", ...args]);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, JSON.stringify(JSON.parse(result.stdout)));
    assert.deepEqual(JSON.parse(result.stdout).selection, expected);
  }

  const oversizedRunner = new module.TestRunner({
    presetNames: ["base"],
    maxJsonBytes: 1,
    resolveFiles: () => ["tests/unit/a.test.js"],
    executeFiles: () => {
      throw new Error("listing must not execute tests");
    },
  });
  const oversized = oversizedRunner.run(["--list", "--json", "--scope", "unit"]);
  assert.equal(oversized.exitCode, 1);
  assert.equal(oversized.stdout, "");
  assert.match(oversized.stderr, /limit|JSON/i);
});

test("R1 R2: tests/run.js entrypoint rejects invalid selectors and owns help and JSON-list output", () => {
  const help = spawnSync("node", ["tests/run.js", "--help"], { cwd: root, encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage:/);
  assert.equal(help.stderr, "");

  const unknown = spawnSync("node", ["tests/run.js", "--unknown"], { cwd: root, encoding: "utf8" });
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /unknown|usage/i);

  const listing = spawnSync("node", [
    "tests/run.js",
    "--list",
    "--json",
    "--file",
    "specs/316-issue-412-strict-ci-test-suite/tests/test-selection.contract.test.js",
  ], { cwd: root, encoding: "utf8" });
  assert.equal(listing.status, 0);
  assert.equal(listing.stderr, "");
  const result = JSON.parse(listing.stdout);
  assert.equal(result.version, 1);
  assert.deepEqual(result.selection, { mode: "files", preset: null, scope: null });
  assert.deepEqual(result.suites.map((suite) => suite.category), ["unit", "integration", "acceptance", "other"]);
  assert.equal(result.totalFiles, 1);
});

test("R2: shared resolver rejects unsafe resolved files before execution in execution mode", async () => {
  const module = await loadRunnerModule();
  assert.ok(module?.TestRunner, "tests/run.js must delegate command behavior to an injectable TestRunner");
  const invalidFileSets = [
    ["../escape.test.js"],
    [`${Array(33).fill("nested").join("/")}/test.js`],
    Array(10001).fill("tests/unit/a.test.js"),
    ["x".repeat(4097)],
  ];

  for (const files of invalidFileSets) {
    let executed = 0;
    const runner = new module.TestRunner({
      presetNames: ["base"],
      resolveFiles: () => files,
      executeFiles: () => { executed += 1; },
    });
    const result = runner.run(["--scope", "unit"]);
    assert.equal(result.exitCode, 1);
    assert.equal(executed, 0, "unsafe resolver output must not reach execution");
    assert.match(result.stderr, /limit|path|traversal|depth/i);
  }
});

test("R2: TestSelection exposes separate help and bounded JSON-list contracts", async () => {
  const module = await loadSelectionModule();
  assert.ok(module, "TestSelection must provide non-executing help/list contracts");
  const { TestSelection, renderTestList } = module;
  const help = TestSelection.parse(["--help"], { presetNames: [] });
  assert.equal(help.mode, "help");

  const selection = TestSelection.parse(["--list", "--json", "--scope", "unit"], { presetNames: [] });
  assert.throws(() => TestSelection.parse(["--list"], { presetNames: [] }));
  assert.throws(() => TestSelection.parse(["--json"], { presetNames: [] }));
  const json = renderTestList(selection, [
    { category: "other", files: ["tests/z.test.js"] },
    { category: "unit", files: ["tests/unit/z.test.js", "tests/unit/a.test.js"] },
    { category: "integration", files: ["tests/e2e/a.test.js"] },
    { category: "acceptance", files: ["tests/acceptance/a.test.js"] },
  ], { maxDepth: 32, maxFiles: 10000, maxRelativePath: 4096, maxJsonBytes: 16 * 1024 * 1024 });
  assert.deepEqual(json.suites.map((suite) => suite.category), ["unit", "integration", "acceptance", "other"]);
  assert.deepEqual(json.suites[0].files, ["tests/unit/a.test.js", "tests/unit/z.test.js"]);
  assert.equal(json.totalFiles, 5);
  assert.throws(() => renderTestList(selection, [{ category: "unit", files: ["../escape.test.js"] }], { maxDepth: 32, maxFiles: 10000, maxRelativePath: 4096, maxJsonBytes: 16 * 1024 * 1024 }));
  assert.throws(() => renderTestList(selection, [{ category: "unit", files: [`${Array(33).fill("nested").join("/")}/test.js`] }], { maxDepth: 32, maxFiles: 10000, maxRelativePath: 4096, maxJsonBytes: 16 * 1024 * 1024 }));
  assert.throws(() => renderTestList(selection, [{ category: "unit", files: Array(10001).fill("tests/unit/a.test.js") }], { maxDepth: 32, maxFiles: 10000, maxRelativePath: 4096, maxJsonBytes: 16 * 1024 * 1024 }));
  assert.throws(() => renderTestList(selection, [{ category: "unit", files: ["x".repeat(4097)] }], { maxDepth: 32, maxFiles: 10000, maxRelativePath: 4096, maxJsonBytes: 16 * 1024 * 1024 }));
  assert.throws(() => renderTestList(selection, [{ category: "unit", files: ["tests/unit/a.test.js"] }], { maxDepth: 32, maxFiles: 10000, maxRelativePath: 4096, maxJsonBytes: 1 }));
});
