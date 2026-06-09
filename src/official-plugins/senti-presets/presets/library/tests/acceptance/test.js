import { acceptanceTest } from "../../../../../tests/acceptance/lib/test-template.js";

acceptanceTest("library", {
  fixtureDir: new URL("./fixtures/", import.meta.url),
});
