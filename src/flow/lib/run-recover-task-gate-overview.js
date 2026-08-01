import { Envelope } from "../../lib/flow-envelope.js";
import { FlowCommand } from "./base-command.js";
import {
  selectTaskGateOverviewRecoveryTask,
  TaskGateOverviewEffect,
} from "./task-gate-completion.js";

export class RunRecoverTaskGateOverviewCommand extends FlowCommand {
  constructor() {
    super({ explicitTargetResolution: true });
  }

  execute(ctx) {
    const state = ctx.flowManager.loadReadOnly(ctx.specId);
    const taskId = selectTaskGateOverviewRecoveryTask(state);
    if (taskId == null) {
      return Envelope.fail(
        "run",
        "recover-task-gate-overview",
        "TASK_GATE_OVERVIEW_RECOVERY_UNAVAILABLE",
        "no incomplete task-gate overview effect is available for this Flow",
      );
    }
    const result = new TaskGateOverviewEffect({
      root: ctx.root,
      flowManager: ctx.flowManager,
      specId: ctx.specId,
      taskId,
    }).execute();
    return Envelope.ok("run", "recover-task-gate-overview", result.toJSON());
  }
}

export default RunRecoverTaskGateOverviewCommand;
