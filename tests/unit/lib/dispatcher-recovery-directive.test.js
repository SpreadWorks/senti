import assert from "node:assert/strict";
import { it } from "node:test";

import { Command } from "../../../src/lib/command.js";
import { dispatch } from "../../../src/lib/dispatcher.js";
import {
  ExternalBlockedOutcome,
  StepAttempt,
} from "../../../src/flow/lib/step-outcome.js";

it("keeps a guarded mechanical recovery successful after an external-blocked attempt", async () => {
  class MechanicalRecoveryCommand extends Command {
    static outputMode = "envelope";

    execute() {
      return {
        stepAttempt: new StepAttempt({
          runId: "run-mechanical-recovery",
          stepId: "spec-gate",
          attempt: 1,
          outcome: new ExternalBlockedOutcome({
            reason: "mechanical",
            resumeInstruction: "Resolve the mechanical blocker.",
          }),
        }).toJSON(),
        directive: {
          kind: "execute_command",
          terminal: false,
          requiresUserAction: false,
          actionId: "RECOVER_CANONICAL_REVIEW_PASS",
          nextAction: "senti flow run recover-review-pass --phase spec",
          instruction: "Recover the exact canonical PASS projection.",
          reason: "The prior mutable projection was overwritten.",
        },
      };
    }
  }

  let stdout = "";
  let exitCode = 0;
  await dispatch({
    container: { has: () => false, get: () => null },
    entry: {
      args: {},
      requiresFlow: false,
      command: async () => ({ default: MechanicalRecoveryCommand }),
    },
    argv: [],
    envelopeType: "get",
    envelopeKey: "next-action",
    stdout: (text) => { stdout += text; },
    stderr: () => {},
    setExitCode: (code) => { exitCode = code; },
  });

  const envelope = JSON.parse(stdout);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.data.directive.actionId, "RECOVER_CANONICAL_REVIEW_PASS");
  assert.deepEqual(envelope.errors, []);
  assert.equal(exitCode, 0);
});
