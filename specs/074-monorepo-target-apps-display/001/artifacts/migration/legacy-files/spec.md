# Feature Specification: Monorepo Target Apps Display

**Feature Branch**: `feature/074-monorepo-target-apps-display`
**Created**: 2026-03-19
**Status**: Draft
**Input**: I2: モノレポでの対象アプリケーション表示 — 各章ヘッダーに対象アプリを明示する機能

## Goal

モノレポプロジェクトにおいて、各ドキュメント章がどのアプリケーションに関するものかを明示する仕組みを提供する。これにより、複数アプリを含むリポジトリのドキュメントの可読性を向上させる。

## Scope

### 1. `architecture/monorepo` プリセットの新設

- `src/presets/architecture/preset.json` — 共有層（parent: base）
- `src/presets/monorepo/preset.json` — monorepo プリセット（parent: architecture）
- `src/presets/monorepo/data/monorepo.js` — MonorepoSource DataSource

### 2. type 配列対応

- `config.json` の `type` フィールドが文字列または文字列配列を受け付ける
- 配列の場合、各要素の DataSource を追加ロードする
- resolver-factory のロード順: base → arch chain → 追加 type（配列の 2 番目以降）
- `validateConfig()` を配列対応に更新
- `resolveType()` は配列の各要素を個別に解決

### 3. MonorepoSource DataSource

- `monorepo.apps()` — 章に関連するアプリ一覧をバッジ風テキストで出力（`> 対象: Frontend, Backend CMS`）
- アプリ情報の取得元:
  1. `config.json` の `monorepo.apps` 定義（優先）
  2. enriched analysis の file パスから AI が推定（enrich 時に `app` フィールドを付与）
- config 定義例: `"monorepo": { "apps": [{ "name": "Frontend", "path": "apps/frontend" }, { "name": "Backend CMS", "path": "apps/backend" }] }`
- `monorepo.outline()` — README 向けアプリ一覧概要（将来拡張用、本 spec ではスコープ外）

### 4. `[ignoreError=true]` optional directive パラメータ

- `{{data}}` と `{{text}}` の両方で `[ignoreError=true]` パラメータをサポート
- DataSource が見つからない、または null を返した場合に警告を出さず空文字で解決
- directive-parser の `parseDirectives()` で data ディレクティブのパラメータ解析を追加
- `resolveDataDirectives()` で ignoreError 判定を追加
- review.js の UNRESOLVED チェックで ignoreError を考慮

### 5. enrich 時の app フィールド付与

- `buildEnrichPrompt()` に monorepo config のアプリ定義を渡す
- AI が各エントリの file パスからアプリを推定し、`app` フィールドを付与
- config に `monorepo.apps` がない場合はスキップ（既存動作に影響なし）

### 6. テンプレート更新

- base の各章テンプレートに `{{data[ignoreError=true]: monorepo.apps("...")}}` を追加
- `## Description` の直前（章タイトル直後）に配置
- monorepo でないプロジェクトでは空になり、表示に影響なし

## Out of Scope

- `monorepo.outline()` の実装（README 向けアプリ概要）
- monorepo 固有の章テンプレート
- monorepo 固有の guardrail 記事
- polyrepo プリセットの作成
- scan 時のワークスペース自動検出（package.json workspaces, composer.json 等）
- monorepo 固有の enrich プロンプト最適化

## Approach Rationale

- **preset として作る理由**: type 配列で指定可能にし、将来 guardrail テンプレートや章テンプレートを追加できる拡張性を確保。guardrail 拡張構想（`.tmp/guardrail-expansion.md`）とも整合する
- **共通 DataSource にしない理由**: type で指定できなくなる。preset 化すれば data/, templates/, guardrail を一箇所にまとめられる
- **`[ignoreError=true]` を採用する理由**: 既存の `[key=value]` パラメータ構文と一貫。`!` プレフィックスのような新記法を避けられる
- **AI 検出 + config 定義の理由**: package.json workspaces 等の言語固有検出を避け、汎用的に対応

