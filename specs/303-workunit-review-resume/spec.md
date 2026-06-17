# Feature Specification: 303-workunit-review-resume

**Feature Branch**: `feature/303-workunit-review-resume`
**Created**: 2026-06-17
**Status**: Draft
**Input**: GitHub Issue #394

## Goal
impl-review loop review の AI provider 呼び出しを WorkUnit として checkpoint / resume できるようにし、途中失敗後の再実行で成功済み chunk と cross-check を再利用する。

## Background
impl-review enters loop review when touched file count reaches `LOOP_REVIEW_THRESHOLD=10`, then batches diff groups into up to `MAX_LOOP_CALLS=16` chunks. The current loop review can avoid duplicate calls for the same chunk hash only within one process. If a later chunk, cross-check, parser, schema validation, provider, or timeout failure interrupts the run, earlier successful chunks are not available as structured artifacts on the next run. The requested change adds a checkpoint-resumable WorkUnit foundation for impl-review loop AI calls while keeping the canonical final outputs as `impl-review.json` and `review.md`.

## Scope
- impl-review loop review chunk call を WorkUnit checkpoint / resume 対象にする。
- impl-review loop review cross-check call を WorkUnit checkpoint / resume 対象にする。
- WorkUnit identity、checkpoint artifact、resume decision、attempt count、failure state を扱う foundation を追加する。
- success checkpoint かつ identity 完全一致の WorkUnit は provider call なしで reuse する。
- failed、missing、stale WorkUnit は再実行する。
- 全 WorkUnit 成功後だけ既存正本の `impl-review.json` と `review.md` を生成する。
- retryable な同一 loop chunk failure 2 回後、その chunk だけ child WorkUnit に fallback splitting する。
- `flow.review.excludePaths` を config から読み、default exclusions と同じ判定経路で impl-review 対象から除外する。

## Out of Scope
- single-shot impl-review の behavior は変更しない。
- impl-gate / integration gate には WorkUnit を適用しない。
- test-review / draft-review / spec-review には WorkUnit を適用しない。
- `.senti/agent-cache` の仕様は変更しない。
- semantic review finding の retry budget 仕様は変更しない。
- `LOOP_REVIEW_THRESHOLD` / `MAX_LOOP_CALLS` の初期 splitting policy は変更しない。

## Constraints
- 外部依存を追加しない。hash 生成、path matching、JSON artifact 永続化は Node.js built-in module と既存 helper だけで実装する。
- 新しい値構造は object literal や pseudo discriminated union ではなく、専用 class で invariant と振る舞いを持たせる。
- src/ 以下に特定 project や環境固有の path を追加しない。default exclusions も汎用的な generated artifact path だけに限定する。
- WorkUnit foundation の責務は identity 計算、checkpoint 読み書き、resume decision、attempt count 更新に限定する。impl-review 固有の chunk creation、prompt creation、response parsing、artifact aggregation、verdict decision は impl-review 側に残す。
- checkpoint は `review-history/work-units/impl-review/<unit-id>.json` に保存し、既存の `review-history/impl-attempt-*.json` と衝突させない。
- `unitId` は stable lookup key であり、phase、kind、stable order key、parentUnitId から導出する。inputHash、provider identity、promptVersion、schemaVersion、targetFiles は `unitId` には含めず、stored full identity と planned full identity の比較で stale を判定する。
- provider failure / timeout / parser failure / schema failure は tooling failure として扱い、semantic reviewRetry を消費しない。
- impl-review WorkUnit tooling failure は `run-review` boundary で structured `TOOLING_FAILURE` result として扱う。final `impl-review.json` / `review.md` は changed artifacts に含めず、next step advancement は行わず、semantic reviewRetry は増やさない。
- WorkUnit checkpoint failureKind は `provider_failure`、`timeout`、`parser_failure`、`schema_failure` を retryable=true として保存する。checkpoint I/O failure や invariant violation は retryable=false の command failure として扱い、fallback splitting の threshold には数えない。
- fallback splitting は 1 階層だけ許可する。parent loop chunk から child WorkUnit への分割後、child WorkUnit は再分割しない。child WorkUnit 数は parent chunk 内の group 数を上限にする。
- spec-local tests under `specs/303-workunit-review-resume/tests/` must include `// spec: R<N> ...` headers for every covered test file.
- 全 WorkUnit が success になるまで、成功 artifact としての `impl-review.json` と `review.md` は生成しない。
- loop proposal は引き続き `nonBlockingImprovements` として扱い、blocking finding に昇格しない。
- single-shot impl-review、impl-gate / integration gate、test-review / draft-review / spec-review は retained public surfaces として既存 path を維持し、WorkUnit checkpoint を作らないことを behavior-level verification で確認する。

