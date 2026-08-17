# Feature Specification: 104-remove-chapter-classification-from-enrich-and-re

**Feature Branch**: `feature/104-remove-chapter-classification-from-enrich-and-re`
**Created**: 2026-03-30
**Status**: Draft
**Input**: GitHub Issue #33

## Goal
enrich の chapter 割り当て精度を改善する。AI が章名だけで推測していた割り当てを、(1) テンプレートの `{{data}}` 参照から静的に確定する第1段階と、(2) 章の説明（desc）付きプロンプトで AI が割り当てる第2段階の2段階方式に変更する。併せて chapters の設定形式をオブジェクト配列に変更し、章の説明と除外を設定可能にする。

## Scope
- `preset.json` と `config.json` の `chapters` 形式をオブジェクト配列に変更
- `enrich.js` に静的 chapter 割り当て（`{{data}}` カテゴリベース）を追加
- `enrich.js` の AI プロンプトに章の説明（desc）を追加
- テンプレートから `{{data}}` 参照カテゴリを抽出する共通ユーティリティ作成
- 全プリセットの `preset.json` を新形式に移行し、各章に desc を設定
- `types.js` のバリデーション更新

## Out of Scope
- `getEnrichedContext()` の廃止 — chapter フィルタは維持
- `detectChangedChapters()` の変更 — chapter フィールドは残る
- deep/light モードの変更
- enrich の summary/detail 生成ロジックの変更
- 構造情報の機械的抽出（ボード 5513）

## Clarifications (Q&A)
- Q: chapter フィルタを廃止して全エントリを渡す方式ではだめか？
  - A: ボード dffe の検証で enriched context が text 品質に必須と判明。chapter フィルタなしで全エントリを渡すとコンテキストが巨大になる。フィルタは維持し、割り当て精度を改善する方が費用対効果が高い。
- Q: `{{data}}` がない章（node-cli の overview 等）はどうなるか？
  - A: 静的割り当てでカバーできない。第2段階の AI 割り当て（desc 付き）で対応する。
- Q: 1エントリが複数章に割り当てられるケースは？
  - A: 1エントリ1章を維持。静的で決まればそれ、決まらなければ AI が1つ選ぶ。
- Q: chapters の順序はどう決まるか？
  - A: preset.json の配列順。config.json は desc/exclude の上書きのみ。config にあって preset にない章は末尾追加。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-31
- Notes: ドラフト Q&A 後、ユーザー承認済み

## Requirements

優先順位の根拠: R1→R2→R3 はデータ形式の基盤。R4→R5 は静的割り当ての実装（R1-R3 の新形式に依存）。R6 は AI プロンプト改善（R4 の結果を前提）。R7 は全プリセットへの適用（全要件の実装完了後）。

### R1: chapters 形式の変更（優先度: 1）
- `preset.json` の `chapters` を文字列配列からオブジェクト配列に変更する
- 各要素の形式: `{ "chapter": "name.md", "desc": "章の説明", "exclude": false }`
  - `chapter` は必須（ファイル名）
  - `desc` は省略可（章の説明。enrich の AI プロンプトで使用）
  - `exclude` は省略可（true で章を除外）
- `config.json` の `chapters` も同じオブジェクト形式を受け付ける
  - config.json は差分上書き。全章の列挙は不要
  - desc のみ上書き、exclude のみ指定、などが可能
- 章の順序解決ロジック:
  1. preset.json の chapters 配列順をベースとする
  2. config.json で `exclude: true` の章を除外する
  3. config.json にあって preset にない章を末尾に追加する
  4. config.json の desc は preset の desc を上書きする

### R2: chapters マージロジックの実装（優先度: 2）
- preset.json の chapters と config.json の chapters をマージする関数を実装する
- 既存の `resolveChaptersOrder()` を新形式に対応させる
- マージ結果は `[{ chapter: "name.md", desc: "..." }, ...]` 形式（exclude 済み、順序確定）

### R3: types.js バリデーション更新（優先度: 3）
- `config.json` の `chapters` がオブジェクト配列であることを検証する
- 各要素の `chapter` フィールドが文字列であることを検証する
- `desc` が文字列であること、`exclude` が真偽値であることを検証する
- バリデーション失敗時は `validateConfig()` が errors 配列にメッセージを追加する（既存の振る舞いと同じ）。コマンドはエラーを表示して停止する

### R4: enrich の静的 chapter 割り当て（優先度: 4）
- enrich が AI バッチを構築する前に、docs/ 内の全テンプレートファイルを読み、`{{data}}` ディレクティブの参照カテゴリを抽出する
- カテゴリ→章のマッピングを構築する（例: `{{data("base.modules.list")}}` が `overview.md` にある → modules カテゴリのエントリは overview 章）
- analysis.json の各エントリについて、そのカテゴリがマッピングに存在する場合、chapter フィールドを静的に設定する
- enrich が AI バッチを構築する際、静的に chapter が設定済みのエントリは AI プロンプトの「chapter を割り当てよ」の対象リストから除外する。ただし summary/detail の生成対象には含める（AI は chapter 以外のフィールドを生成する）