## Clarifications (Q&A)

- Q: type のパス形式（`webapp/laravel`）は使われているか？
  - A: 廃止済み。leaf 名のみ指定（`"type": "hono"`）。parent チェーンで解決
- Q: monorepo はプリセットツリーのどこに配置するか？
  - A: `architecture` 共有層の下。`base → architecture → monorepo`
- Q: optional directive の記法は？
  - A: `{{data[ignoreError=true]: ...}}`。既存の `[key=value]` パラメータ構文と統一
- Q: 表示形式は？
  - A: バッジ風テキスト `> 対象: Frontend, Backend CMS`。パスは含めない
- Q: guardrail 拡張との関係は？
  - A: preset として作ることで guardrail テンプレートも将来追加可能。同じ仕組みで `frontend-design` 等も追加できる

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-19
- Notes: ドラフト議論で全論点を解決済み

## Requirements

1. プリセットディレクトリとして `src/presets/architecture/preset.json`（parent: base）と `src/presets/monorepo/preset.json`（parent: architecture）を新規作成し、`sdd-forge presets list` で表示されること
2. `src/presets/monorepo/data/monorepo.js` に MonorepoSource DataSource を実装し、`type` 配列に `"monorepo"` が含まれる場合に resolver-factory が `monorepo` DataSource として解決できること
3. `monorepo.apps()` が章に関連するアプリをバッジ風テキストで返す。判定アルゴリズム: config.json の `monorepo.apps` 定義があればそれを優先し、なければ enriched analysis の各エントリの `app` フィールドと章の `chapter` フィールドを照合して、その章に属するエントリの `app` 値をユニーク収集する。どちらも存在しない場合は null を返す
4. `config.json` の `type` フィールドに文字列配列が渡された場合、`validateConfig()` がエラーなく受け付けること。文字列の場合は既存動作を維持する
5. `type` が配列の場合、`resolver-factory.js` が最初の要素の parent チェーンに加え、2 番目以降の要素の DataSource も追加ロードすること
6. `{{data[ignoreError=true]: ...}}` のようにパラメータ付き data ディレクティブが記述された場合、`directive-parser.js` がパラメータを解析して `params` オブジェクトに格納すること
7. `resolveDataDirectives()` が `ignoreError=true` パラメータを持つディレクティブを処理する際、DataSource が見つからないか null を返した場合に警告せず空文字で解決すること
8. `sdd-forge review` 実行時、`ignoreError=true` パラメータ付きディレクティブが未解決であっても FAIL としてカウントしないこと
9. `config.json` に `monorepo.apps` 定義がある場合、`buildEnrichPrompt()` がアプリ定義を AI プロンプトに含め、各エントリに `app` フィールドの付与を指示すること。定義がない場合はスキップする
10. base プリセットの各章テンプレートに `{{data[ignoreError=true]: monorepo.apps("...")}}` を章タイトル直後に追加し、monorepo 非使用時は空になり表示に影響しないこと

## Acceptance Criteria

- [ ] `type: ["hono", "monorepo"]` で config バリデーションが PASS する
- [ ] monorepo プリセットの DataSource が resolver で解決される
- [ ] `monorepo.apps()` が config 定義からバッジ風テキストを返す
- [ ] `monorepo.apps()` が enriched analysis の app フィールドからバッジ風テキストを返す
- [ ] `[ignoreError=true]` 付きディレクティブが未解決時に空文字になり警告が出ない
- [ ] monorepo 非使用プロジェクトで既存動作に影響がない
- [ ] `sdd-forge review` が ignoreError ディレクティブを FAIL にしない
- [ ] enrich で monorepo config がある場合、各エントリに app フィールドが付与される

## Exemptions

- **単一責任**: `[ignoreError=true]` ディレクティブ拡張は monorepo.apps() を非 monorepo プロジェクトで安全に使うための前提機能であり、monorepo 表示機能と不可分。分割すると monorepo テンプレートの動作確認ができない。

## Open Questions

- (なし — ドラフト議論で全て解決済み)
