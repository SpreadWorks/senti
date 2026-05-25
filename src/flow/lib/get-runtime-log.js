import { Command } from "../../lib/command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { runtimeLogFileForContext } from "../../lib/runtime-log.js";
import { specIdFromPath } from "../../lib/flow-helpers.js";

function positiveInteger(value, name) {
  if (value == null) return null;
  if (!/^[1-9]\d*$/.test(String(value))) {
    throw Object.assign(new Error(`${name} must be a positive integer`), { code: "INVALID_ARG_VALUE" });
  }
  return Number(value);
}

function parseRunId(value) {
  if (value == null) return { runId: null, sequence: null };
  const text = String(value).trim();
  if (!text) throw Object.assign(new Error("--run-id must be non-empty"), { code: "INVALID_ARG_VALUE" });
  const match = text.match(/^(.+)#([1-9]\d*)$/);
  if (!match) return { runId: text, sequence: null };
  return { runId: match[1], sequence: Number(match[2]) };
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!["--format", "--sequence", "--run-id"].includes(arg)) {
      throw Object.assign(new Error(`Unknown option: ${arg}`), { code: "ARGS_ERROR" });
    }
    const value = argv[++i];
    if (value == null || String(value).startsWith("-")) {
      throw Object.assign(new Error(`Missing value for option: ${arg}`), { code: "ARGS_ERROR" });
    }
    if (arg === "--format") parsed.format = value;
    if (arg === "--sequence") parsed.sequence = value;
    if (arg === "--run-id") parsed.runId = value;
  }
  return parsed;
}

function fail(code, message) {
  process.stdout.write(JSON.stringify(Envelope.fail("get", "runtime-log", code, message).toJSON(), null, 2) + "\n");
  process.exitCode = 1;
}

export default class GetRuntimeLogCommand extends Command {
  static outputMode = "raw";

  execute(ctx) {
    try {
      const args = parseArgs(ctx._rawArgs || []);
      if (args.format != null && args.format !== "json") {
        throw Object.assign(new Error("--format accepts only json"), { code: "INVALID_ARG_VALUE" });
      }
      const explicitSequence = positiveInteger(args.sequence, "--sequence");
      const parsedRunId = parseRunId(args.runId);
      if (explicitSequence != null && parsedRunId.sequence != null && explicitSequence !== parsedRunId.sequence) {
        throw Object.assign(new Error("--sequence conflicts with --run-id sequence"), { code: "INVALID_ARG_VALUE" });
      }
      const sequence = parsedRunId.sequence ?? explicitSequence;
      const flowState = ctx.container.get("flowManager").load();
      const file = runtimeLogFileForContext({
        root: ctx.container.get("paths").root,
        specId: flowState ? specIdFromPath(flowState.spec) : null,
      });
      const block = file.select({
        sequence,
        runId: parsedRunId.runId,
        latestNonRuntimeLog: sequence == null && parsedRunId.runId == null,
      });
      if (!block) {
        fail("RUNTIME_LOG_NOT_FOUND", "runtime log block not found");
        return;
      }
      if (args.format === "json") {
        process.stdout.write(JSON.stringify(Envelope.ok("get", "runtime-log", block.toJSON()).toJSON(), null, 2) + "\n");
        return;
      }
      process.stdout.write(block.text.endsWith("\n") ? block.text : `${block.text}\n`);
    } catch (err) {
      fail(err.code || "ARGS_ERROR", err.message || String(err));
    }
  }
}
