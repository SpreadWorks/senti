import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { FlowManager } from "../../../src/lib/flow-manager.js";
import { emptySpecStub } from "../../../src/lib/spec-json.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { CanonicalFlowCreateRequest } from "../../../src/flow/lib/canonical-flow-manager-store.js";
import { CurrentFlowSpecRecord } from "../../../src/flow/lib/current-flow-state.js";
import {
  inspectCanonicalReviewPassRecovery,
} from "../../../src/flow/lib/run-recover-review-pass.js";
import RunRecoverReviewPassCommand from "../../../src/flow/lib/run-recover-review-pass.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const roots = [];

function root() {
  const value = createTmpDir("recover-review-pass-v1-");
  roots.push(value);
  return value;
}

function createCanonicalReviewFixture(specId = "001-review-pass-recovery") {
  const repository = root();
  const flowManager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
  const created = flowManager.createFresh(new CanonicalFlowCreateRequest({
    specId,
    runId: "run-review-pass-recovery",
    request: "Verify that Version-1 review evidence cannot need projection recovery.",
    execution: { mode: "direct" },
    policy: { autoApprove: false, nonblocking: null },
    flowId: "review-pass-recovery-flow",
    flowVersionId: "review-pass-recovery-v1",
    specRecord: new CurrentFlowSpecRecord({ ...emptySpecStub(), tasks: [] }, { specId }),
  }));
  flowManager.addActiveFlow(created.specId, "direct");
  return Object.freeze({ repository, flowManager, created });
}

function guardedContext(fixture, phase) {
  return {
    root: fixture.repository,
    executionRoot: fixture.repository,
    flowState: fixture.flowManager.load(fixture.created.specId),
    flowManager: fixture.flowManager,
    phase,
    expectRunId: fixture.created.runId,
    expectSpec: fixture.created.specId,
    expectNoIssue: true,
  };
}

describe("canonical review PASS recovery", () => {
  afterEach(() => {
    while (roots.length > 0) removeTmpDir(roots.pop());
  });

  for (const phase of ["draft-questions", "draft-coverage", "spec", "test", "impl"]) {
    it(`keeps the ${phase} review result atomic instead of replaying a provider projection`, () => {
      const fixture = createCanonicalReviewFixture(`001-recovery-${phase}`);
      const before = fixture.flowManager.load(fixture.created.specId);
      const activities = fixture.flowManager.activityLedger(fixture.created.specId);
      assert.equal(inspectCanonicalReviewPassRecovery({ state: before, phase }), null);

      const result = new RunRecoverReviewPassCommand().execute(guardedContext(fixture, phase));

      assert.equal(result.ok, false);
      assert.equal(result.errors[0].code, "REVIEW_PASS_RECOVERY_NOT_ELIGIBLE");
      assert.deepEqual(fixture.flowManager.load(fixture.created.specId), before);
      assert.deepEqual(fixture.flowManager.activityLedger(fixture.created.specId), activities);
      assert.equal(Object.hasOwn(before, "reviewConvergence"), false);
      assert.equal(Object.hasOwn(before, "canonicalReviewPassRecoveries"), false);
    });
  }

  it("does not treat a changed review target as a recoverable root projection", () => {
    const fixture = createCanonicalReviewFixture("001-recovery-stale-target");
    const before = fixture.flowManager.load(fixture.created.specId);
    const result = new RunRecoverReviewPassCommand().execute(guardedContext(fixture, "spec"));

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "REVIEW_PASS_RECOVERY_NOT_ELIGIBLE");
    assert.deepEqual(fixture.flowManager.load(fixture.created.specId), before);
    assert.equal(fixture.flowManager.activityLedger(fixture.created.specId).length, 0);
  });

  it("requires exact target guards and advertises the recovery command contract", () => {
    const fixture = createCanonicalReviewFixture("001-recovery-guards");
    const result = new RunRecoverReviewPassCommand().execute({
      root: fixture.repository,
      executionRoot: fixture.repository,
      flowState: fixture.flowManager.load(fixture.created.specId),
      flowManager: fixture.flowManager,
      phase: "spec",
    });
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "REVIEW_PASS_RECOVERY_GUARDS_REQUIRED");

    const entry = FLOW_COMMANDS.run["recover-review-pass"];
    assert.ok(entry);
    assert.ok(entry.args.options.includes("--phase"));
    assert.ok(entry.args.options.includes("--expect-run-id"));
    assert.match(entry.help, /canonical PASS/);
  });
});
