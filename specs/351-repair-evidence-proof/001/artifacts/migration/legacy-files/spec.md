# Feature Specification: 351-repair-evidence-proof

**Feature Branch**: `feature/351-repair-evidence-proof`
**Created**: 2026-07-26
**Status**: Draft
**Input**: User request

## Goal
Repair proof production and gate verification must use one complete, workflow-owned record so a repaired must-fix finding passes only when its fingerprint, reviewed revision, repair delta, and passing validation result match.

## Background
RepairEvidenceReference already enforces a complete proof contract, but the impl-repair workflow emits only a finding id and repair reference. Gate readiness also omits the proof context required by the policy. Consequently a real repaired must-fix finding cannot satisfy integration verification. Separately, a draft migration-parity finding exhausted its retry budget and was misclassified as missing repair evidence, which prevented the flow from recording the required semantic deferral.

## Scope
- must: Replace the impl-repair repair-evidence entry with a complete proof record that binds each applied finding to its canonical review revision, repair delta, and passing test result.
- must: Supply reviewedTree, reviewedHead, repairDiff, findingFingerprint, and validatingTestResult identity to integration gate disposition checks after test-result-review; task gates retain their pre-validation review lifecycle.
- must: Preserve generic issue-log diagnostics while preventing CLI callers from asserting repair-proof fields.
- must: Classify exhausted draft-gate semantic findings as deferred semantic findings rather than implementation repair-evidence failures.
- must: Add spec-local and shared regression coverage for valid proof acceptance, invalid proof rejection, preserved diagnostics, and draft semantic deferral.

## Out of Scope
- must: Change acceptance-fixture injection behavior.
- must: Weaken must-fix disposition policy or accept incomplete evidence.
- must: Add user-facing issue-log proof flags, configuration keys, hooks, public APIs, or generated artifact paths.
- must: Alter the final-regression command or its timeout policy.

## Constraints
- must: Use Node.js built-ins and the existing repair, review, issue-log, and test-result artifacts; do not add dependencies.
- must: Evidence matching fails closed whenever a required proof field is absent or invalid, more than one proof matches one finding, the proof timestamp precedes that finding's reportedAt, or a proof field differs from the gate's finding fingerprint, reviewedTree, reviewedHead, repairDiff, phase, or taskId context.
- must: Preserve the existing issue-log CLI diagnostic contract for step, reason, trigger, and resolution; no caller-supplied proof-field input is permitted.
- must: Keep repair proof bounded to one record per applied finding and repair entry.

## Design Principles
- A repair proof is an authoritative workflow artifact, not a user-authored diagnostic.
- The producer writes complete evidence once the repair workflow has all required inputs; the gate only verifies that record.
- Draft semantic review findings are planning evidence and never require implementation repair evidence.

## Overview
### Modules
- src/flow/lib/impl-repair-artifacts.js records applied repair findings and owns the replacement complete repair-proof writer.
- src/flow/lib/finding-disposition-policy.js validates a RepairEvidenceReference against the canonical finding fingerprint, review revision, repair delta, and validating test result.
- src/flow/lib/run-gate.js constructs gate readiness context, invokes FindingDispositionPolicy, and classifies retry exhaustion.
- impl-repair-artifacts owns construction of complete validated finding-repair proofs.
- specs/351-repair-evidence-proof/tests/repair-evidence-proof.test.js verifies the repair-proof contract at the public workflow boundaries.

### Data Flow
- Canonical review finding + impl-repair delta + passing test-result evidence -> complete issue-log repair proof -> gate readiness context -> FindingDispositionPolicy verification -> pass or blocked disposition.
- Draft gate semantic failure at retry exhaustion -> typed semantic-finding deferral -> flow-findings.json -> later acceptance disposition; no repair-proof lookup.
- A late applied repair derives proof bindings from canonical review, repair delta, and passing test artifacts before appending issue-log evidence.
- Draft-gate retry exhaustion validates typed findings before creating a semantic deferral, so repair-proof validation is never invoked for draft planning evidence.
- Complete and malformed repair proof fixtures plus draft semantic and non-semantic classifications -> focused Node assertions -> test-execute evidence.

### Decisions
- [VERIFY] The existing impl-repair writer records normalizedFindingId and repairRef only, while RepairEvidenceReference requires fingerprint, reviewed tree/head, repair diff, and passing test result. The replacement record must be complete before policy verification.
- [VERIFY] Gate readiness currently supplies findings and issue-log entries but not reviewedTree, reviewedHead, or repairDiff to FindingDispositionPolicy. The gate context must own this binding.
- [CORRECTION] Draft semantic retry exhaustion is a planning deferral, not an implementation proof failure. Validate typed draft findings, then defer them without evaluating repair evidence.
- Migration parity: SetIssueLogCommand remains the owner of generic diagnostic records; its CLI fields, issue-log.json location, and diagnostic side effect remain. recordAppliedFindingRepairEvidence's partial repair-evidence entry is replaced by the workflow-owned complete proof writer, and FindingDispositionPolicy remains the verifier.
- Initial repair transactions emit no consumable proof; only post-validation recovery writes strict repair evidence.
- [CONFIRMED] Draft semantic retry exhaustion is deferred only after structural validation; malformed artifacts, tooling or command failures, coverage failures, no-progress, and empty findings remain blocking.
- [CONFIRMED] R6 uses Node built-in tests: spec-local contract coverage is paired with focused policy and retry-exhaustion unit tests.

