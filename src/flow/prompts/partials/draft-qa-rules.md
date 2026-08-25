## Draft Question Ledger Rules

`draft.json.questionLedger` is the exclusive question authority. Its exact JSON shape is:

```json
{
  "revision": 0,
  "publication": "draft-worker-publication",
  "evidenceDigest": "<64-lowercase-hex-sha256>",
  "questions": []
}
```

Questions are ordered by stable `q<N>` id, have unique ids, and carry their own revision, provenance, and evidence digest. The ledger may be empty. Do not emit unknown fields or retired `qa`, `status`, `evidence`, or `droppedReason` fields.

### Exact exclusive question states

Every question has exactly one of these exact JSON shapes. Substitute real non-empty prose and SHA-256 digests.

```json
{"state":"CandidateQuestion","id":"q1","category":"goal-confirmation","question":"Which public behavior must be selected?","revision":0,"provenance":{"producer":"draft"},"evidenceDigest":"<64-lowercase-hex-sha256>"}
```

```json
{"state":"ResolvedByExistingInformation","id":"q1","category":"goal-confirmation","question":"Which public behavior must be selected?","revision":0,"provenance":{"producer":"draft-refine"},"evidenceDigest":"<64-lowercase-hex-sha256>","resolution":"The request and project rule already select the stable behavior."}
```

```json
{"state":"AwaitingUserAnswer","id":"q1","category":"goal-confirmation","question":"Which public behavior must be selected?","revision":1,"provenance":{"producer":"definition-promotion"},"evidenceDigest":"<64-lowercase-hex-sha256>"}
```

```json
{"state":"AnsweredQuestion","id":"q1","category":"goal-confirmation","question":"Which public behavior must be selected?","revision":2,"provenance":{"producer":"user-answer"},"evidenceDigest":"<64-lowercase-hex-sha256>","answer":"Use the stable public representation.","why":"The user selected it after reviewing the request and impact.","considered":"A private representation was rejected because it breaks callers."}
```

```json
{"state":"DiscardedQuestion","id":"q1","category":"goal-confirmation","question":"Which public behavior must be selected?","revision":2,"provenance":{"producer":"draft-refine"},"evidenceDigest":"<64-lowercase-hex-sha256>","reason":"The existing project rule already makes this decision."}
```

`category` is one of `goal-confirmation`, `impact-scope`, `acceptance-criteria`, `constraint-non-goal`, `risk-migration-policy`, `user-visible-behavior`, `dependency-integration-boundary`, `implementation-policy`, or `follow-up-coverage`. `AnsweredQuestion.answer` and `why` are non-empty; `considered` is always a string and may be empty. `ResolvedByExistingInformation.resolution` and `DiscardedQuestion.reason` are non-empty.

Workers, reviewers, and repair steps record candidates or existing-information resolutions only. They never choose a user wait. Definition alone promotes a candidate to `AwaitingUserAnswer`. A candidate is not a completeness checkbox: create one only after research proves that the request, Issue, project rules, docs, and relevant source do not determine a user-only decision. Do not turn an explicit requirement into a confirmation question. `decisionMap.requiresUserJudgment` is a readable projection; the ledger remains authoritative.

### Field-level boundary

Draft is RFP/requirements level only. Mentioning file paths or function names as context is permitted. Do not describe internal algorithms, data structures, control flow, or API design. Code references in question prose, provenance, evidence digest provenance, resolution, answer, why, considered, and reason are permitted as justification and do not constitute implementation details.

### Premise validation

Before starting questions, fill the `analysis` object:

- Read the request or issue and identify what problem is actually being solved.
- State the proposed solution approach.
- Evaluate whether the approach addresses the root problem, not just the surface request.

If the analysis cannot be filled without more context, investigate by reading code, docs, or issue context before proceeding.

### Decision entry rule

Any terminal decision entry with non-empty `why` or `considered` must have provenance and `evidenceDigest` supporting that decision. Do not invent evidence or use an empty provenance object.

### Requirement priority markers

Every requirement-like draft entry that expresses a required outcome MUST include exactly one accepted priority marker: `must`, `should`, or `nice-to-have`.

Apply this to authored requirement-like text in `questionLedger.questions`, `scopeVerification`, `impactOnExisting`, `decisionMap`, and `openQuestions`. The marker belongs in the prose, not in a separate field.

Draft coverage review must not report missing priority markers as unresolved user-decision blockers. Draft-gate preflight and gate validation own residual priority issues.

### Research and self-verification

Before generating candidates, fill `decisionMap` from the request or issue, docs, project rules, and relevant source code. Record stated requirements in `knownFacts`, project-owned choices in `resolvedByProjectRules`, and a bounded spec-writing delegation in `deferredToSpec` only as `{ "boundary": "...", "relevance": "...", "owner": "spec" }`. Draft owns boundary, relevance, and owner validation; Spec owns the final detail. Create a candidate only after research proves that none of those authorities determines the choice. Do not ask for confirmation of an explicit request or ask questions based on assumptions.

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

Draft coverage review identifies only blocking user decisions that still prevent spec writing. It must not propose iterative follow-up loops, append ledger entries, mutate `draft.json`, or report issues that existing project rules, code patterns, or conservative implementation choices can resolve during spec writing.
