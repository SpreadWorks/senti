/**
 * src/flow/definition.js
 *
 * Single source of truth for the SDD flow structure.
 *
 * Every node carries the attributes that other modules previously derived
 * from context-rules.json, registry hooks, hardcoded constants, or prompt
 * literals. Adding / reordering steps is done here; consumers derive
 * behaviour from this data structure instead of maintaining parallel maps.
 *
 * Max depth: 3 (root list → branch → leaf). Traversal helpers enforce this.
 */

import { draftReviewRouteForKey } from "./lib/draft-review-routes.js";

const MAX_DEPTH = 3;

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

class ScalarMaxAttempts {
  constructor(value) {
    if (!isPositiveInteger(value)) {
      throw new Error("invalid maxAttempts: expected a positive integer");
    }
    this.value = value;
    Object.freeze(this);
  }

  resolve() {
    return this.value;
  }
}

class ModeMaxAttempts {
  constructor(value) {
    if (!isPlainObject(value)) {
      throw new Error("invalid maxAttempts: expected exactly own auto/manual keys");
    }
    const keys = Object.keys(value);
    if (
      keys.length !== 2
      || !Object.hasOwn(value, "auto")
      || !Object.hasOwn(value, "manual")
    ) {
      throw new Error("invalid maxAttempts: expected exactly own auto/manual keys");
    }
    if (!isPositiveInteger(value.auto) || !isPositiveInteger(value.manual)) {
      throw new Error("invalid maxAttempts: auto/manual must be positive integers");
    }
    this.auto = value.auto;
    this.manual = value.manual;
    Object.freeze(this);
  }

  resolve(context = {}) {
    return context.autoApprove === true ? this.auto : this.manual;
  }
}

function isPlainObject(value) {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
  );
}

function createMaxAttempts(value) {
  if (typeof value === "number") return new ScalarMaxAttempts(value);
  return new ModeMaxAttempts(value);
}

class FlowNode {
  constructor({
    id,
    label,
    action,
    instructionsKey,
    contextKinds = [],
    outputSchemaRef = null,
    requiresApproval = false,
    skippable = false,
    maxAttempts = 1,
    fallbacks = null,
    children = null,
    sideEffects = null,
    gatePhase = null,
  }) {
    this.id = id;
    this.label = label;
    this.action = action;
    this.instructionsKey = instructionsKey;
    this.contextKinds = Object.freeze([...contextKinds]);
    this.outputSchemaRef = outputSchemaRef;
    this.requiresApproval = requiresApproval;
    this.skippable = skippable;
    this.maxAttempts = createMaxAttempts(maxAttempts);
    this.fallbacks = fallbacks ? Object.freeze([...fallbacks]) : null;
    this.children = children ? Object.freeze(children.map((c) => Object.freeze(c))) : null;
    this.sideEffects = sideEffects ? Object.freeze([...sideEffects]) : null;
    this.gatePhase = gatePhase ? Object.freeze([...gatePhase]) : null;
  }

  get isBranch() { return this.children != null; }
  get isLeaf() { return this.children == null; }

  resolveMaxAttempts(context = {}) {
    return this.maxAttempts.resolve(context);
  }
}

const GATE_IMPL_SIDE_EFFECTS = Object.freeze(["completeTask", "promoteNextTask", "mergeOverview"]);
const DRAFT_QUESTIONS_ROUTE = draftReviewRouteForKey("questions");
const DRAFT_COVERAGE_ROUTE = draftReviewRouteForKey("coverage");
const DRAFT_REVIEW_ROUTE_EXPECTATIONS = Object.freeze([
  Object.freeze({
    route: DRAFT_QUESTIONS_ROUTE,
    triageStepId: "draft-questions-triage",
    repairStepId: "draft-questions-repair",
  }),
  Object.freeze({
    route: DRAFT_COVERAGE_ROUTE,
    triageStepId: "draft-coverage-triage",
    repairStepId: "draft-coverage-repair",
  }),
]);
for (const expectation of DRAFT_REVIEW_ROUTE_EXPECTATIONS) {
  if (
    expectation.route.triageStepId !== expectation.triageStepId
    || expectation.route.repairStepId !== expectation.repairStepId
  ) {
    throw new Error(`draft review route mismatch: ${expectation.triageStepId}`);
  }
}
const PLAN_REVIEW_MAX_ATTEMPTS_BY_ID = Object.freeze({
  "review-draft-questions": Object.freeze({ auto: 1, manual: 1 }),
  "review-draft-coverage": Object.freeze({ auto: 1, manual: 1 }),
  "review-spec": Object.freeze({ auto: 1, manual: 1 }),
  "review-test": Object.freeze({ auto: 3, manual: 3 }),
});

