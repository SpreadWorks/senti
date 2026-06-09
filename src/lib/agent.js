/**
 * src/lib/agent.js
 *
 * AI agent service. Built once at Container init time and accessed via
 * `container.get("agent")`. The class encapsulates:
 *   - profile resolution (SENTI_PROFILE > config.agent.useProfile > default profile > default)
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
import crypto from "crypto";
import { spawn } from "child_process";
import { generateRequestId } from "./log.js";
import { ProviderRegistry } from "./provider.js";
import { formatPreview } from "./error-preview.js";

const DEFAULT_AGENT_TIMEOUT_MS = 300_000;
const DEFAULT_STDIN_FALLBACK_THRESHOLD = 100_000;
const MAX_RETRY = 5;
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY_MS = 3000;
const RETRY_BACKOFF_FACTOR = 2;

class Agent {
  /**
   * @param {Object} opts
   * @param {Object} opts.config       - SentiConfig
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
   * Priority: SENTI_PROFILE env > config.agent.useProfile > default profile > default.
   * Returns null when no profile is configured.
   */
  resolve(commandId) {
    const agentSection = this._config.agent || {};
    const profileKey = resolveProfileKey(agentSection, commandId);
    if (!profileKey) return null;

    const resolved = this._registry.resolveProfile(profileKey);
    if (!resolved) return null;

    const timeoutMs = agentSection.timeout != null
      ? Number(agentSection.timeout) * 1000
      : DEFAULT_AGENT_TIMEOUT_MS;

    return {
      provider: resolved.provider,
      profile: resolved.profile,
      providerKey: resolved.providerKey,
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
      throw new Error("No agent configured. Set 'agent.default' in config.json or run 'senti setup'.");
    }
    ensureWorkDir(this._paths.agentWorkDir);

    const retry = this._normalizeRetryOptionsForTest(opts);
    const promptCache = this._resolvePromptCache(resolved, prompt, opts);
    const hit = promptCache?.cache.get(promptCache.key);
    if (hit != null) {
      recordPromptCacheHit({
        flowManager: this._flowManager,
        context: promptCache.context,
        provider: resolved.providerKey,
        profileKey: resolved.profileKey,
        text: hit,
      });
      return hit;
    }

    let cacheCandidate = null;
    const text = await runWithLogging({
      logger: this._logger,
      flowManager: this._flowManager,
      command: resolved.profile.command,
      systemPrompt: opts.systemPrompt ?? null,
      prompt,
      provider: resolved.providerKey,
      profileKey: resolved.profileKey,
      invoke: async () => {
        cacheCandidate = await this._callOnceWithRetry(resolved, prompt, opts, retry);
        return cacheCandidate;
      },
    });
    if (promptCache && text && cacheCandidate?.cacheable !== false) {
      promptCache.cache.set(promptCache.key, text);
    }
    return text;
  }

  // -----------------------------------------------------------------------
  // Internal helpers (also used by tests via _*ForTest seams)
  // -----------------------------------------------------------------------

  _buildInvocationForTest(prompt, options = {}) {
    const resolved = this.resolve(options.commandId);
    if (!resolved) throw new Error("No agent configured.");
    return this._buildInvocation(resolved, prompt, options);
  }

  _buildPromptCacheKeyMaterialForTest(resolved, prompt, options = {}) {
    return PromptCacheIdentity.from({ resolved, prompt, options }).toKeyMaterial();
  }

  _buildPromptCacheKeyForTest(resolved, prompt, options = {}) {
    return sha256(this._buildPromptCacheKeyMaterialForTest(resolved, prompt, options));
  }

  _normalizeRetryOptionsForTest(options = {}) {
    const configuredCount = this._config.agent?.retryCount;
    const baseCount = options.retryCount ?? configuredCount ?? DEFAULT_RETRY_COUNT;
    const rawCount = Number(baseCount);
    const rawDelay = Number(options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
    const retryCount = Number.isFinite(rawCount) && rawCount > 0
      ? Math.min(Math.floor(rawCount), MAX_RETRY)
      : 0;
    const retryDelayMs = Number.isFinite(rawDelay) && rawDelay > 0
      ? Math.floor(rawDelay)
      : DEFAULT_RETRY_DELAY_MS;
    return { retryCount, retryDelayMs };
  }

  _resolvePromptCache(resolved, prompt, options) {
    const context = resolvePromptCacheContext(this._flowManager);
    if (!context) return null;
    const cache = new AgentPromptCache({
      root: this._paths.root || process.cwd(),
      specId: context.spec,
    });
    const key = this._buildPromptCacheKeyForTest(resolved, prompt, options);
    return { cache, key, context };
  }

  _buildInvocation(resolved, prompt, options) {
    const { provider, profile } = resolved;
    const baseArgs = Array.isArray(profile.args) ? [...profile.args] : [];
    const systemFlag = provider.systemPromptFlag();
    const systemPrompt = options.systemPrompt ?? null;

    const prefix = systemFlag && systemPrompt ? [systemFlag, systemPrompt] : [];
    let effectivePrompt = !systemFlag && systemPrompt
      ? `${systemPrompt}\n\n${prompt}`
      : prompt;

    // jsonSchema handling: profile-property-based flag or fmtFallback
    const jsonSchema = options.jsonSchema ?? null;
    const schemaFlag = jsonSchema ? (profile.jsonSchemaFlag || null) : null;
    const schemaSuffix = [];
    let pendingSchemaWrite = null;
    if (jsonSchema && schemaFlag) {
      if (profile.jsonSchemaMode === "file") {
        const schemaPath = path.join(this._paths.agentWorkDir, `schema-${Date.now()}.json`);
        pendingSchemaWrite = { path: schemaPath, content: JSON.stringify(jsonSchema) };
        schemaSuffix.push(schemaFlag, schemaPath);
      } else {
        schemaSuffix.push(schemaFlag, JSON.stringify(jsonSchema));
      }
    } else if (jsonSchema && !schemaFlag && options.fmtFallback) {
      effectivePrompt = `${options.fmtFallback}\n\n${effectivePrompt}`;
    }

    const promptedArgs = substitutePromptToken(baseArgs, effectivePrompt);

    const workDirFlag = provider.workDirFlag();
    const workDirInjected = workDirFlag
      ? injectWorkDirFlag(workDirFlag, this._paths.agentWorkDir, promptedArgs)
      : promptedArgs;

    const finalArgs = [...prefix, ...workDirInjected, ...schemaSuffix];
    const env = { ...process.env };
    delete env.CLAUDECODE;

    const threshold = this._config.agent?.stdinFallbackThreshold ?? DEFAULT_STDIN_FALLBACK_THRESHOLD;
    const totalBytes = finalArgs.reduce((sum, a) => sum + Buffer.byteLength(String(a)), 0);
    if (totalBytes <= threshold) {
      return { finalArgs, env, stdinContent: null, pendingSchemaWrite };
    }

    // Stdin fallback: route the prompt via stdin instead of CLI args.
    const strippedArgs = stripPromptArgs(baseArgs);
    const strippedFinal = workDirFlag
      ? injectWorkDirFlag(workDirFlag, this._paths.agentWorkDir, strippedArgs)
      : strippedArgs;
    return {
      finalArgs: [...prefix, ...strippedFinal, ...schemaSuffix],
      env,
      stdinContent: effectivePrompt,
      pendingSchemaWrite,
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
        lastError = err;
      }
      if (attempt < retry.retryCount) {
        const delayMs = retry.retryDelayMs * Math.pow(RETRY_BACKOFF_FACTOR, attempt);
        await sleep(delayMs);
      }
    }
    throw lastError;
  }

  async _callOnce(resolved, prompt, options) {
    const { provider, profile, providerKey, profileKey, timeoutMs } = resolved;
    const { finalArgs, env, stdinContent, pendingSchemaWrite } = this._buildInvocation(resolved, prompt, options);
    const cwd = this._paths.root || process.cwd();

    if (pendingSchemaWrite) {
      await fs.promises.writeFile(pendingSchemaWrite.path, pendingSchemaWrite.content);
    }

    return new Promise((resolve, reject) => {
      const child = spawn(profile.command, finalArgs, {
        stdio: [stdinContent != null ? "pipe" : "ignore", "pipe", "pipe"],
        cwd,
        env,
      });

      let stdinError = null;
      if (stdinContent != null) {
        child.stdin.on("error", (err) => {
          stdinError = err;
        });
        child.stdin.write(stdinContent, () => {
          child.stdin.end();
        });
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
        if (code === 0 && !signal && !stdinError) {
          const trimmed = String(stdout).trim();
          if (profile.jsonOutputFlag) {
            const parsed = tryParseProvider(provider, trimmed);
            resolve(parsed ?? { text: trimmed, usage: null, cacheable: false });
          } else {
            resolve({ text: filterStreamingEvents(trimmed), usage: null });
          }
          return;
        }
        const parts = [];
        parts.push(`provider=${providerKey}`);
        parts.push(`profile=${profileKey}`);
        if (signal) parts.push(signal === "SIGTERM" ? "timeout" : `signal=${signal}`);
        if (code != null && code !== 0) parts.push(`exit=${code}`);
        if (stdinError) parts.push(`stdin=${stdinError.code || stdinError.message}`);
        if (stderr) parts.push(String(stderr).trim());
        const stdoutPreview = formatPreview(stdout);
        if (stdoutPreview) parts.push(`stdoutPreview=${stdoutPreview}`);
        const error = new Error(parts.join(" | ") || "unknown error");
        error.code = code;
        error.signal = signal;
        error.killed = signal === "SIGTERM";
        error.stdinError = stdinError || null;
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

class PromptCacheIdentity {
  constructor(input = {}) {
    this.commandId = input.commandId ?? null;
    this.provider = input.provider ?? null;
    this.profileKey = input.profileKey ?? null;
    this.invocation = input.invocation instanceof PromptCacheInvocation
      ? input.invocation
      : new PromptCacheInvocation(input.invocation || {});
    this.systemPrompt = input.systemPrompt ?? null;
    this.userPrompt = input.userPrompt ?? null;
    this.jsonSchema = input.jsonSchema ?? null;
    this.fmtFallback = input.fmtFallback ?? null;
  }

  static from({ resolved, prompt, options = {} }) {
    return new PromptCacheIdentity({
      commandId: options.commandId ?? null,
      provider: resolved.providerKey,
      profileKey: resolved.profileKey,
      invocation: PromptCacheInvocation.fromProfile(resolved.profile),
      systemPrompt: options.systemPrompt ?? null,
      userPrompt: prompt,
      jsonSchema: options.jsonSchema ?? null,
      fmtFallback: options.fmtFallback ?? null,
    });
  }

  toJSON() {
    return {
      commandId: this.commandId,
      provider: this.provider,
      profileKey: this.profileKey,
      invocation: this.invocation.toJSON(),
      systemPrompt: this.systemPrompt,
      userPrompt: this.userPrompt,
      jsonSchema: this.jsonSchema,
      fmtFallback: this.fmtFallback,
    };
  }

  toKeyMaterial() {
    return stableStringify(this.toJSON());
  }
}

class PromptCacheInvocation {
  constructor(input = {}) {
    this.command = input.command ?? null;
    this.args = Array.isArray(input.args) ? [...input.args] : [];
    this.jsonOutputFlag = input.jsonOutputFlag ?? null;
    this.jsonSchemaFlag = input.jsonSchemaFlag ?? null;
    this.jsonSchemaMode = input.jsonSchemaMode ?? null;
  }

  static fromProfile(profile = {}) {
    return new PromptCacheInvocation({
      command: profile.command,
      args: profile.args,
      jsonOutputFlag: profile.jsonOutputFlag,
      jsonSchemaFlag: profile.jsonSchemaFlag,
      jsonSchemaMode: profile.jsonSchemaMode,
    });
  }

  toJSON() {
    return {
      command: this.command,
      args: this.args,
      jsonOutputFlag: this.jsonOutputFlag,
      jsonSchemaFlag: this.jsonSchemaFlag,
      jsonSchemaMode: this.jsonSchemaMode,
    };
  }
}

class AgentPromptCache {
  constructor({ root, specId }) {
    this.root = root;
    this.specId = specId;
    this.filePath = path.join(root, ".senti", "agent-cache", `${cacheFileName(specId)}.json`);
  }

  get(key) {
    const store = this.read();
    const entry = store.entries[key] || null;
    if (!entry || typeof entry.text !== "string") return null;
    return entry.text;
  }

  set(key, text) {
    const store = this.read();
    store.entries[key] = {
      text: String(text),
      storedAt: new Date().toISOString(),
    };
    this.write(store);
  }

  read() {
    if (!fs.existsSync(this.filePath)) return this.emptyStore();
    try {
      const data = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      if (!data || typeof data !== "object" || data.version !== 1 || !data.entries || typeof data.entries !== "object") {
        return this.emptyStore();
      }
      return data;
    } catch (_) {
      return this.emptyStore();
    }
  }

  write(store) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(store, null, 2) + "\n", "utf8");
  }

  emptyStore() {
    return { version: 1, entries: {} };
  }
}

function resolvePromptCacheContext(flowManager) {
  if (!flowManager) return null;
  try {
    const context = flowManager.resolveCurrentContext();
    if (!context?.spec) return null;
    const activeFlows = typeof flowManager.loadActiveFlows === "function"
      ? flowManager.loadActiveFlows()
      : [];
    if (!activeFlows.some((entry) => entry.spec === context.spec)) return null;
    return context;
  } catch (_) {
    return null;
  }
}

function recordPromptCacheHit({ flowManager, context, provider, profileKey, text }) {
  if (!flowManager || !context?.sentiPhase) return;
  try {
    flowManager.appendMetric({
      phase: context.sentiPhase,
      kind: "agent-cache",
      provider,
      profileKey,
      callCount: 0,
      cachedResponse: true,
      responseChars: textStats(text).chars,
    }, { specId: context.spec, taskId: context.taskId ?? null });
  } catch (err) {
    process.stderr.write(`[senti] agent: cache-hit metric failed: ${err.message}\n`);
  }
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function cacheFileName(specId) {
  return String(specId || "no-spec").replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

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

function resolveProfileKey(agentSection, commandId) {
  const defaultKey = agentSection.default;
  const profileName = process.env.SENTI_PROFILE || agentSection.useProfile || null;
  if (!profileName) return defaultKey;

  const profiles = agentSection.profiles;
  if (!profiles || !profiles[profileName]) {
    throw new Error(`Profile "${profileName}" is not defined in agent.profiles.`);
  }

  return matchProfilePrefix(profiles[profileName], commandId)
    || matchDefaultProfileFallback(profiles, profileName, commandId)
    || defaultKey;
}

function matchDefaultProfileFallback(profiles, profileName, commandId) {
  if (profileName === "default" || !profiles.default) return null;
  return matchProfilePrefix(profiles.default, commandId);
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

const STREAMING_EVENT_PATTERN = /^\s*\{[^}]*"type"\s*:\s*"(message_start|message_delta|message_stop|content_block_start|content_block_delta|content_block_stop)"/;

function filterStreamingEvents(text) {
  const lines = text.split("\n");
  const result = [];
  let inCodeBlock = false;
  for (const line of lines) {
    if (line.trimStart().startsWith("```")) inCodeBlock = !inCodeBlock;
    if (inCodeBlock) { result.push(line); continue; }
    if (STREAMING_EVENT_PATTERN.test(line)) continue;
    result.push(line);
  }
  return result.join("\n");
}

function tryParseProvider(provider, stdout) {
  try {
    return provider.parse(stdout);
  } catch (err) {
    process.stderr.write(`[senti] agent output parse failed (${provider.constructor.name}): ${err.message}\n`);
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithLogging({ logger, flowManager, command, systemPrompt, prompt, provider, profileKey, invoke }) {
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
        if (ctx.sentiPhase) {
          const durationMs = Math.max(0, Math.round(Date.now() - startedAt));
          flowManager.accumulateAgentMetrics(ctx.sentiPhase, {
            provider,
            profileKey,
            usage,
            responseChars: responseStats.chars,
            model: null,
            durationMs,
          });
        }
      } catch (metricErr) {
        process.stderr.write(`[senti] agent: metric accumulation failed: ${metricErr.message}\n`);
      }
    }
  }
}

function textStats(s) {
  if (s == null) return { chars: 0, lines: 0 };
  const str = String(s);
  return { chars: str.length, lines: str.length === 0 ? 0 : str.split("\n").length };
}

export { Agent, filterStreamingEvents };
