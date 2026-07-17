import { flattenSteps } from "./step-tree.js";

const TERMINAL_STEP_STATUSES = new Set(["done", "skipped"]);

export class FlowCompletion {
  constructor(state) {
    if (!state || typeof state !== "object") throw new Error("flow completion requires state");
    const leaves = flattenSteps(state.steps || []);
    this.total = leaves.length;
    this.done = leaves.filter((step) => TERMINAL_STEP_STATUSES.has(step.status)).length;
    Object.freeze(this);
  }

  get complete() {
    return this.total > 0 && this.done === this.total;
  }
}
