import { acceptanceTest } from "../../../../../tests/acceptance/lib/test-template.js";

acceptanceTest("node-cli", {
  fixtureDir: new URL("./fixtures/", import.meta.url),
});
