# Feature Specification: 266-structured-gate-fail

**Feature Branch**: `feature/266-structured-gate-fail`
**Created**: 2026-05-22
**Status**: Draft
**Input**: GitHub Issue #341

## Goal
Make gate-impl FAIL output and repeat handling structured through Observation, Diagnosis, and NextAction so agents and humans can identify the next repair target without rereading the full spec or guardrail text.

## Background
Issue #341 identifies two related causes of repeated gate-impl FAIL loops. First, gate FAILs are flattened into natural-language reason strings, so agents and humans must reconstruct the repair target, evidence, and severity. Second, prior FAIL context is not carried forward as behavior state, and broad guardrail wording lets AI evaluators apply different concrete interpretations across rounds. The current source confirms this shape: gate artifacts expose `reasons`, issue-log stores `failedEvaluations`, and gate-impl instructions read `artifacts.reasons`. This spec replaces that path with structured Observation/Diagnosis/NextAction output, bounded prior memory, and diff-verifiable base guardrail text.

## Scope
- [must] Add Observation, Diagnosis, and NextAction in-memory classes with JSON conversion, markdown rendering, and similarity signatures.
- [must] Emit `artifacts.nextAction.diagnosis.observations[]` for gate PASS and FAIL results and make gate consumers read that shape.
- [must] Define gate-impl failure modes as `spec-impl-mismatch`, `guardrail-violation`, and `process-evidence-missing` with explicit severity policy.
- [must] Replace new issue-log `failedEvaluations` persistence with `observations` for gate failures while keeping issue-log audit-only for prior-memory behavior.
- [must] Store gate-impl prior memory state in `flow.json` and detailed memory entries in a spec-local artifact, retaining the latest 3 gate-impl rounds.
- [must] Convert unmigrated legacy phase evaluations to NextAction at the wire boundary without phase-specific adapter branches.
- [must] Rewrite base preset `no-overengineering` and `code-placement` guardrail wording into diff-verifiable violation conditions.
- [must] Add reusable guardrail rewrite rubric material under `src/presets/base` and keep generated preset/skill copies synchronized with source changes.
- [must] Add spec-local tests under `specs/266-structured-gate-fail/tests` and update shared tests whose assertions read `artifacts.reasons`, `artifacts.evaluations`, `artifacts.issues`, or `failedEvaluations`.

## Out of Scope
- Cross-flow learning between unrelated specs or historical flows.
- Similarity algorithm changes beyond renaming inputs from `guardrail_id`/`reason` to `requirementRef`/`observed`.
- Full guardrail rewrite across all presets beyond base `no-overengineering` and `code-placement`.
- Test-phase-specific failureMode expansion.
- Adding external dependencies.
- Adding, removing, or renaming user-facing CLI commands or options.

## Constraints
- Use only Node.js built-in modules and existing project helpers.
- Represent Observation, Diagnosis, NextAction, and any meaningful memory entry values as classes with constructor invariants and behavior methods; do not model them as object-literal discriminated unions.
- Do not keep backward-compatible parsing or persistence for old alpha gate failure formats when writing new artifacts.
- Keep `src/` generic and free of project-specific issue details.
- Issue-log entries are audit records only and must not be read for gate behavior; no-progress rejection, pass-to-fail flip handling, and prior-memory prompt input must use flow.json and the spec-local memory artifact.
- Gate-impl prior memory must be bounded to the latest 3 rounds for prompt injection and bounded resource usage.
- A failed Observation parse consumes the existing gate retry maxAttempts budget; no new unbounded retry loop is introduced.
- Prompt and preset source changes under `src/flow/prompts`, `src/skills`, or `src/presets` require generated preset/skill copies to be synchronized with their source files.
- No new user-facing CLI argument is introduced. Existing gate command exit-code behavior remains: successful evaluation returns exit code 0; command errors, invalid artifacts, retry exhaustion, and unrecoverable parse errors use existing non-zero envelope paths.

