/**
 * src/lib/dispatcher.js
 *
 * Unified command dispatcher for all domains (flow / docs / check / metrics).
 * Replaces the per-domain ad-hoc runners with one path:
 *
 *   parseArgs(argv, entry.args)         — consistent CLI parsing
 *   → entry.pre?(ctx)                   — lifecycle pre
 *   → cmd.run(container, input)         — Command contract
 *   → entry.post?(ctx, result)          — lifecycle post (success only)
 *   → entry.onError?(ctx, err)          — lifecycle onError (failure only)
 *   → write envelope JSON | raw stdout  — per Command.outputMode
 *
 * Writes to stdout and setExitCode can be injected for testing.
 */

import { parseArgs as cliParseArgs } from "./cli.js";
import { Command } from "./command.js";
import { Envelope } from "./flow-envelope.js";
import { RuntimeLogBlockWriter } from "./runtime-log.js";
import { targetMismatchEnvelopeForInput } from "./flow-target-guard.js";
import { findActiveNode, taskIdForResolvedStep } from "../flow/definition.js";

function throwUnexpected(extras) {
  const unknownOpt = extras.find((v) => typeof v === "string" && v.startsWith("-"));
  if (unknownOpt) throw new Error(`Unknown option: ${unknownOpt}`);
  throw new Error(`Unexpected argument: ${extras[0]}`);
}

function splitArgsBySpec(argv, flagSet, optionSet) {
  const nonPositional = [];
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      nonPositional.push(a);
      continue;
    }
    if (flagSet.has(a)) {
      nonPositional.push(a);
      continue;
    }
    if (optionSet.has(a)) {
      if (i + 1 >= argv.length || String(argv[i + 1]).trim() === "" || String(argv[i + 1]).startsWith("-")) {
        throw new Error(`Missing value for option: ${a}`);
      }
      nonPositional.push(a);
      nonPositional.push(argv[++i]);
      continue;
    }
    // Unrecognized `-`-prefixed token → unknown option; non-dash tokens fall
    // through as positional values.
    if (typeof a === "string" && a.startsWith("-")) {
      throw new Error(`Unknown option: ${a}`);
    }
    positional.push(a);
  }
  return { nonPositional, positional };
}

/**
 * Parse argv into an input object according to entry.args.
 *   - flags / options use camelCase conversion via cli.parseArgs.
 *   - positional values are assigned by name: ctx[positional[i]] = values[i].
 *
 * When `entry.args` is absent (typical for legacy adapter entries that parse
 * their own argv internally), return an empty input so the raw args reach
 * the command unaltered via `_rawArgs` (set later in dispatch()).
 */
export function parseEntryInput(entry, argv) {
  if (!entry.args) {
    if (entry.passthroughArgs) {
      return { help: argv.includes("-h") || argv.includes("--help") };
    }
    // Strict no-arg entry: reject any extras besides help.
    const extras = argv.filter((a) => a !== "-h" && a !== "--help");
    if (extras.length > 0) throwUnexpected(extras);
    return { help: argv.includes("-h") || argv.includes("--help") };
  }
  const spec = entry.args || {};
  const positionalNames = spec.positional || [];
  const flags = spec.flags || [];
  const options = spec.options || [];

  const { nonPositional, positional } = splitArgsBySpec(
    argv,
    new Set(flags),
    new Set(options),
  );

  const parsed = cliParseArgs(nonPositional, { flags, options });

  for (let i = 0; i < positionalNames.length && i < positional.length; i++) {
    parsed[positionalNames[i]] = positional[i];
  }
  if (spec.rest) {
    parsed[spec.rest] = positional.slice(positionalNames.length);
  } else if (positional.length > positionalNames.length) {
    throwUnexpected(positional.slice(positionalNames.length));
  }
  return parsed;
}

const FINALIZE_CLEANUP_REPORT_HEADER = "Finalize Report";
const FINALIZE_CLEANUP_REPORT_MISSING_CODE = "REPORT_MISSING";
const FINALIZE_CLEANUP_WARNING_MESSAGE_LIMIT = 3;
const FINALIZE_CLEANUP_WARNING_TEXT_LIMIT = 600;

