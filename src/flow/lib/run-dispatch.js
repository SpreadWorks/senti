/**
 * Agent-independent Flow continuation dispatcher.
 *
 * The CLI cannot observe an interactive agent host emitting its final
 * response.  Instead of depending on a host lifecycle callback, this command
 * owns the non-terminal portion of the Flow: it asks for the guarded next
 * action, delegates one action to the configured provider-neutral Agent
 * service, verifies durable progress, and repeats until the Flow reaches a
 * user or terminal boundary.
 */

import crypto from "node:crypto";
import path from "node:path";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import {
  ProcessOwnedLock,
  RealDirectoryAuthority,
} from "../../lib/process-owned-lock.js";
import {
  AbortedDirective,
  AwaitUserDecisionDirective,
  BlockedDirective,
  CompletedDirective,
  ExecuteCommandDirective,
  ExecuteStepDirective,
  IdleDirective,
  NextActionDirective,
  RepairEvidenceDirective,
} from "./next-action-directive.js";
import { finalRegressionWorktreeFingerprint } from "./test-artifacts.js";
import { guardFlagsForState } from "./user-action-prompt.js";
import GetNextActionCommand from "./get-next-action.js";
import { RepairArtifactRegistry } from "./repair-state-identity.js";

const DEFAULT_MAX_DISPATCHES = 256;
const DEFAULT_MAX_STALLED_DISPATCHES = 3;
const APPROVAL_TOKEN_VERSION = "flow-dispatch-approval-v1";
const DISPATCH_LOCK_KIND = "flow-dispatch";

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function errorMessages(envelope) {
  return (envelope?.errors || [])
    .flatMap((entry) => entry?.messages || [])
    .map(String);
}

function errorCode(envelope) {
  return envelope?.errors?.find((entry) => entry?.level === "fatal")?.code
    || envelope?.errors?.[0]?.code
    || "FLOW_DISPATCH_NEXT_ACTION_FAILED";
}

function targetGuardInput(ctx) {
  return {
    ...(ctx.expectRunId ? { expectRunId: ctx.expectRunId } : {}),
    ...(ctx.expectSpec ? { expectSpec: ctx.expectSpec } : {}),
    ...(ctx.expectIssue != null ? { expectIssue: ctx.expectIssue } : {}),
    ...(ctx.expectNoIssue === true ? { expectNoIssue: true } : {}),
    _envelopeType: "get",
    _envelopeKey: "next-action",
  };
}

function readFlowState(ctx) {
  try {
    return ctx.flowManager.loadReadOnly(ctx.specId);
  } catch (error) {
    if (error?.code === "ERR_MISSING_FILE" || error?.message === "no active flow (flow.json not found)") {
      return null;
    }
    throw error;
  }
}

function dispatchRepositoryFingerprint(ctx) {
  const state = ctx.flowState || readFlowState(ctx);
  const registry = state?.spec ? new RepairArtifactRegistry(state.spec) : null;
  return finalRegressionWorktreeFingerprint(ctx.root, {
    pathspecExcludes: registry?.gitPathspecExcludes() || [],
  });
}

function dispatchLockError(status, message, { lockPath, cause } = {}) {
  const error = new Error(message, { cause });
  error.name = "FlowDispatchLockError";
  error.code = status === "live"
    ? "FLOW_DISPATCH_BUSY"
    : `FLOW_DISPATCH_LOCK_${status.replace(/-/g, "_").toUpperCase()}`;
  error.lockPath = lockPath;
  return error;
}

export class FlowDispatchLease {
  constructor({ mainRoot, runId }) {
    const root = new RealDirectoryAuthority(mainRoot, {
      errorFactory: dispatchLockError,
    });
    const directory = new RealDirectoryAuthority(path.join(mainRoot, ".senti"), {
      create: true,
      parentAuthority: root,
      errorFactory: dispatchLockError,
    });
    this.lock = new ProcessOwnedLock({
      directoryAuthority: directory,
      fileName: `.flow-dispatch-${sha256(runId).slice(0, 24)}.lock`,
      kind: DISPATCH_LOCK_KIND,
      authority: { runId },
      errorFactory: dispatchLockError,
    });
  }

  acquire() {
    // A dispatcher process can disappear while its detached agent child (and
    // therefore a long-running review started by that child) is still alive.
    // Reclaiming an apparently stale parent lock would permit a second review
    // to overwrite the first one's canonical artifacts. Fail closed until an
    // operator has verified that the original process tree has ended.
    return this.lock.acquire({ claimStale: false });
  }

