import assert from "node:assert/strict";
import { describe, it } from "node:test";

import RunDispatchCommand from "../../../src/flow/lib/run-dispatch.js";

const NOOP_LEASE_FACTORY = () => ({
  acquire() {},
  release() {},
});

const REPAIR_ACTION = {
  taskId: null,
  step: "test-review",
  action: "run-review",
  instructions: { key: "plan.test-review", content: "Repair rejected evidence and review it again." },
  context: null,
  output_schema: {},
  requires_approval: false,
  maxAttempts: 4,
  directive: {
    kind: "repair_evidence",
    terminal: false,
    requiresUserAction: false,
    actionId: "REPAIR_REVIEW_EVIDENCE",
    evidenceKind: "review",
    phase: "test",
    instruction: "Repair the persisted test-review findings.",
    reason: "The review is rejected and semantic retries remain.",
    nextAction: "senti flow get next-action --expect-run-id 'run-dispatch'",
  },
};

const REVIEW_ACTION = {
  ...REPAIR_ACTION,
  directive: {
    kind: "execute_step",
    terminal: false,
    requiresUserAction: false,
    action: "run-review",
  },
};

const AUTO_APPROVAL_ACTION = {
  ...REVIEW_ACTION,
  step: "approval",
  action: "await-approval",
  requires_approval: true,
  auto_approval_choice_id: "1",
};

const MANUAL_EXCEPTION_ACTION = {
  ...REVIEW_ACTION,
  step: "acceptance-decision",
  action: "set-acceptance-decision",
  requires_approval: true,
};

const ACCEPTANCE_HANDOFF = {
  taskId: null,
  step: "test-review",
  action: "await-acceptance",
  instructions: null,
  context: null,
  output_schema: null,
  requires_approval: false,
  directive: {
    kind: "await_user_decision",
    terminal: false,
    requiresUserAction: true,
    actionPrompt: {
      question: "Choose the exhausted-review disposition.",
      choices: [{
        actionId: "ACCEPT_RISK",
        label: "Accept the bounded risk",
        nextAction: "senti flow set acceptance-decision accepted",
        impact: { retains: [], changes: ["acceptance disposition"], deletes: [] },
      }, {
        actionId: "KEEP_STRICT_FLOW",
        label: "Keep the strict blocker",
        stateTransition: "retain-strict-flow-block",
        impact: { retains: ["strict review blocker"], changes: [], deletes: [] },
      }],
      recommendedActionId: "KEEP_STRICT_FLOW",
      recommendationReason: "The semantic retry budget is exhausted.",
    },
    reason: "The semantic retry budget is exhausted.",
  },
};

const COMPLETED_ACTION = {
  taskId: null,
  step: null,
  action: "completed",
  instructions: null,
  context: null,
  output_schema: null,
  requires_approval: false,
  directive: {
    kind: "completed",
    terminal: true,
    requiresUserAction: false,
  },
};

function context(state, overrides = {}) {
  return {
    root: "/tmp/senti-flow-dispatch-fixture",
    specId: "481-flow-dispatch",
    expectRunId: "run-dispatch",
    expectSpec: "specs/481-flow-dispatch/spec.json",
    flowState: state,
    flowManager: {
      loadReadOnly() {
        return structuredClone(state);
      },
      mutate(callback) {
        callback(state);
      },
    },
    _envelopeType: "run",
    _envelopeKey: "dispatch",
    ...overrides,
  };
}

function command({ current, state, agent, maxStalledDispatches = 3 }) {
  const instance = new RunDispatchCommand({
    nextAction: {
      async run() {
        return structuredClone(current.value);
      },
    },
    agent,
    repositoryFingerprint: () => state.repositoryRevision,
    maxStalledDispatches,
    leaseFactory: NOOP_LEASE_FACTORY,
  });
  instance.container = {};
  return instance;
}

