/**
 * src/flow/lib/base-command.js
 *
 * Base class for all flow commands.
 *
 * Container connection point (spec 187 R1):
 *   - run(container, input) is the entrypoint called by the dispatcher.
 *   - The base class stores the container, assembles the execution context
 *     from it (root, mainRoot, config, flowManager, flowState, …), merges
 *     parsed CLI input, and calls execute(ctx).
 *   - Subclasses access shared dependencies via this.container.get(name)
 *     or via the ctx fields built by the base; they do not reach back into
 *     the dispatcher for re-resolution.
 */

import { Command } from "../../lib/command.js";
import { resolveFlowContext } from "./flow-context.js";
import { targetMismatchEnvelopeForInput } from "../../lib/flow-target-guard.js";

export class FlowCommand extends Command {
  /** All flow commands emit JSON envelopes. */
  static outputMode = "envelope";

  /**
   * @param {Object} [options]
   * @param {boolean} [options.requiresFlow=true] - Whether this command requires an active flow
   */
  constructor({ requiresFlow = true, targetGuard = true } = {}) {
    super();
    this.requiresFlow = requiresFlow;
    this.targetGuard = targetGuard;
  }

  /**
   * Run the command. The dispatcher passes the shared container and a
   * parsed input object (CLI flags / options / positional values).
   * @param {import("../../lib/container.js").Container} container
   * @param {Object} [input={}]
   * @returns {Promise<Object>|Object}
   * @throws {Error}
   */
  async run(container, input = {}) {
    this.container = container;
    const ctx = { ...resolveFlowContext(container, { allowMissingActive: !this.requiresFlow }), ...input };
    if (this.requiresFlow && !ctx.flowState) {
      throw new Error("no active flow (flow.json not found)");
    }
    if (this.targetGuard) {
      const mismatch = targetMismatchEnvelopeForInput({
        type: input._envelopeType || "run",
        key: input._envelopeKey || "flow",
        input,
        flowState: ctx.flowState,
      });
      if (mismatch) return mismatch;
    }
    return this.execute(ctx);
  }

  /**
   * Command logic. Must be overridden by subclasses.
   * @param {Object} ctx - resolved flow context merged with parsed CLI input
   * @returns {Promise<Object>|Object}
   * @throws {Error}
   */
  execute(ctx) {
    throw new Error("execute() must be implemented by subclass");
  }
}

export { resolveExplicitTaskOption } from "../../lib/flow-options.js";
