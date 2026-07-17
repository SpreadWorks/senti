const EXECUTION_MODES = new Set(["commit", "dry-run"]);

class WritePlanAction {
  constructor(description, commit) {
    if (typeof description !== "string" || description.trim() === "") {
      throw new Error("WritePlan action description must be a non-empty string");
    }
    if (typeof commit !== "function") {
      throw new Error("WritePlan action commit must be a function");
    }
    this.description = description;
    this.commitAction = commit;
    Object.freeze(this);
  }

  commit() {
    return this.commitAction();
  }
}

export class WritePlan {
  constructor(name, { preview = "" } = {}) {
    if (typeof name !== "string" || name.trim() === "") {
      throw new Error("WritePlan name must be a non-empty string");
    }
    if (typeof preview !== "string") {
      throw new Error("WritePlan preview must be a string");
    }
    this.name = name;
    this.preview = preview;
    this.actions = [];
  }

  add(description, commit) {
    this.actions.push(new WritePlanAction(description, commit));
    return this;
  }

  render() {
    const lines = [
      `DRY-RUN: ${this.name}`,
      ...this.actions.map((action, index) => `  ${index + 1}. ${action.description}`),
    ];
    if (this.preview) lines.push("", this.preview);
    return lines.join("\n");
  }

  async commit() {
    const results = [];
    for (const action of this.actions) {
      results.push(await action.commit());
    }
    return results;
  }
}

export class ExecutionMode {
  constructor(value) {
    if (!EXECUTION_MODES.has(value)) {
      throw new Error(`unsupported execution mode: ${value}`);
    }
    this.value = value;
    Object.freeze(this);
  }

  static fromDryRun(dryRun) {
    return new ExecutionMode(dryRun ? "dry-run" : "commit");
  }

  get isDryRun() {
    return this.value === "dry-run";
  }

  async execute(plan, { write = console.log } = {}) {
    if (!(plan instanceof WritePlan)) {
      throw new Error("ExecutionMode.execute requires a WritePlan");
    }
    if (this.isDryRun) {
      write(plan.render());
      return [];
    }
    return plan.commit();
  }
}
