# Feature Specification: 281-narrow-impl-review-ai-calls

**Feature Branch**: `feature/281-narrow-impl-review-ai-calls`
**Created**: 2026-06-06
**Status**: Draft
**Input**: GitHub Issue #367

## Goal
impl review の loop review で AI call の fan-out を抑え、proposal が単一 chunk からだけ出た場合の cross-check 追加 call をなくす。

## Background
The loop review helper currently allows one AI call per diff group up to 50 groups, then adds a cross-check whenever any chunk produced proposals. Source verification also showed that active impl review currently uses a single prompt path and does not call that helper. The requested change both narrows loop review fan-out and wires it into applicable active impl review executions while keeping review artifact formats stable.

## Scope
- impl review の loop review call 数上限を 16 に下げる。
- groups.length が 16 を超える場合、per-chunk AI call 数を 16 以下にする。
- cross-check は proposal が複数 chunk から出た場合だけ実行する。
- 単一 chunk だけに proposal がある場合、cross-check call を実行しない。
- 同じ review 実行内で同一 chunk hash が再出現した場合、AI call 前に skip する。
- review.md と impl-review.json の proposal / finding 出力形式を維持する。
- `shouldUseLoopReview(touchedFiles.size)` が true の active impl review path から loop review を呼び出し、loop review の結果を既存の impl-review artifact writer へ渡す。

## Out of Scope
- impl review 以外の review phase の挙動変更は対象外。
- agent provider、CLI option、flow step 構造の変更は対象外。
- prompt log 集計や metrics 表示の新機能追加は対象外。

## Constraints
- 外部依存は追加しない。hash 生成が必要な場合は Node.js 組み込みモジュールだけを使う。
- src/ 以下に特定プロジェクトや環境に固有の情報を書かない。
- 既存の `sdd-forge flow review` CLI interface と exit code contract は変更しない。review 処理の成功・失敗条件も既存のままにする。
- `bounded-resource-usage`: loop review の per-chunk AI call 数は固定上限 16 で bounded にする。
- review.md と impl-review.json の on-disk schema / markdown section contract は変更しない。

## Design Principles
- 既存の group chunking と proposal expansion の流れを保ち、call 数を決める境界だけを狭める。
- cross-check は cross-file 問題を見つけるための追加 pass として扱い、複数 chunk 由来の proposal がある場合に限定する。
- 重複 chunk guard は同一 review 実行内だけに閉じ、実行間の cache や永続化は導入しない。

## Overview
### Modules
- `src/flow/commands/review.js` owns impl review execution. The active `runReview` path currently builds one impl review prompt and writes artifacts through `runImplReview`; this change wires loop review into that active path.
- Spec-local tests under `specs/281-narrow-impl-review-ai-calls/tests/` verify the new loop review call contract without changing shared CLI behavior.

### Data Flow
- Touched files are collected by active impl review. When loop review applies, per-file diffs are compacted into groups, batched into chunks capped by `MAX_LOOP_CALLS`, reviewed or skipped by chunk hash, normalized, and passed to existing artifact writing.
- The duplicate chunk guard computes a hash from the chunk review input during a single run. A repeated hash reuses the first chunk's review result path and avoids another agent call.

### Decisions
- [VERIFY] Source check: current loop review limit and cross-check condition match the draft premise.
- [CORRECTION] Source check: `runLoopReview` is not currently used by active impl review; implementation must wire it into `runReview` for applicable impl review scenarios.
- Set `MAX_LOOP_CALLS` to 16.
- Skip duplicate chunk hashes before AI calls within the same review execution.
- Preserve existing review artifact contracts.
- Existing feature impact: impl review call scheduling changes for applicable multi-file reviews; CLI options, exit codes, review.md layout, and impl-review.json schema remain unchanged.

## Clarifications (Q&A)
- Q: What is the new MAX_LOOP_CALLS value?
  - A: Use 16.
- Q: Should duplicate chunk hashes be skipped before AI calls?
  - A: Yes. Skip duplicate chunk input hashes within the same review execution.

## Alternatives Considered
- Set MAX_LOOP_CALLS to 12. — Rejected because it would reduce calls more aggressively but increase per-call chunk size more than 16.
- Record chunk hashes without skipping duplicate AI calls. — Rejected because it would preserve behavior but would not directly reduce duplicate call volume.
- Leave chunk hash guard out of this change. — Rejected because Issue #367 includes avoiding re-review of the same chunk hash within one review execution.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-06T02:10:09.861Z
- Notes: User approved spec after spec-gate PASS.

## Requirements
- R1 [must]: Set the impl loop review `MAX_LOOP_CALLS` fixed limit to 16.
- R2 [must]: When grouped diff count exceeds 16, batch groups so the number of per-chunk AI review calls is at most 16.
- R3 [must]: Run the cross-check AI pass only when proposals are produced from more than one reviewed chunk.
- R4 [must]: Do not run the cross-check AI pass when proposals are produced from exactly one reviewed chunk.
- R5 [should]: Within one loop review execution, skip the AI call for a chunk whose hash matches an already reviewed chunk input.
- R6 [must]: Preserve the existing review.md and impl-review.json output formats for recorded impl review findings.
- R7 [must]: Wire loop review into the active impl review path so `sdd-forge flow review` executions where `shouldUseLoopReview(touchedFiles.size)` is true use the bounded loop review result before writing review.md and impl-review.json.

## Acceptance Criteria
- R1: `MAX_LOOP_CALLS` for impl loop review is 16.
- R2: A loop review scenario with more than 16 groups performs no more than 16 per-chunk AI review calls.
- R3: A loop review scenario with proposals from multiple reviewed chunks performs exactly one cross-check AI call.
- R4: A loop review scenario with proposals from only one reviewed chunk performs no cross-check AI call.
- R5: A loop review scenario with duplicate chunk input hashes performs one AI call for the first instance and skips subsequent duplicates in the same execution.
- R6: Existing review.md / impl-review.json formatting tests continue to pass, and no artifact schema field is removed or renamed.
- R7: A test exercising the active impl review entry point observes loop review behavior when `shouldUseLoopReview(touchedFiles.size)` is true rather than the old single prompt path.

## Implementation Targets
- src/flow/commands/review.js
- specs/281-narrow-impl-review-ai-calls/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Bound loop review calls
  - Update impl loop review so per-chunk AI calls are capped at 16, duplicate chunk inputs are skipped within one execution, and cross-check runs only for multi-chunk proposal output.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Protect artifact format
  - Ensure existing impl review artifact formatting remains unchanged after the loop review call reduction.
  - see `tasks/T-2.md` for full spec
