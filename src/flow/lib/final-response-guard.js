/**
 * The host-facing final-response guard for an active Flow.
 *
 * A CLI process cannot observe an agent host emitting a final response.  The
 * host calls this command immediately before doing so.  Non-terminal
 * directives deliberately produce a failed envelope so a host can reject the
 * final attempt and dispatch the returned continuation instead.
 */

import { Envelope } from "../../lib/flow-envelope.js";
import { FlowCommand } from "./base-command.js";
import GetNextActionCommand from "./get-next-action.js";
import { NextActionDirective } from "./next-action-directive.js";

const CONTINUATION_DIRECTIVE_KINDS = new Set([
  "execute_step",
  "execute_command",
  "repair_evidence",
]);

const FINAL_DIRECTIVE_KINDS = new Set([
  "await_user_decision",
  "blocked",
  "completed",
  "aborted",
  "idle",
]);

function finalResponseData({ allowed, reason, directive = null, mismatch = null, error = null }) {
  return {
    finalResponse: {
      allowed,
      reason,
      ...(directive && { directive }),
      ...(mismatch && { mismatch }),
      ...(error && { error }),
    },
  };
}

/**
 * Classifies the fresh `flow get next-action` result at the host boundary.
 * This is intentionally independent from prose in the Flow skill: host
 * integrations need a typed decision that they can enforce.
 */
export class FinalResponseGuard {
  decide(nextAction) {
    const directive = NextActionDirective.fromStored(nextAction?.directive);
    if (CONTINUATION_DIRECTIVE_KINDS.has(directive.kind)) {
      return Envelope.fail(
        "get",
        "final-response-guard",
        "FLOW_CONTINUATION_REQUIRED",
        "A non-terminal Flow directive must be dispatched before the agent may return a final response.",
        finalResponseData({
          allowed: false,
          reason: "non_terminal_directive",
          directive: directive.toJSON(),
        }),
      );
    }
    if (FINAL_DIRECTIVE_KINDS.has(directive.kind)) {
      return finalResponseData({
        allowed: true,
        reason: directive.kind,
        directive: directive.toJSON(),
      });
    }
    throw new Error(`final response guard cannot classify directive: ${directive.kind}`);
  }

  targetMismatch(mismatch) {
    return finalResponseData({
      allowed: true,
      reason: "target_mismatch",
      mismatch,
    });
  }

  unresolvedTarget(error) {
    if (error?.code === "FLOW_TARGET_NOT_FOUND") {
      return this.targetMismatch(error.data || null);
    }
    return Envelope.fail(
      "get",
      "final-response-guard",
      "FLOW_FINAL_RESPONSE_UNVERIFIED",
      "The Flow target could not be resolved, so the agent final response cannot be allowed.",
      finalResponseData({
        allowed: false,
        reason: "target_unresolved",
        error: {
          code: error?.code || "ERROR",
          message: error?.message || String(error),
        },
      }),
    );
  }
}

export default class GetFinalResponseGuardCommand extends FlowCommand {
  constructor({ guard = new FinalResponseGuard(), nextAction = new GetNextActionCommand() } = {}) {
    super({
      requiresFlow: false,
      explicitTargetResolution: true,
      targetMismatchResolution: "execute",
    });
    this.guard = guard;
    this.nextAction = nextAction;
  }

  async execute(ctx) {
    if (ctx.targetMismatch) return this.guard.targetMismatch(ctx.targetMismatch);
    if (ctx.targetResolutionError) return this.guard.unresolvedTarget(ctx.targetResolutionError);
    return this.guard.decide(await this.nextAction.execute(ctx));
  }
}
