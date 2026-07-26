import { flattenSteps } from "./step-tree.js";
import {
  DirectAbortReceipt,
  DirectCompletionReceipt,
} from "./direct-completion.js";
import { DirectFlowSession } from "./direct-flow-session.js";

const TERMINAL_STEP_STATUSES = new Set(["done", "skipped"]);

export class FlowCompletion {
  constructor(state) {
    if (!state || typeof state !== "object") throw new Error("flow completion requires state");
    const leaves = flattenSteps(state.steps || []);
    this.total = leaves.length;
    this.done = leaves.filter((step) => TERMINAL_STEP_STATUSES.has(step.status)).length;
    this.directSession = state.directFlowSession
      ? DirectFlowSession.fromStored(state.directFlowSession)
      : null;
    this.directReceipt = state.directCompletionReceipt
      ? DirectCompletionReceipt.fromStored(state.directCompletionReceipt)
      : null;
    this.abortReceipt = state.directAbortReceipt
      ? DirectAbortReceipt.fromStored(state.directAbortReceipt)
      : null;
    if (this.directSession?.phase === "COMPLETED_DIRECT") {
      if (this.directReceipt?.status !== "completed") {
        throw new Error("completed direct Flow requires a completed direct receipt");
      }
      this.completionMode = "direct";
      this.mergeDisposition = this.directReceipt.mergeDisposition;
      this.success = true;
      this.terminal = true;
    } else if (this.directSession?.phase === "ABORTED") {
      if (this.abortReceipt?.status !== "aborted") {
        throw new Error("aborted direct Flow requires a direct abort receipt");
      }
      this.completionMode = "aborted";
      this.mergeDisposition = null;
      this.success = false;
      this.terminal = true;
    } else if (this.directSession) {
      this.completionMode = this.directReceipt ? "direct" : null;
      this.mergeDisposition = this.directReceipt?.mergeDisposition || null;
      this.success = null;
      this.terminal = false;
    } else if (this.total > 0 && this.done === this.total) {
      this.completionMode = "normal";
      this.mergeDisposition = state.mergeStrategy || state.state?.mergeStrategy || null;
      this.success = true;
      this.terminal = true;
    } else {
      this.completionMode = null;
      this.mergeDisposition = null;
      this.success = null;
      this.terminal = false;
    }
    Object.freeze(this);
  }

  get complete() {
    return this.terminal && this.success === true;
  }

  get active() {
    return !this.terminal;
  }

  toJSON() {
    return {
      terminal: this.terminal,
      success: this.success,
      completionMode: this.completionMode,
      mergeDisposition: this.mergeDisposition,
      ...(this.directReceipt && { receiptId: this.directReceipt.receiptId }),
      ...(this.abortReceipt && { receiptId: this.abortReceipt.receiptId }),
    };
  }
}