describe("Flow continuation dispatcher", () => {
  it("serially redispatches a premature worker response through repair, changed evidence, re-review, and acceptance handoff", async () => {
    const state = { runId: "run-dispatch", autoApprove: false, repositoryRevision: "r0" };
    const current = { value: REPAIR_ACTION };
    let calls = 0;
    let active = 0;
    let maxActive = 0;
    const agent = {
      async call(_prompt, options) {
        calls += 1;
        active += 1;
        maxActive = Math.max(maxActive, active);
        assert.equal(options.retryCount, 0);
        assert.equal(options.executionWorkDir, "/tmp/senti-flow-dispatch-fixture");
        assert.equal(options.waitForProcessTree, true);
        await new Promise((resolve) => setImmediate(resolve));
        if (calls === 2) {
          state.repositoryRevision = "r1";
          current.value = REVIEW_ACTION;
        } else if (calls === 3) {
          state.repositoryRevision = "r2";
          current.value = ACCEPTANCE_HANDOFF;
        }
        active -= 1;
        return calls === 1 ? "I am done." : "worker completed its action";
      },
    };
    const nextAction = {
      async run() {
        assert.equal(active, 0, "next-action must not refresh while a worker or review is still running");
        return structuredClone(current.value);
      },
    };
    const dispatcher = new RunDispatchCommand({
      nextAction,
      agent,
      repositoryFingerprint: () => state.repositoryRevision,
      leaseFactory: NOOP_LEASE_FACTORY,
    });
    dispatcher.container = {};

    const result = await dispatcher.execute(context(state));

    assert.equal(result.dispatch.boundary, "await_user_decision");
    assert.equal(result.dispatch.dispatchCount, 3);
    assert.equal(result.nextAction.directive.kind, "await_user_decision");
    assert.equal(calls, 3);
    assert.equal(maxActive, 1);
  });

  it("returns an exact approval token and accepts it only for the unchanged guarded action", async () => {
    const state = { runId: "run-dispatch", autoApprove: false, repositoryRevision: "approval-r0" };
    const current = {
      value: {
        ...REVIEW_ACTION,
        step: "approval",
        requires_approval: true,
      },
    };
    let calls = 0;
    const agent = {
      async call() {
        calls += 1;
        state.repositoryRevision = "approval-r1";
        current.value = COMPLETED_ACTION;
        return "approved action complete";
      },
    };

    const first = await command({ current, state, agent }).execute(context(state));
    assert.equal(first.dispatch.boundary, "approval_required");
    assert.match(first.dispatch.approvalToken, /^[a-f0-9]{64}$/);
    assert.equal(calls, 0);

    const resumed = await command({ current, state, agent }).execute(context(state, {
      approve: first.dispatch.approvalToken,
    }));
    assert.equal(resumed.dispatch.boundary, "completed");
    assert.equal(resumed.dispatch.dispatchCount, 1);
    assert.equal(calls, 1);
    assert.equal(state.flowDispatchApprovals.length, 1);
    assert.equal(state.flowDispatchApprovals[0].approvalToken, first.dispatch.approvalToken);
  });

  it("reuses a durable exact approval after a worker failure", async () => {
    const state = { runId: "run-dispatch", autoApprove: false, repositoryRevision: "approval-retry" };
    const current = {
      value: {
        ...REVIEW_ACTION,
        step: "approval",
        requires_approval: true,
      },
    };
    const first = await command({
      current,
      state,
      agent: { async call() {} },
    }).execute(context(state));
    let calls = 0;
    const failed = await command({
      current,
      state,
      agent: {
        async call(_prompt, options) {
          calls += 1;
          const invocation = JSON.parse(options.executionEnvironment.SENTI_FLOW_DISPATCH_INVOCATION);
          assert.equal(invocation.authorization.source, "explicit");
          assert.equal(invocation.authorization.approved, true);
          assert.equal(invocation.authorization.actionDigest, invocation.action.digest);
          throw new Error("provider unavailable after approval");
        },
      },
    }).execute(context(state, { approve: first.dispatch.approvalToken }));
    assert.equal(failed.ok, false);
    assert.equal(failed.errors[0].code, "FLOW_DISPATCH_AGENT_FAILED");
    assert.equal(state.flowDispatchApprovals.length, 1);

    const resumed = await command({
      current,
      state,
      agent: {
        async call(_prompt, options) {
          calls += 1;
          const invocation = JSON.parse(options.executionEnvironment.SENTI_FLOW_DISPATCH_INVOCATION);
          assert.equal(invocation.authorization.source, "explicit");
          assert.equal(invocation.authorization.actionDigest, invocation.action.digest);
          current.value = COMPLETED_ACTION;
        },
      },
    }).execute(context(state));
    assert.equal(resumed.dispatch.boundary, "completed");
    assert.equal(calls, 2);
  });

  it("rejects stale approval without invoking the worker", async () => {
    const state = { runId: "run-dispatch", autoApprove: false, repositoryRevision: "approval-r0" };
    const current = {
      value: {
        ...REVIEW_ACTION,
        step: "approval",
        requires_approval: true,
      },
    };
    let calls = 0;
    const result = await command({
      current,
      state,
      agent: { async call() { calls += 1; } },
    }).execute(context(state, { approve: "0".repeat(64) }));

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FLOW_DISPATCH_APPROVAL_STALE");
    assert.equal(result.data.dispatch.boundary, "approval_required");
    assert.equal(calls, 0);
  });

  it("rejects autoApprove authorization when the repository fingerprint changes before handoff", async () => {
    const state = { runId: "run-dispatch", autoApprove: true, repositoryRevision: "auto-r0" };
    const current = { value: AUTO_APPROVAL_ACTION };
    let fingerprintReads = 0;
    let calls = 0;
    const dispatcher = new RunDispatchCommand({
      nextAction: {
        async run() {
          return structuredClone(current.value);
        },
      },
      agent: { async call() { calls += 1; } },
      repositoryFingerprint: () => (fingerprintReads++ === 0 ? "auto-r0" : "auto-r1"),
      leaseFactory: NOOP_LEASE_FACTORY,
    });
    dispatcher.container = {};

    const result = await dispatcher.execute(context(state));

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FLOW_DISPATCH_AUTHORIZATION_STALE");
    assert.equal(result.data.invocation.authorization.source, "autoApprove");
    assert.equal(result.data.invocation.authorization.choiceId, "1");
    assert.equal(calls, 0);
  });

  it("does not auto-authorize a manual exception", async () => {
    const state = { runId: "run-dispatch", autoApprove: true, repositoryRevision: "manual" };
    const current = { value: MANUAL_EXCEPTION_ACTION };
    let calls = 0;

    const result = await command({
      current,
      state,
      agent: { async call() { calls += 1; } },
    }).execute(context(state));

    assert.equal(result.dispatch.boundary, "approval_required");
    assert.equal(calls, 0);
  });

  for (const [kind, directive] of [
    ["blocked", {
      kind: "blocked",
      terminal: true,
      requiresUserAction: false,
      code: "EXTERNAL_DEPENDENCY_UNAVAILABLE",
      reason: "The dependency is unavailable.",
      resumeInstruction: "Resume when the dependency is restored.",
    }],
    ["completed", COMPLETED_ACTION.directive],
    ["aborted", {
      kind: "aborted",
      terminal: true,
      requiresUserAction: false,
      reason: "The Flow was aborted.",
    }],
    ["idle", {
      kind: "idle",
      terminal: true,
      requiresUserAction: false,
    }],
  ]) {
    it(`returns ${kind} without invoking a worker`, async () => {
      const state = { runId: "run-dispatch", autoApprove: false, repositoryRevision: kind };
      const current = {
        value: {
          ...COMPLETED_ACTION,
          action: kind,
          directive,
        },
      };
      let calls = 0;
      const result = await command({
        current,
        state,
        agent: { async call() { calls += 1; } },
      }).execute(context(state));

      assert.equal(result.dispatch.boundary, kind);
      assert.equal(result.dispatch.dispatchCount, 0);
      assert.equal(calls, 0);
    });
  }

  it("fails closed after bounded serial worker completions with no durable progress", async () => {
    const state = { runId: "run-dispatch", autoApprove: false, repositoryRevision: "stalled" };
    const current = { value: REPAIR_ACTION };
    let calls = 0;
    const result = await command({
      current,
      state,
      maxStalledDispatches: 2,
      agent: {
        async call() {
          calls += 1;
          return "premature normal final response";
        },
      },
    }).execute(context(state));

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FLOW_DISPATCH_STALLED");
    assert.equal(result.data.dispatch.boundary, "blocked");
    assert.equal(result.data.dispatch.dispatchCount, 2);
    assert.equal(calls, 2);
  });

  it("treats changing diagnostics on the same route as a bounded stall", async () => {
    const state = { runId: "run-dispatch", autoApprove: false, repositoryRevision: "same-content" };
    const current = { value: structuredClone(REPAIR_ACTION) };
    let calls = 0;
    const result = await command({
      current,
      state,
      maxStalledDispatches: 2,
      agent: {
        async call() {
          calls += 1;
          current.value.lastStepAttempt = {
            attempt: calls,
            recordedAt: `2026-07-29T00:00:0${calls}.000Z`,
          };
        },
      },
    }).execute(context(state));

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FLOW_DISPATCH_STALLED");
    assert.equal(calls, 2);
  });

  it("refreshes authority once after a failed worker and never duplicates the failed action", async () => {
    const state = { runId: "run-dispatch", autoApprove: false, repositoryRevision: "failed" };
    const current = { value: REPAIR_ACTION };
    let calls = 0;
    const result = await command({
      current,
      state,
      agent: {
        async call() {
          calls += 1;
          throw new Error("review worker exited after its process finished");
        },
      },
    }).execute(context(state));

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FLOW_DISPATCH_AGENT_FAILED");
    assert.equal(result.data.dispatch.dispatchCount, 1);
    assert.equal(result.data.nextAction.directive.kind, "repair_evidence");
    assert.equal(calls, 1);
  });

  it("passes one stable dispatch invocation id to every worker in a dispatcher invocation", async () => {
    const state = { runId: "run-dispatch", autoApprove: false, repositoryRevision: "invocation-r0" };
    const current = { value: REVIEW_ACTION };
    const invocationIds = [];
    const invocationContracts = [];
    const bindingValues = [];
    const callsByInvocation = new Map();
    const agent = {
      async call(_prompt, options) {
        const invocationId = options.executionEnvironment.SENTI_FLOW_DISPATCH_INVOCATION_ID;
        invocationIds.push(invocationId);
        invocationContracts.push(JSON.parse(
          options.executionEnvironment.SENTI_FLOW_DISPATCH_INVOCATION,
        ));
        bindingValues.push(options.executionEnvironment.SENTI_FLOW_TARGET_BINDING);
        const invocationCallCount = (callsByInvocation.get(invocationId) || 0) + 1;
        callsByInvocation.set(invocationId, invocationCallCount);
        state.repositoryRevision = `invocation-r${invocationIds.length}`;
        current.value = invocationCallCount === 1 ? REPAIR_ACTION : COMPLETED_ACTION;
      },
    };

    const first = await command({ current, state, agent }).execute(context(state));

    assert.equal(first.dispatch.boundary, "completed");
    assert.equal(invocationIds.length, 2);
    assert.match(invocationIds[0], /^[0-9a-f-]{36}$/);
    assert.equal(invocationIds[0], invocationIds[1]);
    assert.equal(bindingValues[0], bindingValues[1]);
    assert.equal(invocationContracts[0].id, invocationIds[0]);
    assert.equal(invocationContracts[0].target.runId, state.runId);
    assert.match(invocationContracts[0].action.digest, /^[a-f0-9]{64}$/);
    assert.equal(invocationContracts[0].authorization.source, "unapproved");

    current.value = REVIEW_ACTION;
    state.repositoryRevision = "invocation-r3";
    const second = await command({ current, state, agent }).execute(context(state));

    assert.equal(second.dispatch.boundary, "completed");
    assert.equal(invocationIds.length, 4);
    assert.notEqual(invocationIds[0], invocationIds[2]);
    assert.equal(invocationIds[2], invocationIds[3]);
  });

  it("honors a terminal transition discovered after the worker process exits with an error", async () => {
    const state = { runId: "run-dispatch", autoApprove: false, repositoryRevision: "cleanup" };
    const current = { value: REPAIR_ACTION };
    let calls = 0;
    const result = await command({
      current,
      state,
      agent: {
        async call() {
          calls += 1;
          current.value = COMPLETED_ACTION;
          throw new Error("worker cwd was removed by successful cleanup");
        },
      },
    }).execute(context(state));

    assert.equal(result.dispatch.boundary, "completed");
    assert.equal(result.dispatch.dispatchCount, 1);
    assert.equal(calls, 1);
  });
});
