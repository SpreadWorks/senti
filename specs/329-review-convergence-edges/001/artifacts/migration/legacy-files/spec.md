# Feature Specification: 329-review-convergence-edges

**Feature Branch**: `feature/329-review-convergence-edges`
**Created**: 2026-07-24
**Status**: Draft
**Input**: GitHub Issue #453

## Goal
同一targetのfinding identity、tree SHA変更時のtooling recovery、flow/task scopeを修正し、検証済みcanonical review evidenceとflow-level acceptance handoffを各identityにつき1回だけ保存する。

## Background
Issue #452でreview dispositionとtooling failureは分離されたが、test-review fingerprintがsame-targetの別findingを衝突させること、changed-tree recoveryがtooling stateをgrantと同じCAS mutationで戻さないこと、flow-level post-hookが残留currentTaskIdへfallbackすることが残っている。この3境界により、providerが返したreview結果をcanonical evidenceへ保存する処理、exhaustion後の再検証、acceptanceへのhandoffが停止しうる。

## Scope
- src/flow/commands/review.jsのtest-review finding identity入力
- src/flow/lib/review-convergence.jsのtyped attempt state、canonical evidence重複拒否、handoff生成
- src/flow/lib/set-retry.jsのchanged-tree recovery入口とCAS mutation
- src/flow/lib/run-review.jsのactive review phaseに基づくflow/task scope
- src/flow/lib/run-gate.jsのgate lifecycle artifact除外による自己参照防止
- src/flow/lib/run-final-regression.jsのstale test evidence検出と既存repair transactionによる証跡監査鎖更新・test-execute復帰
- same-target identity、same-tree/changed-tree recovery、flow/task completionのspec-localおよび共有regression tests

## Out of Scope
- review semantic maxAttempts（draft-questions=1、draft-coverage=1、spec=4、test=5、impl=4、task=4）またはtoolingMaxAttempts=1の変更
- src/lib/agent.js、src/lib/process.js、provider profile、OS・sandbox permission処理の変更
- finding内容からPASS・ADVISORY・REJECTEDおよびblocking・advisory bucketを決める判定の変更
- acceptance reviewの判定・schema・prompt変更（stale repair ledger blockerを既存refreshへ接続する機械的復旧判定を除く）
- 証拠commit daa1900a、6923e01a、53a38a1cまたはbranch fix/test-review-finding-identityのmerge

## Constraints
- Node.js組み込みmoduleのみを使用し、外部依存を追加しない。
- 意味のあるidentity、attempt state、recovery mutationは既存classのinvariantと振る舞いに所属させ、object literalのdiscriminated unionを追加しない。
- 同一phase・taskId・tree SHA・evidence digestの2回目のexecutionとcanonical evidence insertを拒否する。
- expected revision不一致時はreview convergence record、retry metric、recovery grantを変更しない。
- Issue #453のAcceptance Criteriaを表すassertionを削除せず、実行対象から除外せず、保留状態へ変更せず、真偽反転または入力case削減を行わない。
- 既存機能への影響はtest-review finding identity、changed-tree recovery、flow/task completion scopeの3境界、gate自身のlifecycle artifactだけをguardrail入力から除外する自己参照防止、final-regressionが修正後のstale test evidenceを検出した場合に既存repair transactionでdelta・ledger・manifestを更新してtest-executeへ戻す復旧に限定し、既存のreview判定bucket、semantic/tooling上限、same-tree/evidence重複拒否、acceptance reviewの判定動作は変更しない。
- src/flow/lib/acceptance-review-artifacts.jsの変更はstale fingerprint artifactと同時に検出されたimpl-repair ledger終端不一致を既存refreshへ接続する機械的判定だけに限定し、src/flow/lib/run-acceptance-review.js、src/flow/lib/set-acceptance-decision.js、acceptance schema、acceptance prompt、判定bucketを変更しない。

## Design Principles
- finding identityはfinding固有内容から導出し、配列位置やprovider出力順序から導出しない。
- changed-tree recoveryはgrantとconvergence attempt stateを1回のflow state CAS mutationで更新する。
- canonical completion scopeはactive review phaseと明示的scope decisionが所有し、残留currentTaskIdから推論しない。
- flow-level findingだけをacceptanceへhandoffし、task-level reviewはtask lifecycle内で完結させる。