## Design Principles
- resume 判定は WorkUnit identity の完全一致に限定し、部分一致や prompt text だけの一致で reuse しない。
- 成功済み WorkUnit の reuse は provider call suppression であり、最終 review verdict の意味は既存 loop review と同じにする。
- fallback splitting は失敗した parent chunk だけを child WorkUnit に展開し、成功済み chunk の identity と aggregation order を壊さない。
- default exclusions と config exclusions は同じ matcher を通し、fallback diff、touched file count、per-file diff、loop chunk creation で除外対象がずれないようにする。

## Overview
### Modules
- `src/flow/commands/review.js` owns impl-review diff collection, loop review chunking, provider calls, proposal parsing, and final `impl-review.json` / `review.md` persistence.
- `src/flow/lib/run-review.js` wraps review subprocess execution and reviewRetry accounting; tooling failures must not be converted into semantic review findings.
- A new WorkUnit foundation module under `src/flow/lib/` owns reusable checkpoint primitives without depending on gate batch or other review phases.
- Spec-local tests under `specs/303-workunit-review-resume/tests/` verify WorkUnit identity, checkpoint reuse, partial failure resume, fallback splitting, exclusions, and retained public surfaces.

### Data Flow
- impl-review resolves merge-base, target diff, touched files, exclusions, per-file diffs, groups, and review chunks before constructing a WorkUnit plan.
- For each planned loop chunk WorkUnit, review checks the checkpoint store. Matching success checkpoints return parsed proposals without provider calls; missing, failed, or stale checkpoints execute the provider.
- A successful provider response is parsed and immediately saved as a success checkpoint. Provider, timeout, parser, or schema failure is saved as a failed checkpoint and stops the run as tooling failure.
- When chunk summaries require cross-check and call capacity remains under the existing rule, cross-check is planned and checkpointed as a WorkUnit whose identity is based on summary hashes.
- After all planned WorkUnits are success, aggregation preserves original plan order, expands fallback child results at the parent position, converts proposals through existing non-blocking semantics, and writes final review artifacts.
- If WorkUnit execution fails with provider, timeout, parser, or schema failure, the review command writes a failed checkpoint and returns a structured impl `TOOLING_FAILURE` result across the `run-review` boundary without final review artifacts.

### Decisions
- [VERIFY] loop review currently deduplicates only inside one process with `seen = new Map()` and has no persisted checkpoint store.
- [VERIFY] loop proposals currently remain non-blocking, so WorkUnit aggregation must preserve that verdict meaning.
- [VERIFY] current default exclusions apply through `REVIEW_EXCLUDE_PATHS`, but touched file count and scoped path handling need one shared decision path.
- [VERIFY] `run-review` already separates tooling failure from semantic retry for non-impl phases; this spec extends that contract to partial loop WorkUnit failures.
- WorkUnit identity includes phase, kind, stable order key, target files, input hash, commandId, provider identity, prompt version, and schema version.
- WorkUnit `unitId` is a stable lookup key, not the full identity hash. Stale detection compares stored full identity with the planned full identity after loading by stable `unitId`.
- Impl WorkUnit tooling failures cross `run-review` as structured `TOOLING_FAILURE` results with no final artifacts, no next-step advancement, and no semantic reviewRetry increment.
- Retryable WorkUnit failures are provider_failure, timeout, parser_failure, and schema_failure. Checkpoint I/O and invariant failures are not fallback-splitting inputs.
- Retained public surfaces are explicit exclusions from the WorkUnit path, not migrations to new owners.

## Clarifications (Q&A)
- Q: Does this spec apply WorkUnits to gate batch or other review phases?
  - A: No. Initial application is limited to impl-review loop chunk and cross-check calls. Gate batch and other review phases are explicit out of scope.
- Q: Does a stale success checkpoint allow reuse?
  - A: No. Any identity mismatch makes the checkpoint stale and the WorkUnit must execute again.
- Q: How is `unitId` different from WorkUnit identity?
  - A: `unitId` is a stable lookup key derived from phase, kind, stable order key, and parentUnitId. Full identity includes volatile target/input/provider/prompt/schema fields and is compared after lookup to decide reusable versus stale.