function createPlanReviewNode({ id, label, contextKinds }) {
  const maxAttempts = PLAN_REVIEW_MAX_ATTEMPTS_BY_ID[id];
  return new FlowNode({
    id,
    label,
    action: "run-review",
    instructionsKey: `plan.${id}`,
    contextKinds,
    outputSchemaRef: "next-action/review.schema.json",
    maxAttempts,
  });
}

function createDraftReviewLeafNode({ id, label }) {
  return new FlowNode({
    id,
    label,
    action: "write-draft",
    instructionsKey: `plan.${id}`,
    contextKinds: ["draft", "issue", "guardrail"],
    outputSchemaRef: "next-action/spec.schema.json",
    maxAttempts: 1,
  });
}

function createDraftReviewRouteNodes(route) {
  return [
    createDraftReviewLeafNode({
      id: route.triageStepId,
      label: `${route.label} triage`,
    }),
    createDraftReviewLeafNode({
      id: route.repairStepId,
      label: `${route.label} repair`,
    }),
  ];
}

// ── FLOW_DEFINITION ─────────────────────────────────────────────────────────

export const FLOW_DEFINITION = Object.freeze([
  new FlowNode({
    id: "plan",
    label: "Plan",
    children: [
      new FlowNode({
        id: "branch",
        label: "Branch",
        action: "create-branch",
        instructionsKey: "plan.branch",
        contextKinds: [],
        skippable: true,
      }),
      new FlowNode({
        id: "prepare-spec",
        label: "Prepare spec",
        action: "prepare-spec",
        instructionsKey: "plan.prepare-spec",
        contextKinds: [],
      }),
      new FlowNode({
        id: "draft",
        label: "Draft",
        action: "write-draft",
        instructionsKey: "plan.draft",
        contextKinds: ["issue", "guardrail", "project_overview"],
        outputSchemaRef: "next-action/draft.schema.json",
        maxAttempts: 1,
      }),
      createPlanReviewNode({
        id: "review-draft-questions",
        label: "Review (draft questions)",
        contextKinds: ["draft", "issue"],
      }),
      ...createDraftReviewRouteNodes(DRAFT_QUESTIONS_ROUTE),
      new FlowNode({
        id: "draft-refine",
        label: "Draft refine",
        action: "write-draft",
        instructionsKey: "plan.draft-refine",
        contextKinds: ["draft", "issue", "guardrail", "project_overview"],
        outputSchemaRef: "next-action/draft.schema.json",
        maxAttempts: 1,
      }),
      createPlanReviewNode({
        id: "review-draft-coverage",
        label: "Review (draft coverage)",
        contextKinds: ["draft", "issue"],
      }),
      ...createDraftReviewRouteNodes(DRAFT_COVERAGE_ROUTE),
      new FlowNode({
        id: "gate-draft",
        label: "Gate (draft)",
        action: "run-gate",
        instructionsKey: "plan.gate-draft",
        contextKinds: ["draft", "guardrail"],
        outputSchemaRef: "next-action/gate.schema.json",
        maxAttempts: 10,
        gatePhase: ["draft"],
      }),
      new FlowNode({
        id: "spec",
        label: "Spec",
        action: "write-spec",
        instructionsKey: "plan.spec",
        contextKinds: ["draft", "guardrail"],
        outputSchemaRef: "next-action/spec.schema.json",
      }),
      createPlanReviewNode({ id: "review-spec", label: "Review (spec)", contextKinds: ["spec", "guardrail"] }),
      new FlowNode({
        id: "spec-review-triage",
        label: "Spec review triage",
        action: "write-spec",
        instructionsKey: "plan.spec-review-triage",
        contextKinds: ["spec", "guardrail"],
        outputSchemaRef: "next-action/spec.schema.json",
        maxAttempts: 1,
      }),
      new FlowNode({
        id: "spec-repair",
        label: "Spec repair",
        action: "write-spec",
        instructionsKey: "plan.spec-repair",
        contextKinds: ["spec", "guardrail"],
        outputSchemaRef: "next-action/spec.schema.json",
        maxAttempts: 1,
      }),
      new FlowNode({
        id: "gate",
        label: "Gate (spec)",
        action: "run-gate",
        instructionsKey: "plan.gate",
        contextKinds: ["spec", "guardrail"],
        outputSchemaRef: "next-action/gate.schema.json",
        maxAttempts: 20,
        gatePhase: ["spec", "task-spec"],
      }),
      new FlowNode({
        id: "approval",
        label: "Approval",
        action: "await-approval",
        instructionsKey: "plan.approval",
        contextKinds: ["spec"],
        outputSchemaRef: "next-action/approval.schema.json",
        requiresApproval: true,
        sideEffects: ["syncSpecTasks", "autoUpgradeReeval"],
      }),
      new FlowNode({
        id: "test",
        label: "Test",
        action: "write-tests",
        instructionsKey: "plan.test",
        contextKinds: ["spec", "guardrail"],
        outputSchemaRef: "next-action/spec.schema.json",
      }),
      new FlowNode({
        id: "scenario-validity",
        label: "Scenario Validity",
        action: "run-scenario-validity",
        instructionsKey: "plan.scenario-validity",
        contextKinds: ["spec", "test"],
        outputSchemaRef: "next-action/scenario-validity.schema.json",
        maxAttempts: 3,
      }),
      createPlanReviewNode({ id: "review-test", label: "Review (test)", contextKinds: ["spec", "guardrail"] }),
    ],
  }),

  new FlowNode({
    id: "impl",
    label: "Implementation",
    children: [
      new FlowNode({
        id: "implement",
        label: "Implement",
        action: "run-impl",
        instructionsKey: "impl.implement",
        contextKinds: ["spec", "test", "overview"],
        outputSchemaRef: "next-action/impl.schema.json",
        maxAttempts: 3,
      }),
      new FlowNode({
        id: "test-execute",
        label: "Test Execute",
        action: "run-test-execute",
        instructionsKey: "impl.test-execute",
        contextKinds: ["spec", "test"],
        outputSchemaRef: "next-action/test-execute.schema.json",
        maxAttempts: 3,
      }),
      new FlowNode({
        id: "test-result-review",
        label: "Test Result Review",
        action: "run-test-result-review",
        instructionsKey: "impl.test-result-review",
        contextKinds: ["spec", "test"],
        outputSchemaRef: "next-action/test-result-review.schema.json",
        maxAttempts: 3,
      }),
      new FlowNode({
        id: "review",
        label: "Review",
        action: "run-review",
        instructionsKey: "impl.review",
        contextKinds: ["spec", "diff", "testlog"],
        outputSchemaRef: "next-action/review.schema.json",
        maxAttempts: 3,
      }),
      new FlowNode({
        id: "gate-impl",
        label: "Gate (impl)",
        action: "run-gate",
        instructionsKey: "impl.gate-impl",
        contextKinds: ["spec", "diff", "testlog"],
        outputSchemaRef: "next-action/gate.schema.json",
        maxAttempts: 5,
        sideEffects: GATE_IMPL_SIDE_EFFECTS,
        gatePhase: ["integration", "task-impl"],
      }),
      new FlowNode({
        id: "retro",
        label: "Retrospective",
        action: "run-retro",
        instructionsKey: "impl.retro",
        contextKinds: ["spec", "test"],
        outputSchemaRef: "next-action/retro.schema.json",
        maxAttempts: 2,
      }),
      new FlowNode({
        id: "final-regression",
        label: "Final Regression",
        action: "run-final-regression",
        instructionsKey: "impl.final-regression",
        contextKinds: ["spec", "test"],
        outputSchemaRef: "next-action/final-regression.schema.json",
        maxAttempts: 2,
      }),
      new FlowNode({
        id: "finalize",
        label: "Finalize",
        children: [
          new FlowNode({
            id: "finalize-commit",
            label: "Commit",
            action: "run-finalize-commit",
            instructionsKey: "impl.finalize-commit",
            contextKinds: ["spec", "diff"],
            outputSchemaRef: "next-action/finalize.schema.json",
            requiresApproval: true,
          }),
          new FlowNode({
            id: "finalize-merge",
            label: "Merge",
            action: "run-finalize-merge",
            instructionsKey: "impl.finalize-merge",
            contextKinds: ["spec", "diff"],
            outputSchemaRef: "next-action/finalize.schema.json",
          }),
          new FlowNode({
            id: "finalize-sync",
            label: "Sync",
            action: "run-finalize-sync",
            instructionsKey: "impl.finalize-sync",
            contextKinds: ["spec"],
            outputSchemaRef: "next-action/finalize.schema.json",
          }),
          new FlowNode({
            id: "finalize-cleanup",
            label: "Cleanup",
            action: "run-finalize-cleanup",
            instructionsKey: "impl.finalize-cleanup",
            contextKinds: ["spec"],
            outputSchemaRef: "next-action/finalize.schema.json",
          }),
        ],
      }),
    ],
  }),
]);

