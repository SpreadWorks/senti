# Feature Specification: 340-preserve-child-diagnostics

**Feature Branch**: `feature/340-preserve-child-diagnostics`
**Created**: 2026-07-25
**Status**: Draft
**Input**: GitHub Issue #463

## Goal
final-regression の nested child command が失敗した理由を、テストを再実行せず raw log と final artifact の保存済み evidence だけから説明可能にする。

## Background
Issue #451 showed that the outer node tests/run.js command could exit with code 1 while its nested unit/e2e evidence was preserved as empty streams. The final artifact then labeled the failure as assertion and unattributed existing even though neither conclusion was supported by durable evidence. The current child result model already distinguishes spawn, signal, timeout, and max-buffer outcomes, but treats every remaining numeric non-zero exit as assertion-failure. The final-regression artifact stores only the outer process fields and text-derived classification. Preserving bounded typed child records through the existing invocation closes this evidence gap without rerunning tests or changing lifecycle policy.

## Scope
- tests/run.js が実行する unit、integration、acceptance、other child command ごとの bounded execution record。
- src/flow/lib/test-regression.js の child process result model、stream capture、failure mode classification、diagnostic serialization。
- src/flow/lib/run-final-regression.js の nested record extraction、raw-log persistence、artifact serialization、failure classification。
- final-regression-result.json と tests/.raw/final-regression-attempt-NNN.log の diagnostic contract。
- spec-local requirement tests と影響を受ける shared unit/e2e regression tests。

## Out of Scope
- Issue #451 で失敗した product code 自体の修正。
- final-regression の execution point、outer invocation count、retry behavior、record-and-proceed failed-state display の変更。
- 失敗を fallback で PASS または skipped に変換する処理。
- assertion の削減または test command の diagnostic enrichment 再実行。
- 外部 dependency と legacy artifact compatibility shim の追加。

## Constraints
- Node.js 組み込みモジュールだけを使用し、外部 dependency を追加しない。
- 意味のある child execution record、stream capture、final artifact fragment は専用 class と constructor invariant で表現する。
- child stdout/stderr の artifact capture は明示的な byte bound を持ち、元 byte length、captured byte length、truncated flag、durable raw-log reference を保存する。
- diagnostic enrichment は既存 child invocation と既存 outer final-regression invocation の中で完結し、process を追加 spawn しない。
- assertion、current-change、existing attribution は concrete preserved evidence が存在する場合だけ設定する。
- attribution を証明できない failure は unknown とし、existing failure の record-and-proceed eligibility を与えない。
- tests/run.js の category order、summary、aggregate exit code と final-regression の pass/fail/skipped、retry、status/report transitions を維持する。
- alpha policy に従い generated artifact は新 contract を直接採用し、旧 format の読み替えや compatibility branch を追加しない。
- stream、record count、artifact evidence collection は bounded-resource-usage guardrail に従い、size/count 上限を code と tests で検証可能にする。

## Design Principles
- Outer process の終了状態と nested child command の終了状態を別の typed evidence として扱う。
- Child runner を execution record の canonical producer、final-regression を durable artifact と classification の canonical consumer にする。
- Human-readable raw log と machine-readable final artifact は同じ child record から生成し、片方だけに診断が存在する状態を避ける。
- 分類不能を assertion または existing と推測するより unknown として fail closed にする。
- 既存の ChildProcessExecutionResult と FinalRegressionArtifact を深い module boundary として拡張し、caller-side plain object assembly を増やさない。

## Overview
### Modules
- src/flow/lib/test-regression.js owns typed child process outcomes, bounded stream captures, invariants, serialization, and parsing helpers.
- tests/run.js owns one execution record per nested category command and emits its bounded machine-readable diagnostic marker without spawning another process.
- src/flow/lib/run-final-regression.js owns extraction of nested markers from the outer result, durable raw-log references, final artifact child records, and evidence-based recovery classification.
- spec-local tests own R1-R8 requirement coverage; affected shared tests preserve the existing test runner and final-regression public contracts.
- src/flow/lib/test-regression.js now owns bounded UTF-8 ProcessStreamCapture values, typed nonzero-exit classification, invariant-checked ChildProcessExecutionRecord values, and a bounded marker codec.
- tests/run.js now emits one machine-readable execution record for every category result while retaining the existing spawn and stream-forwarding owner.
- src/flow/lib/run-final-regression.js now decodes bounded child execution records, attaches the durable attempt-log path, persists them in FinalRegressionArtifact, and owns unattributed_unknown_failure recovery.
- src/flow/lib/test-artifacts.js now validates the new childProcesses artifact contract, stream metadata, unknown failure kind, and unknown category at the system boundary.

