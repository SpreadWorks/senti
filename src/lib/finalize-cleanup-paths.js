import path from "path";

export const FINALIZE_CLEANUP_DURABLE_AGENT_WORK_DIR = path.join(".senti", "agent-work");

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index >= 0) return argv[index + 1] ?? null;
  const prefix = `${name}=`;
  const entry = argv.find((arg) => arg.startsWith(prefix));
  return entry == null ? null : entry.slice(prefix.length);
}

export class FinalizeCleanupRoute {
  constructor({ command = null, action = null } = {}) {
    if (command != null && typeof command !== "string") {
      throw new Error("finalize cleanup route command must be a string");
    }
    if (action != null && typeof action !== "string") {
      throw new Error("finalize cleanup route action must be a string");
    }
    this.command = command;
    this.action = action;
    Object.freeze(this);
  }

  static fromCliArgs(argv = []) {
    if (!Array.isArray(argv) || argv.some((arg) => typeof arg !== "string")) {
      throw new Error("finalize cleanup CLI arguments must contain only strings");
    }
    if (argv[0] !== "flow" || argv[1] !== "run") {
      return new FinalizeCleanupRoute();
    }
    return new FinalizeCleanupRoute({
      command: argv[2] ?? null,
      action: optionValue(argv.slice(3), "--action"),
    });
  }

  static fromDispatch({ envelopeKey = null, action = null } = {}) {
    return new FinalizeCleanupRoute({ command: envelopeKey, action });
  }

  get removesManagedWorktree() {
    return this.command === "finalize-cleanup";
  }
}
