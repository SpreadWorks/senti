# Feature Specification: 322-flow-target-transition-guards

**Feature Branch**: `feature/322-flow-target-transition-guards`
**Created**: 2026-07-20
**Status**: Draft
**Input**: GitHub Issue #443

## Goal
Flow mutation の target を `runId` / `spec` / `issue` の AND 条件と検証時 revision で一意に確定し、normal step transition と next-action promotion を検証後の単一 atomic write に限定して、失敗時に foreign flow または durable side effect を残さない。

## Background
同時に複数 flow を扱える現在のCLIでは、normal resolutionの一部が同じIssueに一致する最初のflowを選び、read resolverは複数selectorのmatchをOR集約する。Normal set-stepとdefinition lifecycleは共通transition policyを持たず、next-actionは実行可能性の検証前にpromotionを保存する。FlowStoreには既にrevision-aware atomic writerがあるため、本specはtarget、transition、promotionのeligibilityを専用ownerへ集約し、そのCASを唯一のcommit pointとして使う。maxAttempts は既存の明示的上限と揃えた整数 `1..10_000`（両端含む）だけを許可し、上限超過も他の不正値と同じく書き込み前に失敗させる。Source verificationでdispatcher target failureがruntime-log blockを残すことも確認したため、承認済みno-mutation contractを満たす補正としてdispatcher target guardをruntime-log open前へ移す。

## Scope
- active、preparing、bound worktree target に対する normal mutation resolution で supplied `runId` / `spec` / `issue` selector を AND 条件として0件/1件/2件以上に分類する。
- dispatcher の target identity failure を hook、command、runtime-log block open より前に返し、failure path の durable surfaces を byte-identical に保つ。
- normal `set step` を current leaf の `in_progress` から `done` または `skipped` への definition-approved transition に限定する。
- normal、definition lifecycle、explicit recovery の transition contract を constructor invariant を持つ専用 OOP class で表現し、全 caller が該当 policy owner を通る。
- step status、timestamps、next promotion を1回の revision-aware `FlowStore` write にまとめ、logger、artifact、runtime log、retry side effect を commit 後に一度だけ実行する。
- next-action の definition、rule、schema、instruction、target identity、task scope、`maxAttempts` が整数 `1..10_000`（両端含む）であることを永続化前に検証し、revision CAS で promotion する。
- public CLI、direct API、definition lifecycle hook、target flags/config/help/registered steps、artifacts、side effects の migration parity、owner、intentional removal、caller migration を維持または明示する。
- public CLI と direct module の failure/success/concurrency matrix を spec-local tests と focused shared tests で検証し、`npm test` regression を通す。

## Out of Scope
- #442 が所有する registered step set の追加、削除、名称変更。
- Ideas BUG `3c9d` が所有する gate phase inference の failure atomicity。
- Ideas BUG `c9de` が所有する approval と spec task sync の atomicity。
- Ideas BUG `0781` が所有する resume candidate scan の completeness。
- legacy flow format compatibility、same-Issue first-candidate compatibility、multi-selector fallback、暗黙 rewind。

## Constraints
- Node.js built-in modules だけを使い、外部依存を追加しない。
- target、transition、revision invariant は constructor で検証する専用 class で表現し、discriminated object literal を追加しない。
- normal target failure は hook、command、`RuntimeLogBlockWriter` open/close より前に確定し、typed envelope/error 以外を永続化しない。
- `FLOW_STATE_ATOMIC_STALE` を自動 retry または暗黙 re-resolve せず、caller に最新 target の再解決を要求する。
- `base-command.js` と `flow-context.js` は解決済み authority の routing だけを担当し、selector policy または transition policy の owner にしない。
- existing `runId` / `spec` / `issue` flags、flow config、CLI help、registered step set を変更せず、新しい config または flag を追加しない。
- same-Issue first-candidate fallback、multi-selector OR/fallback、normal non-current/out-of-order update、pre-validation promotion を削除し、alpha policy に従い legacy fallback を設けない。
- approval/spec task sync は `c9de` の scope とし、本 spec の atomic write に含めない。
- `src/` に Issue、spec、run、workspace 固有値を埋め込まない。