### Data Flow
- tests/run.js spawns each category command once and converts the spawnSync result into a typed ChildProcessExecutionResult.
- The result class classifies the concrete process termination, creates bounded stdout/stderr captures with truncation metadata, and serializes one diagnostic marker.
- tests/run.js continues forwarding child stdout/stderr and emits the marker; the outer final-regression process captures that output in its existing single invocation.
- RunFinalRegressionCommand writes the outer output to the attempt log, parses bounded child markers, attaches the attempt-log reference, and persists child records in final-regression-result.json.
- Final-regression classification consumes typed outer and child evidence. Assertion and attribution fields are set only when their supporting evidence is present; otherwise the result is unattributed_unknown_failure with a non-proceed recovery policy.
- Each spawn result becomes a ChildProcessExecutionResult, then a bounded ChildProcessExecutionRecord; tests/run.js forwards raw streams and writes the codec marker during the same category iteration.
- RunFinalRegressionCommand decodes child markers before classification, writes the same marker-bearing outer output to the raw attempt log, and serializes class-backed child records with that rawOutputPath.
- Failure classification checks typed child termination and captured stream evidence before legacy outer-text fallback; unsupported attribution becomes a stop-only unknown result.

### Decisions
- [VERIFY] tests/run.js creates one ChildProcessExecutionResult per category spawn, forwards streams, and emits diagnosticLines only when the child is not passed; result=match.
- [VERIFY] numeric non-zero child exits are currently classified as assertion-failure without inspecting assertion evidence; result=match.
- [VERIFY] final-regression currently persists only the outer process summary and output, and can classify output that does not reference changed files as ExistingRegressionFailure; result=match.
- [VERIFY] existing final-regression already combines bounded failure evidence with a durable rawOutputPath; result=match and reused for nested stream references.
- Represent a numeric non-zero exit without assertion evidence as nonzero-exit rather than assertion-failure.
- Emit records for passed and failed nested commands so execution order, completed categories, and the exact failing category remain reconstructable.
- Use unattributed_unknown_failure with stop recovery and no record-and-proceed eligibility when current/existing attribution lacks preserved evidence.
- Retain all current command, config, hook, artifact, and side-effect owners; extend their behavior rather than introducing a parallel diagnostic execution path.
- Numeric non-zero exits become assertion-failure only when bounded preserved output contains assertion evidence; otherwise they become nonzero-exit.
- The marker codec enforces record-count and line-byte limits and reconstructs class instances rather than exposing plain discriminated objects.
- Concrete changed-file references produce current-change attribution; assertion evidence that names an unchanged source/test path may produce existing attribution; all other typed child failures remain unknown.
- Unknown failures use failureCategory=unknown, failureNature=execution unless child assertion evidence exists, currentDiffRelationship=unknown, and record-and-proceed eligibility=false.

## Clarifications (Q&A)
- Q: Does every numeric non-zero child exit mean an assertion failed?
  - A: No. assertion-failure requires preserved assertion evidence. Other numeric non-zero exits use nonzero-exit.
- Q: Are successful child commands recorded?
  - A: Yes. Every executed category produces one record so execution order and the failure boundary are reconstructable.
- Q: Does bounded artifact capture discard the full child output?
  - A: No. The structured record is bounded and carries truncation metadata; the existing attempt log is the durable source reference for forwarded output.
- Q: Can an unknown failure continue as an existing failure in auto mode?
  - A: No. Unsupported attribution is unattributed_unknown_failure and cannot receive automatic existing-failure record-and-proceed eligibility.
- Q: Does this add another test execution for diagnostics?
  - A: No. Records are produced and consumed inside the existing nested and outer invocations.

