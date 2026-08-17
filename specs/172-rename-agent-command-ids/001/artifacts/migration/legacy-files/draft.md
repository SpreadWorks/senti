# Draft: エージェントコマンドIDの体系化リネーム

**開発種別:** リファクタリング（命名体系の変更）
**目的:** エージェントプロファイルのコマンドID命名をフェーズ軸で体系化し、プレフィックスマッチ階層を一貫させる

## 背景

現在のコマンドIDは命名が混在している（`context.search`, `spec.gate`, `flow.review.*`, `flow.retro`）。
フェーズ軸（`flow.spec`, `flow.impl`, `flow.test`, `flow.finalize`, `flow.context`）で体系化することで、
プレフィックスマッチによるグループ指定が論理的に整合する。

## Q&A

### Q1: `flow.commands.context.search.mode` は変更するか？
**A:** スコープ外。これは config の機能設定パス（`config.flow.commands.context.search.mode`）であり、エージェントコマンドID（`agent.profiles.<name>.<commandId>`）とは別レイヤー。

### Q2: 既存ユーザーの config に残る旧コマンドIDへのマイグレーション対応は？
**A:** alpha 版ポリシーに従い、旧IDは即時廃止。マイグレーション対応なし。CHANGELOG で告知のみ。
旧IDが `agent.profiles` に残った場合の動作: `resolveProviderKeyFromProfile` のプレフィックスマッチで一致しなくなり、`defaultAgent` にフォールバックする。`defaultAgent` も未設定なら `null` が返り、呼び出し元でエラーが throw される。つまり旧IDは無視されるだけで、デフォルトエージェントが設定されていれば動作は継続する。

**CLI インターフェースへの影響:** なし。`sdd-forge` のコマンド体系（`sdd-forge flow run`, `sdd-forge docs build` 等）は変更されない。変更はエージェントプロファイル内部のコマンドID文字列のみであり、ユーザーが CLI から直接指定する値ではない。影響を受けるのは `.sdd-forge/config.json` の `agent.profiles.<name>` セクションに旧コマンドIDをキーとして設定しているユーザーのみ。

**マイグレーション計画（alpha 版ポリシー準拠）:**
1. CHANGELOG に旧→新IDの対応表と、`agent.profiles` 内のキーを手動で更新する手順を記載する
2. `config.example.json` を新IDで更新し、`sdd-forge setup` で生成される新規 config が正しいIDを使用するようにする
3. alpha 版ポリシーにより、旧IDの自動検出・警告・自動変換は実装しない（後方互換コードは書かない）

### Q3: プレフィックスマッチの互換性（`flow.review` での一括指定が壊れる）は？
**A:** 意図的な設計。フェーズ軸の体系化を優先する。`flow` プレフィックスで全体一括指定は引き続き可能。

### Q4: テスト方針は？
**A:** 既存テスト（`npm test`）通過を確認。spec 固有テストは grep による旧→新ID反映の検証のみ。新規テスト追加なし。

## 変更マッピング

| 現在 | 変更後 |
|---|---|
| `context.search` | `flow.context.search` |
| `spec.gate` | `flow.spec.gate` |
| `flow.review.spec` | `flow.spec.review` |
| `flow.review.draft` | `flow.impl.review.draft` |
| `flow.review.final` | `flow.impl.review.final` |
| `flow.review.test` | `flow.test.review` |
| `flow.retro` | `flow.finalize.retro` |

`docs.*`（init, enrich, text, forge, readme, agents, translate）は変更なし。

## 変更対象ファイル

- `src/flow/lib/get-context.js` — `context.search` → `flow.context.search`
- `src/flow/lib/run-gate.js` — `spec.gate` → `flow.spec.gate`
- `src/flow/commands/review.js` — `flow.review.*` → 各新ID
- `src/flow/lib/run-retro.js` — `flow.retro` → `flow.finalize.retro`
- `src/templates/config.example.json` — プロファイル例の更新

## 関連する影響

- `src/templates/config.example.json` を変更するため、実装後に `sdd-forge upgrade` の実行が必要（CLAUDE.md のテンプレート変更ルールに準拠）

## スコープ外

- `flow.commands.context.search.mode`（config 機能設定パス）の変更
- 旧コマンドIDのマイグレーション/互換性対応
- `docs.*` コマンドIDの変更

- [x] User approved this draft
  - 承認日: 2026-04-13
