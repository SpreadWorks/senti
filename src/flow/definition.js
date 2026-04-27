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

const MAX_DEPTH = 3;

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
    children = null,
    sideEffects = null,
  }) {
    this.id = id;
    this.label = label;
    this.action = action;
    this.instructionsKey = instructionsKey;
    this.contextKinds = Object.freeze([...contextKinds]);
    this.outputSchemaRef = outputSchemaRef;
    this.requiresApproval = requiresApproval;
    this.skippable = skippable;
    this.maxAttempts = maxAttempts;
    this.children = children ? Object.freeze(children.map((c) => Object.freeze(c))) : null;
    this.sideEffects = sideEffects ? Object.freeze([...sideEffects]) : null;
  }

  get isBranch() { return this.children != null; }
  get isLeaf() { return this.children == null; }
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
      new FlowNode({
        id: "gate-draft",
        label: "Gate (draft)",
        action: "run-gate",
        instructionsKey: "plan.gate-draft",
        contextKinds: ["draft", "guardrail"],
        outputSchemaRef: "next-action/gate.schema.json",
        maxAttempts: 10,
      }),
      new FlowNode({
        id: "spec",
        label: "Spec",
        action: "write-spec",
        instructionsKey: "plan.spec",
        contextKinds: ["draft", "guardrail"],
        outputSchemaRef: "next-action/spec.schema.json",
      }),
      new FlowNode({
        id: "gate",
        label: "Gate (spec)",
        action: "run-gate",
        instructionsKey: "plan.gate",
        contextKinds: ["spec", "guardrail"],
        outputSchemaRef: "next-action/gate.schema.json",
        maxAttempts: 20,
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
        id: "gate-impl",
        label: "Gate (impl)",
        action: "run-gate",
        instructionsKey: "impl.gate-impl",
        contextKinds: ["spec", "diff", "testlog"],
        outputSchemaRef: "next-action/gate.schema.json",
        maxAttempts: 5,
        sideEffects: ["completeTask", "promoteNextTask", "mergeOverview"],
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
        id: "finalize",
        label: "Finalize",
        action: "run-finalize",
        instructionsKey: "impl.finalize",
        contextKinds: ["spec", "diff"],
        outputSchemaRef: "next-action/finalize.schema.json",
        requiresApproval: true,
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

function findInProgressLeaf(steps) {
  if (!Array.isArray(steps)) return null;
  for (const s of steps) {
    if (s.children) {
      const found = findInProgressLeaf(s.children);
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
export function deriveNextAction(scope, stepId) {
  const def = scope === "task" ? TASK_DEFINITION : FLOW_DEFINITION;
  const node = resolveNodeFor(def, stepId);
  if (!node) return null;
  return {
    action: node.action,
    instructionsKey: node.instructionsKey,
    contextKinds: [...node.contextKinds],
    outputSchemaRef: node.outputSchemaRef,
    requiresApproval: node.requiresApproval,
    maxAttempts: node.maxAttempts,
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