## Alternatives Considered
- Rerun only the failed nested command after the outer command exits. — Rejected because it changes invocation count, can produce different evidence, and violates Issue #463.
- Keep parsing only free-form stdout/stderr text in final-regression. — Rejected because empty output cannot identify the child or termination mode and text heuristics caused the incorrect assertion/existing classification.
- Store unbounded stdout/stderr copies in every child artifact record. — Rejected by bounded-resource-usage; the bounded record plus durable attempt-log reference preserves auditability without unbounded artifact growth.
- Treat every unattributed failure as existing and ask only after record-and-proceed selection. — Rejected because existing attribution is not proven and could hide a regression caused by the current change.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-25T05:55:14.583Z
- Notes: Auto-approved after spec review PASS and spec gate PASS; user enabled auto mode at preflight.

## Requirements
- R1 [must]: Every nested test command shall produce one typed execution record containing command argv, started/completed state, exit code, signal, error code, timeout state, spawn error, and bounded stdout/stderr captures.
- R2 [must]: Child outcomes shall distinguish passed, assertion-failure with concrete assertion output, nonzero-exit without assertion evidence, signal, timeout, spawn-error, and max-buffer outcomes through class-enforced invariants.
- R3 [must]: Each captured child stream shall record original byte length, captured byte length, truncation state, bounded content, and a durable final-regression attempt-log reference when content exceeds the configured capture bound.
- R4 [must]: tests/run.js shall emit one machine-readable child execution marker for every executed category while preserving existing stream forwarding, category order, summary, aggregate exit code, and exactly one spawn per category.
- R5 [must]: The final-regression raw log and final-regression-result.json shall identify each nested command and its typed outcome, and the artifact shall expose bounded child records linked to the raw attempt log.
- R6 [must]: Final-regression shall set failureNature assertion and current-versus-existing attribution only when preserved evidence supports them; an unsupported attribution shall become unattributed_unknown_failure with no automatic existing-failure eligibility.
- R7 [must]: The change shall preserve final-regression execution count, pass/fail/skipped envelopes, retry behavior, record-and-proceed failed-state display, status/report transitions, config-derived command/timeout behavior, and issue-log side effects except for evidence-based failure fields.
- R8 [must]: Automated coverage shall prove all child failure modes, bounded truncation and durable references, raw-log/artifact persistence, evidence-based classification, retained-surface behavior parity, and zero additional test-process invocations without requiring legacy artifact compatibility.

## Acceptance Criteria
- [AC1/R1] Passed and failed unit, integration, acceptance, and other category executions each yield one record with command identity, lifecycle fields, termination fields, and two stream captures.
- [AC2/R2] Fixtures independently produce passed, assertion-failure, nonzero-exit, signal, timeout, spawn-error, and max-buffer records; a numeric exit with empty or non-assertion output never yields assertion-failure.
- [AC3/R3] A stream below the capture bound is preserved without truncation; a stream above the bound reports exact original/captured byte counts, truncated=true, bounded content, and the final attempt-log path.
- [AC4/R4] tests/run.js writes each child stream and one parseable record marker, preserves category summary and aggregate exit behavior, and a process spy reports the same spawn count as the number of executed categories.
- [AC5/R5] Given a nested unit or e2e failure, the attempt log and final-regression-result.json both identify the child command, typed failure mode, exit/signal/timeout/spawn details, stream metadata, and raw-log reference.
- [AC6/R6] Assertion output may set failureNature=assertion; no-output non-zero exit does not. A failure with no concrete current/existing evidence is unattributed_unknown_failure, is not marked existing, and is not auto-selected for record-and-proceed.
- [AC7/R7] Current spec-local tests exercise tests/run.js ordering/summary/exit and final-regression pass/fail/skipped/retry/status/report, config command/timeout, issue-log, and record-and-proceed behavior through production code. Only evidence-supported diagnostic fields change.
- [AC8/R8] Integration-gate acceptance uses current spec-local test-execute evidence for every child failure mode, retained surface, and one invocation per scenario. A completed final-regression result and affected shared-suite evidence are not integration-gate prerequisites because that step runs later; downstream final-regression remains mandatory and runs the full project command once without a diagnostic rerun.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Model bounded child execution evidence
  - Extend the existing child process result module and test runner boundary to produce one invariant-checked, bounded execution record for every nested category command without changing invocation behavior.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Classify preserved final-regression evidence
  - Persist parsed nested records in the existing final-regression raw log and artifact, then derive failure nature and attribution only from preserved typed evidence.
  - see `tasks/T-2.md` for full spec
