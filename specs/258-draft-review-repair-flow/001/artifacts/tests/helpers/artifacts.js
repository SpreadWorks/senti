export function reviewItem(titleOrOverrides = {}, classification = "blocking", overrides = {}) {
  const values = typeof titleOrOverrides === "object"
    ? { title: "Sample finding", classification: "blocking", ...titleOrOverrides }
    : { title: titleOrOverrides, classification, ...overrides };
  return {
    title: values.title,
    target: values.target || "qa[0].question",
    rationale: values.rationale || "r",
    evidence: values.evidence || "e",
    classification: values.classification,
  };
}

export function triageItem(titleOrOverrides = {}, decision = "apply", overrides = {}) {
  const values = typeof titleOrOverrides === "object"
    ? { title: "Sample finding", decision: "apply", ...titleOrOverrides }
    : { title: titleOrOverrides, decision, ...overrides };
  return {
    title: values.title,
    target: values.target || "qa[0].question",
    decision: values.decision,
    rationale: values.rationale || "r",
    evidence: values.evidence || "e",
  };
}

export function repairItem(titleOrOverrides = {}, paths = ["qa"], overrides = {}) {
  const values = typeof titleOrOverrides === "object"
    ? { title: "Sample finding", changedFieldPaths: ["qa"], ...titleOrOverrides }
    : { title: titleOrOverrides, changedFieldPaths: paths, ...overrides };
  return {
    title: values.title,
    target: values.target || "qa[0].question",
    rationale: values.rationale || "r",
    evidence: values.evidence || "e",
    changedFieldPaths: values.changedFieldPaths,
  };
}
