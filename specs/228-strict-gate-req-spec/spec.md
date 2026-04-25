# Feature Specification: 228-strict-gate-req-spec

**Feature Branch**: `feature/228-strict-gate-req-spec`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #258

## Goal
gate-impl の REQ-SPEC 評価に mechanical pre-check を追加し、spec の tasks[].expected_tests で宣言されたテストファイルの存在を AI に依存せず機械的に検証する。

## Background
spec 215 の実装過程で gate-impl が REQ-SPEC を PASS したが、spec で約束したテスト（REQ-12: integration シナリオ）が未実装だった。原因は gate-impl の評価が集約テスト結果（exit code 0 + テスト数）に依存し、個別テストの存在を検証しなかったこと。Issue #256 で全容が報告された。

## Scope
- spec.schema.json に tasks[].expected_tests フィールドを追加する
- executeDiffBasedGate に expected_tests のファイル存在チェックを追加する
- 検証失敗時に具体的な FAIL reason メッセージを出力する
- task-impl / integration 両フェーズで検証を適用する
- expected_tests 未定義時のスキップ（既存 spec 互換）

## Out of Scope
- テストケースレベル（describe/it）の個別照合
- テストランナー出力のパース
- AI 評価プロンプト（buildImplCheckPrompt）の変更

## Constraints
- 外部依存なし — Node.js 組み込みモジュールのみ使用
- 既存 spec.json との後方互換を維持 — expected_tests は optional フィールド

## Design Principles
- AI 前の mechanical check で構造的問題を排除する（checkTestChanges, checkMissingHeadTestEvidence と同パターン）
- spec.json の構造化フィールドを信頼の源泉とする（authorized_test_modifications と同パターン）

## Overview
### Modules
- spec.schema.json — tasks[].expected_tests フィールド定義を追加
- run-gate.js — executeDiffBasedGate 内に checkExpectedTests 関数を追加

### Data Flow
- spec.json tasks[].expected_tests → loadSpecJson → executeDiffBasedGate → checkExpectedTests → PASS/FAIL

### Decisions
- ファイル存在チェックのみ。テストケースレベルの照合はフレームワーク依存が高く対象外。
- task レベルに所属させる。spec 226 のタスク分解と整合する。
- glob パターン対応。テストディレクトリ指定等の柔軟性を確保する。

## Clarifications (Q&A)
- Q: Why mechanical pre-check instead of AI prompt enhancement?
  - A: Issue #258 の根本原因は AI が集約テスト結果から甘判定すること。AI に依存しない検証が根本対策。
- Q: Why file-level check instead of test-case-level?
  - A: テストケースレベルの照合はテストフレームワーク固有のパーサーが必要で、外部依存なし方針に反する。
- Q: Why task-level instead of parent-level?
  - A: spec 226 で導入されたタスク分解が concern 分離を実現しており、テスト責任も task 単位で管理するのが整合する。

## Alternatives Considered
- AI プロンプト強化 — AI が判定するので柔軟だが、構造的に隠蔽可能という根本問題が残る。
- テストランナー出力パース — 正確だがフレームワーク依存性が高く、外部依存なし方針と合わない。
- parent レベルに配置 — タスク分解による concern 分離と整合しない。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-25
- Notes: draft で 5 問の Q&A 完了後に承認

## Requirements
- **REQ-1** [must]: When a task declares expected_tests in spec.json, the spec schema shall accept the declaration as an optional array of strings.
- **REQ-2** [must]: When gate evaluates a task-impl or integration phase and the current task has expected_tests, it shall verify that each declared path exists in the diff or worktree before invoking the AI evaluation.
- **REQ-3** [must]: If a declared expected test file is missing from both the diff and the worktree, gate shall FAIL with a reason identifying the missing file path.
- **REQ-4** [must]: When expected_tests is undefined, null, or empty for the current task, gate shall skip the verification and proceed to the existing AI evaluation.
- **REQ-5** [should]: When expected_tests contains glob patterns, the check shall expand globs against the worktree and verify that at least one file matches each pattern.
- **REQ-6** [must]: The checkExpectedTests function shall be a pure mechanical check with no AI invocation, consistent with the existing checkTestChanges and checkMissingHeadTestEvidence patterns.

## Acceptance Criteria
- spec.schema.json validates a spec.json that includes tasks[].expected_tests as an optional string array
- gate-impl FAILs when expected_tests declares a file that does not exist in the diff or worktree
- gate-impl PASSes when all expected_tests files exist (given other checks also pass)
- gate-impl skips expected_tests verification when the field is absent or empty
- existing specs without expected_tests continue to work without changes

## Implementation Targets
- src/flow/schemas/spec.schema.json
- src/flow/lib/run-gate.js

## Open Questions
- (none)
