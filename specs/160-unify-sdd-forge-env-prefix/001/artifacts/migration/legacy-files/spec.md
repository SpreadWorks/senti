# Feature Specification: 160-unify-sdd-forge-env-prefix

**Feature Branch**: `feature/160-unify-sdd-forge-env-prefix`
**Created**: 2026-04-08
**Status**: Draft
**Input**: Issue #118

## Goal

`SDD_SOURCE_ROOT` / `SDD_WORK_ROOT` 環境変数を `SDD_FORGE_SOURCE_ROOT` / `SDD_FORGE_WORK_ROOT` にリネームし、`SDD_FORGE_*` プレフィックスで全環境変数を統一する。

## Scope

- `src/lib/cli.js` — `process.env.SDD_WORK_ROOT` → `process.env.SDD_FORGE_WORK_ROOT`（コメント含む）
- `src/lib/cli.js` — `process.env.SDD_SOURCE_ROOT` → `process.env.SDD_FORGE_SOURCE_ROOT`（コメント含む）
- `src/docs/lib/command-context.js` — JSDoc コメント内の変数名参照を更新
- `src/presets/laravel/tests/e2e/integration.test.js` — `spawn` の `env` オプションを更新（2箇所）
- `src/presets/symfony/tests/e2e/integration.test.js` — `spawn` の `env` オプションを更新（2箇所）

## Out of Scope

- `SDD_FORGE_PROFILE`（既に正しいプレフィックスを持つため変更不要）
- JavaScript 定数名（`SDD_DIRECTIVE_RE`, `SDD_DIR_NAME` 等）— 環境変数ではないため変更しない
- `specs/` 以下の過去ドキュメント — 歴史的記録のため変更しない
- `src/AGENTS.md` の手動更新 — `sdd-forge build` による自動再生成に委ねる
- 旧変数名の検出・警告処理 — alpha ポリシーにより後方互換コード禁止

## Why This Approach

`SDD_FORGE_PROFILE`（spec 157 で追加）が `SDD_FORGE_` プレフィックスを採用しており、既存の `SDD_SOURCE_ROOT` / `SDD_WORK_ROOT` と命名が一致していない。機械的なリネームにより全 env var を `SDD_FORGE_*` に統一する。alpha 版ポリシーによりフォールバックコードは不要で、変更の複雑さは最小限。

## Clarifications (Q&A)

- Q: CLI コマンド・オプションへの影響はあるか？
  - A: なし。環境変数名のみの変更。
- Q: 旧変数名を使用し続けた場合の挙動は？
  - A: サイレント無視（フォールバックなし）。CHANGELOG に Breaking Change として記載する。

## Alternatives Considered

- 旧変数名を残してフォールバック: alpha ポリシーにより不採用。後方互換コードは書かない。
- 警告出力を追加: フォールバック処理と等価のため alpha ポリシーにより不採用。

## User Confirmation

- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-08
- Notes: gate PASS 後に autoApprove により承認

## Requirements

1. **R1** (P1): `src/lib/cli.js` の `repoRoot()` 関数において、`process.env.SDD_WORK_ROOT` の参照を `process.env.SDD_FORGE_WORK_ROOT` に変更すること。関連するコメントも合わせて更新すること。
2. **R2** (P1): `src/lib/cli.js` の `sourceRoot()` 関数において、`process.env.SDD_SOURCE_ROOT` の参照を `process.env.SDD_FORGE_SOURCE_ROOT` に変更すること。関連するコメントも合わせて更新すること。
3. **R3** (P2): `src/docs/lib/command-context.js` の JSDoc コメントにおける `SDD_WORK_ROOT` / `SDD_SOURCE_ROOT` の参照を新しい変数名に更新すること。
4. **R4** (P2): `src/presets/laravel/tests/e2e/integration.test.js` および `src/presets/symfony/tests/e2e/integration.test.js` において、`spawn` の `env` オプションに渡している `SDD_WORK_ROOT` / `SDD_SOURCE_ROOT` を `SDD_FORGE_WORK_ROOT` / `SDD_FORGE_SOURCE_ROOT` に変更すること。

## Acceptance Criteria

- [ ] `SDD_FORGE_WORK_ROOT` を設定した場合、`repoRoot()` がその値を返すこと
- [ ] `SDD_FORGE_SOURCE_ROOT` を設定した場合、`sourceRoot()` がその値を返すこと
- [ ] `SDD_WORK_ROOT`（旧名）を設定しても `repoRoot()` に影響しないこと（フォールバックなし）
- [ ] `src/` 内に `process.env.SDD_WORK_ROOT` / `process.env.SDD_SOURCE_ROOT` の参照が残っていないこと
- [ ] laravel / symfony e2e テストが新しい変数名で正常に動作すること

## Test Strategy

- `specs/160-unify-sdd-forge-env-prefix/tests/` に検証テストを配置
- `src/lib/cli.js` の `repoRoot()` / `sourceRoot()` を直接インポートし、環境変数を設定して戻り値を確認する unit test を作成
- テスト項目：
  - `SDD_FORGE_WORK_ROOT` 設定時に `repoRoot()` がその値を返す（happy path）
  - `SDD_FORGE_SOURCE_ROOT` 設定時に `sourceRoot()` がその値を返す（happy path）
  - 旧変数名（`SDD_WORK_ROOT`）を設定しても `repoRoot()` の戻り値に影響しないこと（フォールバックなしの確認）

## Open Questions

なし
