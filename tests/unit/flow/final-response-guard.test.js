import assert from "node:assert/strict";
import { describe, it } from "node:test";

import GetFinalResponseGuardCommand, {
  FinalResponseGuard,
} from "../../../src/flow/lib/final-response-guard.js";

const REPAIR_DIRECTIVE = {
  kind: "repair_evidence",
  terminal: false,
  requiresUserAction: false,
  actionId: "REPAIR_REVIEW_EVIDENCE",
  evidenceKind: "review",
  phase: "test",
  instruction: "Repair the rejected review evidence.",
  reason: "The review remains rejected.",
  nextAction: "senti flow get next-action --expect-run-id 'run-final-guard'",
};

const RETRY_DIRECTIVE = {
  kind: "execute_command",
  terminal: false,
  requiresUserAction: false,
  actionId: "RETRY_REVIEW",
  nextAction: "senti flow run review --phase test --expect-run-id 'run-final-guard'",
  instruction: "Re-review the changed evidence.",
  reason: "Changed evidence is ready for review.",
};

const USER_DECISION_DIRECTIVE = {
  kind: "await_user_decision",
  terminal: false,
  requiresUserAction: true,
  actionPrompt: {
    question: "Choose the accepted risk disposition.",
    choices: [{
      actionId: "ACCEPT_RISK",
      label: "Accept risk",
      nextAction: "senti flow set acceptance accepted",
      impact: { changes: ["acceptance record"], retains: [], risks: [] },
    }, {
      actionId: "KEEP_STRICT",
      label: "Keep strict review",
      nextAction: "senti flow run review --phase test",
      impact: { changes: [], retains: ["strict review requirement"], risks: [] },
    }],
    recommendedActionId: "ACCEPT_RISK",
    recommendationReason: "The bounded review retry budget is exhausted.",
  },
};

describe("final-response guard", () => {
  it("rejects a final attempt while rejected review evidence still requires repair", () => {
    const result = new FinalResponseGuard().decide({ directive: REPAIR_DIRECTIVE });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FLOW_CONTINUATION_REQUIRED");
    assert.equal(result.data.finalResponse.allowed, false);
    assert.deepEqual(result.data.finalResponse.directive, REPAIR_DIRECTIVE);
  });

  it("keeps the final response rejected until the guarded refresh has dispatched re-review", async () => {
    const directives = [REPAIR_DIRECTIVE, RETRY_DIRECTIVE, USER_DECISION_DIRECTIVE];
    const command = new GetFinalResponseGuardCommand({
      nextAction: {
        async execute() {
          return { directive: directives.shift() };
        },
      },
    });

    const beforeRepair = await command.execute({});
    assert.equal(beforeRepair.ok, false);
    assert.equal(beforeRepair.data.finalResponse.directive.kind, "repair_evidence");

    const afterChangedEvidence = await command.execute({});
    assert.equal(afterChangedEvidence.ok, false);
    assert.equal(afterChangedEvidence.data.finalResponse.directive.kind, "execute_command");
    assert.equal(afterChangedEvidence.data.finalResponse.directive.actionId, "RETRY_REVIEW");

    const acceptanceHandoff = await command.execute({});
    assert.equal(acceptanceHandoff.finalResponse.allowed, true);
    assert.equal(acceptanceHandoff.finalResponse.reason, "await_user_decision");
  });

  it("permits only a true target mismatch when an exact target no longer exists", () => {
    const result = new FinalResponseGuard().unresolvedTarget({
      code: "FLOW_TARGET_NOT_FOUND",
      data: { expectedRunId: "finished-run", matchCount: 0 },
    });

    assert.equal(result.finalResponse.allowed, true);
    assert.equal(result.finalResponse.reason, "target_mismatch");
  });

  it("permits user decision and terminal Flow exits", () => {
    const guard = new FinalResponseGuard();
    const directives = [
      USER_DECISION_DIRECTIVE,
      {
        kind: "blocked",
        terminal: true,
        requiresUserAction: false,
        code: "EXTERNAL_DEPENDENCY_UNAVAILABLE",
        reason: "The required external dependency is unavailable.",
        resumeInstruction: "Resume after the dependency is available.",
      },
      { kind: "completed", terminal: true, requiresUserAction: false },
      { kind: "aborted", terminal: true, requiresUserAction: false, reason: "The Flow was aborted." },
      { kind: "idle", terminal: true, requiresUserAction: false },
    ];

    for (const directive of directives) {
      const result = guard.decide({ directive });
      assert.equal(result.finalResponse.allowed, true, directive.kind);
      assert.equal(result.finalResponse.reason, directive.kind);
    }
  });

  it("rejects an unresolved or ambiguous target rather than allowing an unverified final", () => {
    const result = new FinalResponseGuard().unresolvedTarget({
      code: "FLOW_TARGET_AMBIGUOUS",
      message: "multiple active flows match the target",
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FLOW_FINAL_RESPONSE_UNVERIFIED");
  });
});
