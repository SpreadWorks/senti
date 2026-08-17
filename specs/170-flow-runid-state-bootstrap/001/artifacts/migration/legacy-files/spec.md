# Feature Specification: 170-flow-runid-state-bootstrap

**Feature Branch**: `feature/170-flow-runid-state-bootstrap`
**Created**: 2026-04-13
**Status**: Draft
**Input**: User request

## Goal

一時ファイル運用を `/tmp` 固定から `agent.workDir` 解決ベースへ統一し、
指示プロンプト（skill共有パーツ）と CLI 実装の整合を確保する。

## Scope

- CLI に `agent.workDir` 解決ヘルパーを追加する。
- 解決優先順位を `SDD_FORGE_WORK_DIR`（環境変数） > `config.agent.workDir` > `.tmp`（フォールバック）に統一する。
- flow 系 skill の共有パーツに「`/tmp` 直書き回避・解決済み workDir 利用」ルールを明記する。
- 長時間コマンドのログ保存先を、解決済み workDir 配下に統一する。

## Out of Scope

- `agent.workDir` 以外の config キー設計変更。
- 一時ファイル以外の永続データ保存先設計変更。
- flow の runId / `.active-flow.<runId>` 仕様変更（別specで対応）。

## Clarifications (Q&A)

- Q: 今回の対象テーマは何か？
  - A: 一時ファイル運用の統一（`/tmp` 固定回避）を対象とする。
- Q: 適用範囲はどこまでか？
  - A: skill共有パーツへの指示追加と、CLI の `agent.workDir` 解決ヘルパー実装を含める。
- Q: 解決優先順位はどうするか？
  - A: `SDD_FORGE_WORK_DIR` > `config.agent.workDir` > `.tmp`。

## Alternatives Considered

- `.tmp` 固定に統一する案
  - 不採用理由: プロジェクト設定（`agent.workDir`）による運用柔軟性を失うため。
- skill 文言のみ修正し、CLI 実装は変更しない案
  - 不採用理由: 実装と指示の不一致が再発するため。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-13
- Notes: approved by user in flow-plan approval step.

## Requirements

- R1. CLI は一時作業ディレクトリ解決ヘルパーを提供し、`SDD_FORGE_WORK_DIR`、`config.agent.workDir`、`.tmp` の順で解決すること。
- R2. R1 の解決結果は既存の一時ログ保存処理で再利用され、`/tmp` 直書きを新規追加しないこと。
- R3. flow 系 skill の共有パーツに「`/tmp` 直書き回避」「解決済み workDir を利用」のルールを明記すること。
- R4. `config.agent.workDir` 未設定時でも `.tmp` へのフォールバックにより既存運用を維持すること。
- R5. 解決ロジック（env/config/fallback）に対する単体テストを追加し、優先順位を固定すること。

## Acceptance Criteria

- AC1. `SDD_FORGE_WORK_DIR=/x` 設定時、CLI が `/x` を一時ディレクトリとして選択する。
- AC2. `SDD_FORGE_WORK_DIR` 未設定かつ `config.agent.workDir` 設定時、当該設定値が選択される。
- AC3. 両方未設定時、`.tmp` が選択される。
- AC4. skill 共有パーツに `/tmp` 直書きを避ける明示ルールが存在する。
- AC5. 既存の flow コマンド実行で後方互換（未設定時 `.tmp`）が維持される。

## Open Questions

- [x] 既存テストで `/tmp` 文字列前提がある場合は、今回変更対象に直接関係するテストのみ最小修正し、無関係テストは別specで整理する。