## Clarifications (Q&A)
- Q: Which behavior is intentionally removed by replacing the partial repair-evidence entry?
  - A: The partial normalizedFindingId plus repairRef entry no longer represents repair proof. Its issue-log location and repairRef remain as components of the complete workflow-produced proof; no user-visible command behavior is removed.
- Q: Does draft gate deferral allow planning evidence with an invalid source-artifact schema to proceed?
  - A: No. Only validated typed semantic findings defer. Invalid source-artifact schema, tooling or command failure, failed coverage validation, no-progress, and an empty finding set remain blocking.

## Alternatives Considered
- Accept caller-supplied proof fields through senti flow set issue-log — Rejected: a CLI caller could assert review, diff, or test evidence without the workflow artifacts that establish it.
- Relax RepairEvidenceReference to accept normalizedFindingId and repairRef — Rejected: it would let a proof recorded before the finding reportedAt or a proof for a different finding satisfy a must-fix disposition and contradict the existing fail-closed proof contract.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-26T02:37:29.934Z
- Notes: autoApprove: reapproved after the repaired #351 draft/spec gate passed

## Requirements
- R1 [must]: must: For each applied impl-repair finding, the workflow writes exactly one issue-log repair proof that contains normalizedFindingId, findingFingerprint, reviewedTree, reviewedHead, repairDiff, validatingTestResult with status pass, and repairRef; every value must originate from the current canonical review, repair delta, and validation artifacts.
- R2 [must]: must: Integration gate readiness after test-result-review passes reviewedTree, reviewedHead, and repairDiff with every authoritative must-fix finding from the flow-scoped canonical review artifact and its retained flow-scoped review history into FindingDispositionPolicy.evaluateGate, so exactly one complete proof whose phase is integration and taskId is null satisfies each finding; task gates do not require post-validation proof before validation exists.
- R3 [must]: must: Gate readiness blocks a must-fix finding when no matching proof exists, more than one proof matches it, the proof timestamp is earlier than the finding reportedAt, any required proof field fails RepairEvidenceReference validation, validatingTestResult.status is not pass, or normalizedFindingId, findingFingerprint, reviewedTree, reviewedHead, repairDiff, phase, or taskId differs from the gate context.
- R4 [must]: must: SetIssueLogCommand continues to persist caller-provided step, reason, trigger, and resolution fields without accepting findingFingerprint, reviewedTree, reviewedHead, repairDiff, or validatingTestResult input; an entry containing only those diagnostic fields plus normalizedFindingId and repairRef does not satisfy gate readiness.
- R5 [must]: must: At draft-gate semantic retry exhaustion, validated typed findings are written as deferred semantic findings and do not invoke implementation repair-evidence validation; invalid source-artifact schema, agent/tooling or command failure, failed coverage validation, no-progress, and an empty finding set remain blocking.
- R6 [must]: must: Automated coverage verifies R1 through R5, including a complete proof pass, each invalid proof class block, retained generic diagnostics, and draft semantic deferral without repair evidence.

## Acceptance Criteria
- A complete workflow-produced proof with the same normalized finding id, finding fingerprint, reviewed tree/head, repair digest, integration phase, null taskId, and passing validation result as the integration gate context allows the integration gate to proceed after test-result-review, while task gates remain pre-validation review checks.
- Gate readiness rejects a missing proof, more than one matching proof, a proof recorded before the finding reportedAt, a proof rejected by RepairEvidenceReference, a proof with validatingTestResult.status other than pass, or a proof whose identity or scope fields differ from the gate context.
- A generic issue-log diagnostic retains its fields and cannot satisfy repair proof matching.
- A typed draft migration-parity finding at retry exhaustion writes deferred flow findings instead of missing_repair_evidence.
- Focused shared tests and spec-local tests for R1 through R6 pass.

## Implementation Targets
- src/flow/lib/impl-repair-artifacts.js
- src/flow/lib/finding-disposition-policy.js
- src/flow/lib/run-gate.js
- tests/unit/flow/finding-disposition-policy.test.js
- tests/unit/flow/retry-exhaustion-defer.test.js
- specs/351-repair-evidence-proof/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Write complete repair proof
  - Replace the partial impl-repair evidence entry with one complete workflow-owned proof for each applied finding.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Verify repair proof in gate readiness
  - Bind current review and repair context into integration gate policy evaluation after validation artifacts exist.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Defer exhausted draft semantic findings
  - Preserve draft-gate semantic exhaustion as a deferred planning finding instead of an implementation repair-proof blocker.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Add repair proof regression coverage
  - Provide spec-local evidence that the complete proof contract protects the repaired-finding gate path.
  - see `tasks/T-4.md` for full spec
