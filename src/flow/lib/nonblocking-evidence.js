/** Closed-world extraction of eligible post-implementation evidence. */

function source(ref, source) {
  return { ref, source, value: JSON.parse(source) };
}

export function fromReviewResult({ ref, source: body }) {
  const found = source(ref, body);
  if (found.value.verdict === "REJECTED") return { ...found, resultKind: "quality" };
  if (found.value.toolingOutcome != null) return { ...found, resultKind: "tooling" };
  return null;
}

export function fromGateResult({ ref, source: body }) {
  const found = source(ref, body);
  if (found.value.verdict !== "fail" && found.value.result !== "fail") return null;
  // Gate writes an explicit semantic failure kind.  Every other explicit
  // failure record is an execution/schema/prerequisite condition and must use
  // the retry branch rather than being presented as a repairable finding.
  return {
    ...found,
    resultKind: found.value.failureKind == null || found.value.failureKind === "ai_semantic_fail"
      ? "quality"
      : "tooling",
  };
}

export function fromAcceptanceResult({ ref, source: body }) {
  const found = source(ref, body);
  // The acceptance artifact's current canonical vocabulary expresses the
  // rejected and inconclusive branches as repair_required and
  // user_decision_required.  Keep the artifact authoritative rather than
  // inventing a second result representation for nonblocking.
  return ["repair_required", "user_decision_required", "rejected", "inconclusive", "aborted", "blocked"].includes(found.value.verdict)
    ? { ...found, resultKind: "quality" }
    : null;
}

/**
 * Verification checkpoints have a durable result but no semantic finding
 * schema shared with reviews and gates.  A continuation records a typed
 * handoff for acceptance instead of pretending that the verification passed.
 */
export function fromVerificationResult({ ref, source: body }, step) {
  const found = source(ref, body);
  if (step === "scenario-validity" && found.value.result !== "pass") {
    return { ...found, resultKind: "unavailable" };
  }
  if (step === "test-result-review" && found.value.verdict !== "pass") {
    return { ...found, resultKind: "quality" };
  }
  if (step === "retro" && Number(found.value?.summary?.not_done || 0) > 0) {
    return { ...found, resultKind: "quality" };
  }
  return null;
}

export function fromFinalRegressionResult({ ref, source: body }) {
  const found = source(ref, body);
  if (!["fail", "unavailable", "not-run"].includes(found.value.result)) return null;
  if (found.value.result === "unavailable" || found.value.result === "not-run") {
    return { ...found, resultKind: "unavailable" };
  }
  return {
    ...found,
    resultKind: found.value.failureKind === "caused_by_current_change" ? "quality" : "tooling",
  };
}
