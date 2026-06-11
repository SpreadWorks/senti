/**
 * src/lib/provider.js
 *
 * Provider abstraction for AI agent CLIs.
 * Each Provider class encapsulates the per-CLI knowledge:
 *   - parse(stdout): output format parsing (JSON / NDJSON)
 *   - systemPromptFlag(): CLI flag for system prompt (or null to inline)
 *   - workDirFlag(): CLI flag for working directory (or null if unsupported)
 *   - builtinProfiles(): profile dictionary owned by this provider (args are
 *                        used literally; callers must include any required
 *                        CLI flags such as --json here)
 *
 * The ProviderRegistry composes built-in providers with user-defined
 * profiles and exposes lookup APIs for the Agent service.
 */

class Provider {
  static key = null;

  parse(_stdout) {
    throw new Error("Provider.parse() must be implemented by a subclass.");
  }

  systemPromptFlag() {
    return null;
  }

  workDirFlag() {
    return null;
  }

  builtinProfiles() {
    return {};
  }
}

class ClaudeProvider extends Provider {
  static key = "claude";

  parse(stdout) {
    const parsed = JSON.parse(stdout);
    // claude CLI --output-format json shape varies by version:
    //   - single object: { result, usage, total_cost_usd, ... }
    //   - event array (2.1.114+): [{type:"system"...}, ..., {type:"result", result, usage, ...}]
    let envelope;
    if (Array.isArray(parsed)) {
      envelope = [...parsed].reverse().find((e) => e && e.type === "result");
      if (!envelope) {
        throw new Error("claude output: no 'result' event found in array envelope");
      }
    } else {
      envelope = parsed;
    }
    return {
      text: envelope.structured_output != null
        ? JSON.stringify(envelope.structured_output)
        : String(envelope.result ?? ""),
      usage: {
        input_tokens: envelope.usage?.input_tokens ?? 0,
        output_tokens: envelope.usage?.output_tokens ?? 0,
        cache_read_tokens: envelope.usage?.cache_read_input_tokens ?? 0,
        cache_creation_tokens: envelope.usage?.cache_creation_input_tokens ?? 0,
        cost_usd: envelope.total_cost_usd ?? null,
      },
    };
  }

  systemPromptFlag() {
    return "--system-prompt";
  }

  workDirFlag() {
    return null;
  }

  builtinProfiles() {
    return {
      "claude/opus": {
        command: "claude",
        args: ["-p", "{{PROMPT}}", "--model", "opus", "--output-format", "json"],
        jsonOutputFlag: "--output-format json",
        jsonSchemaFlag: "--json-schema",
        jsonSchemaMode: "inline",
      },
      "claude/sonnet": {
        command: "claude",
        args: ["-p", "{{PROMPT}}", "--model", "sonnet", "--output-format", "json"],
        jsonOutputFlag: "--output-format json",
        jsonSchemaFlag: "--json-schema",
        jsonSchemaMode: "inline",
      },
    };
  }
}

class CodexProvider extends Provider {
  static key = "codex";
  static jsonOutputFlag = "--json";

  static execArgs(model) {
    return ["exec", this.jsonOutputFlag, "-m", model, "--sandbox", "workspace-write", "{{PROMPT}}"];
  }

  parse(stdout) {
    const lines = stdout.trim().split("\n");
    let text = "";
    let usageRaw = null;
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if (event.type === "item.completed" && event.item?.type === "agent_message") {
        text += String(event.item.text ?? "");
      } else if (event.type === "turn.completed") {
        usageRaw = event.usage;
      }
    }
    return {
      text,
      usage: {
        input_tokens: (usageRaw?.input_tokens ?? 0) - (usageRaw?.cached_input_tokens ?? 0),
        output_tokens: usageRaw?.output_tokens ?? 0,
        cache_read_tokens: usageRaw?.cached_input_tokens ?? 0,
        cache_creation_tokens: 0,
        cost_usd: null,
      },
    };
  }

  systemPromptFlag() {
    return null;
  }

  workDirFlag() {
    return "-C";
  }

  builtinProfiles() {
    return {
      "codex/gpt-5.4": {
        command: "codex",
        args: CodexProvider.execArgs("gpt-5.4"),
        jsonOutputFlag: CodexProvider.jsonOutputFlag,
        jsonSchemaFlag: "--output-schema",
        jsonSchemaMode: "file",
      },
      "codex/gpt-5.3": {
        command: "codex",
        args: CodexProvider.execArgs("gpt-5.3-codex"),
        jsonOutputFlag: CodexProvider.jsonOutputFlag,
        jsonSchemaFlag: "--output-schema",
        jsonSchemaMode: "file",
      },
    };
  }
}

class UserProvider extends Provider {
  static key = "user";

  constructor(profile) {
    super();
    this._profile = profile || {};
  }
  parse(stdout) {
    return { text: stdout, usage: null };
  }
  systemPromptFlag() {
    return this._profile.systemPromptFlag || null;
  }
  workDirFlag() {
    return this._profile.workDirFlag || null;
  }
}

class ProviderRegistry {
  constructor(userProviders = {}) {
    this._providers = [new ClaudeProvider(), new CodexProvider()];
    this._profiles = this._mergeProfiles(userProviders);
  }

  _mergeProfiles(userProviders) {
    const merged = {};
    for (const provider of this._providers) {
      Object.assign(merged, provider.builtinProfiles());
    }
    Object.assign(merged, userProviders);
    return merged;
  }

  _profileForKey(profileKey) {
    if (!profileKey) return null;
    if (this._profiles[profileKey]) return this._profiles[profileKey];
    const slash = profileKey.indexOf("/");
    if (slash === -1) return null;
    return this._profiles[profileKey.slice(0, slash)] || null;
  }

  /**
   * Resolve a Provider instance whose static key matches the given command
   * string (e.g. "claude" → ClaudeProvider, "codex" → CodexProvider).
   * Returns null when no provider matches.
   */
  resolveByCommand(command) {
    if (!command) return null;
    for (const provider of this._providers) {
      const key = provider.constructor.key;
      if (key && command.includes(key)) return provider;
    }
    return null;
  }

  /**
   * Resolve a profile key into { provider, profile } where profile is the
   * raw profile entry (command/args/etc) and provider is the matching Provider
   * instance. Returns null when the profile key itself is unknown.
   *
   * When a profile references an unrecognized command, a generic
   * `UserProvider` reads any provider hints (`systemPromptFlag`) directly
   * from the profile entry.
   */
  resolveProfile(profileKey) {
    if (!profileKey) return null;
    const profile = this._profileForKey(profileKey);
    if (!profile) return null;
    const matched = this.resolveByCommand(profile.command);
    const provider = matched || new UserProvider(profile);
    const providerKey = matched ? matched.constructor.key : UserProvider.key;
    return { provider, profile, providerKey };
  }

  hasProfile(profileKey) {
    return this._profileForKey(profileKey) != null;
  }

  /** Iteration helper for tests / introspection. */
  profileKeys() {
    return Object.keys(this._profiles);
  }
}

export { Provider, ClaudeProvider, CodexProvider, ProviderRegistry };