function runtimeLogRunId(hookCtx) {
  return hookCtx?.flowState?.runId || hookCtx?.runId || "no-flow";
}

function runtimeLogFlowId(hookCtx) {
  return hookCtx?.specId || "no-flow";
}

function runtimeLogRoot({ envelopeKey, hookCtx, container }) {
  const fallbackRoot = hookCtx.root || container.get("paths").root;
  if (envelopeKey !== "finalize-cleanup" || !hookCtx?.flowManager || !hookCtx?.flowState?.worktree) {
    return fallbackRoot;
  }
  const { mainRepoPath } = hookCtx.flowManager.resolveWorktreePaths(hookCtx.flowState);
  return mainRepoPath || fallbackRoot;
}

function attachRuntimeLog(envelope, metadata) {
  if (!(envelope instanceof Envelope) || !metadata) return envelope;
  const runtimeLog = {
    runId: metadata.runId,
    sequence: metadata.sequence,
  };
  envelope.data = envelope.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)
    ? { ...envelope.data, runtimeLog }
    : { runtimeLog };
  return envelope;
}

function runtimeLogStepId(entry, hookCtx, result) {
  const spec = entry.runtimeLog;
  if (!spec || spec.stepMetadata === false) return null;
  if (typeof spec.stepId === "function") return spec.stepId(hookCtx, result);
  if (typeof spec.stepId === "string") return spec.stepId;
  return null;
}

async function persistFinalizeCleanupPostReturnMetadata({ envelopeKey, hookCtx, metadata }) {
  if (envelopeKey !== "finalize-cleanup" || !metadata || !hookCtx?.flowManager || !hookCtx?.specId) return;
  const state = hookCtx.flowState || hookCtx.flowManager.loadReadOnly(hookCtx.specId);
  if (!state?.worktree) return;
  const { mainRepoPath } = hookCtx.flowManager.resolveWorktreePaths(state);
  if (!mainRepoPath) return;
  const { recordFinalizeCleanupPostCommandMetadata } = await import("../flow/lib/run-finalize-cleanup.js");
  recordFinalizeCleanupPostCommandMetadata({
    flowManager: hookCtx.flowManager,
    specId: hookCtx.specId,
    runtimeLog: metadata.toStepMetadata(),
  });
}

function findWarning(envelope, code) {
  return (envelope.errors || []).find((entry) => entry?.level === "warn" && entry?.code === code) || null;
}

function truncateText(text, limit) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
}

function formatWarningMessages(warning) {
  const messages = Array.isArray(warning?.messages) ? warning.messages : [];
  const shown = messages.slice(0, FINALIZE_CLEANUP_WARNING_MESSAGE_LIMIT);
  const suffix = messages.length > shown.length
    ? ` ... (${messages.length - shown.length} more message(s))`
    : "";
  return truncateText(`${shown.join(" ")}${suffix}`, FINALIZE_CLEANUP_WARNING_TEXT_LIMIT);
}

function formatFinalizeCleanupReportDisplay({ envelopeKey, envelope }) {
  if (envelopeKey !== "finalize-cleanup" || !(envelope instanceof Envelope) || envelope.ok !== true) return null;
  const report = envelope.data?.report;
  if (report && typeof report.text === "string") return `${FINALIZE_CLEANUP_REPORT_HEADER}\n${report.text}`;
  if (report !== null) return null;

  const warning = findWarning(envelope, FINALIZE_CLEANUP_REPORT_MISSING_CODE);
  if (!warning) return null;
  return `${FINALIZE_CLEANUP_REPORT_MISSING_CODE}: ${formatWarningMessages(warning)}\n`;
}

function emitFinalizeCleanupReportDisplay({ envelopeKey, envelope, writeErr }) {
  const text = formatFinalizeCleanupReportDisplay({ envelopeKey, envelope });
  if (text) writeErr(text);
}

