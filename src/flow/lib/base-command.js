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

export class FlowCommand extends Command {
  /** All flow commands emit JSON envelopes. */
  static outputMode = "envelope";

  /**
   * @param {Object} [options]
   * @param {boolean} [options.requiresFlow=true] - Whether this command requires an active flow
   */
  constructor({ requiresFlow = true } = {}) {
    super();
    this.requiresFlow = requiresFlow;
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
    const ctx = { ...resolveFlowContext(container), ...input };
    if (this.requiresFlow && !ctx.flowState) {
      throw new Error("no active flow (flow.json not found)");
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

/**
 * Normalize the optional `--task-id` CLI flag into a flow-store mutator opts
 * object. Returns `{ taskId }` when the flag was supplied (empty string → null
 * for flow scope) and `undefined` otherwise, letting the mutator fall back to
 * `currentTaskId` inference.
 *
 * @param {Object} ctx parsed command context
 * @returns {{taskId: string|null}|undefined}
 */
export function resolveExplicitTaskOption(ctx) {
  if (!ctx || !Object.prototype.hasOwnProperty.call(ctx, "taskId")) return undefined;
  const raw = ctx.taskId;
  return { taskId: raw === "" || raw == null ? null : raw };
}
