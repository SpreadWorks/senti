const WORKFLOW_AGENT_METHODS = ["publish", "classify", "similarity", "compose"];

export class WorkflowAgentResolver {
  constructor({ agent, config = {}, lang = "en" } = {}) {
    if (!agent || typeof agent.call !== "function") {
      throw new Error("workflow plugin agent context requires agent.call");
    }
    this.agent = agent;
    this.config = config;
    this.lang = lang;
  }

  async call(name, prompt, data = {}) {
    const override = this.config?.workflow?.agent?.[name] || {};
    const options = {
      workflowAgent: name,
      commandId: `workflow.${name}`,
      lang: this.lang,
      data,
      ...(override.provider ? { provider: override.provider } : {}),
      ...(override.profile ? { profile: override.profile } : {}),
    };
    if (typeof this.agent.resolve === "function") {
      this.agent.resolve(options.commandId, options);
    }
    return this.agent.call(prompt, options);
  }
}

for (const name of WORKFLOW_AGENT_METHODS) {
  WorkflowAgentResolver.prototype[name] = function promptWorkflowAgent(prompt, data = {}) {
    return this.call(name, prompt, data);
  };
}