- Q: How does impl WorkUnit tooling failure cross the subprocess boundary?
  - A: The review command saves the failed checkpoint and returns a structured impl `TOOLING_FAILURE` result to `run-review`. That result has no final review artifacts, no next-step advancement, and no semantic reviewRetry increment.
- Q: Which WorkUnit failures are retryable for fallback splitting?
  - A: `provider_failure`, `timeout`, `parser_failure`, and `schema_failure` are retryable. Checkpoint I/O failure and invariant violation are non-retryable command failures.
- Q: Does fallback splitting change `MAX_LOOP_CALLS` or initial chunking?
  - A: No. Initial chunking and `MAX_LOOP_CALLS` remain unchanged. Fallback splitting expands only the failed parent chunk after two retryable failures.
- Q: Are WorkUnit checkpoints final review outputs?
  - A: No. They are intermediate development evidence. The canonical final outputs remain `impl-review.json` and `review.md`.
- Q: How is migration parity handled for retained surfaces?
  - A: Retained public surfaces are mapped to their existing owners and excluded from the WorkUnit path. Tests must verify they still produce existing artifacts and do not create WorkUnit checkpoint artifacts.

## Alternatives Considered
- Rely on `.senti/agent-cache` for loop review resume — Rejected because prompt cache reuses exact prompt/provider responses but does not track WorkUnit success/failure state, target files, aggregation order, retry count, stale identity, or child fallback state.
- Apply WorkUnit foundation to impl-gate and all review phases in the initial spec — Rejected because Issue #394 limits initial application to impl-review loop review. Expanding to gate batch or other phases would add unrelated contracts before the API stabilizes.
- Re-chunk the entire loop review after a retryable chunk failure — Rejected because it would invalidate successful sibling WorkUnit identities and violates the requirement to split only the failed chunk while preserving initial chunking policy.
- Promote loop proposals to blocking findings during aggregation — Rejected because current loop review semantics convert proposals to `nonBlockingImprovements`; changing verdict meaning is out of scope.
- Use separate matching logic for default exclusions and config exclusions — Rejected because touched file count, fallback diff, and loop review chunk creation must use one decision logic to avoid target mismatch.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-17T05:38:10.920Z
- Notes: User approved gate-passed spec via choice [1].

## Requirements
- R1 [must]: Introduce dedicated WorkUnit value classes for identity, plan entries, checkpoint records, and resume decisions. These classes enforce required identity fields and status values in constructors and expose behavior for hashing, identity comparison, serialization, and stale detection.
- R2 [must]: Calculate each WorkUnit identity from phase, kind, stable order key, normalized target files, input hash, commandId, resolved provider identity, prompt version, and schema version. Derive `unitId` separately from stable lookup fields: phase, kind, stable order key, and parentUnitId. A checkpoint is reusable only when loaded by `unitId` and the stored full identity exactly matches the planned full identity.
- R3 [must]: Persist WorkUnit checkpoints under the current spec directory at `review-history/work-units/impl-review/<unit-id>.json` with version, phase, kind, unitId, identity, targetFiles, inputHash, provider identity, promptVersion, schemaVersion, status, attemptCount, startedAt, finishedAt, and optional success or failure fields.
- R4 [must]: For loop chunk WorkUnits, reuse a matching success checkpoint without calling the provider, and execute only missing, failed, or stale WorkUnits.
- R5 [must]: On loop chunk provider success, parse proposals and immediately save a success checkpoint before executing later WorkUnits. On provider failure, timeout, parser failure, or schema failure, immediately save a failed checkpoint and return an impl `TOOLING_FAILURE` result across the `run-review` boundary without writing successful final review artifacts or advancing to the next step.
- R6 [must]: Generate `impl-review.json` and `review.md` only after every required WorkUnit in the current plan is successful, preserving the existing loop proposal conversion to `nonBlockingImprovements` and an empty `blockingFindings` array.
- R7 [must]: Plan, save, and reuse loop cross-check as a WorkUnit when the existing condition holds: at least two chunk summaries exist and reviewCallCount remains below `MAX_LOOP_CALLS`. Cross-check identity is based on the hashes of chunk summaries included in its input.
- R8 [must]: After the same retryable parent `loop-chunk` WorkUnit has two failed checkpoints, split only that parent chunk into child WorkUnits, one child per group. `provider_failure`, `timeout`, `parser_failure`, and `schema_failure` checkpoints are retryable for this threshold. Fallback splitting is one level only: child WorkUnits are never split again, and child WorkUnit count is bounded by the parent chunk group count. Child WorkUnits include parentUnitId, and aggregation expands successful child results at the parent position without writing a parent success checkpoint.
- R9 [must]: Add config setting `flow.review.excludePaths` and combine it with default review exclusions through one repository-root-relative path matching decision. Apply exclusions before touched file count, per-file diff collection, and loop review chunk creation.
- R10 [must]: Provider failure, timeout, parser failure, and schema failure inside WorkUnit execution are tooling failures and do not increment semantic reviewRetry. Checkpoint I/O failure and invariant violation are non-retryable command failures and do not count toward fallback splitting.
- R11 [must]: Preserve retained public surfaces: single-shot impl-review, impl-gate / integration gate, test-review, draft-review, and spec-review continue through existing paths and do not create WorkUnit checkpoint artifacts.
- R12 [should]: Record WorkUnit checkpoint rawResponse and failure details as spec-directory development evidence only; do not add new secret collection behavior or a new redaction policy.