## Design Principles
- Target identity と action executability を検証し終えるまで、runtime log を含む observable side effect を開始しない。
- Supplied selector の全条件と検証時 revision に一致する一意な authority だけを mutation target とする。
- NormalStepTransition、DefinitionLifecycleTransition、ExplicitRecoveryTransition を別 class とし、各 constructor が source state、target step、requested status、transition source を検証する。
- FlowStore の revision CAS を唯一の durable commit point とし、status、timestamps、next promotion を一回で書く。
- Logger、artifact、runtime log、retry bookkeeping は commit success 後に一度だけ実行し、terminal retry では再生成しない。
- Definition lifecycle と explicit recovery は dedicated transition owner を使用し、normal `set step` guard を迂回しない。
- Retained behavior は owner と behavior-level test を対応付け、removed behavior は caller migration と no-legacy expectation を明示する。

## Overview
### Modules
- `FlowTargetExpectation` / `ResolvedFlowTarget` と `FlowManager` が active、preparing、bound worktree candidates の selector AND、identity、0/1/2+ classification を所有する。
- `flow-context.js` と `base-command.js` は resolved authority を command へ route し、`dispatcher.js` は target failure を runtime-log block と hook より前に返す。
- 新規 `step-transition-policy.js` の3 transition class が normal、definition lifecycle、explicit recovery の eligibility と constructor invariant を所有する。
- `SetStepCommand`、`definition.js`、`RegistryLifecycleAdapter` は transition instance を作成し、`FlowStore.updateStepStatus` / `saveAtomic` へ渡す。
- `GetNextActionCommand` は immutable promotion plan を構築して全 executable input を検証し、`FlowStore` revision CAS へ一回の promotion commit を依頼する。
- spec-local tests と focused shared CLI/module tests が target、transition、promotion、dispatcher failure、migration parity の behavior matrix を検証する。
- `GateMutationOwner` が task gate と flow integration gate の step/task/attempt/retry/defer mutation routing を分離し、`FlowStore` が validated transition の status、timestamps、next flow step promotion を単一 atomic write で所有する。
- `NextActionPlanner` と `NextActionPromotionPlan` が definition、rule、schema、instruction、target、task scope、revision、maxAttempts を immutable な実行計画として書き込み前に検証する。

### Data Flow
- CLI input から FlowTargetExpectation を構築し、FlowManager が active/preparing/bound candidates に全 supplied selector を適用して0件、1件、2件以上を typed result にする。
- 0件、2件以上、bound mismatch は dispatcher から typed envelope/error を返し、hook、command、RuntimeLogBlockWriter、flow/preparing/registry state に触れない。
- Normal set は current definition leaf と requested terminal status から NormalStepTransition を構築し、policy validation 後に FlowStore CAS を一回実行する。
- Definition lifecycle action は DefinitionLifecycleTransition、existing rewind/recovery entrypoint は ExplicitRecoveryTransition を構築し、同じ FlowStore commit boundary を使用する。
- GetNextActionCommand は target/task scope、definition、rule、schema、instruction、maxAttempts の整数範囲 `1..10_000`（両端含む）を読み取り専用 plan に解決し、検証時 revision と共に FlowStore へ渡す。
- CAS success は status、timestamps、next promotion を一度永続化し、その後 logger/artifact/runtime-log/retry side effects を一度発行する。CAS stale は無変更で再解決要求を返す。
- Validated transition instance は FlowStore の単一 atomic write で step status、timestamps、definition-driven next flow step promotion を整合させ、commit 後にだけ side effects を発行する。
- get-next-action は read-only plan を構築し、同じ loaded revision を expectedOriginal として FlowStore CAS に一度だけ渡し、成功後にだけ任意の effect recorder を通知する。

