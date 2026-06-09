import { acceptanceTest } from "../../../../../tests/acceptance/lib/test-template.js";

acceptanceTest("cli", {
  fixtureDir: new URL("./fixtures/", import.meta.url),
  configOverrides: { type: "cli" },
});
