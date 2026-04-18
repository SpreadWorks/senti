/**
 * src/lib/agent.js
 *
 * AI agent service. Built once at Container init time and accessed via
 * `container.get("agent")`. The class encapsulates:
 *   - profile resolution (SDD_FORGE_PROFILE > config.agent.useProfile > default)
 *   - prompt building (system prompt, JSON output flag, workDir flag injection)
 *   - argv-size based stdin fallback (config-driven threshold)
 *   - spawn-based asynchronous invocation (no blocking on stdin EOF)
 *   - bounded retry (max 5 attempts)
 *   - Logger.agent start/end events
 *
 * The class is the only public export of this module. Callers must NOT
 * import from this module directly except via the container; the registry
 * and Provider classes live in src/lib/provider.js.
 */

import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { generateRequestId } from "./log.js";
import { ProviderRegistry } from "./provider.js";

const DEFAULT_AGENT_TIMEOUT_MS = 300_000;
const DEFAULT_STDIN_FALLBACK_THRESHOLD = 100_000;
const MAX_RETRY = 5;
const DEFAULT_RETRY_DELAY_MS = 3000;

class Agent {
  /**
   * @param {Object} opts
   * @param {Object} opts.config       - SddConfig
   * @param {Object} opts.paths        - Container paths ({ root, agentWorkDir, ... })
   * @param {ProviderRegistry} opts.registry
   * @param {Object} opts.logger       - Logger instance
   * @param {Object} [opts.flowManager] - FlowManager, used for metric accumulation
   */
  constructor({ config, paths, registry, logger, flowManager }) {
    this._config = config || {};
    this._paths = paths || {};
    this._registry = registry || new ProviderRegistry(this._config.agent?.providers || {});
    this._logger = logger;
    this._flowManager = flowManager || null;
  }

  /**
   * Resolve a profile for the given commandId.
   * Priority: SDD_FORGE_PROFILE env > config.agent.useProfile > default.
   * Returns null when no profile is configured.
   */
  resolve(commandId) {
    const agentSection = this._config.agent || {};
    const defaultKey = agentSection.default;
    const profileName = process.env.SDD_FORGE_PROFILE || agentSection.useProfile || null;

    let profileKey = null;
    if (profileName) {
      const profiles = agentSection.profiles;
      if (!profiles || !profiles[profileName]) {
        throw new Error(`Profile "${profileName}" is not defined in agent.profiles.`);
      }
      profileKey = matchProfilePrefix(profiles[profileName], commandId) || defaultKey;
    } else {
      profileKey = defaultKey;
    }
    if (!profileKey) return null;

    const resolved = this._registry.resolveProfile(profileKey);
    if (!resolved) return null;

    const timeoutMs = agentSection.timeout != null
      ? Number(agentSection.timeout) * 1000
      : DEFAULT_AGENT_TIMEOUT_MS;

    return {
      provider: resolved.provider,
      profile: resolved.profile,
      profileKey,
      timeoutMs,
    };
  }

  /**
   * Invoke the resolved AI agent.
   *
   * @param {string} prompt
   * @param {Object} [options]
   * @param {string} [options.commandId]
   * @param {string} [options.systemPrompt]
   * @param {Function} [options.onStdout]
   * @param {Function} [options.onStderr]
   * @param {number}  [options.retryCount=0]
   * @param {number}  [options.retryDelayMs=3000]
   * @param {boolean} [options._dryRun] - Test-only short-circuit
   * @returns {Promise<string>} response text (trimmed)
   */
  async call(prompt, options) {
    const opts = options || {};
    if (opts._dryRun) return "";

    const resolved = this.resolve(opts.commandId);
    if (!resolved) {
      throw new Error("No agent configured. Set 'agent.default' in config.json or run 'sdd-forge setup'.");
    }
    ensureWorkDir(this._paths.agentWorkDir);

    const retry = this._normalizeRetryOptionsForTest(opts);
    return runWithLogging({
      logger: this._logger,
      flowManager: this._flowManager,
      command: resolved.profile.command,
      systemPrompt: opts.systemPrompt ?? null,
      prompt,
      invoke: () => this._callOnceWithRetry(resolved, prompt, opts, retry),
    });
  }