## Overview
### Modules
- src/flow/commands/review.js: TestReviewFindingがtest-review findingをcanonical fingerprint入力へ変換する。
- src/flow/lib/review-convergence.js: ReviewConvergenceStateとReviewConvergenceStoreがsemantic/tooling attempt、evidence identity、handoffを検証・保存する。
- src/flow/lib/set-retry.js: SetRetryCommandがsame-tree拒否とchanged-tree recoveryの公開入口を所有する。
- src/flow/lib/run-review.js: RunReviewCommandとpost-hook persistenceがactive phaseに対応するtaskIdでcanonical completionを記録する。
- src/flow/commands/review.js: TestReviewFinding owns normalized test-review identity tuple construction and delegates hashing to ReviewFindingFingerprint.
- src/flow/lib/review-convergence.js: ReviewToolingRecoveryMutation validates flow identity and replaces one exhausted review target with the changed tree and a reset tooling attempt.
- src/flow/lib/set-retry.js: SetRetryCommand attaches the typed review recovery mutation to applyRetryReset afterReset so grant, retry metrics, and convergence state share one CAS write.
- src/flow/lib/run-review.js: ReviewCompletionScope owns the canonical phase/task scope used by review execution, evidence promotion, retry accounting, and post-hook tooling failure persistence.
- src/flow/lib/run-gate.js: integration/task gates exclude only their own lifecycle state and gate source/result artifacts while retaining product, spec-test, and test-execute evidence.
- src/flow/lib/run-final-regression.js and src/flow/lib/stale-test-evidence-refresh.js: stale test-execute evidence is recovered before project regression through the existing refresh-only repair transaction, which extends the repair ledger and returns the flow to test-execute.
- src/flow/lib/acceptance-review-artifacts.js: a stale impl-repair ledger endpoint is recoverable only when fingerprinted downstream artifacts are stale in the same evidence set, routing both through the existing refresh transaction without changing acceptance judgments.

### Data Flow
- parsed test-review finding → normalized target/kind/failureMode/title/issue-or-improvement tuple → SHA-256 findingId → canonical review evidence
- tooling exhaustion → current tree SHA比較 → changed-tree recovery eligibility → expected revision検証 → toolingAttempts 1→0とgrantの単一CAS保存
- active test/impl/task review phase → explicit flow/task scope → canonical completion taskId → flow findingのone-time acceptance handoff
- test-review target/kind-or-failureMode/title/issue-or-improvement → normalized ordered tuple → ReviewFindingFingerprint.fromCanonicalTuple → stable findingId
- exhausted review target + changed current tree → guarded ReviewToolingRecoveryMutation → grant/retry metrics/toolingAttempts reset in one flowManager mutation
- active review phase + explicit artifact taskId (including null) → ReviewCompletionScope → canonical convergence record and one-time finding handoff
- final-regression preflight + stale test-execute repairFingerprint → refresh-only ImplRepairTransaction → repair delta/ledger/manifest更新 + downstream evidence invalidation → test-execute

### Decisions
- [VERIFY] test-review identityのsame-target衝突原因をsourceで確認した。
- [VERIFY] review attempt上限とchanged-tree recovery gapをsourceで確認した。
- [VERIFY] flow/task scope omissionのpost-hook fallbackをsourceで確認した。
- Issue #453で受理済みのGoal、Scope、Out of Scope、Invariantsを維持する。
- T-1 keeps the ordered four-string identity inside TestReviewFinding so same-target findings retain semantic differences without depending on array position.
- T-2 preserves the complete convergence record while changing only treeSha and toolingAttempts, retaining semantic budgets, toolingMaxAttempts=1, provider, tooling outcome, and target-state provenance.
- T-3 treats an explicitly present taskId as authoritative, including null; a missing post-hook taskId and every non-impl phase remain flow-scoped instead of falling back to currentTaskId.
- [VERIFY] gate evaluation must not consume artifacts written by the active gate lifecycle itself.
- [USER CONFIRMED] final-regressionで修正後のtest evidence fingerprint不一致を検出した場合、hashを手編集せず既存のStaleTestEvidenceRefreshとrefresh-only repair transactionを再利用してtest-executeへ戻す。

## Clarifications (Q&A)
- Q: Issue #453の3境界を同じ上限とscope contractのまま修正するか。
  - A: はい。toolingMaxAttempts=1とphase別semantic maxAttemptsを維持し、provider・sandbox・acceptance policyは変更しない。
- Q: active gateが書き換えるlifecycle artifactを同じgateのguardrail入力へ含めるか。
  - A: いいえ。flow.json、issue-log.json、retry recovery state、gate source/resultだけを除外し、product source、spec-local tests、test-execute evidenceは保持する。これはIssue #453実装を検証可能にするために実行中に判明した自己参照防止である。
- Q: final-regression修正後にtest evidenceのrepairFingerprintが古くなった場合、artifactのhashだけを更新するか。
  - A: いいえ。古いテスト結果を修正後の証跡として扱わず、既存のStaleTestEvidenceRefreshとrefresh-only repair transactionでrepair delta・ledger・manifestを更新し、test-execute以降を無効化してtest-executeから再生成する。

## Alternatives Considered
- targetだけをfindingId入力にする — same-targetの別findingが衝突し、R1とR2を満たさない。
- same-tree rerunまたはretry上限増加で回復する — 同一identityのduplicate executionを許し、#448/#452の上限contractを破る。
- canonical completion scopeをcurrentTaskIdから決める — flow-level review中にtask cursorが残るcaseでtask scopeへ誤分類し、R5を満たさない。
- 証拠branchを直接mergeする — 現行mainとpatch-equivalentではなく、現在のclass invariant、CAS、target guardを迂回する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-24T14:52:12.202Z
- Notes:

