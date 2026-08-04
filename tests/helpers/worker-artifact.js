export function workerArtifactJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function validWorkerHandoffSpec() {
  return {
    goal: "Validate worker handoff publication.",
    background: "The worker cannot write canonical Flow artifacts.",
    scope: { in: ["worker handoff"], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [{ id: "R1", desc: "Publish a validated artifact." }],
    acceptance_criteria: ["The canonical artifact is published."],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  };
}