  // -----------------------------------------------------------------------
  // Internal helpers (also used by tests via _*ForTest seams)
  // -----------------------------------------------------------------------

  _buildInvocationForTest(prompt, options = {}) {
    const resolved = this.resolve(options.commandId);
    if (!resolved) throw new Error("No agent configured.");
    return this._buildInvocation(resolved, prompt, options);
  }

  _normalizeRetryOptionsForTest(options = {}) {
    const rawCount = Number(options.retryCount ?? 0);
    const rawDelay = Number(options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
    const retryCount = Number.isFinite(rawCount) && rawCount > 0
      ? Math.min(Math.floor(rawCount), MAX_RETRY)
      : 0;
    const retryDelayMs = Number.isFinite(rawDelay) && rawDelay > 0
      ? Math.floor(rawDelay)
      : DEFAULT_RETRY_DELAY_MS;
    return { retryCount, retryDelayMs };
  }

  _buildInvocation(resolved, prompt, options) {
    const { provider, profile } = resolved;
    const baseArgs = Array.isArray(profile.args) ? [...profile.args] : [];
    const systemFlag = provider.systemPromptFlag();
    const systemPrompt = options.systemPrompt ?? null;

    const prefix = systemFlag && systemPrompt ? [systemFlag, systemPrompt] : [];
    const effectivePrompt = !systemFlag && systemPrompt
      ? `${systemPrompt}\n\n${prompt}`
      : prompt;

    const promptedArgs = substitutePromptToken(baseArgs, effectivePrompt);

    const workDirFlag = provider.workDirFlag();
    const workDirInjected = workDirFlag
      ? injectWorkDirFlag(workDirFlag, this._paths.agentWorkDir, promptedArgs)
      : promptedArgs;

    const finalArgs = [...prefix, ...workDirInjected];
    const env = { ...process.env };
    delete env.CLAUDECODE;

    const threshold = this._config.agent?.stdinFallbackThreshold ?? DEFAULT_STDIN_FALLBACK_THRESHOLD;
    const totalBytes = finalArgs.reduce((sum, a) => sum + Buffer.byteLength(String(a)), 0);
    if (totalBytes <= threshold) {
      return { finalArgs, env, stdinContent: null };
    }

    // Stdin fallback: route the prompt via stdin instead of CLI args.
    const strippedArgs = stripPromptArgs(baseArgs);
    const strippedFinal = workDirFlag
      ? injectWorkDirFlag(workDirFlag, this._paths.agentWorkDir, strippedArgs)
      : strippedArgs;
    return {
      finalArgs: [...prefix, ...strippedFinal],
      env,
      stdinContent: effectivePrompt,
    };
  }

  async _callOnceWithRetry(resolved, prompt, options, retry) {
    if (retry.retryCount === 0) {
      // No retry: return whatever the single call produces (including empty string).
      return this._callOnce(resolved, prompt, options);
    }
    let lastError = null;
    for (let attempt = 0; attempt <= retry.retryCount; attempt++) {
      try {
        const result = await this._callOnce(resolved, prompt, options);
        if (result.text) return result;
        lastError = new Error("empty response");
      } catch (err) {
        if (err.killed || err.signal) throw err;
        lastError = err;
      }
      if (attempt < retry.retryCount) {
        await sleep(retry.retryDelayMs);
      }
    }
    throw lastError;
  }

  _callOnce(resolved, prompt, options) {
    const { provider, profile, timeoutMs } = resolved;
    const { finalArgs, env, stdinContent } = this._buildInvocation(resolved, prompt, options);
    const cwd = this._paths.root || process.cwd();

    return new Promise((resolve, reject) => {
      const child = spawn(profile.command, finalArgs, {
        stdio: [stdinContent != null ? "pipe" : "ignore", "pipe", "pipe"],
        cwd,
        env,
      });

      if (stdinContent != null) {
        child.stdin.write(stdinContent);
        child.stdin.end();
      }

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
        if (options.onStdout) options.onStdout(String(chunk));
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
        if (options.onStderr) options.onStderr(String(chunk));
      });

      const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);

      child.on("close", (code, signal) => {
        clearTimeout(timer);
        if (code === 0 && !signal) {
          const trimmed = String(stdout).trim();
          const parsed = tryParseProvider(provider, trimmed);
          resolve(parsed ?? { text: trimmed, usage: null });
          return;
        }
        const parts = [];
        if (signal) parts.push(signal === "SIGTERM" ? "timeout" : `signal=${signal}`);
        if (code != null && code !== 0) parts.push(`exit=${code}`);
        if (stderr) parts.push(String(stderr).trim());
        if (!stderr && stdout) parts.push(String(stdout).trim());
        const error = new Error(parts.join(" | ") || "unknown error");
        error.code = code;
        error.signal = signal;
        error.killed = signal === "SIGTERM";
        reject(error);
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Module-private helpers
// ---------------------------------------------------------------------------

function matchProfilePrefix(profile, commandId) {
  if (!commandId) return null;
  let bestKey = null;
  let bestLen = -1;
  for (const [prefix, providerKey] of Object.entries(profile)) {
    if (commandId === prefix || commandId.startsWith(prefix + ".")) {
      if (prefix.length > bestLen) {
        bestLen = prefix.length;
        bestKey = providerKey;
      }
    }
  }
  return bestKey;
}

function substitutePromptToken(args, prompt) {
  const hasToken = args.some((a) => typeof a === "string" && a.includes("{{PROMPT}}"));
  if (hasToken) {
    return args.map((a) => (typeof a === "string" ? a.replaceAll("{{PROMPT}}", prompt) : a));
  }
  return [...args, prompt];
}

function stripPromptArgs(args) {
  const result = [];
  for (let i = 0; i < args.length; i++) {
    if (typeof args[i] === "string" && args[i].includes("{{PROMPT}}")) {
      if (result.length > 0 && ["-p", "--print"].includes(result[result.length - 1])) {
        result.pop();
      }
      continue;
    }
    result.push(args[i]);
  }
  return result;
}

function injectWorkDirFlag(flag, workDir, args) {
  if (!flag || !workDir) return args;
  const existing = args.indexOf(flag);
  if (existing !== -1) {
    const next = [...args];
    next[existing + 1] = workDir;
    return next;
  }
  if (args.length > 0 && !args[0].startsWith("-")) {
    return [args[0], flag, workDir, ...args.slice(1)];
  }
  return [flag, workDir, ...args];
}

function ensureWorkDir(workDir) {
  if (!workDir) return;
  fs.mkdirSync(workDir, { recursive: true });
}

function tryParseProvider(provider, stdout) {
  try {
    return provider.parse(stdout);
  } catch (err) {
    process.stderr.write(`[sdd-forge] agent output parse failed (${provider.constructor.name}): ${err.message}\n`);
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithLogging({ logger, flowManager, command, systemPrompt, prompt, invoke }) {
  const requestId = generateRequestId();
  const startedAt = Date.now();
  await logger.agent({ phase: "start", requestId });

  let result = null;
  let err = null;
  try {
    result = await invoke();
    return result.text;
  } catch (e) {
    err = e;
    throw e;
  } finally {
    const text = result?.text ?? null;
    const usage = result?.usage ?? null;
    const responseStats = textStats(text);
    const payload = {
      agentKey: command ?? null,
      model: null,
      prompt: { system: systemPrompt, user: prompt },
      response: {
        text,
        exitCode: err ? (err.code ?? 1) : 0,
        error: err ? err.message : null,
      },
      usage,
      durationSec: (Date.now() - startedAt) / 1000,
    };
    await logger.agent({ phase: "end", requestId, ...payload });

    // Metric accumulation is the Agent's responsibility: it runs independently
    // of cfg.logs.enabled so flow.json metrics are always up to date (R3).
    if (flowManager) {
      try {
        const ctx = flowManager.resolveCurrentContext();
        if (ctx.sddPhase) {
          const durationMs = Math.max(0, Math.round(Date.now() - startedAt));
          flowManager.accumulateAgentMetrics(ctx.sddPhase, {
            usage,
            responseChars: responseStats.chars,
            model: null,
            durationMs,
          });
        }
      } catch (metricErr) {
        process.stderr.write(`[sdd-forge] agent: metric accumulation failed: ${metricErr.message}\n`);
      }
    }
  }
}

function textStats(s) {
  if (s == null) return { chars: 0, lines: 0 };
  const str = String(s);
  return { chars: str.length, lines: str.length === 0 ? 0 : str.split("\n").length };
}

export { Agent };
