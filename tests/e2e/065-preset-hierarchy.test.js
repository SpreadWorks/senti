/**
 * Preset hierarchy runtime boundary.
 *
 * Non-base presets are no longer bundled in the main package. Parent chains for
 * non-base presets must come from an enabled project plugin registry.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("presets.js: builtin runtime boundary", () => {
  it("resolves builtin base without a project root", async () => {
    const { resolveChain } = await import("../../src/lib/presets.js");
    assert.deepEqual(resolveChain("base").map((preset) => preset.key), ["base"]);
  });

  it("rejects non-base presets without an enabled project plugin", async () => {
    const { resolveChain, presetByLeaf, PRESETS } = await import("../../src/lib/presets.js");
    assert.throws(() => resolveChain("sample-node-command"), /Preset not found: sample-node-command/);
    assert.equal(presetByLeaf("child-preset"), undefined);
    assert.deepEqual(PRESETS.map((preset) => preset.key), ["base"]);
  });
});
