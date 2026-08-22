import { acceptanceTest } from "../../../../../tests/acceptance/lib/test-template.js";
import { createSchemaAwareStubProvider, createStubAgent } from "../../../../../tests/support/fakes/stub-agent.js";

acceptanceTest("base", {
  fixtureDir: new URL("./fixtures/", import.meta.url),
  configOverrides: { type: "base" },
  agent: createStubAgent(createSchemaAwareStubProvider()),
});
