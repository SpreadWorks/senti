import crypto from "node:crypto";
import { DirectFlowTarget } from "./direct-flow-session.js";
import { DirectScopeAdoption } from "./direct-scope-review.js";

const CLASSIFICATIONS = Object.freeze([
  "FIX_REQUIRED",
  "PROCESS_ONLY",
  "DISMISSED",
  "USER_DECISION_REQUIRED",
  "RISK_ACCEPTED",
]);
const FINDING_ID = /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,299}$/;

function requireString(value, field, max = 4000) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${field} exceeds ${max} characters`);
  return normalized;
}

function requireAuthoredString(value, field, max = 4000) {
  const normalized = requireString(value, field, max);
  if (
    /^<[^<>\r\n]+>$/.test(normalized)
    || /^\{\{[^{}\r\n]+\}\}$/.test(normalized)
  ) {
    throw new Error(`${field} must replace the command placeholder with concrete evidence`);
  }
  return normalized;
}

function stringList(value, field, { allowEmpty = true } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${field} must be ${allowEmpty ? "an" : "a non-empty"} array`);
  }
  const result = value.map((entry, index) => requireString(entry, `${field}[${index}]`, 1000));
  if (new Set(result).size !== result.length) throw new Error(`${field} must not contain duplicates`);
  return result;
}

export class DirectResolutionFinding {
  constructor({
    findingId,
    source,
    classification,
    summary,
    recommendedResolution,
    changeTargets = [],
    rationale,
    selectedResolution = null,
    scopeAdoption = null,
  }) {
    this.findingId = requireString(findingId, "direct finding findingId", 300);
    if (!FINDING_ID.test(this.findingId)) {
      throw new Error("direct finding findingId must be a stable path-safe token");
    }
    this.source = requireAuthoredString(source, "direct finding source", 1000);
    this.classification = requireString(classification, "direct finding classification", 100);
    if (!CLASSIFICATIONS.includes(this.classification)) {
      throw new Error(`invalid direct finding classification: ${this.classification}`);
    }
    this.summary = requireAuthoredString(summary, "direct finding summary");
    this.recommendedResolution = requireAuthoredString(
      recommendedResolution,
      "direct finding recommendedResolution",
    );
    this.changeTargets = Object.freeze(stringList(changeTargets, "direct finding changeTargets"));
    this.rationale = requireAuthoredString(rationale, "direct finding rationale");
    this.selectedResolution = selectedResolution == null
      ? null
      : requireAuthoredString(selectedResolution, "direct finding selectedResolution");
    this.scopeAdoption = scopeAdoption == null
      ? null
      : DirectScopeAdoption.fromStored(scopeAdoption);
    if (
      this.scopeAdoption != null
      && this.scopeAdoption.paths.some((reviewedPath) => !this.changeTargets.includes(reviewedPath))
    ) {
      throw new Error("direct finding changeTargets must include every adopted scope path");
    }
    Object.freeze(this);
  }

  get requiresDecision() {
    return this.classification === "USER_DECISION_REQUIRED" && this.selectedResolution == null;
  }

  toJSON() {
    return {
      findingId: this.findingId,
      source: this.source,
      classification: this.classification,
      summary: this.summary,
      recommendedResolution: this.recommendedResolution,
      changeTargets: [...this.changeTargets],
      rationale: this.rationale,
      selectedResolution: this.selectedResolution,
      scopeAdoption: this.scopeAdoption?.toJSON() || null,
    };
  }

  static fromStored(value) {
    return value instanceof DirectResolutionFinding ? value : new DirectResolutionFinding(value);
  }
}

function stablePlanId(input) {
  const canonical = JSON.stringify({
    runId: input.target.runId,
    spec: input.target.spec,
    issue: input.target.issue,
    flowStateRevision: input.originFlowStateRevision,
    sourceStep: input.sourceStep,
    adoptedActionId: input.adoptedActionId,
  });
  return `direct-plan-${crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 24)}`;
}

export class DirectResolutionPlan {
  constructor({
    planId = null,
    revision = 1,
    target,
    sourceStep,
    transitionReason,
    transitionAt,
    skippedSteps,
    validationItems,
    findings = [],
    routingFailure = null,
    originFlowStateRevision,
    selectionSource,
    adoptedActionId,
    scopePaths = [],
  }) {
    this.target = DirectFlowTarget.fromStored(target);
    this.sourceStep = requireString(sourceStep, "direct plan sourceStep", 200);
    this.transitionReason = requireAuthoredString(transitionReason, "direct plan transitionReason");
    this.transitionAt = requireString(transitionAt, "direct plan transitionAt", 100);
    if (!Number.isFinite(Date.parse(this.transitionAt))) throw new Error("direct plan transitionAt must be an ISO timestamp");
    this.skippedSteps = Object.freeze(stringList(skippedSteps, "direct plan skippedSteps", { allowEmpty: false }));
    this.validationItems = Object.freeze(stringList(
      validationItems,
      "direct plan validationItems",
      { allowEmpty: false },
    ));
    this.findings = Object.freeze(findings.map((finding) => DirectResolutionFinding.fromStored(finding)));
    this.routingFailure = routingFailure == null ? null : requireString(routingFailure, "direct plan routingFailure");
    this.originFlowStateRevision = requireString(
      originFlowStateRevision,
      "direct plan originFlowStateRevision",
      64,
    );
    if (this.originFlowStateRevision !== this.target.flowStateRevision) {
      throw new Error("direct plan originating Flow revision does not match its target guard");
    }
    this.selectionSource = requireString(selectionSource, "direct plan selectionSource", 100);
    if (!["manual", "auto"].includes(this.selectionSource)) {
      throw new Error("direct plan selectionSource must be manual or auto");
    }
    this.adoptedActionId = requireString(adoptedActionId, "direct plan adoptedActionId", 80);
    this.scopePaths = Object.freeze(stringList(scopePaths, "direct plan scopePaths"));
    if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("direct plan revision must be positive");
    this.revision = revision;
    this.planId = planId == null
      ? stablePlanId(this)
      : requireString(planId, "direct plan planId", 100);
    if (this.planId !== stablePlanId(this)) throw new Error("direct plan ID does not match its immutable target");
    Object.freeze(this);
  }

