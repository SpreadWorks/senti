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

import path from "node:path";
import { loadSpecJsonSchema } from "../../lib/spec-json.js";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { AgentFailure } from "../../lib/agent-failure.js";
import { DeferredAgentInvocationMetric } from "../../lib/agent-invocation-metric.js";
import { flowCommands } from "../../lib/command-registry.js";
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
import GetNextActionCommand from "./get-next-action.js";
import { FlowDispatchArtifactRegistry } from "./repair-state-identity.js";
import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";
import { appendIssueLogEntry } from "./set-issue-log.js";
import {
  WorkerArtifactHandoffCoordinator,
  WorkerArtifactHandoffError,
  WorkerArtifactRetryExhaustedError,
  WorkerArtifactMutationAuthoritySnapshot,
  WorkerArtifactHandoffRequest,
} from "./worker-artifact-handoff.js";
import {
  AutoApprovedFlowDispatchAuthorization,
  ExplicitFlowDispatchAuthorization,
  FlowDispatchInvocation,
  FlowDispatchSession,
  FlowDispatchTarget,
  UnapprovedFlowDispatchAuthorization,
  flowDispatchDigest,
} from "./dispatch-invocation.js";

const DEFAULT_MAX_DISPATCHES = 256;
const DEFAULT_MAX_STALLED_DISPATCHES = 3;
const DISPATCH_LOCK_KIND = "flow-dispatch";
const DISPATCHER_OWNED_REPAIR_COMMANDS = new Set([
  "repair-plan-gate",
  "repair-test-review",
]);
const SPEC_WORKER_STEPS = new Set(["spec", "spec-repair"]);

function specWorkerAgentOptions(stepId, outputSchema) {
  if (!SPEC_WORKER_STEPS.has(stepId)) return {};
  const schema = loadSpecJsonSchema();
  const schemaGuidance = [
    "The handoff file named spec.json is the canonical spec artifact.",
    "Write valid JSON that matches this schema exactly; do not add properties outside the schema.",
    "The CLI validates the file before it can be sealed or published.",
    "Spec artifact schema:",
    JSON.stringify(schema, null, 2),
  ].join("\n");
  return {
    jsonSchema: outputSchema,
    fmtFallback: schemaGuidance,
    promptGuidance: schemaGuidance,
  };
}

