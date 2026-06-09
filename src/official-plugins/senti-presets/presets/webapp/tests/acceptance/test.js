import { acceptanceTest } from "../../../../../tests/acceptance/lib/test-template.js";

acceptanceTest("webapp", {
  fixtureDir: new URL("./fixtures/", import.meta.url),
  configOverrides: { type: "webapp" },
});
