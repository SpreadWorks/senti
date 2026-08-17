# Feature Specification: 172-rename-agent-command-ids

**Feature Branch**: `feature/172-rename-agent-command-ids`
**Created**: 2026-04-13
**Status**: Draft
**Input**: GitHub Issue #141

## Goal

エージェントプロファイルのコマンドID命名をフェーズ軸（`flow.spec`, `flow.impl`, `flow.test`, `flow.finalize`, `flow.context`）で体系化し、プレフィックスマッチ階層を一貫させる。

## Scope

以下のコマンドIDを変更する:

| 現在 | 変更後 |
|---|---|
| `context.search` | `flow.context.search` |
| `spec.gate` | `flow.spec.gate` |
| `flow.review.spec` | `flow.spec.review` |
| `flow.review.draft` | `flow.impl.review.draft` |
| `flow.review.final` | `flow.impl.review.final` |
| `flow.review.test` | `flow.test.review` |
| `flow.retro` | `flow.finalize.retro` |

変更対象ファイル:
- `src/flow/lib/get-context.js` — `context.search` → `flow.context.search`
- `src/flow/lib/run-gate.js` — `spec.gate` → `flow.spec.gate`（エラーメッセージ含む）
- `src/flow/commands/review.js` — `flow.review.*` → 各新ID
- `src/flow/lib/run-retro.js` — `flow.retro` → `flow.finalize.retro`（エラーメッセージ含む）
- `src/templates/config.example.json` — プロファイル例のキーを新IDに更新

## Out of Scope

- `docs.*` コマンドID（init, enrich, text, forge, readme, agents, translate）の変更
- `flow.commands.context.search.mode`（config 機能設定パス）の変更 — エージェントコマンドIDとは別レイヤー
- 旧コマンドIDの自動検出・警告・自動変換（alpha 版ポリシーにより後方互換コードは書かない）

## Clarifications (Q&A)

- Q: `flow.commands.context.search.mode` は変更するか？
  - A: スコープ外。config の機能設定パスであり、エージェントコマンドIDとは別レイヤー。

- Q: 旧コマンドIDへのマイグレーション対応は？
  - A: alpha 版ポリシーに従い即時廃止。旧IDが `agent.profiles` に残った場合は `defaultAgent` にフォールバックし、未設定ならエラー。CHANGELOG で告知のみ。

- Q: `flow.review` プレフィックスでの一括指定が壊れるが問題ないか？
  - A: 意図的な設計。フェーズ軸の体系化を優先。`flow` プレフィックスで全体一括指定は引き続き可能。

## Alternatives Considered

- **旧IDとの互換レイヤー追加**: `resolveProviderKeyFromProfile` にエイリアスマッピングを追加する案。alpha 版ポリシー（後方互換コードは書かない）に反するため不採用。
- **config パスも同時変更**: `flow.commands.context.search.mode` も合わせて変更する案。別レイヤーであり、破壊的変更を1 spec に bundleすることは Single Responsibility に反するため不採用。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-13
- Notes: Issue #141 の変更マッピング通りに実装を進める

## Requirements

1. **[P1] コマンドID文字列の変更**: `src/flow/lib/get-context.js`, `src/flow/lib/run-gate.js`, `src/flow/commands/review.js`, `src/flow/lib/run-retro.js` 内のコマンドID文字列を変更マッピング表の通りに更新する。エラーメッセージ内のコマンドIDも同様に更新する。
2. **[P1] config.example.json の更新**: `src/templates/config.example.json` のプロファイル例に含まれるコマンドIDキーを新IDに更新する。
3. **[P2] sdd-forge upgrade の実行**: テンプレート変更後に `sdd-forge upgrade` を正常終了で実行すること。`.claude/skills/` は gitignore 対象のため git diff には反映されない。本要件は実行完了をもって充足とし、diff での検証は不要。
4. **[P2] CHANGELOG への記載**: 旧→新コマンドIDの対応表と、以下のマイグレーション手順を CHANGELOG に記載する:
   - ユーザーは `.sdd-forge/config.json` の `agent.profiles.<name>` セクションを開く
   - 対応表に従い、旧キー名を新キー名に置換する（例: `"spec.gate": "claude/sonnet"` → `"flow.spec.gate": "claude/sonnet"`）
   - `flow.review` をプレフィックスとして一括指定していた場合は、`flow.spec.review`, `flow.impl.review.draft`, `flow.impl.review.final`, `flow.test.review` を個別に設定するか、`flow` プレフィックスで全体指定に変更する

## Acceptance Criteria

- 変更後のソースコードに旧コマンドID（`context.search`, `spec.gate`, `flow.review.spec`, `flow.review.draft`, `flow.review.final`, `flow.review.test`, `flow.retro`）が `loadAgentConfig` / `resolveAgent` の引数として残っていないこと
- 新コマンドID（`flow.context.search`, `flow.spec.gate`, `flow.spec.review`, `flow.impl.review.draft`, `flow.impl.review.final`, `flow.test.review`, `flow.finalize.retro`）が正しいファイルに配置されていること
- `config.example.json` のプロファイル例が新IDを使用していること
- 既存テスト（`npm test`）が全て通ること
- `sdd-forge upgrade` が正常終了すること（`.claude/skills/` は gitignore 対象のため diff には現れない）

## Test Strategy

- 既存テスト（`npm test`）の通過を確認する。文字列リネームのみでロジック変更がないため、新規テスト追加は行わない
- spec 固有テストとして、旧IDが残っていないこと・新IDが正しく配置されていることを grep で検証する

## Impact on Existing Features

- **CLI インターフェース**: 変更なし。`sdd-forge` のコマンド体系は影響を受けない
- **エージェントプロファイル**: `agent.profiles` に旧コマンドIDをキーとして設定しているユーザーは、新IDに手動更新が必要。未更新の場合は `defaultAgent` にフォールバックする
- **プレフィックスマッチ**: `flow.review` での一括指定は機能しなくなる。`flow` での全体一括指定は引き続き有効

## Open Questions

（なし — すべてドラフト Q&A で解決済み）
