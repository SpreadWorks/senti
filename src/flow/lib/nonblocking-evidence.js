/** Closed-world extraction of eligible post-implementation evidence. */

function source(ref, source) {
  return { ref, source, value: JSON.parse(source) };
}

export function fromReviewResult({ ref, source: body }) {
  const found = source(ref, body);
  if (found.value.verdict === "REJECTED") return { ...found, resultKind: "quality" };
  if (found.value.toolingOutcome) return { ...found, resultKind: "tooling" };
  return null;
}

export function fromGateResult({ ref, source: body }) {
  const found = source(ref, body);
  if (found.value.verdict !== "fail" && found.value.result !== "fail") return null;
  return { ...found, resultKind: found.value.failureKind || found.value.toolingFailure ? "tooling" : "quality" };
}

export function fromAcceptanceResult({ ref, source: body }) {
  const found = source(ref, body);
  return ["repair_required", "user_decision_required", "inconclusive", "aborted"].includes(found.value.verdict)
    ? { ...found, resultKind: "quality" }
    : null;
}

export function fromFinalRegressionResult({ ref, source: body }) {
  const found = source(ref, body);
  if (!["fail", "unavailable", "not-run"].includes(found.value.result)) return null;
  return { ...found, resultKind: found.value.failureKind ? "tooling" : "unavailable" };
}
