/**
 * Canonical agent timeout value.
 *
 * Configuration is expressed in seconds for human-facing readability. Convert
 * to milliseconds only when calling Node.js process and timer APIs.
 */
export const DEFAULT_AGENT_TIMEOUT_SECONDS = 900;

export class AgentTimeout {
  constructor(seconds = DEFAULT_AGENT_TIMEOUT_SECONDS) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value <= 0) {
      throw new TypeError("agent timeout must be a positive number of seconds");
    }
    this.seconds = value;
    Object.freeze(this);
  }

  static fromConfig(agentConfig = {}) {
    return new AgentTimeout(agentConfig?.timeout ?? DEFAULT_AGENT_TIMEOUT_SECONDS);
  }

  toMilliseconds() {
    return this.seconds * 1000;
  }
}
