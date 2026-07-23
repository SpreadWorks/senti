/**
 * Remove one exact managed-worktree flow pointer from the shared active-flow
 * authority without changing the flow, worktree, branch, or artifacts.
 */

import { Command } from "../../lib/command.js";
import { ParkedFlowIdentity } from "../../lib/flow-manager.js";

export default class RunParkCommand extends Command {
  static outputMode = "envelope";

  execute(ctx) {
    const identity = new ParkedFlowIdentity(ctx);
    return ctx.container.get("flowManager").parkActiveFlow(identity).toJSON();
  }
}
