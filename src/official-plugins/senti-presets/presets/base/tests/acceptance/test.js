import { acceptanceTest } from "../../../../../tests/acceptance/lib/test-template.js";

acceptanceTest("base", {
  fixtureDir: new URL("./fixtures/", import.meta.url),
  configOverrides: { type: "base" },
});
