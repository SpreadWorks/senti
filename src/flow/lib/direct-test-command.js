import { spawnSync } from "node:child_process";

const DEFAULT_TEST_TIMEOUT_MS = 120_000;
const MAX_TEST_TIMEOUT_MS = 900_000;
const MAX_DIAGNOSTIC_CHARS = 3_200;

function boundedTail(value) {
  const text = String(value || "").trim();
  if (text.length <= MAX_DIAGNOSTIC_CHARS) return text;
  return `[truncated]\n${text.slice(-MAX_DIAGNOSTIC_CHARS)}`;
}

function failureOutput(stdout, stderr) {
  return [
    ...(String(stderr || "").trim() ? [`stderr:\n${boundedTail(stderr)}`] : []),
    ...(String(stdout || "").trim() ? [`stdout:\n${boundedTail(stdout)}`] : []),
  ].join("\n");
}

export class DirectTestCommandResult {
  constructor({ status, command = null, detail }) {
    if (!["passed", "failed", "not-configured", "tooling-error"].includes(status)) {
      throw new Error("direct test command status is invalid");
    }
    if (command != null && (typeof command !== "string" || command.trim() === "")) {
      throw new Error("direct test command must be null or a non-empty string");
    }
    if (typeof detail !== "string" || detail.trim() === "") {
      throw new Error("direct test command detail must be a non-empty string");
    }
    this.status = status;
    this.command = command == null ? null : command;
    this.detail = detail.trim();
    Object.freeze(this);
  }

  static notConfigured() {
    return new DirectTestCommandResult({
      status: "not-configured",
      detail: "No deterministic test command was configured.",
    });
  }

  static fromProcess(command, result) {
    if (result.error) {
      return new DirectTestCommandResult({
        status: "tooling-error",
        command,
        detail: result.error.message,
      });
    }
    if (result.status === 0) {
      return new DirectTestCommandResult({
        status: "passed",
        command,
        detail: "Deterministic test command exited successfully.",
      });
    }
    const output = failureOutput(result.stdout, result.stderr);
    return new DirectTestCommandResult({
      status: "failed",
      command,
      detail: [
        `Deterministic test command exited ${result.status ?? "without a status"}.`,
        ...(output ? [output] : []),
      ].join("\n"),
    });
  }
}

export function runDirectTestCommand(root, command, timeoutMs) {
  if (command == null || String(command).trim() === "") {
    return DirectTestCommandResult.notConfigured();
  }
  const timeout = timeoutMs == null ? DEFAULT_TEST_TIMEOUT_MS : Number(timeoutMs);
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > MAX_TEST_TIMEOUT_MS) {
    throw new Error(`test timeout must be 1 through ${MAX_TEST_TIMEOUT_MS} milliseconds`);
  }
  const normalizedCommand = String(command);
  const result = spawnSync(normalizedCommand, {
    cwd: root,
    encoding: "utf8",
    shell: true,
    timeout,
    maxBuffer: 4 * 1024 * 1024,
  });
  return DirectTestCommandResult.fromProcess(normalizedCommand, result);
}