### Decisions
- [VERIFY] `FlowManager.resolveExplicitFlowTarget` は expectation の全条件で filter する一方、`resolveActiveFlow` の run/spec/issue 選択は最初の match を返し、`resolveExplicitFlowTargetForRead` は supplied selector ごとの match を OR 集約している。
- [VERIFY] `SetStepCommand` と `FlowStore.updateStepStatus` には normal current-leaf と definition lifecycle provenance の全経路を横断する共通 guard がなく、terminal update 時の次 pending promotion も同じ mutation に含める。
- [VERIFY] `GetNextActionCommand` は no-target state で pending step/task promotion を永続化した後に definition、rule、schema、instruction、maxAttempts を derive/load/validateする。本 spec は書き込み前に maxAttempts を整数 `1..10_000`（両端含む）へ制限する。
- [VERIFY] `FlowStore` load/saveAtomic と `AtomicFlowStateWriter` は `FlowStateRevision`、expected revision、`FLOW_STATE_ATOMIC_STALE` を持ち、revision CAS の durable基盤を既に提供する。
- [VERIFY] `definition.js` の lifecycle actions と `RegistryLifecycleAdapter` は `SetStepStatus` を `FlowManager.updateStepStatus` へ直接渡し、normal commandとは別経路でmulti-step statusを変更する。
- [CORRECTION] `dispatcher.emitTargetFailure` は identity mismatchをhook/command前に返すがruntime-log writerを既にopen/closeしてblockを追加するため、target failureではwriterをopen/attach/persistしないpathへ補正する。
- Transition table は NormalStepTransition=current in_progress→done|skipped、DefinitionLifecycleTransition=current definition actionだけ、ExplicitRecoveryTransition=existing recovery entrypointだけとする。
- Migration ownerは selector=`FlowTargetExpectation`/`ResolvedFlowTarget`+FlowManager、transition=専用policy、promotion planning=GetNextActionCommand、durable CAS=FlowStore とする。
- same-Issue first-candidate、multi-selector OR/fallback、normal non-current/out-of-order update、pre-validation promotionを意図的に削除し、legacy fallbackを追加しない。
- Task gate の対象 step/task/attempt/retry/defer 判定は `GateMutationOwner` に集約し、flow-level `impl-gate` と task-level `task-gate` を caller 条件分岐で混在させない。
- `FLOW_STATE_ATOMIC_STALE` では自動 retry や target 再解決を行わず、caller に再解決を要求する。production default に空の effect abstraction は置かない。

## Clarifications (Q&A)
- Q: How are 0-result, 2+-result, and bound-authority mismatch errors distinguished?
  - A: Candidate selection returns typed not-found/mismatch for 0 and typed ambiguity for 2+. A bound worktree or guarded active authority whose identity differs from supplied expectations may retain ACTIVE_FLOW_MISMATCH, provided it returns before hooks and runtime-log open and selects no foreign target.
- Q: Does no-mutation include runtime-log evidence for rejected target selection?
  - A: Yes. Target-resolution failures return only the typed envelope/error; they do not create or append a `.tmp` runtime-log block and do not attach step runtimeLog metadata. Other failures after a unique target is accepted retain their existing logging policy.
- Q: Why can definition lifecycle perform transitions normal set-step rejects?
  - A: The current definition node/event emits a bounded action list that may complete review/triage/repair leaves and start auxiliary leaves. DefinitionLifecycleTransition validates that provenance; normal user-facing set-step has no such provenance and is restricted to its current in-progress leaf.
- Q: What is the durable commit boundary for step and next-action changes?
  - A: FlowStore revision CAS is the only durable commit point. The validated transition or promotion plan supplies expected original revision, and logger/artifact/runtime-log/retry side effects begin only after the atomic write succeeds.
- Q: Does this spec make approval and spec task synchronization atomic with step completion?
  - A: No. That behavior is owned by Ideas BUG c9de and remains unchanged. This spec makes status, timestamps, and definition-driven next promotion atomic while preserving the existing approval-sync boundary.
- Q: What must callers do after compatibility behavior is removed?
  - A: CLI callers add a selector that proves a unique target, direct API callers handle typed 0/2+ outcomes, and stale callers re-resolve the target. No caller may rely on first-candidate selection, selector OR/fallback, implicit rewind, or automatic CAS retry.

