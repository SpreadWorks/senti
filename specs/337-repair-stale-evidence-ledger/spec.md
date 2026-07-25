# Feature Specification: 337-repair-stale-evidence-ledger

**Feature Branch**: `feature/337-repair-stale-evidence-ledger`
**Created**: 2026-07-25
**Status**: Draft
**Input**: GitHub Issue #458

## Goal
material な実装修正後の stale test evidence recovery を既存の formal repair transaction authority に統合し、repair fingerprint manifest、impl-repair ledger、repair delta、artifact invalidation、flow lifecycle が同じ current fingerprint を指す状態でのみ recovery 成功を返す。

## Background
Current source already extends an existing impl-repair ledger in one shared refresh helper, which addresses the visible ledger-tail mismatch in the normal success path. The remaining contract is broader: the shared gate, final-regression, and acceptance-review refresh path writes its transaction journal and directly commits repair files plus lifecycle mutation, while the explicit rewind path separately owns a guarded transition intent followed by verified effects commit. Issue #458 requires every stale evidence entrypoint to preserve the same formal invariant across normal completion, pending recovery, failure, and crash boundaries. The fix therefore consolidates mutation ownership at the existing impl-repair transaction boundary without weakening downstream validation or changing each command's public recovered result.

## Scope
- StaleTestEvidenceRefresh と completeTestEvidenceRefresh が所有する repair transaction の整合性。
- repair fingerprint manifest、impl-repair ledger tail、repair delta、stale artifact invalidation、test-execute への lifecycle transition。
- final-regression、acceptance-review、flow-level integration gate の stale evidence recovery entrypoint。
- 既存 impl-repair ledger がある場合の ledger continuity と pending transaction recovery。
- transaction failure、crash injection、malformed evidence、current evidence、target guard mismatch の regression coverage。
- spec-local tests と影響を受ける shared unit / CLI lifecycle tests。

## Out of Scope
- repair hash、manifest、ledger、delta の手編集による復旧。
- stale artifact の手動削除を利用手順とする変更。
- TestEvidenceRefreshPurpose と既存 impl-repair transaction authority 以外の mutation owner 追加。
- acceptance-review または他 consumer の repair fingerprint validation 緩和。
- stale evidence ではない semantic failure の recovery policy 変更。
- 外部 dependency の追加。

## Constraints
- Node.js 組み込みモジュールだけを使用し、外部 dependency を追加しない。
- TestEvidenceRefreshPurpose、ImplRepairTransaction、ImplRepairTransitionIntent、commitImplRepairEffects を含む既存 impl-repair authority を再利用する。
- repair manifest、ledger、delta、artifact invalidation、lifecycle transition の一部だけを current evidence として公開しない。
- transaction failure または crash injection 時は recovered=true を返さず、再開可能な owned transaction または fail-closed error を残す。
- 既存 ledger がある場合、新しい ledger entry の previousHash は直前 entry の currentHash、currentHash は current repair fingerprint と一致させる。
- pending transaction の identity、purpose、previous/current fingerprints、target run/spec/Issue authority が一致しない場合は mutation を行わない。
- valid かつ current fingerprint と一致する evidence は recovery 対象にせず、malformed、inconsistent、または target mismatch evidence は fail closed にする。
- integration gate、final-regression、acceptance-review が現在返す recovered result、invalidated artifact list、activeStep=test-execute の behavior parity を維持する。
- 意味のある authority、transaction、result、failure boundary は専用クラスで invariant と振る舞いを表現する。

## Design Principles
- stale evidence detection と mutation ownership を分離し、検出 entrypoint は canonical repair transaction authority へ委譲する。
- flow lifecycle transition と filesystem effects を同じ owned transaction identity で結び、どちらか片方だけを完了扱いにしない。
- ledger continuity は consumer 側の例外処理ではなく producer transaction の invariant として保証する。
- pending transaction は新しい recovery と競合させず、同一 transaction の roll-forward または明示的な fail-closed result に限定する。
- 既存の正しい fingerprint mismatch rejection を維持し、repair chain の生成側だけを修正する。

