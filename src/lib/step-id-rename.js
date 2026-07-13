// Shared step-id rename core for the `<phase>-<concern>-<action>` convention (spec 269).
//
// Two consumers depend on this:
//   - src/scripts/rename-phase-steps.js — the historical-data migration tool (static files).
//   - src/lib/flow-store.js — read-time schema probe that rejects legacy flow state.
//
// Keeping the maps and the structural rename in one place prevents the two paths from drifting.

// 1:1 unambiguous renames (apply in every scope).
export const ONE_TO_ONE_STEP_RENAMES = Object.freeze({
  gate: "spec-gate",
  "gate-draft": "draft-gate",
  "review-draft-questions": "draft-questions-review",
  "review-draft-coverage": "draft-coverage-review",
  "review-spec": "spec-review",
  "review-test": "test-review",
  "spec-review-triage": "spec-triage",
});

// Collision ids resolved by structural scope: flow steps[] vs task tasks[].steps[].
export const FLOW_STEP_RENAMES = Object.freeze({
  ...ONE_TO_ONE_STEP_RENAMES,
  review: "impl-review",
  "gate-impl": "impl-gate",
});
export const TASK_STEP_RENAMES = Object.freeze({
  ...ONE_TO_ONE_STEP_RENAMES,
  impl: "task-impl",
  review: "task-review",
  "gate-impl": "task-gate",
});

// Rename leaf step ids in a steps tree using scopeMap. Branch nodes (those with a non-empty
// children array, e.g. plan/impl) keep their id and are recursed into. Mutates in place and
// pushes {from, to} entries onto `changes`.
export function renameStepTreeIds(nodes, scopeMap, changes = []) {
  const walk = (list) => {
    for (const node of list) {
      if (!node || typeof node !== "object") continue;
      if (Array.isArray(node.children) && node.children.length) {
        walk(node.children);
      } else if (typeof node.id === "string" && scopeMap[node.id]) {
        changes.push({ from: node.id, to: scopeMap[node.id] });
        node.id = scopeMap[node.id];
      }
    }
  };
  if (Array.isArray(nodes)) walk(nodes);
  return changes;
}

// Rename structural step ids in a flow state object in place: flow-scope steps[] and
// task-scope tasks[].steps[]. Returns the list of {from, to} changes applied.
export function renameFlowStateStepIds(state, changes = []) {
  if (Array.isArray(state?.steps)) renameStepTreeIds(state.steps, FLOW_STEP_RENAMES, changes);
  if (Array.isArray(state?.tasks)) {
    for (const task of state.tasks) {
      if (task && Array.isArray(task.steps)) renameStepTreeIds(task.steps, TASK_STEP_RENAMES, changes);
    }
  }
  return changes;
}
