export const FailureKind = Object.freeze({
  AiSemanticFail: "ai-semantic-fail",
  MechanicalValidation: "mechanical-validation",
  DeterministicRepair: "deterministic-repair",
  Protocol: "protocol",
  Tooling: "tooling",
  OutputSchema: "output-schema",
});

function counterFor(kind) {
  if (kind === "gate") return "gateRetry";
  if (kind === "review") return "reviewRetry";
  throw new Error(`unknown retry kind: ${kind}`);
}

function recordRetryOutcome({ state, phase, kind, failureKind }) {
  if (!state || !Array.isArray(state.metrics)) state.metrics = [];
  if (failureKind !== FailureKind.AiSemanticFail) return false;
  state.metrics.push({
    phase,
    counter: counterFor(kind),
    delta: 1,
    taskId: null,
    ts: new Date().toISOString(),
  });
  return true;
}

export function recordReviewRetryOutcome({ state, phase, failureKind }) {
  return recordRetryOutcome({ state, phase, kind: "review", failureKind });
}

export function recordGateRetryOutcome({ state, phase, failureKind }) {
  return recordRetryOutcome({ state, phase, kind: "gate", failureKind });
}

export function readRetryCount({ state, kind, phase }) {
  const counter = counterFor(kind);
  let count = 0;
  for (const entry of state?.metrics || []) {
    if (entry.phase !== phase || entry.counter !== counter) continue;
    if (entry.reset) count = 0;
    else count += entry.delta ?? 1;
  }
  return count;
}

export function classifyPublicFlowFailure({ state, surface, failureKind, artifact = {} }) {
  const [kind, phase = "impl"] = String(surface || "").split(":");
  const retryKind = kind === "gate" ? "gate" : "review";
  const consumed = recordRetryOutcome({ state, phase, kind: retryKind, failureKind });
  const semantic = failureKind === FailureKind.AiSemanticFail;
  return {
    retryBudgetConsumed: consumed,
    envelope: {
      ok: false,
      code: artifact.code || (semantic ? "AI_SEMANTIC_FAILURE" : "NON_SEMANTIC_FAILURE"),
      semantic,
    },
  };
}