## Overview
### Modules
- src/flow/lib/stale-test-evidence-refresh.js validates stale fingerprint pairs and exposes the shared recovery result used by gate, final regression, and acceptance review.
- src/flow/lib/impl-repair-artifacts.js owns repair manifests, ledger entries, deltas, invalidations, transaction journals, lifecycle transition intent, effects commit, and pending transaction recovery.
- src/flow/lib/run-gate.js detects stale integration evidence and must delegate recovery without weakening structural artifact validation.
- src/flow/lib/run-final-regression.js detects a stale test-execute artifact and must return to test-execute through the same formal transaction.
- src/flow/lib/acceptance-review-artifacts.js recognizes stale downstream evidence, including a stale impl-repair ledger endpoint, and must use the same formal transaction before persisting acceptance output.
- src/flow/lib/run-rewind-test-evidence.js provides the existing guarded transition/effects authority pattern and remains the explicit recovery command for its current blocker contract.
- spec-local and shared flow tests verify ledger continuity, behavior parity, exact target authority, durable failure boundaries, and the normal regenerated lifecycle.
- src/flow/lib/impl-repair-artifacts.js now models exact run/spec/Issue target identity on every impl-repair transaction and owns guarded stale-evidence transition plus idempotent effects recovery.
- src/flow/lib/stale-test-evidence-refresh.js forwards durable-boundary fault injection into the shared transaction owner, while src/flow/lib/run-rewind-test-evidence.js emits the same target-bound transaction format.
- specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js proves stale recovery ownership, exact target rejection, durable retry convergence, projection parity, and explicit rewind behavior across R1-R9.
- Affected shared recovery suites cover typed intent completion, legacy impl-repair recovery fixtures, exact rewind guards, final-regression behavior, and the real CLI acceptance lifecycle.
- CommittedImplRepairEffects classifies a journal with no pending state intent as either fully committed, untouched, or fail-closed partial state before recovery continues.

### Data Flow
- An entrypoint validates its evidence authority and detects one previous fingerprint that differs from the current material repair fingerprint.
- The shared recovery owner resolves the active flow identity, current manifest, existing ledger tail, changed paths, repair delta, invalidation set, and lifecycle reset as one ImplRepairTransaction with TestEvidenceRefreshPurpose.
- The owned lifecycle transition records the exact transaction intent before repair effects can become current.
- The effects commit verifies the unchanged target and material state, writes the delta, ledger, and manifest, invalidates stale artifacts, and clears the pending intent only after the transaction is complete.
- A successful commit exposes recovered=true, previous/current fingerprints, invalidated artifact paths, and activeStep=test-execute; all entrypoints preserve their existing surrounding result shape.
- A pending journal with matching authority rolls forward idempotently; malformed, foreign, changed-authority, or partially inconsistent state returns fail closed without reporting recovery success.
- Regenerated test-execute, test-result-review, impl-review, impl-gate, retro, and acceptance-review evidence is stamped against the ledger endpoint and current manifest produced by the committed transaction.
- A stale entrypoint creates or resumes one target-bound TestEvidenceRefreshPurpose journal, commits one ImplRepairTransitionIntent through updateStepStatus, then applies delta, ledger, manifest, evidence recording, and invalidations from the identical journal.
- A durable retry compares the journal, persisted transition intent, source owner, target identity, and current material fingerprint before rolling the same effects forward; mismatches fail before further lifecycle mutation.
- The regression matrix injects each durable effects failure, verifies the journal and owned intent remain pending without success, retries the same transaction, and verifies both durable markers are cleared after one converged ledger append.
- The CLI lifecycle records current test evidence, introduces a material source change, recovers at integration gate, and regenerates test-execute through acceptance-review and final regression.
- If intent completion succeeds before journal deletion, retry verifies exact delta, ledger, manifest, lifecycle, acceptance cleanup, and invalidations, then removes the leftover journal without replaying lifecycle or effects.

