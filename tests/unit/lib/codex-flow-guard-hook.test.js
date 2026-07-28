import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CODEX_FLOW_GUARD_HOOK_FILE,
  mergeCodexFlowGuardHook,
} from "../../../src/lib/codex-flow-guard-hook.js";

describe("Codex Flow final-response hook deployment", () => {
  it("retains project-owned Stop hooks and replaces only its managed handler", () => {
    const config = {
      description: "Project hooks",
      hooks: {
        Stop: [
          { hooks: [{ type: "command", command: "node project-stop.mjs" }] },
          { hooks: [{ type: "command", command: `node .codex/hooks/${CODEX_FLOW_GUARD_HOOK_FILE}` }] },
        ],
      },
    };

    const merged = mergeCodexFlowGuardHook(config);
    assert.equal(merged.description, "Project hooks");
    assert.equal(merged.hooks.Stop.length, 2);
    assert.equal(merged.hooks.Stop[0].hooks[0].command, "node project-stop.mjs");
    const managed = merged.hooks.Stop.flatMap((group) => group.hooks)
      .filter((handler) => handler.command.includes(CODEX_FLOW_GUARD_HOOK_FILE));
    assert.equal(managed.length, 1);
    assert.match(managed[0].command, /git rev-parse --show-toplevel/);
  });

  it("rejects malformed project hooks rather than replacing them", () => {
    assert.throws(
      () => mergeCodexFlowGuardHook({ hooks: { Stop: {} } }),
      /hooks\.Stop.*array/,
    );
  });
});