  release() {
    this.lock.release();
  }
}

class FlowDispatchIdentity {
  constructor({ runId, nextAction, worktreeFingerprint }) {
    this.runId = runId;
    this.nextAction = nextAction;
    this.worktreeFingerprint = worktreeFingerprint;
    this.digest = sha256(stableStringify({
      runId,
      nextAction,
      worktreeFingerprint,
    }));
    Object.freeze(this);
  }

  static capture({ ctx, nextAction, repositoryFingerprint }) {
    let worktreeFingerprint = null;
    try {
      worktreeFingerprint = repositoryFingerprint(ctx);
    } catch {
      // A non-Git fixture or a repository that is temporarily unavailable is
      // still protected by the guarded next-action identity.
    }
    return new FlowDispatchIdentity({
      runId: ctx.expectRunId,
      nextAction,
      worktreeFingerprint,
    });
  }

  equals(other) {
    return other instanceof FlowDispatchIdentity && this.digest === other.digest;
  }

  approvalToken() {
    return sha256(`${APPROVAL_TOKEN_VERSION}\0${this.digest}`);
  }
}

export class FlowDispatchAction {
  constructor(nextAction) {
    if (!nextAction || typeof nextAction !== "object" || Array.isArray(nextAction)) {
      throw new Error("Flow dispatch requires a next-action object");
    }
    this.nextAction = nextAction;
    this.directive = NextActionDirective.fromStored(nextAction.directive);
    Object.freeze(this);
  }

  get requiresApproval() {
    return this.nextAction.requires_approval === true;
  }

  get hasAutoUpgradeChoice() {
    return this.directive instanceof ExecuteStepDirective
      && this.nextAction.autoUpgrade?.available === true;
  }

  get isContinuation() {
    return this.directive instanceof ExecuteStepDirective
      || this.directive instanceof ExecuteCommandDirective
      || this.directive instanceof RepairEvidenceDirective;
  }

  get isTerminal() {
    return this.directive instanceof BlockedDirective
      || this.directive instanceof CompletedDirective
      || this.directive instanceof AbortedDirective
      || this.directive instanceof IdleDirective;
  }

  get awaitsUserDecision() {
    return this.directive instanceof AwaitUserDecisionDirective;
  }
}

export class FlowDispatchBoundary {
  constructor({ kind, nextAction, dispatchCount, approvalToken = null, message = null }) {
    this.kind = kind;
    this.nextAction = nextAction;
    this.dispatchCount = dispatchCount;
    this.approvalToken = approvalToken;
    this.message = message;
    Object.freeze(this);
  }

  toJSON() {
    return {
      dispatch: {
        boundary: this.kind,
        dispatchCount: this.dispatchCount,
        ...(this.approvalToken && { approvalToken: this.approvalToken }),
        ...(this.message && { message: this.message }),
      },
      nextAction: this.nextAction,
    };
  }
}

class FlowDispatchWork {
  constructor({ action, targetGuards }) {
    this.action = action;
    this.targetGuards = targetGuards;
    Object.freeze(this);
  }

  prompt() {
    const nonblockingRule = this.action.nextAction.nonblockingDecision
      ? [
          "",
          "A nonblockingDecision is present. Resolve and record exactly that",
          "digest-guarded decision before the ordinary directive, then let the",
          "parent dispatcher refresh authority. Do not ask the user.",
        ].join("\n")
      : "";
    return [
      "You are a worker owned by the senti Flow CLI dispatcher.",
      "Execute exactly one supplied non-terminal Flow action in the current repository.",
      "Do not invoke a senti.flow skill and do not run `senti flow run dispatch`.",
      "Do not merely describe the work. Perform the edits and commands required by",
      "the action, including its durable Flow transition or guarded refresh.",
      "Run every command in the foreground and wait for it to finish. Never start",
      "a review, gate, test, or other Flow command in parallel or in the background.",
      "Never choose a user decision. If a genuine user decision appears unexpectedly,",
      "leave it unchanged and report that fact.",
      `Use these exact target guards for every target-sensitive Flow command: ${this.targetGuards}`,
      nonblockingRule,
      "",
      "Guarded next action:",
      JSON.stringify(this.action.nextAction, null, 2),
      "",
      "Your response is only a worker report. The CLI ignores it as a completion",
      "signal and independently verifies the refreshed Flow and repository state.",
    ].join("\n");
  }
}

function blockedBoundary({ nextAction, dispatchCount, message }) {
  return new FlowDispatchBoundary({
    kind: "blocked",
    nextAction,
    dispatchCount,
    message,
  }).toJSON();
}

