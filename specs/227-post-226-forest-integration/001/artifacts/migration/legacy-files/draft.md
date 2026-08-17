# Draft: 227-post-226-forest-integration

**開発種別:** feature
**目的:** spec 226 で scaffolding のみ実装した forest task decomposition を完全統合する。既存 flow.json の migration、flat fallback 廃止、overview/forest 自動配線、E2E test 追加、forest dogfood 検証を行う。

## Requirements (priority order)

Priority は依存関係順: A が完了しないと B/C は動作確認不能。D は本 spec 全体に適用。

### P1: A. 既存資産の migration と strict 化
- R-A1: migration を実行したとき、全既存 flow state が tasks 非空状態に変換されること（dry-run + idempotent）
- R-A2: flow state の読み込み時に tasks が空の場合、エラーとして拒否されること
- R-A3: next-action 解決が tasks 非空を前提とし、tasks 空時の互換経路が存在しないこと
- R-A4: production path を経由しない旧テスト（reopen-draft 関連）が削除されること

### P2: B. scaffolding の完全統合
- R-B1: impl step が完了したとき、overview merge が自動実行されること
- R-B2: next-action が target を解決するとき、forest 構造に基づいて task 順序を決定すること
- R-B3: spec 226 の placeholder tests を実テストに展開したとき、全件が PASS すること

### P3: C. E2E integration test
- R-C1: tasks 2 件の flow を CLI 経由のみで開始したとき、flow state の直接編集なしで全 step が遷移し完了すること

### P4: D. Forest dogfood（本 spec 全体に適用）
- R-D1: spec 段階でタスク構造を定義するとき、forest 形式（親 task = concern 境界、子 task = 作業単位）で分解すること

## Scope Verification
- In scope:
  - R-A1〜R-A4: 既存 flow state の migration、strict 化、fallback 廃止、旧テスト削除
  - R-B1〜R-B3: overview 自動配線、forest traversal 統合、placeholder テスト展開
  - R-C1: E2E integration test 新規追加
  - R-D1: 本 spec の forest dogfood
- Out of scope:
  - reopen-draft コマンド本体の削除（テスト削除のみ）
  - 旧 spec の機能改修
  - guardrail / prompt ���ンプレートの変更

## Impact on Existing Features
- 影響ありの既存機能:
  - flow state の読み込み: tasks 空を拒否に変更 → migration が先行必須
  - next-action 解決: 互換経路削除 → tasks 非空を前提
  - impl step の完了処理: overview merge を自動実行するよう拡張
  - next-action の target 解決: forest 構造を直接参照するよう拡張
  - テスト基盤: tasks 非空を保証するよう修正（strict 化に伴う既存テストの対応）

## Q&A
- Q1: スコープの分割方針は？
  - A: forest 構造で分解。親 task = concern 境界（A/B/C/D）、子 task = 各作業単位。D の dogfood 要件と一致する。根拠: Issue #257 の D 項に「自 spec を forest 構造で分解」と明記されている。
- Q2: Issue 記載の "scenario-reopen-flow.test.js" の削除対象は？
  - A: 該当ファイルはコードベースに存在しない。コード探索の結果、reopen-draft の unit test が削除対象。根拠: Issue の意図（production path を通さないテストの削除）と一致。
- Q3: Migration 戦略は？
  - A: spec 208 パターン（one-time script, dry-run, idempotent）に従う。tasks 定義がない旧 flow state はフロ��全体を 1 つの合成 task として格納。migration → strict ��� → fallback ��止の順序。根拠: 既存コードで spec 208 が同種 migration の前例。
- Q4: テスト��ルパーの対応は？
  - A: テストヘルパーを修正して tasks 非空を保証する。根拠: strict 化（R-A2）により tasks 空の flow state が loader でエラーになるため、既存テスト fixture の整合性維持に必須。

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-24
- Notes:
