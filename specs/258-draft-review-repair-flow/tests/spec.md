# Test Design

### Test Design

- **TC-1: Review-draft-questions writes JSON review artifact only**
  - Type: integration
  - Input: Run `review-draft-questions` against a valid `draft.json`.
  - Expected: A stage JSON review artifact is written; `draft.json` is unchanged; no draft repair audit artifact is written.

- **TC-2: Review-draft-coverage writes JSON review artifact only**
  - Type: integration
  - Input: Run `review-draft-coverage` against a valid `draft.json`.
  - Expected: A stage JSON review artifact is written; `draft.json` is unchanged; no draft repair audit artifact is written.

- **TC-3: Markdown summary is ignored for machine routing**
  - Type: integration
  - Input: Provide conflicting markdown summary and JSON review artifact verdicts.
  - Expected: Downstream routing and gate decisions use only the JSON artifact.

- **TC-4: Draft review artifact accepts valid required shape**
  - Type: unit
  - Input: Review JSON containing `version`, `phase`, `sourceDraft`, `generatedAt`, `verdict`, `summary`, `blockingFindings`, `advisoryFindings`, and `repairTargets`.
  - Expected: Validation passes.

- **TC-5: Draft review artifact rejects missing required fields**
  - Type: unit
  - Input: Review JSON missing one required top-level field.
  - Expected: Validation fails with the missing field identified.

- **TC-6: Draft review artifact enforces max 20 blocking findings**
  - Type: unit
  - Input: Review JSON with 21 `blockingFindings`.
  - Expected: Validation fails.

- **TC-7: Draft review artifact allows exactly 20 items per array**
  - Type: unit
  - Input: Review JSON with exactly 20 items in each findings/targets array.
  - Expected: Validation passes.

- **TC-8: Finding classification must match containing array**
  - Type: unit
  - Input: `blockingFindings[]` item with classification `advisory`.
  - Expected: Validation fails.

- **TC-9: Repair target classification must be repair_target**
  - Type: unit
  - Input: `repairTargets[]` item with classification other than `repair_target`.
  - Expected: Validation fails.

- **TC-10: Finding and repair target required fields are enforced**
  - Type: unit
  - Input: Finding or target missing `title`, `target`, `rationale`, `evidence`, or `classification`.
  - Expected: Validation fails.

- **TC-11: Plan flow includes draft question triage and repair leaves**
  - Type: integration
  - Input: Generate or inspect plan flow containing `review-draft-questions`.
  - Expected: `draft-questions-triage` and `draft-questions-repair` exist before `draft-refine`.

- **TC-12: Plan flow includes draft coverage triage and repair leaves**
  - Type: integration
  - Input: Generate or inspect plan flow containing `review-draft-coverage`.
  - Expected: `draft-coverage-triage` and `draft-coverage-repair` exist before `gate-draft`.

- **TC-13: Draft triage artifact accepts valid shape**
  - Type: unit
  - Input: Triage JSON with `version`, `phase`, `sourceReview`, `summary`, and valid `items[]`.
  - Expected: Validation passes.

- **TC-14: Draft triage artifact rejects more than 40 items**
  - Type: unit
  - Input: Triage JSON with 41 `items`.
  - Expected: Validation fails.

- **TC-15: Draft triage item must correspond to source blocking finding or repair target**
  - Type: unit
  - Input: Triage item referencing a non-existent source review item.
  - Expected: Validation fails.

- **TC-16: Draft triage decision enum is enforced**
  - Type: unit
  - Input: Triage item with decision outside `apply`, `invalid`, `already_resolved`, `downgraded_to_non_blocking`, `requires_user_decision`.
  - Expected: Validation fails.

- **TC-17: Draft triage apply decision requires later repair item**
  - Type: integration
  - Input: Triage artifact has an `apply` item but repair artifact omits it.
  - Expected: `gate-draft` fails.

- **TC-18: Non-apply triage decisions resolve without repair**
  - Type: integration
  - Input: Triage items use `invalid`, `already_resolved`, or `downgraded_to_non_blocking`.
  - Expected: Gate does not require corresponding repair items.

- **TC-19: Requires-user-decision blocks gate**
  - Type: integration
  - Input: Triage artifact contains unresolved `requires_user_decision`.
  - Expected: `gate-draft` fails until draft QA is reopened or answered.

- **TC-20: Draft repair artifact accepts valid shape**
  - Type: unit
  - Input: Repair JSON with `version`, `phase`, `sourceTriage`, `summary`, and valid `items[]`.
  - Expected: Validation passes.

- **TC-21: Draft repair artifact rejects more than 40 items**
  - Type: unit
  - Input: Repair JSON with 41 `items`.
  - Expected: Validation fails.

