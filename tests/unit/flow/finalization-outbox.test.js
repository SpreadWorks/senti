import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BeginOutboxEffect,
  CompleteOutboxEffect,
  ExecuteSideEffects,
  SetStepStatus,
  buildInitialNestedSteps,
  resolveLifecycle,
} from "../../../src/flow/definition.js";
import {
  FlowOutbox,
  FlowOutboxEntry,
  FlowOutboxIdentity,
} from "../../../src/flow/lib/flow-outbox.js";
import { flattenSteps } from "../../../src/flow/lib/step-tree.js";
import { Command } from "../../../src/lib/command.js";
import { dispatch } from "../../../src/lib/dispatcher.js";

function finalizationIdentity(stepId) {
  return new FlowOutboxIdentity({
    runId: "run-421",
    taskId: null,
    stepId,
    operation: stepId,
  });
}

describe("resumable finalization outbox", () => {
  it("places report between final-regression and finalize-commit", () => {
    const ids = flattenSteps(buildInitialNestedSteps()).map((step) => step.id);
    assert.deepEqual(
      ids.slice(ids.indexOf("final-regression"), ids.indexOf("finalize-commit") + 1),
      ["final-regression", "report", "finalize-commit"],
    );
  });

  it("retains one stable identity across pending, failed, retry, and done", () => {
    const identity = finalizationIdentity("finalize-commit");
    const outbox = new FlowOutbox();

    const pending = outbox.begin(identity, "2026-07-17T00:00:00.000Z");
    assert.ok(pending instanceof FlowOutboxEntry);
    assert.equal(pending.status, "pending");

    outbox.fail(identity, new Error("process killed"), "2026-07-17T00:00:01.000Z");
    const retried = outbox.begin(identity, "2026-07-17T00:00:02.000Z");
    assert.equal(retried.idempotencyKey, pending.idempotencyKey);
    assert.equal(retried.attempt, 2);

    outbox.complete(identity, { status: "done" }, "2026-07-17T00:00:03.000Z");
    const resumed = outbox.begin(identity, "2026-07-17T00:00:04.000Z");
    assert.equal(resumed.status, "done");
    assert.equal(resumed.attempt, 2);
    assert.equal(outbox.entries.length, 1);
  });

  it("resumes a done outbox entry without executing the side effect twice", async () => {
    let executions = 0;
    let postHooks = 0;
    class SideEffectCommand extends Command {
      static outputMode = "envelope";

      execute() {
        executions += 1;
        return { status: "done" };
      }
    }
    const identity = finalizationIdentity("finalize-sync");
    const outbox = new FlowOutbox();
    outbox.begin(identity, "2026-07-17T00:00:00.000Z");
    const done = outbox.complete(identity, { status: "done" }, "2026-07-17T00:00:01.000Z");

    let output = "";
    await dispatch({
      container: { has: () => false, get: () => null },
      entry: {
        args: {},
        requiresFlow: false,
        command: async () => ({ default: SideEffectCommand }),
        pre(ctx) { ctx.flowOutboxEntry = done; },
        post() { postHooks += 1; },
      },
      argv: [],
      envelopeType: "run",
      envelopeKey: "finalize-sync",
      stdout(text) { output += text; },
      stderr() {},
      setExitCode() {},
    });

    assert.equal(JSON.parse(output).ok, true);
    assert.equal(executions, 0);
    assert.equal(postHooks, 1);
  });

  it("confirms report outbox before marking report done", () => {
    const actions = resolveLifecycle({
      event: "report:post",
      command: "report",
      result: { result: "ok" },
    });
    assert.ok(actions[0] instanceof CompleteOutboxEffect);
    assert.ok(actions[1] instanceof SetStepStatus);
    assert.equal(actions[1].step, "report");
    assert.equal(actions[1].status, "done");
  });

  it("completes gate side effects before marking the gate done", () => {
    const actions = resolveLifecycle({
      event: "gate:post",
      currentStepId: "impl-gate",
      phase: "integration",
      result: { result: "pass", artifacts: { phase: "integration" } },
    });
    const effectIndex = actions.findIndex((action) => action instanceof ExecuteSideEffects);
    const doneIndex = actions.findIndex((action) => (
      action instanceof SetStepStatus && action.step === "impl-gate" && action.status === "done"
    ));
    assert.ok(effectIndex >= 0);
    assert.ok(doneIndex > effectIndex);
  });

  for (const command of ["finalize-commit", "finalize-merge", "finalize-sync", "finalize-cleanup"]) {
    it(`${command} confirms its outbox before marking the step done`, () => {
      const actions = resolveLifecycle({
        event: "finalize:post",
        command,
        currentStepId: command,
        result: { status: "done" },
      });
      const completeIndex = actions.findIndex((action) => action instanceof CompleteOutboxEffect);
      const doneIndex = actions.findIndex((action) => (
        action instanceof SetStepStatus && action.step === command && action.status === "done"
      ));
      assert.ok(actions.some((action) => action instanceof BeginOutboxEffect) === false);
      assert.ok(completeIndex >= 0);
      assert.ok(doneIndex > completeIndex);
    });
  }

  it("recognizes an envelope-wrapped cleanup result as successful", () => {
    const actions = resolveLifecycle({
      event: "finalize:post",
      command: "finalize-cleanup",
      currentStepId: "finalize-cleanup",
      result: { data: { status: "done" } },
    });
    assert.ok(actions.some((action) => action instanceof CompleteOutboxEffect));
    assert.ok(actions.some((action) => (
      action instanceof SetStepStatus && action.step === "finalize-cleanup" && action.status === "done"
    )));
  });
});