### R5: `{{data}}` カテゴリ抽出の共通化（優先度: 5）
- テンプレートファイルから `{{data}}` ディレクティブの参照カテゴリを抽出する関数を共通ユーティリティとして作成する
- `directive-parser.js` の `parseDirectives()` を利用し、data ディレクティブの `preset.source.method` からカテゴリ（source 名）を取得する
- enrich コマンド実行時（R4）にこの関数を呼び、カテゴリ→章マッピングを構築する
- text コマンドの `main()` 関数内で、ファイル処理ループに入る前にこの共通関数を呼んでカテゴリマッピングを構築する。構築したマッピングを `getAnalysisContext()` に渡し、`CATEGORY_TO_SECTIONS` のハードコードされたマッピングを置き換える。docs/ ディレクトリが存在しない、またはテンプレートファイルが0件の場合は空のマッピングを使用し、`getAnalysisContext()` は従来通り summary データのみを返す

### R6: enrich の AI プロンプト改善（優先度: 6）
- AI に章を割り当てさせるプロンプトに、章名に加えて desc を含める
- 形式例: `- overview: Project overview, architecture diagram, key concepts`
- desc がない章は章名のみ（現状と同じ）
- AI の chapter 割り当てレスポンスが JSON パース不正の場合、既存の enrich エラーハンドリング（`parseEnrichResponse` + `fixUnescapedQuotes`）で処理される。AI レスポンスのマージ時（`mergeEnrichment()`）に chapter フィールドが利用可能な章名に含まれない値の場合、chapter を null に設定し、警告をログ出力する（例: `[enrich] WARN: invalid chapter "xxx" for entry N, skipped`）。そのエントリはどの章にも割り当てられない（text 生成時に getEnrichedContext のフィルタから漏れる）

### R7: upgrade コマンドの旧形式 chapters 自動変換（優先度: 7）
- `sdd-forge upgrade` 実行時に `.sdd-forge/config.json` の `chapters` が旧形式（文字列配列）の場合、新形式（オブジェクト配列）に自動変換して書き戻す
- 変換ルール: `"overview.md"` → `{ "chapter": "overview.md" }`
- `sdd-forge upgrade` は既に設定ファイルを書き換えるコマンドとして設計されている（スキル・テンプレートの差分更新）ため、この変換に追加のユーザー確認は不要
- 変換後にログ出力する（例: `[upgrade] migrated chapters to new format (N entries)`）

### R8: 全プリセットの preset.json 移行（優先度: 8）
- 全プリセット（base, cli, node-cli, webapp, php-webapp, js-webapp, cakephp2, laravel, symfony, library, database, drizzle, edge, workers, storage, r2, api, rest, graphql, monorepo, ci）の `preset.json` を新形式に移行する
- 各章に適切な汎用 desc を設定する

## Acceptance Criteria
1. (R1,R2) preset.json のオブジェクト形式 chapters が正しくパースされ、章の順序が解決されること
2. (R1,R2) config.json の chapters で desc 上書きと exclude が機能すること
3. (R1,R2) config.json にない章は preset のデフォルトのまま動作すること
4. (R4) enrich 実行時に `{{data}}` 参照カテゴリのエントリが静的に正しい章に割り当てられること
5. (R6) 静的に割り当てられなかったエントリが AI によって desc 付きプロンプトで割り当てられること
6. (R7) 全プリセットの preset.json が新形式に移行され、各章に desc があること
7. 既存の text コマンド（getEnrichedContext, detectChangedChapters）が変更なしで動作すること
8. 既存テストがパスすること（新形式に合わせて更新されたテストを含む）

## Migration
- alpha 版ポリシーにより後方互換コードは書かない
- 全プリセットの preset.json の `chapters` を旧形式（文字列配列）から新形式（オブジェクト配列）に一括置換する
- `sdd-forge upgrade` を実行すると、プロジェクトの `.sdd-forge/config.json` に旧形式の chapters がある場合、自動的に新形式に変換する（`["overview.md"]` → `[{ "chapter": "overview.md" }]`）
- `sdd-forge upgrade` を実行せずに `sdd-forge build` 等のコマンドを実行した場合、`validateConfig()` がバリデーションエラーを報告し停止する。エラーメッセージ例: `'chapters' format has changed. Run 'sdd-forge upgrade' to migrate automatically.`

## Open Questions
- [x] preset.json の chapters 形式変更で既存テストへの影響範囲 → alpha 版ポリシーで後方互換不要。テストは新形式に合わせて更新
