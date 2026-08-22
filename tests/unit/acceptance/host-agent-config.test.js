import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { buildCtx, copyFixtureInto } from "../../acceptance/lib/pipeline.js";
import { acceptanceFixtureConfigOverrides } from "../../acceptance/lib/test-template.js";
import { createTmpDir, removeTmpDir, writeJson } from "../../support/builders/tmp-dir.js";

let fixtureRoot = null;
let destination = null;

afterEach(() => {
  for (const root of [fixtureRoot, destination]) {
    if (root) removeTmpDir(root);
  }
  fixtureRoot = null;
  destination = null;
});

function baseConfig(agent) {
  return {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    agent,
    scan: { include: ["src/**/*.js"], exclude: [] },
  };
}

test("acceptance fixture does not inherit a host agent provider", () => {
  fixtureRoot = createTmpDir("acceptance-fixture-");
  destination = createTmpDir("acceptance-destination-");

  writeJson(fixtureRoot, ".sennel/config.json", baseConfig({
    default: "claude",
    providers: {
      claude: { command: "claude", args: ["-p", "{{PROMPT}}"] },
    },
  }));

  copyFixtureInto(
    fixtureRoot,
    destination,
    acceptanceFixtureConfigOverrides({ type: "fixture-type" }),
  );

  const { ctx } = buildCtx(destination);
  assert.equal(ctx.config.type, "fixture-type");
  assert.equal(ctx.agent, null);
});
