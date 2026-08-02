import crypto from "node:crypto";

import {
  FlowTargetBinding,
  FlowTargetExpectation,
} from "../../lib/flow-target-guard.js";
import { NextActionDirective } from "./next-action-directive.js";

const DISPATCH_INVOCATION_VERSION = 1;
const APPROVAL_RECEIPT_VERSION = 1;
const APPROVAL_TOKEN_VERSION = "flow-dispatch-approval-v2";

export const FLOW_DISPATCH_INVOCATION_ENV = "SENTI_FLOW_DISPATCH_INVOCATION";
export const FLOW_DISPATCH_INVOCATION_ID_ENV = "SENTI_FLOW_DISPATCH_INVOCATION_ID";
export const FLOW_TARGET_BINDING_ENV = "SENTI_FLOW_TARGET_BINDING";

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

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

export function flowDispatchDigest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function expectationFromContext(ctx) {
  if (ctx.targetExpectation instanceof FlowTargetExpectation) return ctx.targetExpectation;
  if (ctx.expectBinding) {
    return new FlowTargetExpectation({ expectBinding: ctx.expectBinding });
  }
  // execute(ctx) unit adapters bypass FlowCommand.run(), whose boundary owns
  // full guard normalization. Their already-resolved context only needs the
  // effective run identity for the internal contract.
  return new FlowTargetExpectation({
    ...(ctx.expectRunId ? { expectRunId: ctx.expectRunId } : {}),
  });
}

export class FlowDispatchTarget {
  constructor({ expectation, binding = null }) {
    if (!(expectation instanceof FlowTargetExpectation)) {
      throw new Error("FlowDispatchTarget requires a FlowTargetExpectation");
    }
    if (binding != null && !(binding instanceof FlowTargetBinding)) {
      throw new Error("FlowDispatchTarget binding must be a FlowTargetBinding");
    }
    if (binding) {
      const mismatch = expectation.mismatchAgainst(binding.toJSON());
      if (mismatch) throw new Error("FlowDispatchTarget binding conflicts with its expectation");
    }
    const runId = binding?.runId ?? expectation.effectiveRunId;
    this.runId = requireString(runId, "FlowDispatchTarget runId");
    this.specId = binding?.specId ?? expectation.effectiveSpecId;
    this.issue = binding ? binding.issue : expectation.effectiveIssue;
    this.expectsNoIssue = binding ? binding.issue == null : expectation.expectsNoIssue;
    this.expectation = expectation;
    this.binding = binding;
    this.digest = flowDispatchDigest(stableStringify({
      runId: this.runId,
      specId: this.specId,
      issue: this.issue,
      expectsNoIssue: this.expectsNoIssue,
      bindingDigest: this.binding?.digest ?? null,
    }));
    Object.freeze(this);
  }

  static captureContext(ctx) {
    const expectation = expectationFromContext(ctx);
    const binding = expectation.binding ?? (ctx.flowCommandBoundary === true
      ? FlowTargetBinding.captureContext(ctx, ctx.flowState)
      : null);
    return new FlowDispatchTarget({ expectation, binding });
  }

  get dispatchLockRoot() {
    return this.binding?.dispatchLockRoot ?? null;
  }

  guardInput() {
    if (this.binding) return { expectBinding: this.binding.serialize() };
    return {
      expectRunId: this.runId,
      ...(this.specId && { expectSpec: this.specId }),
      ...(this.issue != null
        ? { expectIssue: this.issue }
        : this.expectsNoIssue
          ? { expectNoIssue: true }
          : {}),
    };
  }

  toJSON() {
    return {
      digest: this.digest,
      runId: this.runId,
      specId: this.specId,
      issue: this.issue,
      expectsNoIssue: this.expectsNoIssue,
      bindingDigest: this.binding?.digest ?? null,
    };
  }
}

function directiveProgressIdentity(nextAction) {
  const directive = NextActionDirective.fromStored(nextAction.directive);
  return {
    kind: directive.kind,
    actionId: directive.actionId ?? directive.continuation?.actionId ?? null,
    action: directive.action ?? null,
    evidenceKind: directive.evidenceKind ?? null,
    phase: directive.phase ?? null,
    nextAction: directive.nextAction ?? directive.continuation?.nextAction ?? null,
  };
}

