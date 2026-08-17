# Feature Specification: 159-check-config-command

**Feature Branch**: `feature/159-check-config-command`
**Created**: 2026-04-08
**Status**: Approved
**Input**: GitHub Issue #115

## Goal

`sdd-forge check config` コマンドを実装する。`.sdd-forge/config.json` の妥当性を3段階（JSONパース → スキーマ検証 → preset存在確認）で診断し、問題を明確なエラーメッセージで報告する。

## Scope

- `src/check.js` の `SCRIPTS` マップへの `config` エントリ追加
- `src/check/commands/config.js` の新規作成
- 出力フォーマット: `text`（デフォルト）、`json`
- 診断チェック:
  1. config.json の存在・JSONパース検証
  2. スキーマ検証（既存 `validateConfig()` を再利用）
  3. `type` フィールドのプリセット存在確認（既存 `PRESETS` を再利用）

## Out of Scope

- `analysis.json` の検証
- `flow.json` の検証
- エージェント設定（`agent.providers[].command`）の実行可能性チェック
- markdown (`--format md`) 出力

## Clarifications (Q&A)

- Q: `validateConfig()` がスキーマエラーで throw した場合、preset確認は行うか？
  - A: 行わない。JSONパース失敗またはスキーマエラーがあれば早期終了する。チェック順序を守る。
- Q: `type` に存在しないプリセット名があった場合の exit code は？
  - A: exit 1。スキーマが正しくても preset が存在しなければエラーとして扱う。
- Q: `--format json` の出力構造は？
  - A: `{ ok: bool, checks: [{ name, result, errors }] }` の形式。`ok` は全チェックがパスした場合のみ true。

## Test Strategy

- `specs/159-check-config-command/tests/` に検証テストを配置する（`npm test` の対象外）
- テストはコマンドの stdout/stderr/exit code を確認するシナリオテスト形式
- カバーするシナリオ:
  - 正常な config.json → exit 0、"config is valid" を含む出力
  - 存在しない config.json → exit 1、エラーメッセージ
  - 無効な JSON → exit 1、パースエラー
  - 必須フィールド欠損 → exit 1、フィールド名を含む出力
  - 存在しないプリセット名 → exit 1、プリセット名を含む出力
  - `--format json` → exit code に応じた JSON 出力、`ok` フィールドを含む

## Alternatives Considered

- `validateConfig()` にプリセット確認を組み込む → 却下。`types.js` はバリデーションライブラリであり、プリセット探索（`presets.js`）への依存を持つべきでない。関心の分離を維持する。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-08 (autoApprove)
- Notes: draft Q&A から反映

## Requirements

1. `sdd-forge check config` コマンドが実行できること
2. `config.json` が存在しない場合、エラーメッセージを stderr に出力して exit 1 すること
3. `config.json` が無効な JSON の場合、パースエラーを報告して exit 1 すること
4. スキーマ検証エラーがある場合、最大50件までエラーを列挙して exit 1 すること
5. `type` に指定されたプリセットが存在しない場合、該当プリセット名を報告して exit 1 すること
6. 全チェックがパスした場合、"config is valid" を表示して exit 0 すること
7. `--format json` オプションで JSON 形式の出力ができること
8. `-h` / `--help` でヘルプを表示すること

## Acceptance Criteria

- `sdd-forge check config` を正常な config に対して実行すると "config is valid" と表示され exit 0 となる
- `type: "nonexistent"` の config に対して実行すると "Preset not found: nonexistent" を含むエラーが出力され exit 1 となる
- `lang` フィールドを欠いた config に対して実行すると `'lang'` を含むエラーが出力され exit 1 となる
- `--format json` で実行すると JSON が stdout に出力され、`ok` フィールドが含まれる

## Open Questions

- なし