## Design Principles
- Use NextAction as the single wire-level representation of what happened and what phase should run next.
- Keep wire and persistence as JSON, but use classes in memory for invariant enforcement and behavior.
- Treat issue-log as audit evidence and flow.json/artifacts as behavior state.
- Use adapters only as temporary wire-boundary conversion for unmigrated phases; do not let adapters become phase-specific quasi-specs.
- Make guardrail text diff-verifiable so gate failures name observable conditions rather than subjective design opinions.
- Prefer bounded prompt memory over complete historical replay.

## Overview
### Modules
- `src/flow/lib/observation.js` defines Observation, Diagnosis, NextAction, gate-impl severity policy helpers, and legacy-to-NextAction adapter functions.
- `src/flow/lib/run-gate.js` builds guardrail prompts, parses AI gate output, creates gate PASS/FAIL artifacts, performs repeated FAIL detection, and writes issue-log entries.
- `src/flow/schemas/next-action/gate.schema.json` documents the gate wire contract for NextAction artifacts.
- `src/flow/prompts/impl/gate-impl.md` tells agents how to read gate-impl FAIL output and must point to `artifacts.nextAction.diagnosis.observations`.
- `src/presets/base/guardrail.json` owns base guardrail articles inherited by presets, including `no-overengineering` and `code-placement`.
- `flow.json` owns active flow behavior state and will store the gate-impl prior-memory index.
- `specs/<spec>/gate-impl-memory.json` stores detailed prior-memory entries used to build the next gate-impl prompt.

### Data Flow
- Gate-impl AI output is parsed into Observation instances. Invalid Observation fields cause a retry using the existing gate retry budget.
- Observation[] is grouped into a Diagnosis, then wrapped in NextAction with `prescription` set to the next phase id already used by gate PASS/FAIL routing.
- Gate verdicts are aggregated from Observation severity: any blocking Observation yields gate FAIL and the existing FAIL prescription; advisory-only Observations yield gate PASS with advisory observations retained in `nextAction.diagnosis.observations`; no Observations yield gate PASS with an empty observations array.
- Gate result artifacts include `nextAction`; consumers read observations from `nextAction.diagnosis.observations` instead of reconstructing action from flattened reasons.
- On gate-impl results, gate behavior state writes a bounded index, `headSha`, `worktreeHash`, and passed-guardrail status to flow.json, and detailed Observation history to the spec-local memory artifact. Issue-log receives audit text but is not read to drive behavior.
- Before later gate-impl AI calls, the prompt receives the latest 3 rounds from the memory artifact with status, statusReason, signature, and Observation fields.
- Unmigrated phases produce legacy evaluations and immediately convert them to NextAction before the wire boundary by mapping guardrail failures to `guardrail-violation`, spec/task mismatches to `spec-impl-mismatch`, and structural or process evidence gaps to `process-evidence-missing`; missing fields use null, empty string, or empty array according to the target JSON field type.

### Decisions
- [VERIFY] Gate prompts currently ask for guardrail article evaluations, not Observation records.
- [VERIFY] Current FAIL reasons are flattened from violation text.
- [VERIFY] Current repeated FAIL detection reads `failedEvaluations` from issue-log.
- [VERIFY] gate-impl agent instructions currently read flattened reasons.
- [VERIFY] Gate schema currently lacks NextAction structure.
- Use regeneration retry for invalid Observation JSON.
- Use flow.json plus artifact for prior memory and keep issue-log audit-only.
- Move all existing gate behavior state out of issue-log, including unchanged-rerun state and passed-guardrail flip state.
- Keep prior memory to the latest 3 gate-impl rounds.
- Store reusable guardrail rewrite rubric under `src/presets/base`.

## Clarifications (Q&A)
- Q: Should issue-log drive gate-impl prior memory?
  - A: No. issue-log remains audit-only. flow.json stores current behavior state and a spec-local artifact stores detailed prior-memory entries.
- Q: How many prior rounds are injected into gate-impl prompts?
  - A: The latest 3 gate-impl rounds for the same flow and phase.
- Q: How should invalid Observation AI output be handled?
  - A: Regenerate using the existing gate retry budget. Do not force advisory and do not create a separate unbounded retry loop.
- Q: Where is the reusable guardrail rewrite rubric stored?
  - A: Under `src/presets/base` so it ships with the base preset and is propagated by upgrade.