### Decisions
- [VERIFY] StaleTestEvidenceRefresh delegates to completeTestEvidenceRefresh and exposes one shared recovery result; result=match.
- [VERIFY] completeTestEvidenceRefresh can append a TestEvidenceRefreshPurpose entry after an existing ledger tail; result=match.
- [VERIFY] the direct shared refresh path commits artifacts and lifecycle inside commitRepairTransaction but does not use the guarded transition intent/effects boundary used by explicit rewind; result=match.
- [VERIFY] integration gate, final regression, and acceptance review all reach StaleTestEvidenceRefresh but supply different surrounding context and result projections; result=match.
- [VERIFY] acceptance review treats an invalid impl-repair ledger as recoverable only when stale fingerprinted artifacts establish a refresh requirement; result=match.
- Use the existing impl-repair transition intent and effects authority as the canonical ownership boundary instead of adding entrypoint-specific repair mutations.
- Preserve each command's public recovery envelope while centralizing the state mutation contract below those projections.
- Treat transaction completion, not individual file contents, as the condition for current evidence visibility.
- Store run/spec/Issue authority inside version 2 ImplRepairTransaction so both generic stale recovery and explicit rewind validate the same durable identity without compatibility branches.
- Complete the persisted transition intent through the same typed authority after effects commit, while retaining the journal until completion so a crash at any effects boundary resumes the identical transaction without a second lifecycle mutation owner.
- Model typed transition completion in shared test doubles rather than bypassing the production completion contract, and keep mutate-call assertions focused on preventing entrypoint-specific lifecycle owners.
- Include every directly affected impl-repair and stale-evidence shared suite in R9 so the transaction version and completion API are exercised alongside public entrypoints.
- Treat intent-complete/journal-present as an explicit durable recovery boundary and inject it in the R5 matrix; do not infer completion from a single artifact marker.

## Clarifications (Q&A)
- Q: 既存の ledger append success path を残したまま consumer validation を緩和できるか。
  - A: できない。consumer の mismatch rejection は正しいため、producer transaction の completion と visibility を修正する。
- Q: entrypoint ごとに recovery transaction を実装するか。
  - A: しない。検出と command-specific result projection だけを entrypoint に残し、mutation は既存 impl-repair authority に集約する。
- Q: crash 後の pending transaction を無条件に破棄するか。
  - A: しない。同じ target と material authority を検証できる場合だけ同一 transaction を roll forward し、検証できなければ fail closed にする。
- Q: acceptance-review が stale impl-repair ledger blocker を検出した場合に hash を補正するか。
  - A: しない。stale fingerprinted evidence が formal recovery authority を成立させる場合だけ canonical transaction を実行し、ledger を新しい entry で前進させる。
- Q: integration gate、final-regression、acceptance-review の user-visible recovery result を変更するか。
  - A: 変更しない。内部 mutation ownership を統合し、各 command の result projection と next step を維持する。

## Alternatives Considered
- acceptance-review の impl-repair fingerprint validation を緩和する。 — Rejected because it would accept a broken audit chain and hide the stale producer state instead of repairing it.
- stale artifact を削除して test-execute だけを再開する。 — Rejected because manifest, ledger, and delta would remain on a different material state and downstream validation would block again.
- entrypoint ごとに ledger append と lifecycle reset を実装する。 — Rejected because it creates multiple mutation owners and permits transaction invariants to diverge across gate, final regression, and acceptance review.
- pending transaction を失敗時に常に rollback する。 — Rejected because durable filesystem and lifecycle writes may already have crossed a recoverable boundary; verified idempotent roll-forward preserves the existing transaction journal authority.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-25T03:54:13.860Z
- Notes: Auto-approved after spec review PASS and spec gate PASS; user explicitly enabled auto mode at preflight.

