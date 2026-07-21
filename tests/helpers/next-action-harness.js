import GetNextActionCommand from "../../src/flow/lib/get-next-action.js";

export function createNextActionHarness(
  flowManager,
  { expectedRevision = null, maxAttempts = 10_000 } = {},
) {
  const calls = {
    planner: 0,
    save: 0,
    resolve: 0,
    runtime: 0,
    artifact: 0,
    retry: 0,
  };
  const planner = {
    build(ctx) {
      calls.planner += 1;
      const revision = expectedRevision || ctx.flowState;
      return {
        definition: { id: "spec" },
        rule: { action: "write-spec" },
        outputSchema: { type: "object" },
        instruction: { key: "plan.spec", content: "write the spec" },
        target: {
          scope: "flow",
          stepId: "spec",
          taskId: null,
          runId: revision.runId,
        },
        taskScope: { taskId: null },
        expectedRevision: revision,
        maxAttempts,
      };
    },
  };
  const effects = {
    writeRuntimeLog() { calls.runtime += 1; },
    writeArtifact() { calls.artifact += 1; },
    recordRetry() { calls.retry += 1; },
  };
  const sharedWriter = {
    saveAtomic(...args) {
      calls.save += 1;
      return flowManager.saveAtomic(...args);
    },
    resolveExplicitFlowTarget() {
      calls.resolve += 1;
      throw new Error("next-action commit must not re-resolve its target");
    },
  };
  const command = new GetNextActionCommand({ planner, effects });
  return {
    calls,
    execute: (flowState) => command.execute({ flowState, flowManager: sharedWriter }),
  };
}
