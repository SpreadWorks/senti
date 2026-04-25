# Draft: 228-strict-gate-req-spec

**開発種別:** feature
**目的:** gate-impl の REQ-SPEC 評価に mechanical pre-check を追加し、spec で宣言されたテストファイルの存在を AI に依存せず機械的に検証する。

## Scope Verification
- In scope:
  - P1 [must]: When a task declares expected test files, the spec schema shall accept the declaration as a structured array field.
  - P2 [must]: When gate evaluates a task-impl or integration phase, it shall verify that each declared expected test file exists in the diff or worktree before invoking the AI evaluation.
  - P3 [must]: If a declared expected test file is missing, gate shall FAIL with a reason identifying the missing file path.
  - P4 [should]: When gate runs on task-impl or integration phase, it shall apply the expected test verification in both phases.
  - P5 [must]: If no expected tests are declared for the current task, gate shall skip the verification and proceed normally.
- Out of scope:
  - テストケースレベル（describe/it）の個別照合
  - テストランナー出力のパース
  - AI 評価プロンプトの変更

## Impact on Existing Features
- spec.json スキーマ: optional フィールド追加のみ。既存 spec.json は影響なし。
- diff-based gate 評価: 期待テスト未定義の場合はスキップするため既存フローは影響なし。
- spec.json の load/save: スキーマ変更のみ。ロード・保存ロジックの変更なし。

## Q&A
- Q1: アプローチ — mechanical pre-check vs AI プロンプト強化?
  - A1: Mechanical pre-check を採用。根拠: Issue #258 の根本原因は AI が集約テスト結果から甘判定すること。既存コードパターン（`checkTestChanges`, `checkMissingHeadTestEvidence` 等）も AI 前の mechanical check で構造的問題を排除する設計。
- Q2: テスト識別子の情報源は?
  - A2: spec.json に構造化フィールドを追加。根拠: 既存の `authorized_test_modifications` が同じパターン（spec.json の構造化配列 → gate が機械的に参照）で成功している。
- Q3: 検証粒度は?
  - A3: ファイル存在チェック。根拠: CLAUDE.md の「外部依存なし」方針。テストケースレベルの照合はテストフレームワーク固有のパーサーが必要で方針に反する。
- Q4: 適用フェーズとフィールド所属は?
  - A4: 両フェーズ適用、task レベルに所属。根拠: spec 226 で導入されたタスク分解が concern 分離を実現しており、テスト責任も task 単位で管理するのが整合する。
- Q5: 要件整理の承認
  - A5: 承認。

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-25
- Notes: 5問の Q&A で全て推奨案 (A/1) を採択
