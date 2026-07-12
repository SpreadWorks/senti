import assert from "node:assert/strict";
import { test } from "node:test";
import { createStubPipeline, runStubAcceptance } from "./stub-acceptance.js";
import { createSchemaAwareStubProvider } from "../helpers/stub-agent.js";

test("stub acceptance runs the base fixture with a schema-aware provider", async () => {
  const provider = createSchemaAwareStubProvider();
  const result = await runStubAcceptance({
    createProvider: () => provider,
    runPipeline: createStubPipeline(provider),
  });
  assert.match(result.quality, /pass/i);
  assert.ok(result.steps.some((step) => step.name === "scan"));
});