function freshWorkerInvocation(invocation, nextAction) {
  const session = new FlowDispatchSession({ target: invocation.target });
  const action = session.captureAction(nextAction, invocation.action.repositoryFingerprint);
  if (action.digest !== invocation.action.digest) {
    throw new Error("fresh worker handoff action changed before retry");
  }
  let authorization = invocation.authorization;
  if (authorization instanceof ExplicitFlowDispatchAuthorization) {
    authorization = new ExplicitFlowDispatchAuthorization({
      action,
      runId: invocation.target.runId,
      approvalToken: action.approvalToken(),
      approvedAt: authorization.approvedAt,
    });
  } else if (authorization instanceof AutoApprovedFlowDispatchAuthorization) {
    authorization = new AutoApprovedFlowDispatchAuthorization({
      action,
      choiceId: authorization.choiceId,
    });
  } else {
    authorization = new UnapprovedFlowDispatchAuthorization(action);
  }
  return new FlowDispatchInvocation({ session, action, authorization });
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

function targetGuardInput(target) {
  return {
    ...target.guardInput(),
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

export function dispatchRepositoryFingerprint(ctx) {
  const state = ctx.flowState || readFlowState(ctx);
  const registry = state?.specId ? new FlowDispatchArtifactRegistry(relativeFlowSpecFile(state)) : null;
  return finalRegressionWorktreeFingerprint(ctx.executionRoot || ctx.root, {
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
  constructor(session) {
    if (!(session instanceof FlowDispatchSession)) {
      throw new Error("FlowDispatchLease requires a FlowDispatchSession");
    }
    this.session = session;
    const { target } = session;
    const mainRoot = target.dispatchLockRoot;
    if (!mainRoot) {
      throw new Error("FlowDispatchLease target requires captured authority");
    }
    const { runId } = target;
    const root = new RealDirectoryAuthority(mainRoot, {
      errorFactory: dispatchLockError,
    });
    const directory = new RealDirectoryAuthority(path.join(mainRoot, ".senrail"), {
      create: true,
      parentAuthority: root,
      errorFactory: dispatchLockError,
    });
    this.lock = new ProcessOwnedLock({
      directoryAuthority: directory,
      fileName: `.flow-dispatch-${flowDispatchDigest(runId).slice(0, 24)}.lock`,
      kind: DISPATCH_LOCK_KIND,
      authority: {
        runId,
        targetDigest: target.digest,
      },
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

function persistDispatchApproval(ctx, invocation) {
  if (
    !(invocation instanceof FlowDispatchInvocation)
    || !(invocation.authorization instanceof ExplicitFlowDispatchAuthorization)
  ) {
    throw new Error("flow dispatch approval persistence requires an explicitly authorized invocation");
  }
  const { action, authorization } = invocation;
  const state = readFlowState(ctx);
  const existing = ExplicitFlowDispatchAuthorization.matching(state, action);
  if (existing) return existing;
  if (typeof ctx.flowManager?.mutate !== "function") {
    throw new Error("flow dispatch approval persistence requires a writable Flow manager");
  }
  ctx.flowManager.mutate((current) => {
    if (current.runId !== action.target.runId) {
      throw new Error("flow dispatch approval target changed before persistence");
    }
    const receipts = Array.isArray(current.flowDispatchApprovals)
      ? current.flowDispatchApprovals
      : [];
    if (!ExplicitFlowDispatchAuthorization.matching(current, action)) {
      current.flowDispatchApprovals = [...receipts, authorization.toReceiptJSON()];
    }
  }, {
    expectedOriginal: state,
    operationOwnerToken: ctx.repositoryOperationOwnerToken || null,
  });
  return authorization;
}

export class FlowDispatchRepositoryFingerprintError extends Error {
  constructor({ cause, nextAction, dispatchCount, phase }) {
    if (!["action-capture", "pre-handoff-validation", "post-handoff-progress"].includes(phase)) {
      throw new Error(`invalid Flow dispatch repository fingerprint phase: ${phase}`);
    }
    super(`failed to capture the Flow dispatch repository fingerprint: ${cause?.message || cause}`, {
      cause,
    });
    this.name = "FlowDispatchRepositoryFingerprintError";
    this.code = "FLOW_DISPATCH_REPOSITORY_FINGERPRINT_FAILED";
    this.nextAction = nextAction;
    this.dispatchCount = dispatchCount;
    this.phase = phase;
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

  get autoApproveChoiceId() {
    return this.nextAction.auto_approval_choice_id ?? null;
  }

  get isAutoApproveEligible() {
    return this.requiresApproval && this.autoApproveChoiceId === "1";
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

export class FlowDispatchWork {
  constructor(invocation, handoffRequest = null) {
    if (!(invocation instanceof FlowDispatchInvocation)) {
      throw new Error("FlowDispatchWork requires a FlowDispatchInvocation");
    }
    if (handoffRequest != null && !(handoffRequest instanceof WorkerArtifactHandoffRequest)) {
      throw new Error("FlowDispatchWork handoff requires a WorkerArtifactHandoffRequest");
    }
    this.invocation = invocation;
    this.handoffRequest = handoffRequest;
    Object.freeze(this);
  }

  executionEnvironment() {
    return {
      ...this.invocation.executionEnvironment(),
      ...(this.handoffRequest?.executionEnvironment() || {}),
    };
  }

  prompt(promptGuidance = "") {
    const { action, authorization, target } = this.invocation;
    const authorizationInstruction = authorization.workerInstruction();
    const nonblockingRule = action.nextAction.nonblockingDecision
      ? [
          "",
          "A nonblockingDecision is present. Resolve and record exactly that",
          "digest-guarded decision before the ordinary directive, then let the",
          "parent dispatcher refresh authority. Do not ask the user.",
        ].join("\n")
      : "";
    const handoffInstruction = this.handoffRequest
      ? [
          "",
          "This action uses the worker artifact handoff contract below.",
          "Treat its input snapshots as the immutable source for this action.",
          "Write every declared payload only to its exact payloadPath. Existing",
          "instructions naming canonical artifact paths are overridden for outputs.",
          "Do not mark the Flow step done. After writing all payloads, run the exact",
          "sealCommand once. The parent dispatcher alone validates, publishes, records",
          "revisions, and completes the step under canonical repository authority.",
          "Return the successful seal command data object as the worker report; it must",
          "match the guarded action output_schema but is never a completion signal.",
          "",
          "Worker artifact handoff contract:",
          JSON.stringify(this.handoffRequest.toWorkerJSON(), null, 2),
        ].join("\n")
      : "";
    const schemaInstruction = promptGuidance
      ? [
          "",
          "The provider may receive a separate response schema for this worker report.",
          "Use the following canonical spec artifact guidance when writing spec.json:",
          promptGuidance,
        ].join("\n")
      : "";
    return [
      "You are a worker owned by the senrail Flow CLI dispatcher.",
      "Execute exactly one supplied non-terminal Flow action in the current repository.",
      "Do not invoke a senrail.flow skill and do not run `senrail flow run dispatch`.",
      "Do not merely describe the work. Perform the edits and commands required by",
      "the action, including its durable Flow transition or guarded refresh.",
      "Run every command in the foreground and wait for it to finish. Never start",
      "a review, gate, test, or other Flow command in parallel or in the background.",
      "Never choose a user decision. If a genuine user decision appears unexpectedly,",
      "leave it unchanged and report that fact.",
      ...(authorizationInstruction ? [
        authorizationInstruction,
        "This is an already-selected authorization, not permission to infer another choice.",
      ] : []),
      ...(target.binding ? [
        "Target-sensitive senrail commands inherit the CLI-captured Flow binding.",
        "Do not construct or append target identity arguments.",
      ] : []),
      "When the directive includes nextAction, execute that exact CLI-generated",
      "command; do not infer completion from pre-existing artifacts.",
      nonblockingRule,
      schemaInstruction,
      "",
      "Machine-readable dispatch invocation contract:",
      JSON.stringify(this.invocation.toJSON(), null, 2),
      "",
      "Guarded next action:",
      JSON.stringify(action.nextAction, null, 2),
      "",
      "Your response is only a worker report. The CLI ignores it as a completion",
      "signal and independently verifies the refreshed Flow and repository state.",
      handoffInstruction,
    ].join("\n");
  }
}

function workerHandoffFailureData(ctx, error, request, dispatchCount, agentError = null) {
  const state = readFlowState(ctx);
  const stepId = request?.stepId || error.data?.stepId || state?.currentStep || "flow-dispatch";
  const actionDigest = request?.actionDigest || error.data?.actionDigest || null;
  const dispatchInvocationId = request?.dispatchInvocationId || error.data?.dispatchInvocationId || null;
  let issueLogError = null;
  if (state?.specId) {
    try {
      appendIssueLogEntry(
        ctx.mainRoot || ctx.root,
        relativeFlowSpecFile(state),
        {
          step: stepId,
          reason: `Worker artifact handoff ${error.classification || "invalid"}: ${error.message}`,
          trigger: "Parent dispatcher rejected or could not complete a worker artifact handoff.",
          resolution: error instanceof WorkerArtifactRetryExhaustedError
            ? "One fresh worker handoff retry was consumed; correct the artifact producer before dispatching this step again."
            : error.recoveryPossible
            ? "Resume the guarded dispatcher to replay the pending publication journal."
            : "Correct the worker artifact payload and dispatch the current action again.",
          ...(error instanceof WorkerArtifactRetryExhaustedError && {
            diagnostic: {
              code: error.code,
              classification: error.classification,
              attempts: error.data.attempts,
              first: error.data.first,
              second: error.data.second,
            },
          }),
          taskId: null,
          timestamp: new Date().toISOString(),
        },
        `worker-handoff-${actionDigest || "unknown"}-${error.classification || "invalid"}`,
      );
    } catch (logError) {
      issueLogError = logError.message || String(logError);
    }
  }
  return {
    ...blockedBoundary({
      nextAction: request?.invocation?.action?.nextAction || null,
      dispatchCount,
      message: error.recoveryPossible
        ? "Canonical publication is journaled and requires deterministic dispatcher recovery."
        : "The parent dispatcher rejected the worker artifact before completing the Flow step.",
    }),
    classification: error.classification || "invalid",
    retryBudgetConsumed: false,
    recoveryPossible: error.recoveryPossible === true,
    retryable: error.retryable === true,
    ...(error instanceof WorkerArtifactRetryExhaustedError && { retryExhausted: true }),
    actionDigest,
    dispatchInvocationId,
    ...(error.data || {}),
    ...(agentError instanceof AgentFailure ? { agentFailure: agentError.toJSON() } : {}),
    ...(issueLogError ? { issueLogError } : {}),
  };
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
    leaseFactory = (session) => new FlowDispatchLease(session),
    handoffCoordinator = new WorkerArtifactHandoffCoordinator(),
    repairCommandRunner = null,
  } = {}) {
    super({ explicitTargetResolution: true });
    this.nextAction = nextAction;
    this.agent = agent;
    this.repositoryFingerprint = repositoryFingerprint;
    this.maxDispatches = maxDispatches;
    this.maxStalledDispatches = maxStalledDispatches;
    this.leaseFactory = leaseFactory;
    this.handoffCoordinator = handoffCoordinator;
    this.repairCommandRunner = repairCommandRunner;
  }

  async fetchNextAction(target) {
    return this.nextAction.run(this.container, targetGuardInput(target));
  }

  captureAction(ctx, session, nextAction, dispatchCount, phase) {
    try {
      return session.captureAction(nextAction, this.repositoryFingerprint(ctx));
    } catch (cause) {
      throw new FlowDispatchRepositoryFingerprintError({
        cause,
        nextAction,
        dispatchCount,
        phase,
      });
    }
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

  async runDispatcherOwnedRepair(ctx, target, action) {
    if (!(action.directive instanceof RepairEvidenceDirective)) return null;
    const match = /^senrail flow run ([a-z][a-z0-9-]*)(?:\s|$)/.exec(action.directive.nextAction);
    const commandName = match?.[1] || null;
    if (!DISPATCHER_OWNED_REPAIR_COMMANDS.has(commandName)) return null;

    if (this.repairCommandRunner) {
      return this.repairCommandRunner({ ctx, target, action, commandName });
    }

    const entry = flowCommands.run?.[commandName];
    if (!entry?.command) {
      throw new Error(`dispatcher-owned repair command is not registered: ${commandName}`);
    }
    const module = await entry.command();
    const CommandClass = module.default;
    if (typeof CommandClass !== "function") {
      throw new Error(`dispatcher-owned repair command has no command class: ${commandName}`);
    }
    return new CommandClass().run(this.container, {
      ...target.guardInput(),
      _envelopeType: "run",
      _envelopeKey: commandName,
    });
  }

  async runWorkerAttempt(ctx, invocation) {
    const action = new FlowDispatchAction(invocation.action.nextAction);
    let handoffRequest;
    try {
      handoffRequest = this.handoffCoordinator.createRequest({
        ctx,
        state: readFlowState(ctx),
        invocation,
      });
    } catch (error) {
      if (!(error instanceof WorkerArtifactHandoffError)) throw error;
      return { error, handoffRequest: null, agentError: null };
    }

    let workerArtifactAuthority = null;
    try {
      workerArtifactAuthority = handoffRequest
        ? WorkerArtifactMutationAuthoritySnapshot.capture(handoffRequest)
        : null;
    } catch (error) {
      if (!(error instanceof WorkerArtifactHandoffError)) throw error;
      return { error, handoffRequest, agentError: null };
    }

    const work = new FlowDispatchWork(invocation, handoffRequest);
    const deferredMetric = handoffRequest
      ? new DeferredAgentInvocationMetric({ flowManager: ctx.flowManager })
      : null;
    let agentError = null;
    try {
      const agent = this.agent || (this.agent = this.container.get("agent"));
      const workerOptions = specWorkerAgentOptions(
        action.nextAction.step,
        action.nextAction.output_schema,
      );
      const { promptGuidance, ...agentOptions } = workerOptions;
      await agent.call(work.prompt(promptGuidance), {
        commandId: "flow.dispatch",
        executionWorkDir: ctx.executionRoot || ctx.root,
        cacheMode: "bypass",
        retryCount: 0,
        waitForProcessTree: true,
        executionEnvironment: work.executionEnvironment(),
        deferredMetric,
        ...agentOptions,
      });
    } catch (error) {
      agentError = error;
    }

    if (!handoffRequest) return { error: null, handoffRequest: null, agentError };

    let mutationError = null;
    try {
      workerArtifactAuthority.assertUnchanged();
    } catch (error) {
      mutationError = error;
    }
    await deferredMetric.flush();
    if (mutationError) {
      if (!(mutationError instanceof WorkerArtifactHandoffError)) throw mutationError;
      return { error: mutationError, handoffRequest, agentError };
    }
    try {
      this.handoffCoordinator.reconcile({ ctx, request: handoffRequest });
      agentError = null;
    } catch (error) {
      if (!(error instanceof WorkerArtifactHandoffError)) throw error;
      return { error, handoffRequest, agentError };
    }
    return { error: null, handoffRequest, agentError };
  }

  async execute(ctx) {
    let target;
    try {
      target = FlowDispatchTarget.captureContext(ctx);
    } catch (error) {
      return this.failure(
        ctx,
        "FLOW_DISPATCH_TARGET_REQUIRED",
        "flow dispatch requires an exact --expect-binding or --expect-run-id target",
        { cause: error.message || String(error) },
      );
    }

    const session = new FlowDispatchSession({ target });
    const lease = this.leaseFactory(session);
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
      try {
        return await this.dispatchContinuation(ctx, session);
      } catch (error) {
        if (!(error instanceof FlowDispatchRepositoryFingerprintError)) throw error;
        const boundaryMessage = error.phase === "action-capture"
          ? "The repository fingerprint could not be captured. No authorization was issued and no worker was started for this action."
          : error.phase === "pre-handoff-validation"
            ? "The repository fingerprint could not be recaptured before handoff. No worker was started for this action."
            : "The worker ran, but its result was not accepted because repository progress could not be verified.";
        return this.failure(
          ctx,
          error.code,
          error.message,
          {
            ...blockedBoundary({
              nextAction: error.nextAction,
              dispatchCount: error.dispatchCount,
              message: boundaryMessage,
            }),
            cause: error.cause?.message || String(error.cause),
            fingerprintPhase: error.phase,
          },
        );
      }
    } finally {
      lease.release();
    }
  }

  async dispatchContinuation(ctx, session) {
    const { target } = session;
    let dispatchCount = 0;
    let stalledDispatches = 0;
    let suppliedApproval = ctx.approve || null;
    try {
      this.handoffCoordinator.recoverPending({ ctx });
    } catch (error) {
      if (!(error instanceof WorkerArtifactHandoffError)) throw error;
      return this.failure(
        ctx,
        error.code,
        error.message,
        workerHandoffFailureData(ctx, error, null, dispatchCount),
      );
    }
    let current = await this.fetchNextAction(target);

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

      const actionIdentity = this.captureAction(
        ctx,
        session,
        current,
        dispatchCount,
        "action-capture",
      );
      let flowState = readFlowState(ctx);
      const storedAuthorization = action.requiresApproval
        ? ExplicitFlowDispatchAuthorization.matching(flowState, actionIdentity)
        : null;
      let invocation = new FlowDispatchInvocation({
        session,
        action: actionIdentity,
        authorization: storedAuthorization
          ?? new UnapprovedFlowDispatchAuthorization(actionIdentity),
      });
      if (action.requiresApproval) {
        const expectedApproval = invocation.approvalToken();
        if (suppliedApproval && suppliedApproval !== expectedApproval) {
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
        if (suppliedApproval === expectedApproval) {
          const explicitAuthorization = storedAuthorization
            ?? new ExplicitFlowDispatchAuthorization({
              action: actionIdentity,
              runId: target.runId,
              approvalToken: expectedApproval,
            });
          invocation = invocation.withAuthorization(explicitAuthorization);
          const persistedAuthorization = persistDispatchApproval(ctx, invocation);
          invocation = invocation.withAuthorization(persistedAuthorization);
          flowState = readFlowState(ctx);
          suppliedApproval = null;
        } else if (!invocation.approved && flowState?.autoApprove === true && action.isAutoApproveEligible) {
          invocation = invocation.withAuthorization(
            new AutoApprovedFlowDispatchAuthorization({
              action: actionIdentity,
              choiceId: action.autoApproveChoiceId,
            }),
          );
        }
        if (!invocation.approved) {
          return new FlowDispatchBoundary({
            kind: "approval_required",
            nextAction: current,
            dispatchCount,
            approvalToken: expectedApproval,
          }).toJSON();
        }
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

      const validated = await this.fetchNextAction(target);
      if (validated instanceof Envelope) {
        current = validated;
        continue;
      }
      const activeAction = this.captureAction(
        ctx,
        session,
        validated,
        dispatchCount,
        "pre-handoff-validation",
      );
      try {
        invocation.assertCurrent(activeAction, readFlowState(ctx));
      } catch (error) {
        return this.failure(
          ctx,
          error.code || "FLOW_DISPATCH_INVOCATION_STALE",
          error.message || String(error),
          {
            ...blockedBoundary({
              nextAction: validated,
              dispatchCount,
              message: "The action or repository changed before worker handoff. Refresh the guarded invocation before continuing.",
            }),
            invocation: error.data ?? invocation.toJSON(),
          },
        );
      }

      let dispatcherOwnedRepair;
      try {
        dispatcherOwnedRepair = await this.runDispatcherOwnedRepair(ctx, target, action);
      } catch (error) {
        return this.failure(
          ctx,
          error.code || "FLOW_DISPATCH_REPAIR_COMMAND_FAILED",
          error.message || String(error),
          blockedBoundary({
            nextAction: validated,
            dispatchCount,
            message: "The dispatcher-owned repair command failed before the worker handoff could begin.",
          }),
        );
      }
      if (dispatcherOwnedRepair != null) {
        dispatchCount += 1;
        if (dispatcherOwnedRepair instanceof Envelope && !dispatcherOwnedRepair.ok) {
          return this.failure(
            ctx,
            errorCode(dispatcherOwnedRepair),
            errorMessages(dispatcherOwnedRepair),
            blockedBoundary({
              nextAction: validated,
              dispatchCount,
              message: "The dispatcher-owned repair command did not complete the guarded Flow transition.",
            }),
          );
        }
        current = await this.fetchNextAction(target);
        continue;
      }

      let attempt = await this.runWorkerAttempt(ctx, invocation);
      dispatchCount += 1;
      if (attempt.error) {
        if (attempt.error.retryable !== true || !attempt.handoffRequest) {
          return this.failure(
            ctx,
            attempt.error.code,
            attempt.error.message,
            workerHandoffFailureData(
              ctx,
              attempt.error,
              attempt.handoffRequest,
              dispatchCount,
              attempt.agentError,
            ),
          );
        }

        // A producer-side invalid payload is retried exactly once with a new
        // dispatch invocation and therefore a new handoff directory. The
        // first sealed payload is intentionally left byte-for-byte untouched.
        const retryCurrent = await this.fetchNextAction(target);
        if (
          retryCurrent instanceof Envelope
          || retryCurrent.step !== invocation.action.nextAction.step
          || retryCurrent.action !== invocation.action.nextAction.action
        ) {
          return this.failure(
            ctx,
            attempt.error.code,
            attempt.error.message,
            workerHandoffFailureData(
              ctx,
              attempt.error,
              attempt.handoffRequest,
              dispatchCount,
              attempt.agentError,
            ),
          );
        }
        const retryInvocation = freshWorkerInvocation(invocation, retryCurrent);
        const firstError = attempt.error;
        const firstRequest = attempt.handoffRequest;
        attempt = await this.runWorkerAttempt(ctx, retryInvocation);
        dispatchCount += 1;
        if (attempt.error) {
          const exhausted = attempt.error.retryable === true
            ? new WorkerArtifactRetryExhaustedError({
                firstError,
                secondError: attempt.error,
                firstRequest,
                secondRequest: attempt.handoffRequest,
              })
            : attempt.error;
          return this.failure(
            ctx,
            exhausted.code,
            exhausted.message,
            workerHandoffFailureData(
              ctx,
              exhausted,
              attempt.handoffRequest,
              dispatchCount,
              attempt.agentError,
            ),
          );
        }
        invocation = retryInvocation;
      }
      const agentError = attempt.agentError;

      const refreshed = await this.fetchNextAction(target);
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
        const boundary = blockedBoundary({
          nextAction: refreshed,
          dispatchCount,
          message: "The worker process ended and guarded authority was refreshed. Resolve the provider failure before resuming this non-terminal action.",
        });
        return this.failure(
          ctx,
          agentError instanceof AgentFailure ? agentError.code : "FLOW_DISPATCH_AGENT_FAILED",
          `the configured Flow worker failed: ${agentError.message || agentError}`,
          agentError instanceof AgentFailure
            ? { ...boundary, agentFailure: agentError.toJSON() }
            : boundary,
        );
      }
      const refreshedIdentity = this.captureAction(
        ctx,
        session,
        refreshed,
        dispatchCount,
        "post-handoff-progress",
      );
      stalledDispatches = invocation.hasProgressedTo(refreshedIdentity)
        ? 0
        : stalledDispatches + 1;
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
