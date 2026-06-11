import { servicesFor, workflowConfig } from "../lib/services/context.js";
import fs from "node:fs";
import path from "node:path";

async function issueLogEntriesFor(context) {
  const issueLogPath = context.result?.data?.issueLogPath;
  if (issueLogPath) {
    const file = path.resolve(context.project.root, issueLogPath);
    const root = path.resolve(context.project.root);
    if (file.startsWith(root + path.sep) && fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed.entries)) return parsed.entries;
    }
  }
  const artifactLog = await context.artifacts.readJson("issue-log.json", []);
  if (Array.isArray(artifactLog)) return artifactLog;
  if (Array.isArray(artifactLog.entries)) return artifactLog.entries;
  return [];
}

export default function register(api) {
  return class WorkflowFinalizeCleanupHook extends api.FlowCommandHook {
    static command = "finalize-cleanup";
    static hook = "post";
    static priority = 0;

    async run(context) {
      if (workflowConfig(context.config).flowIntegration !== "enable") {
        return context.envelope.ok("plugin-hook", "workflow.finalize-cleanup", { skipped: true });
      }
      try {
        const issueLogEntries = await issueLogEntriesFor(context);
        const result = await servicesFor(context).ideas.extract({
          spec: context.flow?.spec,
          issueLogEntries,
          result: context.result?.data || {},
        });
        await context.artifacts.writeJson("ideas.json", result);
        return context.envelope.ok("plugin-hook", "workflow.finalize-cleanup", {
          result,
          followUps: result.count ? [`Review workflow ideas for ${context.flow?.spec}`] : [],
        });
      } catch (err) {
        const warning = { code: "WORKFLOW_IDEAS_SKIPPED", message: err.message, spec: context.flow?.spec };
        await context.artifacts.writeJson("ideas-warning.json", warning);
        return context.envelope.ok("plugin-hook", "workflow.finalize-cleanup", {
          warnings: [warning],
          followUps: [`Workflow ideas extraction skipped: ${err.message}`],
        });
      }
    }
  };
}
