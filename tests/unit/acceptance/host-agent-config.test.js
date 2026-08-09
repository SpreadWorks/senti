import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";

import { buildCtx, copyFixtureInto } from "../../acceptance/lib/pipeline.js";
import { acceptanceFixtureConfigOverrides } from "../../acceptance/lib/test-template.js";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";

let hostRoot = null;
let fixtureRoot = null;
let destination = null;

afterEach(() => {
  for (const root of [hostRoot, fixtureRoot, destination]) {
    if (root) removeTmpDir(root);
  }
  hostRoot = null;
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

test("acceptance fixture inherits the host worktree agent profile and resolves relative providers from that root", () => {
  hostRoot = createTmpDir("acceptance-host-worktree-");
  fixtureRoot = createTmpDir("acceptance-fixture-");
  destination = createTmpDir("acceptance-destination-");

  writeJson(hostRoot, ".senrail/config.json", baseConfig({
    default: "codex",
    providers: {
      "worktree/codex": {
        command: "tools/codex",
        args: ["exec", "{{PROMPT}}"],
      },
    },
  }));
  writeJson(hostRoot, ".senrail/config.local.json", {
    agent: {
      useProfile: "worktree-codex",
      profiles: {
        "worktree-codex": {
          "docs.text": "worktree/codex",
        },
      },
    },
  });
  writeJson(fixtureRoot, ".senrail/config.json", baseConfig({
    default: "claude",
    providers: {
      claude: { command: "claude", args: ["-p", "{{PROMPT}}"] },
    },
  }));

  copyFixtureInto(
    fixtureRoot,
    destination,
    acceptanceFixtureConfigOverrides({ type: "fixture-type" }, hostRoot),
  );

  const copied = JSON.parse(fs.readFileSync(path.join(destination, ".senrail", "config.json"), "utf8"));
  assert.equal(copied.type, "fixture-type");
  assert.equal(copied.agent.useProfile, "worktree-codex");
  assert.equal(copied.agent.providers["worktree/codex"].command, path.join(hostRoot, "tools", "codex"));
  assert.equal(copied.agent.providers.claude, undefined);

  const { ctx } = buildCtx(destination);
  const resolved = ctx.agent.resolve("docs.text");
  assert.equal(resolved.profile.command, path.join(hostRoot, "tools", "codex"));
});
