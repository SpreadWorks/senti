// spec: R4
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const targetsModule = new URL("../../../tests/acceptance/lib/targets.js", import.meta.url);
const acceptanceRunnerModule = new URL("../../../tests/acceptance/lib/run-targets.js", import.meta.url);
const acceptanceEntrypointModule = new URL("../../../tests/acceptance/run.js", import.meta.url);

test("R4: fixture discovery uses injected immediate directories and fixed path pairs", async () => {
  let module;
  try {
    module = await import(targetsModule);
  } catch {
    module = null;
  }
  assert.ok(module?.discoverAcceptanceTargets, "targets must expose fixture discovery with injected filesystem seams");
  const { discoverAcceptanceTargets } = module;
  const seen = [];
  const directories = [];
  const root = "/repo";
  const existing = new Set([
    "/repo/src/presets/base/tests/acceptance/test.js",
    "/repo/src/presets/base/tests/acceptance/fixtures",
  ]);
  const result = discoverAcceptanceTargets({
    root,
    readdirSync: (path) => {
      directories.push(path);
      assert.equal(path, "/repo/src/presets", "discovery must not recurse into preset fixtures");
      return [{ name: "base", isDirectory: () => true }];
    },
    existsSync: (path) => {
      seen.push(path);
      return existing.has(path);
    },
    readFileSync: () => {
      throw new Error("fixture content reads are forbidden during target discovery");
    },
  });

  assert.deepEqual(result.targets.map((target) => target.name), ["base"]);
  assert.deepEqual(result.targets[0], {
    name: "base",
    testFile: "/repo/src/presets/base/tests/acceptance/test.js",
    fixtureDir: "/repo/src/presets/base/tests/acceptance/fixtures",
  });
  assert.equal(result.error, null);
  assert.deepEqual(directories, ["/repo/src/presets"]);
  assert.equal(seen.length, 2);
  assert.deepEqual(seen, [
    "/repo/src/presets/base/tests/acceptance/test.js",
    "/repo/src/presets/base/tests/acceptance/fixtures",
  ]);
  const overflow = discoverAcceptanceTargets({ root, readdirSync: () => Array.from({ length: 1001 }, (_, i) => ({ name: `p${i}`, isDirectory: () => true })), existsSync: () => false });
  assert.equal(overflow.targets.length, 0);
  assert.match(overflow.error.code, /LIMIT/);
  const pathOverflow = discoverAcceptanceTargets({
    root,
    maxPathChecks: 1,
    readdirSync: () => [{ name: "base", isDirectory: () => true }],
    existsSync: () => true,
    readFileSync: () => { throw new Error("fixture content reads are forbidden during target discovery"); },
  });
  assert.equal(pathOverflow.targets.length, 0);
  assert.match(pathOverflow.error.code, /LIMIT/);
});

test("R4: tests/acceptance/run.js delegates its entrypoint exit code to acceptance target resolution", async () => {
  let module;
  try { module = await import(acceptanceEntrypointModule); } catch { module = null; }
  assert.ok(module?.main, "acceptance entrypoint must expose an injectable main function");
  const calls = [];
  const exitCode = module.main({
    args: ["base"],
    runAcceptanceTargets: (options) => {
      calls.push(options);
      return 7;
    },
  });
  assert.equal(exitCode, 7);
  assert.deepEqual(calls[0].requested, ["base"]);
  assert.equal(typeof calls[0].discoverTargets, "function");
  assert.equal(typeof calls[0].executeTests, "function");
});

test("R4: importing the target library performs no discovery or observable side effects", () => {
  const imported = spawnSync("node", ["--input-type=module", "--eval", `await import(${JSON.stringify(targetsModule.href)})`], {
    encoding: "utf8",
  });
  assert.equal(imported.status, 0);
  assert.equal(imported.stdout, "");
  assert.equal(imported.stderr, "");
});

test("R4: acceptance run resolver rejects discovery and requested-target failures", async () => {
  let module;
  try { module = await import(acceptanceRunnerModule); } catch { module = null; }
  assert.ok(module, "acceptance runner must expose a non-executing target resolver");
  const targets = [{ name: "base", testFile: "base.test.js" }];
  assert.throws(() => module.resolveAcceptanceRun({ targets: [], error: { code: "LIMIT" } }, []));
  assert.throws(() => module.resolveAcceptanceRun({ targets: [], error: null }, []));
  assert.throws(() => module.resolveAcceptanceRun({ targets, error: null }, ["missing"]));
  assert.throws(() => module.resolveAcceptanceRun({ targets: [{ name: "base", testFile: null }], error: null }, ["base"]));
  assert.deepEqual(module.resolveAcceptanceRun({ targets, error: null }, ["base"]), ["base.test.js"]);
});

test("R4: acceptance command runner consumes discovery and executes only resolved files", async () => {
  let module;
  try { module = await import(acceptanceRunnerModule); } catch { module = null; }
  assert.ok(module?.runAcceptanceTargets, "acceptance runner behavior must be injectable without spawning node");
  const errors = [];
  const executed = [];
  const run = (discovery, requested = []) => module.runAcceptanceTargets({
    requested,
    discoverTargets: () => discovery,
    executeTests: (files) => executed.push(files),
    writeError: (message) => errors.push(message),
  });

  assert.equal(run({ targets: [], error: { code: "LIMIT" } }), 1);
  assert.equal(run({ targets: [], error: null }), 1);
  assert.equal(run({ targets: [{ name: "base", testFile: "base.test.js" }], error: null }, ["missing"]), 1);
  assert.equal(run({ targets: [{ name: "base", testFile: null }], error: null }, ["base"]), 1);
  assert.equal(run({ targets: [{ name: "base", testFile: "base.test.js" }, { name: "node", testFile: "node.test.js" }], error: null }, ["base"]), 0);
  assert.deepEqual(executed, [["base.test.js"]]);
  assert.equal(errors.length, 4);
});