## Alternatives Considered
- Use issue-log as the prior-memory source. — Rejected because issue-log is an audit log and should not drive flow behavior.
- Store all prior-memory detail directly in flow.json. — Rejected because full Observation history would mix detailed prompt/audit content with active flow state and grow flow.json.
- Store prior memory only in a spec-local artifact. — Rejected because the flow's active behavior state would not be visible from flow.json.
- Force invalid Observation output to advisory. — Rejected because a parser failure is not evidence that the underlying issue is non-blocking.
- Enhance similarity with `where` or hierarchical matching. — Rejected for this spec; Issue #341 keeps similarity algorithm changes out of scope except the field rename to requirementRef/observed.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-22T08:53:37.349Z
- Notes: User selected [1] approve gate-passed spec.

## Requirements
- R1 [must]: Add `src/flow/lib/observation.js` exporting Observation, Diagnosis, and NextAction classes. Constructors shall reject invalid severity, empty `observed`, invalid `where.file`, invalid `refs`, and empty `prescription`. Each class shall implement `toJSON()`, `fromJSON()`, and `toMarkdown()`; Observation shall also implement `signature()`.
- R2 [must]: Observation JSON shall have exactly `kind`, `failureMode`, `requirementRef`, `where`, `observed`, `severity`, and `refs`; `kind` is `violation`, `where` is null or `{file, locator?}`, `severity` is `blocking` or `advisory`, and `refs` is an array.
- R3 [must]: Gate failureMode shall be exactly `spec-impl-mismatch`, `guardrail-violation`, or `process-evidence-missing` for every phase that emits NextAction. `spec-impl-mismatch` and `guardrail-violation` are always blocking, while `process-evidence-missing` is blocking only when the missing evidence is diff-verifiable and advisory otherwise.
- R4 [must]: The gate-impl evaluator prompt shall make AI emit only `failureMode`, `requirementRef`, `where`, and `observed` for each violation; code shall derive `kind`, `severity`, and `refs`. Shared gate parsing shall continue to support unmigrated legacy evaluations and convert them to Observation/NextAction at the wire boundary.
- R5 [must]: If AI emits invalid Observation JSON, unknown `failureMode`, unknown `requirementRef`, or missing required fields, gate shall request regeneration and consume one existing gate retry attempt. If regeneration still fails through maxAttempts exhaustion, gate shall stop through the existing retry exhaustion path.
- R6 [must]: Gate PASS and FAIL artifacts shall include `nextAction` with `{diagnosis:{summary,observations},prescription}`. Any blocking Observation shall produce gate FAIL with the existing FAIL prescription; advisory-only Observations shall produce gate PASS with advisory observations retained; zero Observations shall produce gate PASS with an empty observations array. Gate-impl consumers shall read `artifacts.nextAction.diagnosis.observations` as the primary repair input.
- R7 [must]: New gate issue-log entries shall persist `observations` derived from `nextAction.diagnosis.observations` instead of `failedEvaluations`; issue-log shall not be read by prior-memory, no-progress rejection, or pass-to-fail flip logic.
- R8 [must]: Gate-impl prior memory shall store behavior state in flow.json under `gateImplMemory` with `version`, `artifactPath`, `roundsKept`, `lastUpdatedAt`, `headSha`, `worktreeHash`, `passedGuardrails`, and `entries[]` containing `signature`, `status`, and `observationRef`.
- R9 [must]: The spec-local prior-memory artifact shall store full Observation JSON, `headSha`, `worktreeHash`, `passedGuardrails`, `round`, `status`, `statusReason`, and `updatedAt` for the latest 3 gate-impl rounds. Prompt injection shall read this artifact and include only those latest 3 rounds.
- R10 [must]: Repeated FAIL similarity shall compare current Observation `requirementRef` and `observed` against prior Observation `requirementRef` and `observed`, reusing the existing Jaccard algorithm and threshold without adding `where` to the similarity key.
- R11 [must]: Unmigrated phases shall convert legacy evaluations to NextAction before wire output. The adapter shall contain no phase-specific branches and shall map guardrail failures to `guardrail-violation`, spec/task mismatches to `spec-impl-mismatch`, and structural or process evidence gaps to `process-evidence-missing`; unavailable Observation fields shall be filled only with null, empty string, or empty array according to the target field type.
- R12 [must]: `src/flow/schemas/next-action/gate.schema.json` shall document the gate NextAction wire shape, including diagnosis summary, observations, and prescription, without duplicating every class invariant already enforced in `src/flow/lib/observation.js`.
- R13 [must]: `src/flow/prompts/impl/gate-impl.md` and generated skill/template copies shall instruct agents to show every Observation from `artifacts.nextAction.diagnosis.observations` on FAIL and avoid relying on flattened `artifacts.reasons` as the primary repair input.
- R14 [must]: Base `no-overengineering` shall list separate diff-verifiable violation conditions for single-caller indirection, duplicate code shape, and missing design-confirmation evidence; each condition shall state blocking or advisory severity criteria.
- R15 [must]: Base `code-placement` shall define the diff-verifiable violation `derivation logic placed in consumer module` using these conditions: new export or module in diff, operation on data owned by an existing data-owner module, and no change to that owner module in the diff.
- R16 [must]: A reusable guardrail rewrite rubric shall be stored under `src/presets/base` and describe how to rewrite abstract guardrail prose into named violation, diff-verification condition, and severity-policy fields.
- R17 [must]: After changes to `src/presets/base` or prompt/skill source, generated skill/preset copies shall be synchronized with the source files so the diff contains both the source change and the corresponding generated-copy change.
- R18 [must]: Tests shall cover Observation class invariants and JSON conversion, invalid AI output regeneration behavior, NextAction artifacts, issue-log observation persistence, prior-memory flow.json/artifact separation, legacy adapter conversion, prompt consumer changes, and base guardrail/rubric updates.