## Requirements
- R1 [must]: test-review findingIdは正規化済みtarget、finding kindまたはfailureMode、title、issueまたはimprovementを含み、配列indexとfinding順序を含まないcanonical tupleのSHA-256とする。
- R2 [must]: 同じcanonical tupleの再parseとfinding順序変更は同じfindingIdを生成し、titleまたはissue/improvementが異なるsame-target tupleは異なるfindingIdを生成し、完全一致tupleだけをduplicateとして拒否する。
- R3 [must]: toolingAttempts=1でexhaustedしたreviewは同じtree SHAでは再開を拒否し、tree SHAが変わった場合だけtoolingAttemptsを0へ一度戻してtoolingMaxAttempts=1のretryを許可する。
- R4 [must]: changed-tree recoveryはexpected revision一致時にtoolingAttempts 1→0とrecovery grantを同じflow state CAS mutationで各1件保存し、semanticAttempts、semanticMaxAttempts、provenance、runId・issue・spec・phase・taskId guardを変更しない。
- R5 [must]: flow-level test/impl reviewのcanonical exhaustionはcurrentTaskIdが非nullでもtaskId:nullのcompletion recordとflow finding handoffを各identityにつき1件保存し、同じevidenceの再処理で追加recordを作らない。
- R6 [must]: task-level reviewは対象taskIdのcompletion recordを1件保存し、flow-level step status、currentTaskId、acceptance handoffを変更しない。
- R7 [must]: review semantic maxAttempts、toolingMaxAttempts=1、same-tree/evidence duplicate拒否、PASS・ADVISORY・REJECTED bucket invariant、protected acceptance source filesを変更せず、final-regressionの修正後stale test evidenceはhashを手編集せず既存refresh-only repair transactionでdelta・ledger・manifestを現行fingerprintまで更新し、無効化してtest-executeへ戻す。

## Acceptance Criteria
- 同一targetでtitleまたはissue/improvementだけが異なる2 findingのfindingIdが異なる。
- 同じfindingの再parseとfinding配列の並べ替えでfindingIdが変わらず、完全一致findingの2件目だけがduplicate rejectionになる。
- toolingAttempts=1かつ同じtree SHAのrecoveryが変更0件で拒否される。
- tree SHA変更後のrecoveryがtoolingAttemptsを1から0へ一度だけ戻し、toolingMaxAttempts=1とReviewToolingOutcome total maxAttempts=2を維持する。
- recovery CAS成功時にgrantとattempt stateが同じflow revisionへ保存され、CAS不一致時は両方とも保存されない。
- recovery前後でsemanticAttempts、semanticMaxAttempts、provenance、runId・issue・spec・phase・taskId guardがdeep-equalになる。
- currentTaskIdが非nullのflow-level test/impl exhaustionがtaskId:nullのcompletionとhandoffを各1件生成し、同じevidence再処理で件数が増えない。
- task-level exhaustionが対象taskIdを保持し、flow-level step status、currentTaskId、acceptance handoffを変更しない。
- 既存repair ledger後のfinal-regression stale evidence recoveryが、manifest先行履歴を含めrepair ledger終端から現行fingerprintまでrepair delta・ledger・manifestを連続して更新し、test-execute以降の証跡を無効化する。
- spec-local tests、対象共有tests、npm testがexit code 0で完了する。

## Implementation Targets
- src/flow/commands/review.js
- src/flow/lib/review-convergence.js
- src/flow/lib/set-retry.js
- src/flow/lib/run-review.js
- src/flow/lib/run-gate.js
- src/flow/lib/run-final-regression.js
- src/flow/lib/stale-test-evidence-refresh.js
- src/flow/lib/impl-repair-artifacts.js
- src/flow/lib/acceptance-review-artifacts.js
- specs/329-review-convergence-edges/tests/test-review-finding-identity.test.js
- specs/329-review-convergence-edges/tests/changed-tree-recovery.test.js
- specs/329-review-convergence-edges/tests/review-completion-scope.test.js
- specs/329-review-convergence-edges/tests/gate-lifecycle-artifact-filtering.test.js
- specs/329-review-convergence-edges/tests/final-regression-stale-evidence.test.js
- tests/unit/flow/commands/review.test.js
- tests/unit/flow/retry-recovery-convergence.test.js
- tests/unit/flow/gate-diff-compaction.test.js
- tests/unit/flow/run-review-advisory.test.js
- tests/unit/flow/stale-test-evidence-refresh.test.js
- tests/unit/flow/retry-exhaustion-defer.test.js
- tests/e2e/231-task-e2e-full-lifecycle.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Stabilize test-review finding identity
  - same-targetの別findingを区別し、同一findingの再parseと順序変更では同じIDを維持するcanonical identityを実装する。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Atomically recover changed-tree tooling state
  - tree SHA変更時だけreview tooling stateを1回分回復し、grantとattempt stateを単一CASで保存する。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Normalize canonical completion scope
  - active review phaseからflow/task scopeを一意に決め、canonical exhaustion completionとhandoffを正しいtaskIdへ記録する。
  - see `tasks/T-3.md` for full spec
