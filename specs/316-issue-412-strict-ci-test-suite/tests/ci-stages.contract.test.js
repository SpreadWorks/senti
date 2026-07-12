// spec: R3 R5
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { buildSearchDirs } from "../../../tests/helpers/test-runner-search-dirs.js";

const ciModule = new URL("../../../tests/ci.js", import.meta.url);
const stubAgentModule = new URL("../../../tests/helpers/stub-agent.js", import.meta.url);
const stubAcceptanceModule = new URL("../../../tests/ci/stub-acceptance.js", import.meta.url);

async function loadCiModule() {
  try {
    return await import(ciModule);
  } catch {
    return null;
  }
}

test("R3: CI stage factory defines the four deterministic credential-free stages", async () => {
  const module = await loadCiModule();
  assert.ok(module, "tests/ci.js must expose an injectable CI stage factory");
  const { createCiStages, runCiStages } = module;
  const scripts = JSON.parse(readFileSync(resolve(import.meta.dirname, "..", "..", "..", "package.json"), "utf8")).scripts;
  assert.equal(scripts["test:ci"], "node tests/ci.js");
  const stages = createCiStages();
  assert.deepEqual(stages, [
    ["node", ["tests/run.js", "--scope", "unit"]],
    ["node", ["tests/run.js", "--scope", "e2e"]],
    ["node", ["--test", "tests/ci/stub-acceptance.test.js"]],
    ["node", ["--test", "tests/ci/cli-smoke.test.js"]],
  ]);
  const calls = [];
  assert.equal(runCiStages(stages, (command, args) => {
    calls.push([command, args]);
    return { status: args[0] === "tests/run.js" && args[2] === "unit" ? 1 : 0 };
  }), 1);
  assert.deepEqual(calls, [stages[0]]);
  const stub = await import(stubAgentModule);
  assert.equal(typeof stub.createSchemaAwareStubProvider, "function");
  const provider = stub.createSchemaAwareStubProvider();
  assert.ok(provider.enrich("{}").includes("chapters"));
  assert.ok(provider.text("{}").includes("text"));
  assert.match(provider.quality("{}"), /pass/i);
});

test("R3: CI scope stages cannot select credentialed agent tests", async () => {
  const module = await loadCiModule();
  assert.ok(module, "tests/ci.js must expose the CI stage selection");
  const stages = module.createCiStages();
  assert.equal(stages.flat(2).includes("--agent"), false);
  assert.equal(stages.flat(2).some((part) => String(part).includes("tests/agent")), false);

  for (const scope of ["unit", "e2e"]) {
    const dirs = buildSearchDirs({ root: "/repo" }, { scope });
    assert.equal(dirs.some((dir) => dir.includes("/tests/agent")), false);
  }
});

test("R3: stub acceptance copies base, injects the helper provider, and runs without credentials", async () => {
  let module;
  try {
    module = await import(stubAcceptanceModule);
  } catch {
    module = null;
  }
  assert.ok(module?.runStubAcceptance, "stub acceptance must expose an injectable credential-free pipeline runner");
  const stub = await import(stubAgentModule);
  const calls = [];
  const result = await module.runStubAcceptance({
    fixtureName: "base",
    env: {},
    getEnv: (name) => {
      if (/key|token|secret|credential/i.test(name)) throw new Error(`credential lookup is forbidden: ${name}`);
      return undefined;
    },
    getAcceptanceFixtureDir: (name) => {
      calls.push(["fixture", name]);
      return "/fixtures/base";
    },
    copyFixture: (fixture) => {
      calls.push(["copy", fixture]);
      return "/tmp/base";
    },
    createProvider: stub.createSchemaAwareStubProvider,
    runPipeline: async (tmp, provider) => {
      calls.push(["pipeline", tmp, provider]);
      return { steps: ["scan", "enrich", "text", "quality"] };
    },
    verifyQuality: (provider) => {
      calls.push(["quality", provider]);
      return provider.quality("{}");
    },
  });
  assert.deepEqual(calls.slice(0, 2), [["fixture", "base"], ["copy", "/fixtures/base"]]);
  assert.equal(calls[2][0], "pipeline");
  assert.equal(calls[2][2], calls[3][1], "the pipeline and quality verification must receive the same stub provider");
  assert.equal(typeof calls[2][2].enrich, "function");
  assert.equal(typeof calls[2][2].text, "function");
  assert.equal(typeof calls[2][2].quality, "function");
  assert.equal(calls[3][0], "quality");
  assert.match(result.quality, /pass/i);
});

test("R5: retained package-script surface remains explicit", () => {
  const scripts = JSON.parse(readFileSync(resolve(import.meta.dirname, "..", "..", "..", "package.json"), "utf8")).scripts;
  assert.deepEqual(
    Object.fromEntries(["test", "test:unit", "test:e2e", "test:acceptance", "test:agent", "test:all", "test:ci"].map((name) => [name, scripts[name]])),
    {
      test: "node tests/run.js",
      "test:unit": "node tests/run.js --scope unit",
      "test:e2e": "node tests/run.js --scope e2e",
      "test:acceptance": "node tests/acceptance/run.js",
      "test:agent": "node tests/run.js --agent",
      "test:all": "node tests/run.js --all",
      "test:ci": "node tests/ci.js",
    },
  );
});
