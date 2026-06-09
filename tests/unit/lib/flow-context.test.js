import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { Container } from "../../../src/lib/container.js";
import { resolveFlowContext } from "../../../src/flow/lib/flow-context.js";

function buildContainer({ root = "/repo", config = {}, flowState = null } = {}) {
  const c = new Container();
  c.register("config", config);
  c.register("paths", {
    root,
    srcRoot: root,
    sentiDir: path.join(root, ".senti"),
    outputDir: path.join(root, ".senti/output"),
    agentWorkDir: path.join(root, ".tmp"),
    logDir: path.join(root, ".tmp/logs"),
    configPath: path.join(root, ".senti/config.json"),
  });
  c.register("inWorktree", false);
  c.register("mainRoot", root);
  // Stub flowManager whose load() returns the desired snapshot.
  c.register("flowManager", { load: () => flowState });
  return c;
}

describe("resolveFlowContext", () => {
  it("returns flow-specific context fields", () => {
    const fs = { spec: "specs/100-demo/spec.md" };
    const c = buildContainer({ flowState: fs });
    const ctx = resolveFlowContext(c);
    assert.equal(ctx.flowState, fs);
    assert.equal(ctx.specId, "100-demo");
    assert.equal(ctx.inWorktree, false);
    assert.equal(ctx.mainRoot, "/repo");
    assert.equal(ctx.root, "/repo");
  });

  it("returns null specId when no flow state", () => {
    const c = buildContainer({ flowState: null });
    const ctx = resolveFlowContext(c);
    assert.equal(ctx.flowState, null);
    assert.equal(ctx.specId, null);
  });
});
