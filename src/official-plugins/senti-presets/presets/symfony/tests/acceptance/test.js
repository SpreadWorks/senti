import { acceptanceTest } from "../../../../../tests/acceptance/lib/test-template.js";

acceptanceTest("symfony", {
  fixtureDir: new URL("./fixtures/", import.meta.url),
});
