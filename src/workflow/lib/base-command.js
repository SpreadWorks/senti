export class WorkflowCommand {
  async run(ctx) {
    return this.execute(ctx);
  }

  // eslint-disable-next-line no-unused-vars
  execute(ctx) {
    throw new Error("execute() must be implemented");
  }
}
