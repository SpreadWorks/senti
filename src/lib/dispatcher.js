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
      nonPositional.push(a);
      if (i + 1 < argv.length) nonPositional.push(argv[++i]);
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
 */
export async function dispatch({
  container,
  entry,
  argv,
  envelopeType,
  envelopeKey,
  stdout,
  stderr,
  setExitCode,
  buildHookCtx,
}) {
  const writeOut = stdout || ((s) => process.stdout.write(s));
  const writeErr = stderr || ((s) => process.stderr.write(s));
  const setExit = setExitCode || ((code) => { process.exitCode = code; });

  // 1. Parse argv → input. _rawArgs preserved for legacy adapters that
  //    need to reconstruct process.argv before calling into old main().
  let input;
  try {
    input = parseEntryInput(entry, argv);
    input._rawArgs = argv;
  } catch (err) {
    const mode = await resolveOutputMode(entry);
    const helpHint = entry.helpPath
      ? `Run: ${entry.helpPath}`
      : `Run: sdd-forge ${envelopeType || "flow"} ${envelopeKey || ""} --help`.trimEnd();
    if (mode === "envelope") {
      const env = Envelope.fail(envelopeType || "run", envelopeKey || "?", "ARGS_ERROR", [
        String(err.message || err),
        helpHint,
      ]);
      writeOut(JSON.stringify(env.toJSON(), null, 2) + "\n");
    } else {
      writeErr(`${err.message || err}\n${helpHint}\n`);
    }
    setExit(1);
    return;
  }

  // 2. help shortcut
  if (input.help && entry.help) {
    writeOut(`${entry.help}\n`);
    return;
  }

  // 3. Load Command class
  const mod = await entry.command();
  const CommandClass = mod.default;
  if (!CommandClass || typeof CommandClass !== "function") {
    writeErr(`dispatcher: module has no default export (Command class)\n`);
    setExit(1);
    return;
  }
  Command.validate(CommandClass);

  const mode = CommandClass.outputMode;

  // Hook ctx combines container reference with parsed input for convenience.
  // Domains with richer shared state (e.g. flow) can override via buildHookCtx.
  const hookCtx = buildHookCtx
    ? { ...buildHookCtx(container, input), ...input }
    : { container, ...input };

  const emitPreconditionFailure = (code, message) => {
    const env = Envelope.fail(envelopeType || "run", envelopeKey || "?", code, message);
    writeOut(JSON.stringify(env.toJSON(), null, 2) + "\n");
    setExit(1);
  };

  // 4a. requiresConfig — reject early when the command declares config as a
  // precondition but the container has no config registered (setup not run).
  if (entry.requiresConfig && container.get("config") == null) {
    emitPreconditionFailure("NO_CONFIG", "config.json not found. Run sdd-forge setup first.");
    return;
  }

  // 4b. requiresFlow (flow domain only — hooks expect flowState present).
  // Skipped for non-flow entries or when buildHookCtx is absent.
  if (entry.requiresFlow !== false && buildHookCtx && !hookCtx.flowState) {
    emitPreconditionFailure("NO_FLOW", "no active flow (flow.json not found)");
    return;
  }

  // 5. pre
  if (entry.pre) {
    try {
      await entry.pre(hookCtx);
    } catch (err) {
      await emitFailure({ err, mode, entry, envelopeType, envelopeKey, writeOut, writeErr, setExit });
      return;
    }
  }

  // 5. execute via Command.run
  let result;
  let caught;
  try {
    const cmd = new CommandClass();
    result = await cmd.run(container, input);
  } catch (err) {
    caught = err;
  }

  // 6a. Success path
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
      writeOut(JSON.stringify(envelope.toJSON(), null, 2) + "\n");
      setExit(envelope.ok && !postFailed ? 0 : 1);
    } else if (postFailed) {
      setExit(1);
    }
    return;
  }

  // 6b. Failure path
  if (entry.onError) {
    try {
      await entry.onError(hookCtx, caught);
    } catch (onErrorErr) {
      writeErr(`[onError hook] ${onErrorErr.message || onErrorErr}\n`);
    }
  }
  await emitFailure({ err: caught, mode, entry, envelopeType, envelopeKey, writeOut, writeErr, setExit });
}

async function resolveOutputMode(entry) {
  try {
    const mod = await entry.command();
    return mod.default?.outputMode || "raw";
  } catch {
    return "raw";
  }
}

function emitFailure({ err, mode, envelopeType, envelopeKey, writeOut, writeErr, setExit }) {
  if (mode === "envelope") {
    const code = err?.code || "ERROR";
    const env = Envelope.fail(envelopeType || "run", envelopeKey || "?", code, String(err?.message || err));
    if (err?.data !== undefined) env.data = err.data;
    writeOut(JSON.stringify(env.toJSON(), null, 2) + "\n");
  } else {
    writeErr(`${err?.stack || err?.message || err}\n`);
  }
  setExit(err?.exitCode ?? 1);
}
