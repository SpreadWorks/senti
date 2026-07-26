# Feature Specification: 348-report-delivery-fail-closed

**Feature Branch**: `feature/348-report-delivery-fail-closed`
**Created**: 2026-07-26
**Status**: Draft
**Input**: GitHub Issue #470

## Goal
Make `senti flow run report` fail closed for required inputs and linked-Issue delivery, while making each report and its final evidence verifiably bound to the Git target and source artifacts used to produce it.

## Background
Report generation currently trusts a failure-prone boundary in two ways: it turns an unreadable or corrupt issue log into an empty log, and it treats an unavailable GitHub CLI as a skipped but successful delivery. It also records no cryptographic relationship between a generated report and the Git state or artifact bytes from which it was assembled. The change replaces these success paths with explicit failure and delivery state, preserves the durable report/retry path, and makes stale evidence detectable.

## Scope
- Strict loading and validation of report source artifacts, including issue-log.json.
- Explicit delivery state for linked GitHub Issues and idempotent delivery-only retry with one delivery attempt per command invocation.
- Report binding metadata for Git HEAD, Git tree, and consumed artifact SHA-256 hashes, plus freshness validation.
- Spec-local and shared regression coverage for input failure, delivery failure/retry, and binding freshness.

## Out of Scope
- Changing report narrative quality or summary selection addressed by Issue #343.
- Adding delivery targets other than the linked GitHub Issue.
- Changing unrelated flow artifact formats or accepting legacy skipped-success delivery semantics.

## Constraints
- Use Node.js built-in modules and existing atomic artifact, FlowOutbox, git helper, and artifact-validation patterns; add no dependency.
- Treat `src/flow/lib/run-report.js` as the primary integration owner, extending adjacent report/artifact validation modules only where required for a coherent binding contract.
- Do not retain a compatibility path that treats skipped delivery as successful completion; alpha policy permits removal of that behavior.
- bounded-resource-usage: report delivery has no internal retry loop. Each `senti flow run report` invocation makes at most one Issue comment attempt; a later flow command invocation is the only way to resume a failed delivery with the same idempotency key.
- no-overengineering: the user explicitly authorized a bounded audited recovery command solely because an acceptance-review rewind encountered already-implemented source changes and cannot satisfy the pre-implementation scenario-validity contract. The command is limited to the existing `scenario-validity` → `skipped`, `test-execute` → `in_progress` lifecycle transition and reuses the established explicit-recovery transition plus test-evidence refresh/repair-ledger primitives; it adds no report behavior, persistence format, retry loop, or alternate validation path. It skips only that impossible precondition, records a repair-fingerprint transition, and resumes mandatory post-implementation verification.
- Keep report text sections `Report`, `Implementation`, `Retro`, `Metrics`, `Tests`, `Tasks`, and `Issue Log Summary` plus existing data keys implementation, retro, upgrade, issueLog, metrics, tokenMetrics, tests, sync, tasks, taskTotal, and broadModeHistory; add delivery and binding fields without changing no-linked-Issue success.
- Add spec-local coverage under `specs/348-report-delivery-fail-closed/tests/` with `// spec: R<N>` headers, and update shared tests where the production contract changes.

## Design Principles
- A required input or required side effect is either verified or blocks completion; it is never silently replaced by an empty or skipped-success value.
- Separate durable report generation from delivery completion so an unsent artifact is inspectable but cannot be mistaken for a delivered report.
- Bind evidence to exact content and Git authority, then validate the same fields before accepting it as fresh.
- Preserve idempotent delivery ownership in FlowOutbox rather than creating a second publication mechanism.

## Overview
### Modules
- `RunReportCommand` loads and validates report inputs, produces the report artifact and binding metadata, records delivery state, and invokes the existing idempotent issue-comment path when delivery is required.
- Report artifact validation owns the binding shape and freshness comparison for the generated report, Git target, and the exact source artifacts consumed during report generation.
- FlowOutbox remains the retry authority: each resumed report command makes at most one delivery attempt, reuses its idempotency key, and completes only the still-missing Issue delivery.
- RunReportCommand in src/flow/lib/run-report.js
- RunReportCommand delivery state and retry
- ReportBinding validates report Git/source authority and exposes stable invalid or stale failure codes.

### Data Flow
- The report command resolves the target HEAD and tree, strictly reads each required and present optional source artifact, hashes the bytes it consumed, and writes `report.json` with `data.binding` before attempting linked-Issue delivery.
- A successful linked-Issue comment records delivered state. gh unavailability or comment failure records `unsent` or `pending`, returns an error that prevents step completion, and leaves a durable artifact for the same outbox operation to resume.
- Freshness validation compares the recorded headOid, treeSha, and each recorded source-artifact SHA-256 with current values; mismatch rejects the report/evidence instead of treating it as current.
- IssueLogStore read failure -> RunReportCommand failure
- Report generation -> pending delivery artifact -> outbox retry -> Issue comment
- RunReportCommand hashes each present report input and stores the current HEAD/tree with those hashes in data.binding; delivery-only retry validates this binding before posting.

