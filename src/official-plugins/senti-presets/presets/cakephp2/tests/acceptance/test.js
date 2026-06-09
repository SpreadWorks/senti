import { acceptanceTest } from "../../../../../tests/acceptance/lib/test-template.js";

acceptanceTest("cakephp2", {
  fixtureDir: new URL("./fixtures/", import.meta.url),
});
