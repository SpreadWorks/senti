/**
 * Exact-attempt failure recording for definition-owned parent commands.
 *
 * A command and its registry hooks may each update canonical state.  The
 * dispatcher therefore binds the active Attempt before the first hook and
 * records a tooling failure only if that exact Attempt remains unmodified
 * after the failed boundary.  This keeps a post-hook error from stranding an
 * Attempt, without overwriting a command's own semantic outcome or recovery
 * transition.
 */

import { CurrentAttemptIdentity } from "./current-flow-state.js";
import { DefinitionFailureOwnership } from "./definition-failure-ownership.js";

function nonEmptyText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function commandNameFromExecutionCommand(value) {
  if (typeof value !== "string") return null;
  const tokens = value.trim().split(/\s+/);
  if (tokens.length < 4 || tokens[0] !== "sennel" || tokens[1] !== "flow" || tokens[2] !== "run") return null;
  return tokens[3] || null;
}

function lifecycleActionFor(state) {
  if (!state || state.current === null || state.attempt === null) return null;
  const nodeId = state.current.at(-1);
  const node = state.findNode(nodeId);
  if (node?.status !== "in_progress" || state.attempt.failure !== null) return null;
  const action = state.definition.actionFor(nodeId, state.root);
  const commandName = commandNameFromExecutionCommand(action.executionCommand);
  if (commandName === null) return null;
  return { nodeId, action, commandName };
}

function failureFacts(error, fallbackCode) {
  if (error?.errors && Array.isArray(error.errors)) {
    const fatal = error.errors.find((entry) => entry?.level === "fatal") || error.errors[0];
    if (fatal) {
      const messages = Array.isArray(fatal.messages) ? fatal.messages : [fatal.messages];
      return {
        code: nonEmptyText(fatal.code || fallbackCode, "lifecycle failure code"),
        message: nonEmptyText(messages.filter((message) => typeof message === "string").join("; ") || String(error), "lifecycle failure message"),
      };
    }
  }
  return {
    code: nonEmptyText(error?.code || fallbackCode, "lifecycle failure code"),
    message: nonEmptyText(error?.message || String(error), "lifecycle failure message"),
  };
}

/** One exact definition-owned command attempt, captured before pre hooks. */
export class DefinitionLifecycleAttemptBinding {
  constructor({ specId, runId, commandName, attempt, state, flowManager } = {}) {
    this.specId = nonEmptyText(specId, "definition lifecycle binding.specId");
    this.runId = nonEmptyText(runId, "definition lifecycle binding.runId");
    this.commandName = nonEmptyText(commandName, "definition lifecycle binding.commandName");
    this.attempt = CurrentAttemptIdentity.from(attempt);
    this.state = state;
    this.flowManager = flowManager;
    Object.freeze(this);
  }

  static capture({ hookCtx, envelopeType, envelopeKey, registryFailureOwnership = null } = {}) {
    if (
      envelopeType !== "run"
      || !hookCtx?.flowManager
      || typeof hookCtx.flowManager.canonicalState !== "function"
      || typeof hookCtx.flowManager.failCurrentAttemptIfCurrent !== "function"
      || !hookCtx?.specId
      || !(registryFailureOwnership instanceof DefinitionFailureOwnership)
      || !registryFailureOwnership.allowsDispatcherFallback()
    ) return null;
    const state = hookCtx.flowManager.canonicalState(hookCtx.specId);
    const action = lifecycleActionFor(state);
    if (
      action === null
      || action.commandName !== envelopeKey
      || !registryFailureOwnership.equals(action.action.failureOwnership)
    ) return null;
    return new DefinitionLifecycleAttemptBinding({
      specId: state.specId,
      runId: state.runId,
      commandName: action.commandName,
      attempt: state.attempt,
      state,
      flowManager: hookCtx.flowManager,
    });
  }

  toolingFailure(error, fallbackCode) {
    const facts = failureFacts(error, fallbackCode);
    const state = this.state;
    const action = lifecycleActionFor(state);
    if (action === null || action.nodeId !== this.attempt.nodeId) return false;
    const contract = state.definition.contractFor(this.attempt.nodeId, state.root);
    const retryable = action.action.failurePolicy.value === "retry"
      && contract.remainingRetries(state.attempt.consumption, "tooling") > 0;
    return this.flowManager.failCurrentAttemptIfCurrent({
      specId: this.specId,
      expectedRunId: this.runId,
      expectedAttempt: this.attempt,
      failure: {
        category: "tooling",
        code: facts.code,
        message: facts.message,
        retryable,
        retryKind: retryable ? "tooling" : null,
      },
      result: {
        outcome: "failed",
        summary: facts.message,
        confirmedAt: new Date().toISOString(),
        artifactRefs: [],
      },
    });
  }

}