### Decisions
- [VERIFY] `RunReportCommand` currently catches `loadIssueLog()` errors and substitutes an empty log, so invalid issue-log input can produce a successful report. The new contract propagates that failure.
- [VERIFY] linked-Issue delivery currently becomes `skipped` when gh is unavailable, while comment failures throw. The replacement is explicit unsent/pending delivery state plus a non-success report step.
- [VERIFY] the existing outbox idempotency key is passed to Issue comment publication and supports report replay without a second durable report artifact; retain that ownership for delivery-only retry with one comment attempt per command invocation.
- Migration parity inventory: public CLI `senti flow run report` remains RunReportCommand; no public API, hook, or config entry changes. Generated report.json remains the report command artifact and retains report text/data under `data`, adding `data.delivery` and `data.binding`. The GitHub-comment side effect remains commentOnIssueOnce and is successful only when delivered.
- Migration parity ownership: the outbox side effect remains FlowOutbox with one attempt per command. The removed behavior is only `issueComment.status=skipped` success for gh unavailable; its explicit replacement is `data.delivery.status=unsent|pending` plus a blocked report step.
- Report source loading propagates IssueLogStore failures instead of substituting empty entries.
- Linked Issue delivery failures persist pending state and block report completion.
- Binding freshness compares Git object IDs and source bytes, rather than timestamps, so report reuse is permitted only for the exact generated authority.

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- Treat a corrupt issue log as an empty log. — Rejected because an empty substitute disguises an untrusted required input and lets report completion assert evidence it could not read.
- Keep gh unavailable as a skipped successful delivery. — Rejected because the user-visible report completion would falsely imply a required delivery occurred.
- Discard the generated report whenever delivery fails. — Rejected because an explicit unsent/pending artifact is needed to expose the failed state and let the existing idempotent outbox resume only delivery.
- Use timestamps alone for report freshness. — Rejected because timestamps cannot prove exact Git authority or the content bytes consumed by report generation.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-26T00:27:49.198Z
- Notes: User formally reapproved the unchanged gate-passed R1–R7 specification after evidence rewind.

## Requirements
- R1 [must]: `RunReportCommand` shall propagate an unreadable, malformed, or structurally invalid required report source artifact, including issue-log.json, as a report failure; it shall not substitute an empty artifact or continue to report generation.
- R2 [must]: For a flow without a linked Issue, report generation shall retain the existing successful artifact behavior. For a linked Issue, `gh` unavailability, a failed comment operation, or any other required delivery failure shall return non-success and prevent the report step from reaching done.
- R3 [must]: When linked-Issue delivery cannot complete after report generation, report.json shall record delivery as `unsent` or `pending`, never as `done` or `skipped` success. The persisted state shall distinguish the generated report from successful delivery.
- R4 [must]: Each resumed report command invocation with the same FlowOutbox idempotency key shall make at most one attempt to perform only the missing Issue delivery, shall not publish a duplicate Issue comment, and shall retain the already generated report artifact when its binding is still fresh.
- R5 [must]: report.json `data.binding` shall contain `headOid`, `treeSha`, and `sourceArtifacts`. Every sourceArtifacts entry shall contain the project-relative `path` and SHA-256 `sha256` of bytes actually consumed by report generation. The list shall include issue-log.json and each present artifact among retro.json, test-execute-result.json, test-result-review.json, final-regression-result.json, and upgrade-result.json; absent optional artifacts shall not be listed.
- R6 [must]: Report/final-evidence freshness validation shall reject a missing or malformed binding with `REPORT_BINDING_INVALID`, and shall reject a changed current HEAD OID, tree SHA, or recorded source-artifact SHA-256 with `REPORT_BINDING_STALE`.
- R7 [must]: The implementation shall preserve report text sections `Report`, `Implementation`, `Retro`, `Metrics`, `Tests`, `Tasks`, and `Issue Log Summary`, and preserve the existing data keys implementation, retro, upgrade, issueLog, metrics, tokenMetrics, tests, sync, tasks, taskTotal, and broadModeHistory. It shall add delivery and binding data and preserve successful linked-Issue comment behavior when delivery completes.

## Acceptance Criteria
- AC1: A corrupt JSON issue-log, an issue-log with an invalid entries shape, and an unreadable required source artifact each cause the report command to fail without writing a success result or treating the input as empty.
- AC2: A flow with no linked Issue still writes its report successfully; with a linked Issue, gh unavailable and comment failure return non-success and cannot mark report done.
- AC3: A delivery failure after report generation leaves report.json with a visible unsent or pending delivery state that is distinct from delivered state and from the removed skipped-success state.
- AC4: Each retry command invocation for the same outbox report makes at most one comment attempt and, after a recoverable delivery failure, posts exactly one missing Issue comment with the original idempotency key. When the persisted binding equals current values, the retry shall retain report text and binding while updating only delivery state to done.
- AC5: A successful report records binding.headOid, binding.treeSha, and path/SHA-256 records for every consumed source artifact; optional nonexistent artifacts are absent from the binding list.
- AC6: Freshness checks accept an unchanged report binding and reject independently changed source artifact bytes, tree, or HEAD with REPORT_BINDING_STALE; missing or malformed binding returns REPORT_BINDING_INVALID.
- AC7: Regression tests show report text retains `Report`, `Implementation`, `Retro`, `Metrics`, and `Tests` sections; report data retains implementation, retro, issueLog, metrics, tokenMetrics, tests, sync, tasks, taskTotal, and broadModeHistory keys; successful linked-Issue comment behavior still passes with additive delivery/binding fields.
- AC8: Spec-local tests carry `// spec: R1` through `// spec: R7` headers, targeted shared tests pass, and the final regression passes.

## Implementation Targets
- src/flow/lib/run-report.js
- src/flow/commands/report.js
- src/flow/lib/set-issue-log.js
- src/flow/lib/issue-log-store.js
- src/lib/git-helpers.js
- tests/unit/flow/finalization-command-resume.test.js
- specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Reject invalid report inputs
  - Make report input loading fail closed so required unreadable or invalid artifacts cannot become successful empty data.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Make report delivery explicit
  - Represent linked-Issue delivery as delivered or unsent/pending, and block report completion until required delivery succeeds.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Bind report freshness
  - Persist and validate the exact Git and source-artifact authority for a generated report.
  - see `tasks/T-3.md` for full spec
