import { acceptanceTest } from "../../../../../tests/acceptance/lib/test-template.js";

acceptanceTest("node", {
  fixtureDir: new URL("./fixtures/", import.meta.url),
});