export class FlowDispatchActionIdentity {
  constructor({ target, nextAction, repositoryFingerprint = null }) {
    if (!(target instanceof FlowDispatchTarget)) {
      throw new Error("FlowDispatchActionIdentity requires a FlowDispatchTarget");
    }
    if (!nextAction || typeof nextAction !== "object" || Array.isArray(nextAction)) {
      throw new Error("FlowDispatchActionIdentity requires a next-action object");
    }
    if (repositoryFingerprint != null) {
      requireString(repositoryFingerprint, "FlowDispatchActionIdentity repositoryFingerprint");
    }
    this.target = target;
    this.nextAction = nextAction;
    this.repositoryFingerprint = repositoryFingerprint;
    this.digest = flowDispatchDigest(stableStringify({
      targetDigest: target.digest,
      runId: target.runId,
      nextAction,
      repositoryFingerprint,
    }));
    this.progressDigest = flowDispatchDigest(stableStringify({
      targetDigest: target.digest,
      runId: target.runId,
      taskId: nextAction.taskId ?? null,
      step: nextAction.step ?? null,
      action: nextAction.action ?? null,
      repositoryFingerprint,
      directive: directiveProgressIdentity(nextAction),
    }));
    Object.freeze(this);
  }

  equals(other) {
    return other instanceof FlowDispatchActionIdentity && this.digest === other.digest;
  }

  hasProgressedTo(other) {
    if (!(other instanceof FlowDispatchActionIdentity)) {
      throw new Error("Flow dispatch progress requires a FlowDispatchActionIdentity");
    }
    return this.progressDigest !== other.progressDigest;
  }

  approvalToken() {
    return flowDispatchDigest(`${APPROVAL_TOKEN_VERSION}\0${this.digest}`);
  }

  toJSON() {
    const directive = directiveProgressIdentity(this.nextAction);
    return {
      digest: this.digest,
      progressDigest: this.progressDigest,
      repositoryFingerprint: this.repositoryFingerprint,
      taskId: this.nextAction.taskId ?? null,
      step: this.nextAction.step ?? null,
      action: this.nextAction.action ?? null,
      directive,
    };
  }
}

export class FlowDispatchAuthorization {
  constructor(action) {
    if (new.target === FlowDispatchAuthorization) {
      throw new Error("FlowDispatchAuthorization is abstract");
    }
    if (!(action instanceof FlowDispatchActionIdentity)) {
      throw new Error("FlowDispatchAuthorization requires a FlowDispatchActionIdentity");
    }
    this.action = action;
    this.actionDigest = action.digest;
  }

  matches(action) {
    return action instanceof FlowDispatchActionIdentity && this.actionDigest === action.digest;
  }

  get approved() {
    return false;
  }

  isGrantedBy() {
    return true;
  }

  workerInstruction() {
    return null;
  }
}

export class UnapprovedFlowDispatchAuthorization extends FlowDispatchAuthorization {
  constructor(action) {
    super(action);
    Object.freeze(this);
  }

  toJSON() {
    return {
      source: "unapproved",
      actionDigest: this.actionDigest,
      approved: false,
    };
  }
}

export class ExplicitFlowDispatchAuthorization extends FlowDispatchAuthorization {
  constructor({
    version = APPROVAL_RECEIPT_VERSION,
    action,
    runId,
    actionDigest = action?.digest,
    approvalToken,
    approvedAt = new Date().toISOString(),
  }) {
    super(action);
    if (version !== APPROVAL_RECEIPT_VERSION) {
      throw new Error(`flow dispatch approval receipt version must be ${APPROVAL_RECEIPT_VERSION}`);
    }
    this.runId = requireString(runId, "flow dispatch approval runId");
    this.approvalToken = requireString(approvalToken, "flow dispatch approval token");
    if (!/^[a-f0-9]{64}$/.test(this.actionDigest) || !/^[a-f0-9]{64}$/.test(this.approvalToken)) {
      throw new Error("flow dispatch approval digests must be SHA-256");
    }
    this.approvedAt = requireString(approvedAt, "flow dispatch approval approvedAt");
    if (!Number.isFinite(Date.parse(this.approvedAt))) {
      throw new Error("flow dispatch approval approvedAt must be an ISO timestamp");
    }
    if (
      this.runId !== action.target.runId
      || actionDigest !== this.actionDigest
      || this.approvalToken !== action.approvalToken()
    ) {
      throw new Error("explicit Flow dispatch authorization is stale");
    }
    this.version = version;
    Object.freeze(this);
  }

  get approved() {
    return true;
  }

  isGrantedBy(flowState) {
    const matching = ExplicitFlowDispatchAuthorization.matching(flowState, this.action);
    return matching != null && matching.approvalToken === this.approvalToken;
  }