## Alternatives Considered
- Retain same-Issue first-candidate and multi-selector fallback with warnings. — Rejected because warnings do not prevent foreign mutation and cannot satisfy typed ambiguity, selector AND, or byte-identical failure requirements.
- Guard only SetStepCommand without a shared transition policy. — Rejected because definition lifecycle and direct FlowStore callers would retain an unguarded mutation path.
- Represent transition kinds as `{ type, step, status }` object literals. — Rejected because constructors cannot enforce source-specific invariants and the project requires OOP value types rather than discriminated object unions.
- Persist next-action promotion first and roll it back when derivation fails. — Rejected because rollback cannot guarantee byte-identical timestamps, logs, artifacts, retry counters, or concurrent revision behavior.
- Automatically retry FLOW_STATE_ATOMIC_STALE against the newest revision. — Rejected because the caller validated a different authority revision and must explicitly re-resolve before any new mutation.
- Keep runtime-log blocks for target identity failures as diagnostics. — Rejected because target failure occurs before an authorized flow is known and the approved R2 contract requires `.tmp` runtime-log and step runtimeLog bytes to remain unchanged.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-20T05:07:34.237Z
- Notes: Auto-approved per user-selected autonomous mode after audited plan rewind and fresh spec gate PASS.

## Requirements
- R1 [must]: Supplied `runId`、`spec`、`issue` selectors shall be combined as AND conditions across active、preparing、bound worktree targets before command execution; 0 results shall return a distinct typed not-found/mismatch, 1 result shall return that exact target, and 2 or more results shall return typed ambiguity. Bound authority mismatch may use `ACTIVE_FLOW_MISMATCH`, and no foreign candidate may be selected.
- R2 [must]: Every target-resolution failure shall be decided before lifecycle hooks、command execution、or runtime-log writer open. The active/preparing registry、flow/preparing state、flow.json bytes、timestamps、artifacts、`.tmp` runtime-log bytes、step runtimeLog metadata、retry counters shall remain byte-identical, and only the typed envelope/error may be returned.
- R3 [must]: Normal `set step` shall accept only the current leaf whose stored status is `in_progress` and whose requested status is `done` or `skipped`. It shall reject requested `pending`/`in_progress`, already-terminal、non-current、out-of-order、or definition-disallowed targets without state or side-effect changes.
- R4 [must]: Transition eligibility shall be represented by dedicated OOP classes: `NormalStepTransition` permits only current `in_progress`→`done|skipped`; `DefinitionLifecycleTransition` permits only actions emitted by the current definition node/event, including approved auxiliary `pending`→`in_progress|done|skipped`; `ExplicitRecoveryTransition` permits only existing rewind/recovery entrypoints. Each constructor shall enforce state、source、target、status invariants, lifecycle callers shall accept only definition-produced actions, and recovery callers shall use only dedicated paths.
- R5 [must]: FlowStore shall accept a validated transition instance and persist requested status、timestamps、and next promotion in one atomic write. Logger and other post-commit side effects shall run exactly once after commit; retrying an already-terminal transition shall be rejected without duplicate promotion、artifact、runtime log、or retry mutation. Approval/spec-task synchronization owned by `c9de` is excluded.
- R6 [must]: GetNextActionCommand shall build a read-only promotion plan and validate the flow definition、rule、output schema、instruction、target identity、task scope、and `maxAttempts` as an integer from 1 through 10_000 inclusive before any flow write、timestamp、artifact、runtime log、or retry mutation occurs. Values greater than 10_000 shall fail through the same no-write path as every other invalid value.
- R7 [must]: Next-action promotion shall commit only through FlowStore revision CAS. `FLOW_STATE_ATOMIC_STALE` shall cause no automatic retry、implicit re-resolution、promotion、or side effect and shall require caller re-resolution; an unchanged revision shall produce one promotion and one set of post-commit effects.
- R8 [must]: Migration parity shall retain exact-unique CLI/API success、definition-approved lifecycle/recovery、target flags/config/help/registered-step contracts、and exactly-once artifacts/side effects under their mapped owners. It shall intentionally remove first-candidate selection、selector OR/fallback、normal non-current/out-of-order update、and pre-validation promotion, add no legacy fallback, and require CLI/direct/stale callers to handle selector、typed failure、or re-resolution contracts.
- R9 [must]: Spec-local and focused shared tests shall cover public CLI and direct-module matrices for AND/0/1/2+ targets、bound mismatch、no-mutation runtime-log failure、normal/lifecycle/recovery transitions、invalid action inputs、concurrent revision drift、exact success/retry、and unchanged config/help/registered steps; spec-local tests shall carry `// spec: R<N>` headers and the full `npm test` regression shall pass.

