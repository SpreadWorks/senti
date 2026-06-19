import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Container } from "../../../src/lib/container.js";
import { FlowCommand } from "../../../src/flow/lib/base-command.js";

function makeContainerWithAmbiguousActiveFlows() {
  const container = new Container();
  const flowManager = {
    load: () => null,
    resolveActiveFlow: () => {
      throw new Error("multiple active flows: 001-demo (worktree), 002-demo (worktree)");
    },
  };
  container.register("paths", { root: "/repo" });
  container.register("mainRoot", "/repo");
  container.register("config", {});
  container.register("flowManager", flowManager);
  container.register("inWorktree", false);
  return container;
}

describe("optional flow context resolution", () => {
  it("requiresFlow:false commands continue when active flow discovery is ambiguous", async () => {
    let captured;
    class OptionalCommand extends FlowCommand {
      constructor() {
        super({ requiresFlow: false });
      }

      execute(ctx) {
        captured = ctx;
        return { ok: true };
      }
    }

    const cmd = new OptionalCommand();
    const result = await cmd.run(makeContainerWithAmbiguousActiveFlows(), { runId: "preparing-run" });

    assert.deepEqual(result, { ok: true });
    assert.equal(captured.flowState, null);
    assert.match(captured.flowResolutionError.message, /multiple active flows/);
    assert.equal(captured.runId, "preparing-run");
  });

  it("requiresFlow:true commands still fail when active flow discovery is ambiguous", async () => {
    class RequiredCommand extends FlowCommand {
      execute() {
        return { ok: true };
      }
    }

    const cmd = new RequiredCommand();
    await assert.rejects(
      () => cmd.run(makeContainerWithAmbiguousActiveFlows(), {}),
      /multiple active flows/,
    );
  });
});