  workerInstruction() {
    return `The CLI durably recorded explicit user approval at ${this.approvedAt} for this exact action digest.`;
  }

  toJSON() {
    return {
      source: "explicit",
      approved: true,
      version: this.version,
      runId: this.runId,
      actionDigest: this.actionDigest,
      approvalToken: this.approvalToken,
      approvedAt: this.approvedAt,
    };
  }

  toReceiptJSON() {
    const { source: _source, approved: _approved, ...receipt } = this.toJSON();
    return receipt;
  }

  static fromStored(value, action) {
    return new ExplicitFlowDispatchAuthorization({ ...value, action });
  }

  static matching(flowState, action) {
    const receipts = Array.isArray(flowState?.flowDispatchApprovals)
      ? flowState.flowDispatchApprovals
      : [];
    for (let index = receipts.length - 1; index >= 0; index -= 1) {
      try {
        return ExplicitFlowDispatchAuthorization.fromStored(receipts[index], action);
      } catch (error) {
        if (error?.message !== "explicit Flow dispatch authorization is stale") throw error;
      }
    }
    return null;
  }
}

export class AutoApprovedFlowDispatchAuthorization extends FlowDispatchAuthorization {
  constructor({ action, choiceId }) {
    super(action);
    if (choiceId !== "1") {
      throw new Error("autoApprove authorization must be bound to choice id=1");
    }
    this.choiceId = choiceId;
    Object.freeze(this);
  }

  get approved() {
    return true;
  }

  isGrantedBy(flowState) {
    return flowState?.autoApprove === true;
  }

  workerInstruction() {
    return "User-enabled autoApprove authorizes choice id=1 for this exact action digest.";
  }

  toJSON() {
    return {
      source: "autoApprove",
      approved: true,
      actionDigest: this.actionDigest,
      choiceId: this.choiceId,
    };
  }
}

export class FlowDispatchInvocationStaleError extends Error {
  constructor({ authorization, expectedAction, activeAction }) {
    const authorized = authorization.approved;
    super(authorized
      ? "Flow dispatch authorization is stale for the active action or repository fingerprint"
      : "Flow dispatch invocation is stale for the active action or repository fingerprint");
    this.name = "FlowDispatchInvocationStaleError";
    this.code = authorized
      ? "FLOW_DISPATCH_AUTHORIZATION_STALE"
      : "FLOW_DISPATCH_INVOCATION_STALE";
    this.data = Object.freeze({
      expectedActionDigest: expectedAction.digest,
      activeActionDigest: activeAction.digest,
      authorization: authorization.toJSON(),
    });
  }
}

export class FlowDispatchInvocation {
  constructor({ id = crypto.randomUUID(), target, action, authorization }) {
    if (!(target instanceof FlowDispatchTarget)) {
      throw new Error("FlowDispatchInvocation requires a FlowDispatchTarget");
    }
    if (!(action instanceof FlowDispatchActionIdentity) || action.target !== target) {
      throw new Error("FlowDispatchInvocation action must belong to its target");
    }
    if (!(authorization instanceof FlowDispatchAuthorization) || !authorization.matches(action)) {
      throw new Error("FlowDispatchInvocation authorization must match its action");
    }
    this.version = DISPATCH_INVOCATION_VERSION;
    this.id = requireString(id, "FlowDispatchInvocation id");
    this.target = target;
    this.action = action;
    this.authorization = authorization;
    Object.freeze(this);
  }

  static createId() {
    return crypto.randomUUID();
  }

  assertCurrent(activeAction, flowState = null) {
    if (!this.action.equals(activeAction)) {
      throw new FlowDispatchInvocationStaleError({
        authorization: this.authorization,
        expectedAction: this.action,
        activeAction,
      });
    }
    if (!this.authorization.matches(activeAction) || !this.authorization.isGrantedBy(flowState)) {
      throw new FlowDispatchInvocationStaleError({
        authorization: this.authorization,
        expectedAction: this.action,
        activeAction,
      });
    }
    return this;
  }

  executionEnvironment() {
    return {
      ...(this.target.binding && { [FLOW_TARGET_BINDING_ENV]: this.target.binding.serialize() }),
      [FLOW_DISPATCH_INVOCATION_ID_ENV]: this.id,
      [FLOW_DISPATCH_INVOCATION_ENV]: JSON.stringify(this.toJSON()),
    };
  }

  toJSON() {
    return {
      version: this.version,
      id: this.id,
      target: this.target.toJSON(),
      action: this.action.toJSON(),
      authorization: this.authorization.toJSON(),
    };
  }
}
