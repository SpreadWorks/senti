import { DRAFT_REVIEW_ROUTES } from "./draft-review-routes.js";

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`review route ${field} must be a non-empty string`);
  }
  return value;
}

function nullableString(value, field) {
  return value == null ? null : requireString(value, field);
}

export class FlowReviewRoute {
  constructor({
    phase,
    reviewStepId,
    projectionFile,
    passNextStepId,
    downstreamGatePhase = null,
    triageFile = null,
    bypassStepIds = [],
  }) {
    this.phase = requireString(phase, "phase");
    this.reviewStepId = requireString(reviewStepId, "reviewStepId");
    this.projectionFile = requireString(projectionFile, "projectionFile");
    this.passNextStepId = requireString(passNextStepId, "passNextStepId");
    this.downstreamGatePhase = nullableString(downstreamGatePhase, "downstreamGatePhase");
    this.triageFile = nullableString(triageFile, "triageFile");
    if (!Array.isArray(bypassStepIds)) throw new Error("review route bypassStepIds must be an array");
    this.bypassStepIds = Object.freeze(
      bypassStepIds.map((stepId, index) => requireString(stepId, `bypassStepIds[${index}]`)),
    );
    this.historyPattern = new RegExp(`^${this.phase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-attempt-(\\d{3})\\.json$`);
    Object.freeze(this);
  }
}

const DRAFT_FLOW_REVIEW_ROUTES = DRAFT_REVIEW_ROUTES.map((route) => new FlowReviewRoute({
  phase: route.retryPhase,
  reviewStepId: route.reviewStepId,
  projectionFile: route.reviewArtifact,
  passNextStepId: route.passNextStepId,
  downstreamGatePhase: route.passNextStepId === "draft-gate" ? "draft" : null,
  triageFile: route.triageArtifact,
  bypassStepIds: [route.triageStepId, route.repairStepId],
}));

export const FLOW_REVIEW_ROUTES = Object.freeze([
  ...DRAFT_FLOW_REVIEW_ROUTES,
  new FlowReviewRoute({
    phase: "spec",
    reviewStepId: "spec-review",
    projectionFile: "spec-review.json",
    passNextStepId: "spec-gate",
    downstreamGatePhase: "spec",
    triageFile: "spec-triage.json",
    bypassStepIds: ["spec-triage", "spec-repair"],
  }),
  new FlowReviewRoute({
    phase: "test",
    reviewStepId: "test-review",
    projectionFile: "test-review.json",
    passNextStepId: "implement",
  }),
  new FlowReviewRoute({
    phase: "impl",
    reviewStepId: "impl-review",
    projectionFile: "impl-review.json",
    passNextStepId: "impl-gate",
    downstreamGatePhase: "integration",
    triageFile: "impl-triage.json",
    bypassStepIds: ["impl-triage", "impl-repair"],
  }),
]);

const ROUTE_BY_PHASE = new Map(FLOW_REVIEW_ROUTES.map((route) => [route.phase, route]));
const ROUTE_BY_STEP = new Map(FLOW_REVIEW_ROUTES.map((route) => [route.reviewStepId, route]));

export function flowReviewRouteForPhase(phase) {
  return ROUTE_BY_PHASE.get(phase) || null;
}

export function flowReviewRouteForStepId(stepId) {
  return ROUTE_BY_STEP.get(stepId) || null;
}

export function reviewPhaseForFlowStepId(stepId) {
  return flowReviewRouteForStepId(stepId)?.phase || null;
}

export function reviewProjectionFileForPhase(phase) {
  return flowReviewRouteForPhase(phase)?.projectionFile || null;
}