export default class RunDispatchCommand extends FlowCommand {
  constructor({
    nextAction = new GetNextActionCommand(),
    agent = null,
    repositoryFingerprint = dispatchRepositoryFingerprint,
    maxDispatches = DEFAULT_MAX_DISPATCHES,
    maxStalledDispatches = DEFAULT_MAX_STALLED_DISPATCHES,
    leaseFactory = (ctx) => new FlowDispatchLease({
      mainRoot: ctx.mainRoot || ctx.root,
      runId: ctx.expectRunId,
    }),
  } = {}) {
    super({ explicitTargetResolution: true });
    this.nextAction = nextAction;
    this.agent = agent;
    this.repositoryFingerprint = repositoryFingerprint;
    this.maxDispatches = maxDispatches;
    this.maxStalledDispatches = maxStalledDispatches;
    this.leaseFactory = leaseFactory;
  }

  async fetchNextAction(ctx) {
    return this.nextAction.run(this.container, targetGuardInput(ctx));
  }

  failure(ctx, code, messages, data) {
    return Envelope.fail(
      ctx._envelopeType || "run",
      ctx._envelopeKey || "dispatch",
      code,
      messages,
      data,
    );
  }

  async execute(ctx) {
    if (!ctx.expectRunId) {
      return this.failure(
        ctx,
        "FLOW_DISPATCH_TARGET_REQUIRED",
        "flow dispatch requires --expect-run-id so every continuation remains bound to one Flow",
        null,
      );
    }

    const lease = this.leaseFactory(ctx);
    try {
      lease.acquire();
    } catch (error) {
      return this.failure(
        ctx,
        error.code || "FLOW_DISPATCH_LOCK_FAILED",
        error.message || String(error),
        blockedBoundary({
          nextAction: null,
          dispatchCount: 0,
          message: error.code === "FLOW_DISPATCH_BUSY"
            ? "Another live dispatcher owns this exact Flow. Wait for it to finish; do not start a duplicate review."
            : error.code === "FLOW_DISPATCH_LOCK_STALE"
              ? "The prior dispatcher owner is gone, but its worker may still be running. Verify that process tree has ended before recovering the lease; do not start a duplicate review."
              : "The Flow dispatcher lease could not be acquired safely.",
        }),
      );
    }
    try {
      return await this.dispatchContinuation(ctx);
    } finally {
      lease.release();
    }
  }

