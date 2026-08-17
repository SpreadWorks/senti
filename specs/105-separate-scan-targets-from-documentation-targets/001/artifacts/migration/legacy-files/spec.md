# Feature Specification: 105-separate-scan-targets-from-documentation-targets

**Feature Branch**: `feature/105-separate-scan-targets-from-documentation-targets`
**Created**: 2026-03-31
**Status**: Draft
**Input**: GitHub Issue #35

## Goal
scan 対象とドキュメント対象を分離する。config.json に `docs.exclude` パターンを導入し、analysis.json には含まれるが enrich のドキュメント生成対象からは除外するファイルパターンを設定可能にする。これによりプリセットの内部実装やテストフィクスチャがドキュメントに混入する問題を解消する。

## Scope
- config.json の `docs` オブジェクト内に `exclude` フィールドを追加
- `enrich.js` でエントリ収集後に `docs.exclude` パターンでフィルタ
- `types.js` のバリデーション更新
- `globToRegex`（既存の `scanner.js` にある）を共有ユーティリティに移動し、enrich から利用可能にする

## Out of Scope
- `scan.include/exclude` の変更
- `getEnrichedContext()` の変更 — chapter がないエントリは既に無視される
- `detectChangedChapters()` の変更 — chapter がないエントリは既に無視される
- `text.js` の変更 — enrich でフィルタするだけで十分
- AI が正しい情報を持っていても書かない問題 — 別 issue
- 日本語版が空の問題 — translate ステップの別原因

## Clarifications (Q&A)
- Q: docs.exclude にマッチしたエントリは analysis.json から削除されるか？
  - A: 削除しない。analysis.json には残る。enrich に渡されないだけ。
- Q: 既に enrich 済みのエントリに後から docs.exclude を設定した場合は？
  - A: 既存の summary/detail/chapter は analysis.json に残る。次回 enrich 実行時に除外エントリはスキップされるが、既存データは消さない。
- Q: glob マッチングに外部依存は必要か？
  - A: 不要。`scanner.js` に既存の `globToRegex()` がある。これを共有ユーティリティに移動して使用する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-31
- Notes: 議論済みの設計をそのまま spec 化。ユーザー承認済み

## Requirements

優先順位の根拠: R1 は設定フィールドの追加。R2 は R1 のバリデーション。R3 は glob ユーティリティの共有化（R4 の前提）。R4 は R1/R3 を使った enrich のフィルタ実装。

### R1: config.json に docs.exclude フィールドを追加（優先度: 1）
- `config.json` の `docs` オブジェクト内に `exclude` フィールド（文字列配列）を追加する
- 各要素は glob パターン（例: `src/presets/*/tests/**`）
- 省略可。省略時はフィルタなし（全エントリが enrich 対象）

### R2: types.js のバリデーション更新（優先度: 2）
- `docs.exclude` が存在する場合、配列であることを検証する
- 各要素が文字列であることを検証する
- バリデーション失敗時は `validateConfig()` が errors 配列にメッセージを追加する

### R3: globToRegex の共有化（優先度: 3）
- R4 で enrich.js が glob パターンマッチングを行うために、`scanner.js` にある `globToRegex()` を enrich.js から import 可能にする
- `scanner.js` が既に `globToRegex()` を export していない場合、export を追加する
- scanner.js 内の既存利用箇所に影響がないことを確認する

### R4: enrich.js でのフィルタ適用（優先度: 4）
- enrich コマンドが `collectEntries()` で全エントリを収集した後、`docs.exclude` の各パターンを `globToRegex()` で正規表現に変換し、`entry.file` にマッチするエントリを除外する
- 除外されたエントリは AI バッチに含めない
- 除外されたエントリは analysis.json には残る
- 除外したエントリ数をログに出力する（例: `[enrich] excluded 45 entries by docs.exclude`）

## Acceptance Criteria
1. `docs.exclude` に `["src/presets/*/tests/**"]` を設定した場合、該当エントリが enrich のバッチに含まれないこと
2. 除外されたエントリが analysis.json に残っていること
3. `docs.exclude` を設定しない場合、従来と同じ動作をすること
4. `docs.exclude` のバリデーションが正しく動作すること
5. 既存テストがパスすること

## Migration
- 新規フィールドの追加のみで破壊的変更なし。既存の config.json はそのまま動作する。

## Open Questions
- [x] `globToRegex` の移動先 → scanner.js から export するのが最小変更。enrich.js が scanner.js を import する形。
