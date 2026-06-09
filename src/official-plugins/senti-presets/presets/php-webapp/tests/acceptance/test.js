import { acceptanceTest } from "../../../../../tests/acceptance/lib/test-template.js";

acceptanceTest("php", {
  fixtureDir: new URL("./fixtures/", import.meta.url),
});