  async dispatchContinuation(ctx) {
    const agent = this.agent || this.container.get("agent");
    let dispatchCount = 0;
    let stalledDispatches = 0;
    let suppliedApproval = ctx.approve || null;
    let current = await this.fetchNextAction(ctx);

    while (dispatchCount < this.maxDispatches) {
      if (current instanceof Envelope) {
        const code = errorCode(current);
        if (code === "ACTIVE_FLOW_MISMATCH" || code === "FLOW_TARGET_NOT_FOUND") {
          return new FlowDispatchBoundary({
            kind: "target_mismatch",
            nextAction: null,
            dispatchCount,
            message: errorMessages(current).join(" "),
          }).toJSON();
        }
        return this.failure(
          ctx,
          code,
          errorMessages(current),
          blockedBoundary({
            nextAction: null,
            dispatchCount,
            message: "The guarded next action could not be resolved.",
          }),
        );
      }

      const action = new FlowDispatchAction(current);
      const identity = FlowDispatchIdentity.capture({
        ctx,
        nextAction: current,
        repositoryFingerprint: this.repositoryFingerprint,
      });

      if (action.awaitsUserDecision) {
        if (suppliedApproval) {
          return this.failure(
            ctx,
            "FLOW_DISPATCH_APPROVAL_STALE",
            "the supplied approval token no longer targets an approval boundary",
            new FlowDispatchBoundary({
              kind: "await_user_decision",
              nextAction: current,
              dispatchCount,
            }).toJSON(),
          );
        }
        return new FlowDispatchBoundary({
          kind: "await_user_decision",
          nextAction: current,
          dispatchCount,
        }).toJSON();
      }

      if (action.isTerminal) {
        if (suppliedApproval) {
          return this.failure(
            ctx,
            "FLOW_DISPATCH_APPROVAL_STALE",
            "the supplied approval token no longer targets an active approval boundary",
            new FlowDispatchBoundary({
              kind: action.directive.kind,
              nextAction: current,
              dispatchCount,
            }).toJSON(),
          );
        }
        return new FlowDispatchBoundary({
          kind: action.directive.kind,
          nextAction: current,
          dispatchCount,
        }).toJSON();
      }

      if (action.hasAutoUpgradeChoice) {
        if (suppliedApproval) {
          return this.failure(
            ctx,
            "FLOW_DISPATCH_APPROVAL_STALE",
            "the supplied approval token no longer targets an approval boundary",
            new FlowDispatchBoundary({
              kind: "auto_upgrade_decision",
              nextAction: current,
              dispatchCount,
            }).toJSON(),
          );
        }
        return new FlowDispatchBoundary({
          kind: "auto_upgrade_decision",
          nextAction: current,
          dispatchCount,
        }).toJSON();
      }

      if (!action.isContinuation) {
        return this.failure(
          ctx,
          "FLOW_DISPATCH_DIRECTIVE_INVALID",
          `flow dispatch cannot execute directive kind ${action.directive.kind}`,
          blockedBoundary({
            nextAction: current,
            dispatchCount,
            message: "The next-action directive is not dispatchable.",
          }),
        );
      }

      const flowState = readFlowState(ctx);
      const autoApproved = flowState?.autoApprove === true;
      if (action.requiresApproval && !autoApproved) {
        const expectedApproval = identity.approvalToken();
        if (!suppliedApproval) {
          return new FlowDispatchBoundary({
            kind: "approval_required",
            nextAction: current,
            dispatchCount,
            approvalToken: expectedApproval,
          }).toJSON();
        }
        if (suppliedApproval !== expectedApproval) {
          return this.failure(
            ctx,
            "FLOW_DISPATCH_APPROVAL_STALE",
            "the supplied approval token does not match the current guarded next action",
            new FlowDispatchBoundary({
              kind: "approval_required",
              nextAction: current,
              dispatchCount,
              approvalToken: expectedApproval,
            }).toJSON(),
          );
        }
        suppliedApproval = null;
      } else if (suppliedApproval) {
        return this.failure(
          ctx,
          "FLOW_DISPATCH_APPROVAL_STALE",
          "the supplied approval token targets a different Flow action",
          blockedBoundary({
            nextAction: current,
            dispatchCount,
            message: "Refresh the approval boundary before continuing.",
          }),
        );
      }

      const guards = guardFlagsForState(flowState || ctx.flowState);
      const work = new FlowDispatchWork({ action, targetGuards: guards });
      let agentError = null;
      try {
        await agent.call(work.prompt(), {
          commandId: "flow.dispatch",
          executionWorkDir: ctx.root,
          cacheMode: "bypass",
          retryCount: 0,
          waitForProcessTree: true,
        });
      } catch (error) {
        agentError = error;
      }
      dispatchCount += 1;

      const refreshed = await this.fetchNextAction(ctx);
      if (refreshed instanceof Envelope) {
        current = refreshed;
        continue;
      }
      if (agentError) {
        const refreshedAction = new FlowDispatchAction(refreshed);
        if (refreshedAction.isTerminal || refreshedAction.awaitsUserDecision) {
          current = refreshed;
          continue;
        }
        return this.failure(
          ctx,
          "FLOW_DISPATCH_AGENT_FAILED",
          `the configured Flow worker failed: ${agentError.message || agentError}`,
          blockedBoundary({
            nextAction: refreshed,
            dispatchCount,
            message: "The worker process ended and guarded authority was refreshed. Resolve the provider failure before resuming this non-terminal action.",
          }),
        );
      }
      const refreshedIdentity = FlowDispatchIdentity.capture({
        ctx,
        nextAction: refreshed,
        repositoryFingerprint: this.repositoryFingerprint,
      });
      stalledDispatches = identity.equals(refreshedIdentity)
        ? stalledDispatches + 1
        : 0;
      if (stalledDispatches >= this.maxStalledDispatches) {
        return this.failure(
          ctx,
          "FLOW_DISPATCH_STALLED",
          `the configured Flow worker returned ${stalledDispatches} time(s) without durable progress`,
          blockedBoundary({
            nextAction: refreshed,
            dispatchCount,
            message: "The worker response was not accepted as completion because the guarded Flow and repository state did not change.",
          }),
        );
      }
      current = refreshed;
    }

    return this.failure(
      ctx,
      "FLOW_DISPATCH_LIMIT_REACHED",
      `flow dispatch exceeded its ${this.maxDispatches}-action safety limit`,
      blockedBoundary({
        nextAction: current instanceof Envelope ? null : current,
        dispatchCount,
        message: "Resume after inspecting why the finite Flow exceeded the dispatcher safety limit.",
      }),
    );
  }
}
