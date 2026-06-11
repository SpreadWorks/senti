export default function register(api) {
  return class WorkflowIssueStartHook extends api.FlowCommandHook {
    static command = "prepare";
    static hook = "post";
    static priority = 0;

    async run(context) {
      const issue = context.result?.data?.issue || context.flow?.issue;
      if (context.config.flowIntegration !== "enable" || !issue) {
        return context.envelope.ok("plugin-hook", "workflow.issue-start", { skipped: true });
      }
      await context.artifacts.writeJson("issue-start.json", {
        issue,
        action: "issue-start",
        skipped: true,
        reason: "workflow board integration is handled by the workflow command runtime when available",
      });
      return {
        ok: false,
        type: "plugin-hook",
        key: "workflow.issue-start",
        data: { issue, action: "issue-start" },
        errors: [{ level: "warn", code: "WORKFLOW_ISSUE_START_CANDIDATE", messages: [`issue-start candidate for issue ${issue}`] }],
      };
    }
  };
}