  get unresolvedDecisions() {
    return this.findings.filter((finding) => finding.requiresDecision);
  }

  assertTarget(state, {
    featureHead,
    bindingRevision,
    activeRegistryRevision,
    flowStateRevision,
  }) {
    if (!this.target.sameIdentity(state)) throw new Error("DIRECT_TARGET_MISMATCH: Flow identity changed");
    if (featureHead !== this.target.featureHead) throw new Error("DIRECT_TARGET_MISMATCH: feature HEAD changed");
    if (bindingRevision !== this.target.bindingRevision) throw new Error("DIRECT_CAS_CONFLICT: worktree binding changed");
    if (activeRegistryRevision !== this.target.activeRegistryRevision) {
      throw new Error("DIRECT_CAS_CONFLICT: active registry changed");
    }
    if (flowStateRevision !== this.originFlowStateRevision) {
      throw new Error("DIRECT_CAS_CONFLICT: Flow state revision changed");
    }
    return true;
  }

  withFindingResolution(findingId, selectedResolution) {
    const normalizedId = requireString(findingId, "direct finding findingId", 300);
    const normalizedResolution = requireAuthoredString(
      selectedResolution,
      "direct finding selectedResolution",
    );
    let matched = false;
    const findings = this.findings.map((finding) => {
      if (finding.findingId !== normalizedId) return finding;
      matched = true;
      return new DirectResolutionFinding({
        ...finding.toJSON(),
        selectedResolution: normalizedResolution,
      });
    });
    if (!matched) throw new Error(`direct finding does not exist: ${normalizedId}`);
    return new DirectResolutionPlan({
      ...this.toJSON(),
      revision: this.revision + 1,
      findings,
    });
  }

  withFinding(finding) {
    const appended = DirectResolutionFinding.fromStored(finding);
    if (this.findings.some((entry) => entry.findingId === appended.findingId)) {
      throw new Error(`direct finding already exists: ${appended.findingId}`);
    }
    return new DirectResolutionPlan({
      ...this.toJSON(),
      revision: this.revision + 1,
      findings: [...this.findings, appended],
      scopePaths: [...new Set([...this.scopePaths, ...appended.changeTargets])],
    });
  }

  withRecoveryTarget(target) {
    const refreshed = DirectFlowTarget.fromStored(target);
    if (
      refreshed.runId !== this.target.runId
      || refreshed.issue !== this.target.issue
      || refreshed.spec !== this.target.spec
      || refreshed.worktreePath !== this.target.worktreePath
      || refreshed.featureBranch !== this.target.featureBranch
      || refreshed.baseBranch !== this.target.baseBranch
      || refreshed.flowStateRevision !== this.originFlowStateRevision
    ) {
      throw new Error("direct recovery target must preserve the original Flow identity");
    }
    return new DirectResolutionPlan({
      ...this.toJSON(),
      revision: this.revision + 1,
      target: refreshed,
    });
  }

  withRefreshedAuthority(target, reason) {
    const refreshed = DirectFlowTarget.fromStored(target);
    if (
      refreshed.runId !== this.target.runId
      || refreshed.issue !== this.target.issue
      || refreshed.spec !== this.target.spec
      || refreshed.worktreePath !== this.target.worktreePath
      || refreshed.featureBranch !== this.target.featureBranch
      || refreshed.baseBranch !== this.target.baseBranch
      || refreshed.bindingRevision !== this.target.bindingRevision
      || refreshed.activeRegistryRevision !== this.target.activeRegistryRevision
      || refreshed.featureHead !== this.target.featureHead
    ) {
      throw new Error("direct authority refresh may update only the Flow state revision");
    }
    return new DirectResolutionPlan({
      ...this.toJSON(),
      planId: null,
      revision: 1,
      target: refreshed,
      transitionReason: requireString(reason, "direct authority refresh reason"),
      transitionAt: new Date().toISOString(),
      originFlowStateRevision: refreshed.flowStateRevision,
      adoptedActionId: "REFRESH_DIRECT_AUTHORITY",
    });
  }

  toJSON() {
    return {
      planId: this.planId,
      revision: this.revision,
      target: this.target.toJSON(),
      sourceStep: this.sourceStep,
      transitionReason: this.transitionReason,
      transitionAt: this.transitionAt,
      skippedSteps: [...this.skippedSteps],
      validationItems: [...this.validationItems],
      findings: this.findings.map((finding) => finding.toJSON()),
      routingFailure: this.routingFailure,
      originFlowStateRevision: this.originFlowStateRevision,
      selectionSource: this.selectionSource,
      adoptedActionId: this.adoptedActionId,
      scopePaths: [...this.scopePaths],
    };
  }

  static fromStored(value) {
    return value instanceof DirectResolutionPlan ? value : new DirectResolutionPlan(value);
  }

  static classifications() {
    return [...CLASSIFICATIONS];
  }
}
