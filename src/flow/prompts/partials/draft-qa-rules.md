## Draft QA Rules

### QA entry schema
Each entry in `draft.json.qa[]` MUST use this field set:

```json
{
  "id": "q1",
  "status": "pending | approved | answered | dropped",
  "category": "goal-confirmation | impact-scope | acceptance-criteria | constraint-non-goal | risk-migration-policy | user-visible-behavior | dependency-integration-boundary | implementation-policy | follow-up-coverage",
  "question": "the question asked",
  "answer": "the answer given",
  "evidence": "code reference, grep result, or doc citation that supports the answer",
  "why": "rationale for this decision",
  "considered": "alternative approaches evaluated and rejected",
  "droppedReason": "why this question was intentionally dropped"
}
```

For `pending` and `approved` entries, `answer`, `evidence`, `why`, `considered`, and `droppedReason` MUST be empty strings. For `answered` entries, `answer`, `evidence`, and `why` MUST be non-empty, `considered` MAY be empty or non-empty, and `droppedReason` MUST be empty. For `dropped` entries, `droppedReason` MUST be non-empty and `answer`, `evidence`, `why`, and `considered` MUST be empty.

`qa[]` MAY be empty. A `pending` or `approved` entry is not a topic candidate or a completeness checkbox: it is a persisted claim that the request, Issue, project rules, docs, and relevant source context do not determine a decision that only the user can make. Do not turn an already stated requirement into a confirmation question. `decisionMap.requiresUserJudgment` is a readable projection of these unresolved entries and should reference their stable ids; `qa[]` remains the lifecycle authority.

### Field-level boundary
Draft is RFP/requirements level only. Mentioning file paths or function names as context is permitted. Do not describe internal algorithms, data structures, control flow, or API design. Code references within the `evidence`, `why`, `considered`, and `answer` fields of QA entries are permitted as justification and do not constitute implementation details.

### Premise validation
Before starting Q&A, fill the `analysis` object:

- Read the request or issue and identify what problem is actually being solved.
- State the proposed solution approach.
- Evaluate whether the approach addresses the root problem, not just the surface request.

If the analysis cannot be filled without more context, investigate by reading code, docs, or issue context before proceeding.

### Decision entry rule
A decision entry is any QA entry with non-empty `why` or non-empty `considered`. Every decision entry MUST have non-empty `evidence` that supports the decision.

### Requirement priority markers
Every requirement-like draft entry that expresses a required outcome MUST include exactly one accepted priority marker: `must`, `should`, or `nice-to-have`.

Apply this to authored requirement-like text in `qa[]`, `scopeVerification`, `impactOnExisting`, `decisionMap`, and `openQuestions`. The marker belongs in the prose for the requirement-like entry, not in a separate field.

Draft coverage review must not report missing priority markers as unresolved user-decision blockers. Draft-gate preflight and gate validation own residual priority issues.

### Research and self-verification
Before generating questions, fill `decisionMap` from the request or issue, docs, project rules, and relevant source code. Use it to avoid discovering design topics later through review loops. Record stated requirements in `knownFacts`, project-owned choices in `resolvedByProjectRules`, and spec-writing choices in `deferredToSpec`. Create a pending question only after research proves that none of those authorities determines the choice. Do not ask for confirmation of an explicit request or ask questions based on assumptions.

### Requirements category checklist
Use these categories to check draft coverage. They do not require one question per category:

1. Goal and Scope - Is the goal clear? Is scope bounded?
2. Impact on existing - What existing features, code, or tests are affected?
3. Constraints - What non-functional requirements, guardrails, or project rules apply?
4. Edge cases - What boundary conditions or error cases matter?
5. Test strategy - What should be tested and how?
6. Alternatives considered - What other approaches were evaluated? Why was this one chosen?
7. Future extensibility - How does this change affect future modifications or extensions?
8. Consumer contracts - What rules must consumers of introduced interfaces or data structures follow?

### Coverage rule
Draft coverage review uses these rules to identify only blocking user decisions that still prevent spec writing. It must not propose iterative follow-up loops, append QA entries, mutate `draft.json`, or report issues that existing project rules, code patterns, or conservative implementation choices can resolve during spec writing.