## Acceptance Criteria
- R1: Diff shows dedicated classes for WorkUnit identity, plan/checkpoint, and resume decisions; new WorkUnit structures are not represented as plain object-literal type unions.
- R2: Spec-local tests prove identity changes when input hash, provider identity, prompt version, or schema version differs while `unitId` remains stable for the same planned slot, and success reuse occurs only on exact identity match.
- R3: A loop chunk execution writes a JSON checkpoint under the current spec directory `review-history/work-units/impl-review/` with all required identity, status, attempt, timing, and success/failure fields.
- R4: A rerun with one matching success checkpoint and one missing or failed WorkUnit skips the successful WorkUnit provider call and executes only the non-success WorkUnit.
- R5: A simulated later chunk tooling failure leaves earlier success checkpoints present, writes a failed checkpoint for the failing WorkUnit, returns a structured impl `TOOLING_FAILURE` result, does not advance the step, and does not create successful `impl-review.json` / `review.md` artifacts for that run.
- R6: After all WorkUnits succeed on rerun, final `impl-review.json` and `review.md` are generated, and loop proposals remain non-blocking improvements.
- R7: Cross-check WorkUnits are saved and reused; rerunning with matching chunk summary hashes skips the cross-check provider call.
- R8: After two retryable failures with failureKind `provider_failure`, `timeout`, `parser_failure`, or `schema_failure` for the same parent loop chunk, only that chunk is split into child WorkUnits; child count is at most the parent group count; child WorkUnits are not split again; successful sibling chunks remain reused and aggregation preserves parent order.
- R9: `flow.review.excludePaths` affects touched file count and per-file diff collection, and default exclusions plus local config exclusions use the same matcher.
- R10: WorkUnit tooling failure does not append a semantic reviewRetry metric for impl-review, and non-retryable checkpoint I/O or invariant failures are not counted toward fallback splitting.
- R11: Behavior-level tests show single-shot impl-review and non-impl review/gate retained surfaces do not create WorkUnit checkpoint artifacts and still produce their existing artifacts.
- R12: Checkpoint rawResponse and failure details are stored only in the spec directory checkpoint artifact and no source code path adds project-specific secret collection.
- Test header convention: Every spec-local test file under `specs/303-workunit-review-resume/tests/` includes a `// spec: R<N> ...` header mapping it to one or more requirements.

## Implementation Targets
- src/flow/commands/review.js
- src/flow/lib/run-review.js
- src/flow/lib/
- src/lib/config.js
- src/lib/path-match.js
- specs/303-workunit-review-resume/tests/
- tests/unit/flow/commands/review.test.js
- tests/unit/flow/run-review-advisory.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add WorkUnit primitives
  - Introduce reusable WorkUnit identity, checkpoint, store, and resume decision classes for AI provider call checkpoints.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Resume loop chunks
  - Apply WorkUnit checkpoints to impl-review loop chunk provider calls so successful chunks are reused after a partial failure.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Checkpoint cross-check
  - Apply WorkUnit checkpoints to loop review cross-check and implement retryable parent chunk fallback splitting.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Unify review exclusions
  - Add `flow.review.excludePaths` and route default exclusions plus config exclusions through one matcher before impl-review target counting and diff collection.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Verify retained surfaces
  - Add behavior-level migration parity tests proving retained review and gate public surfaces keep existing behavior and do not create WorkUnit checkpoint artifacts.
  - see `tasks/T-5.md` for full spec
