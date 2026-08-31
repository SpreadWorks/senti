/**
 * Typed failures emitted by the agent process boundary.
 *
 * Retryability is owned by the failure type. Callers may choose a smaller
 * retry budget, but they must not turn a terminal failure into a retryable
 * one by matching free-form provider output.
 */

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function positiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer`);
  }
  return value;
}

function failureText(error) {
  const values = [
    error?.message,
    error?.stderr,
    error?.stdout,
    error?.cause?.message,
    error?.cause?.stderr,
  ].filter((value) => value != null && String(value).trim() !== "");
  return values.map(String).join("\n");
}

function errorCodeText(error) {
  return [error?.code, error?.cause?.code, error?.stdinError?.code]
    .filter((value) => value != null)
    .map(String)
    .join(" ");
}

function copyDiagnostics(target, source) {
  for (const field of [
    "stdout",
    "stderr",
    "signal",
    "killed",
    "stdinError",
    "errno",
    "syscall",
    "path",
    "spawnargs",
    "timeoutMs",
    "graceMs",
    "finalAction",
    "unterminatedMembers",
    "diagnosticLog",
  ]) {
    if (source?.[field] != null) target[field] = source[field];
  }
  if (source?.code != null && typeof source.code !== "string") {
    target.providerExitCode = source.code;
  }
}

export class AgentFailure extends Error {
  constructor({
    message,
    kind,
    code,
    retryable,
    recoveryHint,
    attemptCount = 1,
    maxAttempts = 1,
    cause = null,
  }) {
    if (new.target === AgentFailure) throw new Error("AgentFailure is abstract");
    super(requireString(message, "agent failure message"), cause ? { cause } : undefined);
    this.name = new.target.name;
    this.kind = requireString(kind, "agent failure kind");
    this.code = requireString(code, "agent failure code");
    if (!/^AGENT_[A-Z0-9_]+$/.test(this.code)) {
      throw new Error("agent failure code must be a stable AGENT_* code");
    }
    if (typeof retryable !== "boolean") throw new Error("agent failure retryable must be boolean");
    this.retryable = retryable;
    this.recoveryHint = requireString(recoveryHint, "agent failure recoveryHint");
    this.attemptCount = positiveInteger(attemptCount, "agent failure attemptCount");
    this.maxAttempts = positiveInteger(maxAttempts, "agent failure maxAttempts");
    if (this.attemptCount > this.maxAttempts) {
      throw new Error("agent failure attemptCount must not exceed maxAttempts");
    }
    copyDiagnostics(this, cause);
  }

  recordAttempts(attemptCount, maxAttempts) {
    this.attemptCount = positiveInteger(attemptCount, "agent failure attemptCount");
    this.maxAttempts = positiveInteger(maxAttempts, "agent failure maxAttempts");
    if (this.attemptCount > this.maxAttempts) {
      throw new Error("agent failure attemptCount must not exceed maxAttempts");
    }
    return this;
  }

  toJSON() {
    const timeoutDiagnostics = this.code === "AGENT_TIMEOUT";
    return {
      kind: this.kind,
      code: this.code,
      retryable: this.retryable,
      recoveryHint: this.recoveryHint,
      attemptCount: this.attemptCount,
      maxAttempts: this.maxAttempts,
      message: this.message,
      ...(this.providerExitCode != null ? { providerExitCode: this.providerExitCode } : {}),
      ...(this.signal != null ? { signal: this.signal } : {}),
      ...(timeoutDiagnostics && this.timeoutMs != null ? { timeoutMs: this.timeoutMs } : {}),
      ...(timeoutDiagnostics && this.graceMs != null ? { graceMs: this.graceMs } : {}),
      ...(timeoutDiagnostics && this.finalAction != null ? { finalAction: this.finalAction } : {}),
      ...(timeoutDiagnostics && this.stdout != null ? { stdout: this.stdout } : {}),
      ...(timeoutDiagnostics && this.stdout == null ? { stdoutUnavailable: "provider produced no capturable stdout" } : {}),
      ...(timeoutDiagnostics && this.stderr != null ? { stderr: this.stderr } : {}),
      ...(timeoutDiagnostics && this.stderr == null ? { stderrUnavailable: "provider produced no capturable stderr" } : {}),
      ...(timeoutDiagnostics && this.diagnosticLog != null ? { diagnosticLog: this.diagnosticLog } : {}),
      ...(timeoutDiagnostics && Array.isArray(this.supervisorEvents) ? { supervisorEvents: this.supervisorEvents } : {}),
      ...(timeoutDiagnostics && this.cause?.message ? {
        cause: {
          message: String(this.cause.message),
          ...(this.cause.code != null ? { code: String(this.cause.code) } : {}),
        },
      } : {}),
    };
  }

  static from(error) {
    if (error instanceof AgentFailure) return error;
    const text = failureText(error);
    const codes = errorCodeText(error);
    const input = { message: text || "unknown agent provider failure", cause: error };

    if (
      /(?:api[_ -]?error[_ -]?status|http(?: status)?)\s*[=:]?\s*401\b|\b401\s+unauthorized\b|\boauth\b|failed to authenticate|authentication failed|unauthorized|token (?:has )?expired|login required|not logged in|please (?:run )?\/?login/i.test(text)
    ) return new AgentAuthenticationFailure(input);

    if (
      /\b(?:ENOENT|EACCES|EPERM|EEXIST|ENOTDIR|EISDIR|EROFS)\b/.test(codes)
      || error?.code === 126
      || error?.code === 127
      || /\b403\s+forbidden\b|agent command not found|command not found|executable.*not found|permission denied|not permitted|missing (?:agent )?(?:profile|configuration|config)|no agent configured|profile .* is not defined/i.test(text)
    ) return new AgentPermissionConfigurationFailure(input);

    if (
      /usage limit|you(?:'ve| have) hit your (?:usage )?limit|quota(?: exceeded| exhausted| reached)?|session limit|credit balance|billing limit|insufficient credits|too many tokens for (?:this )?(?:account|plan)/i.test(text)
    ) return new AgentUsageLimitFailure(input);

    if (/\b429\b|rate[ -]?limit(?:ed|ing)?|too many requests/i.test(text)) {
      return new TemporaryRateLimitFailure(input);
    }

    if (/\bEAI_AGAIN\b/.test(codes) || /temporary failure in name resolution|temporary dns/i.test(text)) {
      return new TemporaryNetworkFailure(input);
    }

    if (
      error?.code === "AGENT_TIMEOUT"
      || error?.signal === "SIGTERM"
      || error?.killed === true
      || /\btimed? out\b|\btimeout\b/i.test(text)
    ) return new AgentTimeoutFailure(input);

    if (/\bENOTFOUND\b/.test(codes) || /could not resolve (?:host|hostname)|name or service not known/i.test(text)) {
      return new PermanentNetworkFailure(input);
    }

    if (/empty response|no candidates? returned|empty candidates?/i.test(text)) {
      return new EmptyAgentResponseFailure({
        ...input,
        message: text ? `agent returned no response: ${text}` : "agent returned no response",
      });
    }

    return new UnknownProviderFailure(input);
  }
}

export class TemporaryRateLimitFailure extends AgentFailure {
  constructor(input = {}) {
    super({
      ...input,
      kind: "temporary_rate_limit",
      code: "AGENT_TEMPORARY_RATE_LIMIT",
      retryable: true,
      recoveryHint: "Wait for the provider rate-limit window, then retry the same input.",
    });
  }
}

export class TemporaryNetworkFailure extends AgentFailure {
  constructor(input = {}) {
    super({
      ...input,
      kind: "temporary_network",
      code: "AGENT_TEMPORARY_NETWORK",
      retryable: true,
      recoveryHint: "Restore temporary DNS connectivity, then retry the same input.",
    });
  }
}

export class AgentTimeoutFailure extends AgentFailure {
  constructor(input = {}) {
    super({
      ...input,
      kind: "timeout",
      code: "AGENT_TIMEOUT",
      retryable: true,
      recoveryHint: "Retry the same input after the timed-out provider process has terminated.",
    });
  }
}

export class AgentAuthenticationFailure extends AgentFailure {
  constructor(input = {}) {
    super({
      ...input,
      kind: "authentication",
      code: "AGENT_AUTHENTICATION_FAILED",
      retryable: false,
      recoveryHint: "Repair or refresh provider authentication before starting a new attempt.",
    });
  }
}

export class AgentPermissionConfigurationFailure extends AgentFailure {
  constructor(input = {}) {
    super({
      ...input,
      kind: "permission_configuration",
      code: "AGENT_PERMISSION_CONFIGURATION_FAILED",
      retryable: false,
      recoveryHint: "Repair the provider executable, profile, configuration, or permission before starting a new attempt.",
    });
  }
}

export class AgentUsageLimitFailure extends AgentFailure {
  constructor(input = {}) {
    super({
      ...input,
      kind: "usage_limit",
      code: "AGENT_USAGE_LIMIT_REACHED",
      retryable: false,
      recoveryHint: "Restore provider quota or wait for the documented usage window before starting a new attempt.",
    });
  }
}

export class PermanentNetworkFailure extends AgentFailure {
  constructor(input = {}) {
    super({
      ...input,
      kind: "permanent_network",
      code: "AGENT_PERMANENT_NETWORK_FAILURE",
      retryable: false,
      recoveryHint: "Correct the provider hostname or permanent DNS configuration before starting a new attempt.",
    });
  }
}

export class UnknownProviderFailure extends AgentFailure {
  constructor(input = {}) {
    super({
      ...input,
      kind: "unknown_provider",
      code: "AGENT_UNKNOWN_PROVIDER_FAILURE",
      retryable: false,
      recoveryHint: "Inspect the preserved provider diagnostics and classify or repair the failure before starting a new attempt.",
    });
  }
}

export class EmptyAgentResponseFailure extends AgentFailure {
  constructor(input = {}) {
    super({
      ...input,
      message: input.message || "agent returned an empty response",
      kind: "empty_response",
      code: "AGENT_EMPTY_RESPONSE",
      retryable: true,
      recoveryHint: "Retry the same input because the provider returned no candidate response.",
    });
  }
}
