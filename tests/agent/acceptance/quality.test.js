/**
 * tests/agent/acceptance/quality.test.js
 *
 * Opt-in real-provider quality evaluation. This is intentionally the only
 * caller of verifyWithAI: deterministic acceptance never resolves a provider.
 */

import { after, describe, it } from "node:test";
import { copyFixture, removeTmpDir, runPipeline } from "../../acceptance/lib/pipeline.js";
import { getAcceptanceFixtureDir } from "../../acceptance/lib/targets.js";
import { commitAll, initGitRepo } from "../../support/infrastructure/git-repo.js";
import { verifyWithAI } from "./ai-verify.js";

describe("agent acceptance quality", { timeout: 600000 }, () => {
  const configOverrides = {
    type: "base",
    agent: { default: "codex/gpt-5.4", timeout: 240, retryCount: 1 },
  };
  const root = copyFixture(getAcceptanceFixtureDir("base"), configOverrides);
  initGitRepo(root);
  commitAll(root, "agent acceptance fixture");

  after(() => removeTmpDir(root));

  it("evaluates generated base documentation with the configured real provider", async () => {
    const { ctx } = await runPipeline(root);
    await verifyWithAI(root, ctx.config, "base");
  });
});
