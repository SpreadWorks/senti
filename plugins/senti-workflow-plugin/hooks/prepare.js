import { servicesFor, workflowConfig } from "../lib/services/context.js";

export default function register(api) {
  return class WorkflowPrepareHook extends api.FlowCommandHook {
    static command = "prepare";
    static hook = "post";
    static priority = 0;

    async run(context) {
      const issue = context.result?.data?.issue || context.flow?.issue;
      if (workflowConfig(context.config).flowIntegration !== "enable" || !issue) {
        return context.envelope.ok("plugin-hook", "workflow.prepare", { skipped: true });
      }
      try {
        const result = await servicesFor(context).issueStart.start({ issue, flow: context.flow });
        await context.artifacts.writeJson("prepare.json", { issue, result });
        return context.envelope.ok("plugin-hook", "workflow.prepare", { issue, result });
      } catch (err) {
        const warning = { code: "WORKFLOW_PREPARE_SKIPPED", message: err.message, issue };
        await context.artifacts.writeJson("prepare-warning.json", warning);
        return context.envelope.ok("plugin-hook", "workflow.prepare", {
          issue,
          warnings: [warning],
          followUps: [`Workflow prepare hook skipped for issue ${issue}: ${err.message}`],
        });
      }
    }
  };
}
