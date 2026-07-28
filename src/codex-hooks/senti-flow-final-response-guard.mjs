#!/usr/bin/env node
/**
 * Codex Stop hook for the active senti Flow.
 *
 * Codex invokes this process immediately before it returns a final response.
 * The hook snapshots the current Flow target, then asks the CLI's typed guard
 * whether that exact target may end. A required continuation becomes Codex's
 * next prompt instead of an agent final response.
 */

import { spawnSync } from "node:child_process";

function readHookInput() {
  const chunks = [];
  process.stdin.on("data", (chunk) => chunks.push(chunk));
  return new Promise((resolve) => {
    process.stdin.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (_) {
        resolve({});
      }
    });
  });
}

function parseJsonOutput(output) {
  const text = String(output || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function runSenti(cwd, args) {
  const command = process.env.SENTI_BIN || "senti";
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
  });
  return {
    result,
    payload: parseJsonOutput(result.stdout),
  };
}

function targetArgs(status) {
  const args = [];
  if (typeof status.runId === "string" && status.runId.trim() !== "") {
    args.push("--expect-run-id", status.runId);
  }
  if (typeof status.spec === "string" && status.spec.trim() !== "") {
    args.push("--expect-spec", status.spec);
  }
  if (Object.hasOwn(status, "issue")) {
    if (status.issue == null) args.push("--expect-no-issue");
    else args.push("--expect-issue", String(status.issue));
  }
  return args;
}

function continuationReason(directive) {
  return [
    "A non-terminal senti Flow directive is still active. Do not return a final response.",
    "Dispatch this exact continuation in the current invocation, then refresh the guarded next action:",
    JSON.stringify(directive),
  ].join("\n");
}

function guardFailureReason() {
  return [
    "senti could not verify whether the active Flow may end.",
    "Do not return a final response. Resolve the Flow guard error and continue the active Flow in this invocation.",
  ].join("\n");
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function main() {
  const input = await readHookInput();
  const cwd = typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();
  const status = runSenti(cwd, ["flow", "get", "status"]);

  if (!status.payload || status.result.error || status.result.signal) {
    emit({ decision: "block", reason: guardFailureReason() });
    return;
  }
  if (status.payload.active === false) {
    emit({});
    return;
  }
  if (status.payload.ok === false || status.payload.active !== true) {
    emit({ decision: "block", reason: guardFailureReason() });
    return;
  }

  const guard = runSenti(cwd, [
    "flow",
    "get",
    "final-response-guard",
    ...targetArgs(status.payload),
  ]);
  const response = guard.payload?.data?.finalResponse;
  if (response?.allowed === true) {
    emit({});
    return;
  }
  if (guard.payload?.ok === false
    && guard.payload.errors?.some((error) => error.code === "FLOW_CONTINUATION_REQUIRED")
    && response?.directive) {
    emit({ decision: "block", reason: continuationReason(response.directive) });
    return;
  }
  emit({ decision: "block", reason: guardFailureReason() });
}

await main();