/**
 * Dispatch a single entry.
 *
 * @param {Object}   args
 * @param {import("./container.js").Container} args.container
 * @param {Object}   args.entry        registry entry
 * @param {string[]} args.argv         command-specific argv tail
 * @param {string}   [args.envelopeType]
 * @param {string}   [args.envelopeKey]
 * @param {(s: string) => void} [args.stdout]        override for tests
 * @param {(code: number) => void} [args.setExitCode] override for tests
 * @param {(s: string) => void} [args.stderr]        override for tests
 * @param {boolean} [args.runtimeLog]  enable flow-run human-readable runtime log
 */
export async function dispatch({
  container,
  entry,
  argv,
  envelopeType,
  envelopeKey,
  runtimeLog: enableRuntimeLog = false,
  stdout,
  stderr,
  setExitCode,
  buildHookCtx,
}) {
  const baseWriteOut = stdout || ((s) => process.stdout.write(s));
  let runtimeLog = null;
  const baseWriteErr = stderr || ((s) => process.stderr.write(s));
  const processCaptureSuppressed = { stdout: 0, stderr: 0 };
  const withProcessCaptureSuppressed = (stream, fn) => {
    processCaptureSuppressed[stream] += 1;
    try {
      return fn();
    } finally {
      processCaptureSuppressed[stream] -= 1;
    }
  };
  const writeOut = (s) => {
    if (runtimeLog) runtimeLog.capture("stdout", s);
    return withProcessCaptureSuppressed("stdout", () => baseWriteOut(s));
  };
  const writeErr = (s) => {
    if (runtimeLog) runtimeLog.capture("stderr", s);
    return withProcessCaptureSuppressed("stderr", () => baseWriteErr(s));
  };
  let recordedExitCode = 0;
  const baseSetExit = setExitCode || ((code) => { process.exitCode = code; });
  const setExit = (code) => {
    recordedExitCode = code;
    baseSetExit(code);
  };
  let closedRuntimeLogMetadata = null;
  let restoreStreams = null;
  const buildRuntimeHookCtx = (parsedInput) => buildHookCtx
    ? { ...buildHookCtx(container, parsedInput), ...parsedInput }
    : { container, ...parsedInput };
  const openRuntimeLog = (hookCtx) => {
    if (runtimeLog || enableRuntimeLog !== true || !container.has("paths")) return;
    runtimeLog = RuntimeLogBlockWriter.forDispatch({
      root: runtimeLogRoot({ envelopeKey, hookCtx, container }),
      flowId: runtimeLogFlowId(hookCtx),
      runId: runtimeLogRunId(hookCtx),
      envelopeType,
      envelopeKey,
    });
    const originalStdoutWrite = process.stdout.write;
    const originalStderrWrite = process.stderr.write;
    process.stdout.write = function(chunk, encoding, cb) {
      if (runtimeLog && processCaptureSuppressed.stdout === 0) runtimeLog.capture("stdout", chunk);
      return originalStdoutWrite.call(this, chunk, encoding, cb);
    };
    process.stderr.write = function(chunk, encoding, cb) {
      if (runtimeLog && processCaptureSuppressed.stderr === 0) runtimeLog.capture("stderr", chunk);
      return originalStderrWrite.call(this, chunk, encoding, cb);
    };
    restoreStreams = () => {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    };
  };
  const closeRuntimeLog = () => {
    if (!runtimeLog || closedRuntimeLogMetadata) return closedRuntimeLogMetadata;
    closedRuntimeLogMetadata = runtimeLog.close(recordedExitCode);
    return closedRuntimeLogMetadata;
  };

  // 1. Parse argv → input. _rawArgs preserved for legacy adapters that
  //    need to reconstruct process.argv before calling into old main().
  let input;
  try {
    input = parseEntryInput(entry, argv);
    input._rawArgs = argv;
  } catch (err) {
    openRuntimeLog(buildRuntimeHookCtx({}));
    const mode = await resolveOutputMode(entry);
    const helpHint = entry.helpPath
      ? `Run: ${entry.helpPath}`
      : `Run: senti ${envelopeType || "flow"} ${envelopeKey || ""} --help`.trimEnd();
    if (mode === "envelope" || entry.parseErrorsAsEnvelope === true) {
      const env = Envelope.fail(envelopeType || "run", envelopeKey || "?", "ARGS_ERROR", [
        String(err.message || err),
        helpHint,
      ]);
      attachRuntimeLog(env, runtimeLog?.metadata);
      writeOut(JSON.stringify(env.toJSON(), null, 2) + "\n");
    } else {
      writeErr(`${err.message || err}\n${helpHint}\n`);
      if (runtimeLog?.metadata) {
        writeErr(`runtimeLog.runId=${runtimeLog.metadata.runId} runtimeLog.sequence=${runtimeLog.metadata.sequence}\n`);
      }
    }
    setExit(1);
    closeRuntimeLog();
    if (restoreStreams) restoreStreams();
    return;
  }

  // 2. help shortcut
  if (input.help && entry.help) {
    writeOut(`${entry.help}\n`);
    return;
  }

  // 3. Resolve and guard the flow target before loading or validating the
  // command module. A mismatch cannot reach command-owned validation,
  // lifecycle hooks, execution, or step metadata persistence.
  const hookCtx = buildRuntimeHookCtx(input);
  const targetMismatch = entry.targetGuard === false
    ? null
    : buildHookCtx
      ? targetMismatchEnvelopeForInput({
          type: envelopeType || "run",
          key: envelopeKey || "?",
          input,
          flowState: hookCtx.preparingFlowState ?? hookCtx.flowState,
        })
      : null;
  if (targetMismatch) {
    openRuntimeLog(hookCtx);
    attachRuntimeLog(targetMismatch, runtimeLog?.metadata);
    writeOut(JSON.stringify(targetMismatch.toJSON(), null, 2) + "\n");
    setExit(1);
    closeRuntimeLog();
    if (restoreStreams) restoreStreams();
    return;
  }

  // 4. Load Command class
  const mod = await entry.command();
  const CommandClass = mod.default;
  if (!CommandClass || typeof CommandClass !== "function") {
    writeErr(`dispatcher: module has no default export (Command class)\n`);
    setExit(1);
    return;
  }
  Command.validate(CommandClass);

  const mode = CommandClass.outputMode;

  const runtimeLogActiveNode = hookCtx.flowState ? findActiveNode(hookCtx.flowState) : null;

  openRuntimeLog(hookCtx);

  const emitPreconditionFailure = (code, message) => {
    const env = Envelope.fail(envelopeType || "run", envelopeKey || "?", code, message);
    attachRuntimeLog(env, runtimeLog?.metadata);
    writeOut(JSON.stringify(env.toJSON(), null, 2) + "\n");
    setExit(1);
  };
  const persistRuntimeLogMetadata = (result) => {
    const metadata = closedRuntimeLogMetadata;
    const stepId = runtimeLogStepId(entry, hookCtx, result);
    if (metadata && stepId && hookCtx.flowManager && hookCtx.flowState) {
      hookCtx.flowManager.setStepRuntimeLog(stepId, metadata.toStepMetadata(), {
        ...(hookCtx.specId ? { specId: hookCtx.specId } : {}),
        taskId: taskIdForResolvedStep(runtimeLogActiveNode, stepId),
      });
    }
  };

  // 5a. requiresConfig — reject early when the command declares config as a
  // precondition but the container has no config registered (setup not run).
  if (entry.requiresConfig && container.get("config") == null) {
    emitPreconditionFailure("NO_CONFIG", "config.json not found. Run senti setup first.");
    closeRuntimeLog();
    persistRuntimeLogMetadata(null);
    if (restoreStreams) restoreStreams();
    return;
  }

  // 5b. requiresFlow (flow domain only — hooks expect flowState present).
  // Skipped for non-flow entries or when buildHookCtx is absent.
  if (entry.requiresFlow !== false && buildHookCtx && !hookCtx.flowState) {
    emitPreconditionFailure("NO_FLOW", "no active flow (flow.json not found)");
    closeRuntimeLog();
    persistRuntimeLogMetadata(null);
    if (restoreStreams) restoreStreams();
    return;
  }

  // 6. pre
  if (entry.pre) {
    try {
      await entry.pre(hookCtx);
    } catch (err) {
      await emitFailure({ err, mode, entry, envelopeType, envelopeKey, writeOut, writeErr, setExit, runtimeLogMetadata: runtimeLog?.metadata });
      closeRuntimeLog();
      persistRuntimeLogMetadata(null);
      if (restoreStreams) restoreStreams();
      return;
    }
  }

  // 7. execute via Command.run
  let result;
  let caught;
  try {
    const cmd = new CommandClass();
    input._envelopeType = envelopeType;
    input._envelopeKey = envelopeKey;
    result = await cmd.run(container, input);
  } catch (err) {
    caught = err;
  }

  // 8a. Success path
  if (!caught) {
    let envelope;
    if (mode === "envelope") {
      // Commands may return an Envelope directly (e.g. Envelope.fail for
      // recoverable / user-avoidable outcomes). In that case honor it verbatim
      // rather than re-wrapping it in Envelope.ok.
      if (result instanceof Envelope) {
        envelope = result;
      } else {
        envelope = Envelope.ok(envelopeType || "run", envelopeKey || "?", result || {});
      }
    }
    let postFailed = false;
    // Skip post hooks when the command explicitly returned an ok:false envelope —
    // post hooks advance step status / counters assuming success, which would
    // fire incorrectly on a judgment-result rejection.
    const skipPost = result instanceof Envelope && result.ok === false;
    if (entry.post && !skipPost) {
      try {
        await entry.post(hookCtx, result);
      } catch (postErr) {
        postFailed = true;
        if (mode === "envelope") {
          envelope.addWarning("POST_HOOK_FAILED", postErr.message || String(postErr));
        } else {
          writeErr(`[post hook] ${postErr.message || postErr}\n`);
        }
      }
    }
    if (mode === "envelope") {
      if (envelope instanceof Envelope && envelope.ok === false) attachRuntimeLog(envelope, runtimeLog?.metadata);
      writeOut(JSON.stringify(envelope.toJSON(), null, 2) + "\n");
      emitFinalizeCleanupReportDisplay({ envelopeKey, envelope, writeErr });
      setExit(envelope.ok && !postFailed ? 0 : 1);
    } else if (postFailed) {
      setExit(1);
    }
    closeRuntimeLog();
    await persistFinalizeCleanupPostReturnMetadata({ envelopeKey, hookCtx, metadata: closedRuntimeLogMetadata });
    persistRuntimeLogMetadata(result);
    if (restoreStreams) restoreStreams();
    return;
  }

  // 8b. Failure path
  if (entry.onError) {
    try {
      await entry.onError(hookCtx, caught);
    } catch (onErrorErr) {
      writeErr(`[onError hook] ${onErrorErr.message || onErrorErr}\n`);
    }
  }
  await emitFailure({ err: caught, mode, entry, envelopeType, envelopeKey, writeOut, writeErr, setExit, runtimeLogMetadata: runtimeLog?.metadata });
  closeRuntimeLog();
  await persistFinalizeCleanupPostReturnMetadata({ envelopeKey, hookCtx, metadata: closedRuntimeLogMetadata });
  persistRuntimeLogMetadata(null);
  if (restoreStreams) restoreStreams();
}

async function resolveOutputMode(entry) {
  try {
    const mod = await entry.command();
    return mod.default?.outputMode || "raw";
  } catch {
    return "raw";
  }
}

function emitFailure({ err, mode, envelopeType, envelopeKey, writeOut, writeErr, setExit, runtimeLogMetadata }) {
  if (mode === "envelope") {
    const code = err?.code || "ERROR";
    const env = Envelope.fail(envelopeType || "run", envelopeKey || "?", code, String(err?.message || err));
    if (err?.data !== undefined) env.data = err.data;
    attachRuntimeLog(env, runtimeLogMetadata);
    writeOut(JSON.stringify(env.toJSON(), null, 2) + "\n");
  } else {
    writeErr(`${err?.stack || err?.message || err}\n`);
    if (runtimeLogMetadata) {
      writeErr(`runtimeLog.runId=${runtimeLogMetadata.runId} runtimeLog.sequence=${runtimeLogMetadata.sequence}\n`);
    }
  }
  setExit(err?.exitCode ?? 1);
}