- **TC-22: Repair item must correspond to apply triage item**
  - Type: unit
  - Input: Repair item references a triage item whose decision is not `apply`.
  - Expected: Validation fails.

- **TC-23: Repair item records changed draft field paths**
  - Type: unit
  - Input: Repair item missing changed `draft.json` field paths.
  - Expected: Validation fails.

- **TC-24: Coverage repair approves draft when no unresolved user decision remains**
  - Type: integration
  - Input: Coverage triage has no unresolved `requires_user_decision`; run coverage repair.
  - Expected: `draft.json.approval.approved` is `true`; `confirmedAt` is set to repair time before `gate-draft`.

- **TC-25: Coverage repair does not approve draft with unresolved user decision**
  - Type: integration
  - Input: Coverage triage contains unresolved `requires_user_decision`.
  - Expected: Draft approval is not set automatically; `gate-draft` fails.

- **TC-26: Review and triage steps never mutate draft.json**
  - Type: integration
  - Input: Snapshot `draft.json`, run review and triage steps.
  - Expected: Snapshot hash remains unchanged.

- **TC-27: Repair step is the only post-review draft mutator**
  - Type: integration
  - Input: Run full draft review path with repair needed.
  - Expected: Only repair step changes `draft.json`; repair artifact records the changed field paths.

- **TC-28: PASS routing writes empty triage/repair bookkeeping**
  - Type: acceptance
  - Input: Review artifact has no blocking, advisory, or repair target findings.
  - Expected: Verdict is PASS; flow enters triage/repair, writes empty bookkeeping artifacts, and proceeds without blocking on draft repair.

- **TC-29: ADVISORY routing proceeds through triage and repair**
  - Type: acceptance
  - Input: Review artifact has advisory findings or repair targets but no blocking findings.
  - Expected: Verdict is ADVISORY; flow routes through triage/repair and can proceed if resolved.

- **TC-30: FAIL routing blocks until blocking findings are triaged**
  - Type: acceptance
  - Input: Review artifact has at least one blocking finding.
  - Expected: Verdict is FAIL; gate remains blocked until triage/repair resolves or user decision path is completed.

- **TC-31: Gate fails when required review artifact is missing**
  - Type: integration
  - Input: Run `gate-draft` without required draft review JSON artifact.
  - Expected: Gate fails with missing artifact error.

- **TC-32: Gate fails on inconsistent phase/source links**
  - Type: integration
  - Input: Review, triage, or repair artifact references the wrong source artifact or phase.
  - Expected: Gate fails.

- **TC-33: Gate fails on item count inconsistency**
  - Type: integration
  - Input: Triage/repair artifacts omit required source items or include extra unrelated items.
  - Expected: Gate fails.

- **TC-34: Gate validates draft approval after coverage repair**
  - Type: integration
  - Input: Coverage repair completed with no unresolved user decisions, but draft approval fields are missing or stale.
  - Expected: Gate fails.

- **TC-35: Active-flow migration inserts missing draft leaves**
  - Type: integration
  - Input: Existing active flow missing the four new draft triage/repair leaves.
  - Expected: Migration inserts `draft-questions-triage`, `draft-questions-repair`, `draft-coverage-triage`, and `draft-coverage-repair`.

- **TC-36: Migration preserves correct consumer mapping**
  - Type: unit
  - Input: Flow graph migrated from old draft review structure.
  - Expected: Consumers are mapped as specified: questions triage to repair, questions repair to refine, coverage triage to repair, coverage repair to gate.

- **TC-37: Migration marks inserted leaf done when consumer is done**
  - Type: integration
  - Input: Consumer step is already `done` before migration.
  - Expected: Inserted leaf is marked `done`; empty JSON artifact is generated if gate validation requires it.

- **TC-38: Migration marks inserted leaf done when consumer is in progress**
  - Type: integration
  - Input: Consumer step is `in_progress` before migration.
  - Expected: Inserted leaf is marked `done`; empty JSON artifact is generated if needed.

- **TC-39: Migration marks inserted leaf pending when consumer is not started**
  - Type: integration
  - Input: Consumer step is pending before migration.
  - Expected: Inserted leaf is marked `pending`.

- **TC-40: Migration updates old review artifact references**
  - Type: integration
  - Input: Active flow references old draft review artifact names.
  - Expected: References are rewritten to the new JSON artifact names.

- **TC-41: Migration removes markdown-only fallback behavior**
  - Type: acceptance
  - Input: Migrated flow has only old markdown review summaries and no JSON artifacts.
  - Expected: Flow does not use markdown for machine decisions; gate requires valid JSON artifacts.

- **TC-42: Spec-local regression suite covers required scenarios**
  - Type: acceptance
  - Input: Run spec-local tests for draft review flow.
  - Expected: Tests cover non-mutation, triage/repair artifact shape, gate validation failures, and PASS/ADVISORY/FAIL routing.