// ── TASK_DEFINITION ─────────────────────────────────────────────────────────

export const TASK_DEFINITION = Object.freeze([
  new FlowNode({
    id: "impl",
    label: "Task impl",
    action: "run-impl",
    instructionsKey: "task.impl",
    contextKinds: ["task_spec", "related_summary", "overview"],
    outputSchemaRef: "next-action/impl.schema.json",
  }),
  new FlowNode({
    id: "review",
    label: "Task review",
    action: "run-review",
    instructionsKey: "task.review",
    contextKinds: ["task_spec", "diff", "testlog"],
    outputSchemaRef: "next-action/review.schema.json",
  }),
  new FlowNode({
    id: "gate-impl",
    label: "Task gate",
    action: "run-gate",
    instructionsKey: "impl.gate-impl",
    contextKinds: ["task_spec", "guardrail"],
    outputSchemaRef: "next-action/gate.schema.json",
    maxAttempts: 5,
    sideEffects: ["completeTask", "promoteNextTask", "mergeOverview"],
  }),
]);

// ── Gate-phase collection ───────────────────────────────────────────────────

/**
 * Collect [phase, stepId] pairs from all gate nodes across FLOW_DEFINITION
 * and TASK_DEFINITION. Order follows definition order.
 */
export function collectGatePhaseEntries() {
  const entries = [];
  function walk(nodes, depth) {
    assertDepth(depth);
    for (const node of nodes) {
      if (node.children) {
        walk(node.children, depth + 1);
      } else if (node.gatePhase) {
        for (const phase of node.gatePhase) {
          entries.push([phase, node.id]);
        }
      }
    }
  }
  walk(FLOW_DEFINITION, 1);
  walk(TASK_DEFINITION, 1);
  return entries;
}

