import { createWorkflowServices } from "./index.js";

export function workflowConfig(config = {}) {
  return config.workflow || config;
}

export function servicesFor(context) {
  if (context.services) return context.services;
  return createWorkflowServices({
    ...(context.clients || {}),
    agent: context.agent || context.clients?.agent,
    config: context.config,
    rootConfig: context.rootConfig,
    projectRoot: context.project?.root,
  });
}
