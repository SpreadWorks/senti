import { acceptanceTest } from "../../../../../tests/acceptance/lib/test-template.js";

acceptanceTest("laravel", {
  fixtureDir: new URL("./fixtures/", import.meta.url),
});