## Acceptance Criteria
- A gate-impl FAIL artifact contains `artifacts.nextAction.diagnosis.observations[]` with actionable requirementRef, where, observed, severity, and failureMode fields.
- A gate-impl PASS artifact still contains `artifacts.nextAction` with an empty or summary-only diagnosis and the correct next prescription.
- Advisory-only Observations produce gate PASS with those advisory observations retained in `artifacts.nextAction.diagnosis.observations`; any blocking Observation produces gate FAIL.
- Invalid Observation AI output is retried through the existing gate retry path and does not silently downgrade blocking observations to advisory.
- Issue-log entries written by new gate runs use `observations`; prior-memory, no-progress rejection, and pass-to-fail flip behavior reads flow.json and the memory artifact, not issue-log.
- The gate-impl prompt receives prior-memory content from the latest 3 same-flow same-phase rounds.
- Unmigrated phases expose NextAction at the wire boundary without consumer branching on old and new formats.
- Base `no-overengineering` and `code-placement` guardrail bodies are diff-verifiable and include severity criteria.
- Spec-local tests exist under `specs/266-structured-gate-fail/tests` with `// spec: R<N>` headers.
- Generated skill/preset copies are synchronized after preset or prompt source changes.

## Implementation Targets
- src/flow/lib/observation.js
- src/flow/lib/run-gate.js
- src/flow/schemas/next-action/gate.schema.json
- src/flow/prompts/impl/gate-impl.md
- src/presets/base/guardrail.json
- src/presets/base
- src/skills or generated skill copies synchronized with source changes
- tests and specs/266-structured-gate-fail/tests

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add Observation model
  - Create the in-memory Observation, Diagnosis, and NextAction class model with JSON conversion, markdown rendering, severity policy, and legacy adapter support.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Wire gate NextAction
  - Update gate result construction, schema documentation, issue-log persistence, and gate consumers to use NextAction as the primary wire output.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Add gate memory
  - Implement bounded gate-impl prior memory using flow.json for behavior state and a spec-local artifact for detailed Observation history.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Rewrite guardrails
  - Rewrite base preset `no-overengineering` and `code-placement` into diff-verifiable violation conditions and add the reusable rewrite rubric under `src/presets/base`.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Update tests
  - Add spec-local and shared regression coverage for the structured gate output, prior memory, adapter, prompt, and guardrail changes.
  - see `tasks/T-5.md` for full spec