## Requirements
- R1 [must]: A stale test evidence recovery after a material implementation change shall create or resume one TestEvidenceRefreshPurpose transaction whose manifest hash, ledger tail currentHash, delta currentHash, and reported currentFingerprint equal the current repair fingerprint.
- R2 [must]: When an impl-repair ledger already exists, the refresh entry shall append exactly once with previousHash equal to the prior ledger tail currentHash, a non-empty changed-path delta, and invalidation records equal to the transaction's staged artifact set.
- R3 [must]: Integration gate, final-regression, and acceptance-review stale evidence entrypoints shall delegate lifecycle transition and repair effects to the same existing impl-repair transaction authority without adding another mutation owner.
- R4 [must]: Recovery shall report success only after the owned transaction has committed its delta, ledger, manifest, artifact invalidation, and test-execute lifecycle transition, and no consumer shall accept a pending or partially applied transaction as current evidence.
- R5 [must]: A retry after each injected durable failure boundary shall either roll the identical owned transaction forward exactly once or fail closed; it shall not duplicate ledger entries, lose stale artifacts without a committed transition, or return a partial recovered result.
- R6 [must]: Valid evidence already matching the current fingerprint shall retain its normal path, while malformed evidence, inconsistent fingerprints, foreign pending transactions, changed material authority, and run/spec/Issue target mismatches shall fail closed without recovery mutation.
- R7 [must]: After committed recovery, the normal flow shall regenerate current evidence through test-execute, test-result-review, impl-review, impl-gate, retro, and acceptance-review without impl-repair ledger schema rejection.
- R8 [must]: The public recovery behavior of integration gate, final-regression, acceptance-review, and explicit rewind-test-evidence shall retain its existing result fields, next step, exact target guards, and fail-closed structural validation.
- R9 [must]: Spec-local requirement tests and affected shared unit and CLI lifecycle tests shall cover existing-ledger continuity, all stale recovery entrypoints, durable failure boundaries, current evidence, malformed evidence, and target authority mismatches.

## Acceptance Criteria
- [AC1/R1] A recovery fixture with a material source change produces one committed transaction whose manifest, ledger tail, delta, result currentFingerprint, and regenerated evidence fingerprint all match.
- [AC2/R2] Given an existing repair entry A→B, stale recovery after a second material change appends exactly one entry B→C with a non-empty delta and matching invalidation records; retrying the completed recovery does not append another entry.
- [AC3/R3] Integration gate, final-regression, and acceptance-review tests reach the same TestEvidenceRefreshPurpose transaction/effects authority, and the diff contains no new entrypoint-owned filesystem or lifecycle mutation path.
- [AC4/R4] Before transaction completion, acceptance and gate consumers reject the pending or inconsistent evidence set; after completion, recovered=true is returned with previous/current fingerprints, invalidated paths, and activeStep=test-execute.
- [AC5/R5] Fault injection after transition intent, delta write, ledger write, manifest write, invalidation staging, and lifecycle update never returns success on the failed attempt; a permitted retry converges once without duplicate ledger entries or unowned artifact loss.
- [AC6/R6] Current valid evidence follows the existing command path, while malformed JSON/schema, inconsistent fingerprints, foreign journals, changed material state, and incorrect run/spec/Issue guards leave artifacts, ledger, manifest, and lifecycle unchanged.
- [AC7/R7] A CLI lifecycle regression with an existing impl-repair ledger completes recovery and then reaches acceptance-review through test-execute, test-result-review, impl-review, impl-gate, and retro without an invalid_schema blocker for impl-repair.json.
- [AC8/R8] Command-level assertions preserve gate/final-regression result=recovered projections, acceptance evidenceRefresh projection, next=test-execute, explicit rewind guards, and structural fail-closed behavior.
- [AC9/R9] Spec-local tests with `// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9` coverage and affected shared flow tests pass during test-execute; full project regression remains owned by final-regression.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Unify stale recovery ownership
  - Route every stale test evidence entrypoint through the existing guarded impl-repair transaction authority so ledger, manifest, delta, invalidation, and lifecycle state become current as one owned recovery.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Verify recovery lifecycle invariants
  - Prove the shared transaction contract through each stale recovery entrypoint and through the regenerated flow path ending at acceptance-review.
  - see `tasks/T-2.md` for full spec