// ── Traversal helpers ───────────────────────────────────────────────────────

function assertDepth(depth) {
  if (depth > MAX_DEPTH) {
    throw new Error(`definition depth exceeds maximum (${MAX_DEPTH})`);
  }
}

/**
 * Collect all leaf node IDs from a definition tree in document order.
 */
export function collectLeafIds(definition) {
  const ids = [];
  function walk(nodes, depth) {
    assertDepth(depth);
    for (const node of nodes) {
      if (node.children) {
        walk(node.children, depth + 1);
      } else {
        ids.push(node.id);
      }
    }
  }
  walk(definition, 1);
  return ids;
}

/**
 * Derive a phase map (leaf id → branch id) from a definition tree.
 */
export function derivePhaseMap(definition) {
  const map = {};
  function walk(nodes, parentId, depth) {
    assertDepth(depth);
    for (const node of nodes) {
      if (node.children) {
        walk(node.children, node.id, depth + 1);
      } else {
        map[node.id] = parentId;
      }
    }
  }
  walk(definition, null, 1);
  return map;
}

/**
 * Look up a node by id (any depth) in the definition tree.
 */
export function resolveNodeFor(definition, id) {
  function walk(nodes, depth) {
    assertDepth(depth);
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = walk(node.children, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(definition, 1);
}

/**
 * Find the currently active (in_progress) leaf in a nested steps structure,
 * matching against the definition tree for navigation.
 *
 * Returns `{ scope: "flow"|"task", taskId, stepId }` or null.
 */
export function findActiveNode(steps, tasks, currentTaskId) {
  if (currentTaskId != null && Array.isArray(tasks)) {
    const task = tasks.find((t) => t.id === currentTaskId);
    if (task && Array.isArray(task.steps)) {
      const step = findInProgressLeaf(task.steps);
      if (step) return { scope: "task", taskId: currentTaskId, stepId: step.id };
    }
  }
  const step = findInProgressLeaf(steps);
  if (step) return { scope: "flow", taskId: null, stepId: step.id };
  return null;
}

export function findInProgressLeaf(steps, depth = 0) {
  assertDepth(depth);
  if (!Array.isArray(steps)) return null;
  for (const s of steps) {
    if (s.children) {
      const found = findInProgressLeaf(s.children, depth + 1);
      if (found) return found;
    } else if (s.status === "in_progress") {
      return s;
    }
  }
  return null;
}

/**
 * Derive the next action envelope fields from the definition for a given step.
 *
 * Returns `{ action, instructionsKey, contextKinds, outputSchemaRef, requiresApproval, maxAttempts }`
 * for the step identified by `scope` ("flow" or "task") and `stepId`.
 */
export function deriveNextAction(scope, stepId, context = {}) {
  const def = scope === "task" ? TASK_DEFINITION : FLOW_DEFINITION;
  const node = resolveNodeFor(def, stepId);
  if (!node) return null;
  return {
    action: node.action,
    instructionsKey: node.instructionsKey,
    contextKinds: [...node.contextKinds],
    outputSchemaRef: node.outputSchemaRef,
    requiresApproval: node.requiresApproval,
    maxAttempts: node.resolveMaxAttempts(context),
    sideEffects: node.sideEffects ? [...node.sideEffects] : null,
  };
}

/**
 * Build initial nested steps from the definition tree.
 * Branch nodes get `{ id, status: "pending", children: [...] }`;
 * leaf nodes get `{ id, status: "pending" }`.
 *
 * The first leaf is promoted to "in_progress".
 */
export function buildInitialNestedSteps(definition) {
  function buildNode(node) {
    if (node.children) {
      return { id: node.id, status: "pending", children: node.children.map(buildNode) };
    }
    return { id: node.id, status: "pending" };
  }
  const steps = definition.map(buildNode);
  const firstLeaf = findFirstPendingLeaf(steps);
  if (firstLeaf) firstLeaf.status = "in_progress";
  return steps;
}

/**
 * Build initial task-level steps from TASK_DEFINITION.
 */
export function buildInitialTaskSteps() {
  return TASK_DEFINITION.map((node) => ({ id: node.id, status: "pending" }));
}

/**
 * Flatten nested steps to a flat list of leaf steps (for compatibility).
 */
export function flattenSteps(steps) {
  const flat = [];
  function walk(nodes) {
    for (const s of nodes) {
      if (s.children) {
        walk(s.children);
      } else {
        flat.push(s);
      }
    }
  }
  walk(steps);
  return flat;
}

/**
 * Find a step by id in nested steps structure.
 */
export function findStepById(steps, id) {
  for (const s of steps) {
    if (s.id === id) return s;
    if (s.children) {
      const found = findStepById(s.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Find the first pending leaf in nested steps (depth-first).
 */
export function findFirstPendingLeaf(steps) {
  for (const s of steps) {
    if (s.children) {
      const found = findFirstPendingLeaf(s.children);
      if (found) return found;
    } else if (s.status === "pending") {
      return s;
    }
  }
  return null;
}

/**
 * Promote the next pending leaf to in_progress after a step completes.
 * Respects branch boundaries: if all children of a branch are done/skipped,
 * moves to the next sibling branch.
 *
 * Returns the promoted step, or null.
 */
export function promoteNextPendingLeaf(steps) {
  if (steps.some((s) => {
    if (s.children) return findInProgressLeaf(s.children) != null;
    return s.status === "in_progress";
  })) {
    return null;
  }
  return findFirstPendingLeaf(steps);
}

/**
 * Derive prerequisite step ids for a given target step from the definition.
 * Prerequisites are all leaf steps in branches that appear before the target's
 * branch in the definition.
 */
export function derivePrereqs(definition, targetId) {
  const targetBranchIdx = findBranchIndexForLeaf(definition, targetId);
  if (targetBranchIdx < 0) return [];

  const prereqs = [];
  for (let i = 0; i < targetBranchIdx; i++) {
    const branch = definition[i];
    if (branch.children) {
      const lastLeaf = getLastLeaf(branch.children);
      if (lastLeaf) prereqs.push(lastLeaf.id);
    }
  }
  return prereqs;
}

function findBranchIndexForLeaf(definition, leafId) {
  for (let i = 0; i < definition.length; i++) {
    const branch = definition[i];
    if (branch.id === leafId) return i;
    if (branch.children && resolveNodeFor([branch], leafId)) return i;
  }
  return -1;
}

function getLastLeaf(nodes) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.children) {
      const found = getLastLeaf(n.children);
      if (found) return found;
    } else {
      return n;
    }
  }
  return null;
}

/**
 * Check if a step is a branch containing a leaf with the given id.
 * Returns the branch node or null.
 */
export function findBranchForLeaf(definition, leafId) {
  for (const branch of definition) {
    if (branch.children && resolveNodeFor([branch], leafId)) return branch;
  }
  return null;
}

export { FlowNode };