## Acceptance Criteria
- AC1 [R1]: Active、preparing、and bound-worktree fixtures exercise supplied runId/spec/issue selectors individually and together; 0 results return typed not-found/mismatch, exactly 1 returns that target, 2+ returns typed ambiguity, bound mismatch may return ACTIVE_FLOW_MISMATCH, and no foreign run is selected.
- AC2 [R2]: For every not-found、mismatch、ambiguity、and bound-target failure, snapshots before/after show identical registry/preparing/flow.json/timestamps/artifacts/`.tmp` runtime-log/step runtimeLog/retry bytes, and hook/command/runtime-log-writer spies show zero invocations before the typed response.
- AC3 [R3]: Normal set-step matrix accepts only current stored `in_progress`→requested `done|skipped` and rejects requested pending/in_progress、already done/skipped、non-current、out-of-order、and definition-disallowed cases with byte-identical state and zero side effects.
- AC4 [R4]: Constructor tests prove NormalStepTransition、DefinitionLifecycleTransition、and ExplicitRecoveryTransition enforce the transition table; lifecycle tests accept only actions emitted by the current definition event, auxiliary pending transitions work through that owner, and only existing recovery entrypoints create recovery transitions.
- AC5 [R5]: Instrumented FlowStore tests show one atomic write contains status、timestamps、and next promotion, logger/post-commit effects run once after success, a terminal retry performs zero writes/effects, and approval/spec-task sync behavior is unchanged.
- AC6 [R6]: Missing/invalid definition、rule、schema、instruction、target、task scope、and maxAttempts fixtures each fail before mutate/saveAtomic、timestamp、artifact、runtime log、or retry calls. maxAttempts boundary fixtures accept integer 1 and 10_000, reject non-integers、values below 1、and values above 10_000 through the same no-write path; a complete plan reaches the commit boundary.
- AC7 [R7]: A concurrent revision change between plan and commit returns FLOW_STATE_ATOMIC_STALE with byte-identical state and zero retry/re-resolution/effects; unchanged revision commits exactly one promotion and retrying it does not duplicate output.
- AC8 [R8]: Behavior tests inventory CLI、direct APIs、definition lifecycle hooks、config/help/registered steps、artifacts、and side effects; each retained surface exercises its mapped owner, each removed behavior returns the new typed/guarded result, and no legacy fallback or #442 change appears in the diff.
- AC9 [R9]: Tests under `specs/322-flow-target-transition-guards/tests/` contain `// spec: R1` through `// spec: R9` coverage, the listed shared target tests pass, and `npm test` completes successfully.

## Implementation Targets
- src/lib/flow-manager.js
- src/lib/flow-target-guard.js
- src/flow/lib/flow-context.js
- src/flow/lib/base-command.js
- src/lib/flow-store.js
- src/flow/lib/step-transition-policy.js
- src/flow/lib/set-step.js
- src/flow/lib/get-next-action.js
- src/flow/definition.js
- src/flow/registry.js
- src/lib/dispatcher.js
- tests/unit/flow/set-step.test.js
- tests/unit/flow/get-next-action.test.js
- tests/unit/flow/optional-flow-context.test.js
- tests/unit/flow/flow-state-shared-writer.test.js
- tests/unit/lib/dispatcher.test.js
- tests/e2e/flow/worktree-flow-command-identity.test.js
- specs/322-flow-target-transition-guards/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Harden flow target resolution
  - Make every normal mutation resolve one exact active, preparing, or bound target before hooks and runtime logging. Preserve exact-target behavior while making rejected target selection fully side-effect free.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Enforce step transition policy
  - Introduce source-specific transition value classes and require normal, definition lifecycle, and explicit recovery callers to use the correct policy before one atomic step commit.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Commit validated next actions
  - Plan and validate the complete next action before persistence, then commit promotion through the existing FlowStore revision CAS exactly once.
  - see `tasks/T-3.md` for full spec
