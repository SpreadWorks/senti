# Feature Specification: 121-migrate-guardrail-data-format-to-json

**Feature Branch**: `feature/121-migrate-guardrail-data-format-to-json`
**Created**: 2026-04-02
**Status**: Draft
**Input**: GitHub Issue #63

## Goal
guardrail の保存形式を Markdown (`guardrail.md`) から JSON (`guardrail.json`) に移行し、独自パーサーを `JSON.parse()` に置き換える。同時に内部の命名を `articles` から `guardrails` に統一する。

## Scope
- `src/lib/guardrail.js` の内部実装書き換え（パーサー廃止、JSON 読み込み）
- 全プリセットのテンプレートファイル変換（`guardrail.md` → `guardrail.json`、18 ファイル）
- プロジェクト側 `.sdd-forge/guardrail.md` → `.sdd-forge/guardrail.json` への対応
- `articles` → `guardrails` の全面リネーム（JSON キー、変数名、関数名）
- 未使用コードの削除
- 使い捨て変換スクリプトによる一括変換

## Out of Scope
- `flow get guardrail` の出力形式変更（別タスク b5cd）
- exemption 廃止（別タスク 0fa0）
- draft フェーズへの差し込み（別タスク 02df）
- guardrailCandidate → guardrail.json の自動追加パイプライン

## Clarifications (Q&A)
- Q: JSON の構造はフラット（`phase`, `scope`, `lint` がトップレベル）か、現行 Article 型に合わせて `meta` ネストにするか？
  - A: `meta` ネスト構造を維持する。`JSON.parse()` したらそのまま Article 型として使える形にする。変換レイヤー不要。
- Q: JSON のルートキー名は `articles` か `guardrails` か？
  - A: `guardrails`。内部コードの変数・関数・型名もすべて `articles` → `guardrails` にリネームする。
- Q: `id` フィールドの生成方法は？
  - A: title から kebab-case で自動生成する。変換スクリプトで付与する。
- Q: `lint` フィールドの格納形式は？
  - A: 文字列（`"/pattern/flags"`）で保持し、ロード時に `new RegExp()` に変換する。
- Q: マージ時の id 重複処理は？
  - A: 子が親を完全上書き。フィールド単位マージはしない。
- Q: `loadGuardrailTemplate()` と `serializeArticle()` は？
  - A: 未使用コードなので削除。
- Q: テンプレート変換の方法は？
  - A: 使い捨てスクリプトで一括変換。既存の md→json 変換コードがあれば参考にする。
- Q: `template-merger.js` への影響は？
  - A: なし。guardrail は template-merger を経由していない。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-02
- Notes: Gate PASS 後に承認

## Requirements

要件は実装順序に沿って番号付けされている。優先順位は R1 > R2 > R3 > R4 > R5 > R6 > R7 の順。R1〜R4 は必須（これがないと動作しない）、R5〜R7 はコード品質向上のための整理。

### R1: JSON フォーマット定義
guardrail.json のフォーマットを以下とする:
```json
{
  "guardrails": [
    {
      "id": "no-direct-sql",
      "title": "SQL直接実行の禁止",
      "body": "Markdownテキスト",
      "meta": {
        "phase": ["impl", "spec"],
        "scope": ["*.php"],
        "lint": "/\\bquery\\s*\\(/i"
      }
    }
  ]
}
```
- `id`: title から kebab-case で自動生成される安定した識別子
- `body`: Markdown テキストをそのまま格納
- `meta.phase`: 必須。デフォルト `["spec"]`
- `meta.scope`: 省略可。対象ファイルの glob パターン
- `meta.lint`: 省略可。文字列形式の正規表現（`"/pattern/flags"`）

### R2: プリセットテンプレート変換
R1 のフォーマットに従い、使い捨てスクリプトで既存の `guardrail.md` を `guardrail.json` に一括変換する:
- 対象: 全プリセット（9個 × en/ja = 18 ファイル）の `guardrail.md`
- `id` は title から kebab-case で自動生成
- 変換後、元の `guardrail.md` を削除する。変換スクリプトは `src/` に含めず npm パッケージに同梱しない（エンドユーザーは実行できない）。開発リポジトリ内で開発者が一度だけ手動実行し、結果を git commit する。git で追跡されるため復元可能
- プロジェクト側 `.sdd-forge/guardrail.md` も変換対象
- 変換スクリプトは既存の `parseGuardrailArticles()` を利用して md→オブジェクト変換を行い、JSON に書き出す

### R3: JSON 読み込み実装
R2 で JSON ファイルが揃った後、`src/lib/guardrail.js` の読み込みロジックを書き換える:
- `GUARDRAIL_FILENAME` を `"guardrail.json"` に変更
- `readWithFallback()` で JSON ファイルを読み、`JSON.parse()` でパース
- `meta.lint` が文字列の場合、`new RegExp()` に変換する
- `meta.phase` がない場合、デフォルト `["spec"]` を適用

### R4: id ベースマージ
R3 の読み込み変更に伴い、プリセットチェーンのマージを id ベースに変更する:
- プリセットチェーン順（base → 中間 → リーフ → `.sdd-forge/`）で guardrail を収集する
- 同じ `id` の guardrail が現れた場合、子が親を完全上書きする
- 新しい `id` の guardrail は配列に追加する
- 現行の title ベース重複排除を id ベースに変更する

### R5: 不要コード削除
R7 のテストが全てパスした後（R3 の JSON 読み込みが正常に動作している証拠）、旧 Markdown パーサー関連コードを削除する。削除後も R7 のテストが全てパスすることを確認する:
- `parseGuardrailArticles()`, `parseMetaValue()` — 独自パーサー
- `serializeArticle()` — 未使用の逆変換
- `loadGuardrailTemplate()` — 未使用のテンプレート読み込み
- `GUARDRAIL_OPEN_RE`, `GUARDRAIL_CLOSE_RE` — 正規表現定数
- `DEFAULT_META` 定数

### R6: articles → guardrails リネーム
R5 の削除後、`articles` → `guardrails` をコードベース全体に適用する:
- `src/lib/guardrail.js`: `loadMergedArticles` → `loadMergedGuardrails` 等、全変数・関数名
- `src/flow/get/guardrail.js`: 変数名と JSON 出力キー
- `src/flow/run/gate.js`: 変数名
- `src/lib/lint.js`: 変数名（存在する場合）
- リネーム後、guardrail 関連コードで `articles` という変数名が残っていないことを grep で確認する

### R7: テスト更新
R3, R6 の変更に追従し、guardrail 関連テストを更新する:
- テストフィクスチャを Markdown から JSON 形式に差し替える
- 関数名のリネームに合わせてインポートとアサーションを更新する
- テストの検証意図は変更しない
- 全テストがパスすることを確認する

### 破壊的変更
alpha 版ポリシーにより後方互換コードは不要。移行手順も不要。以下は破壊的変更としてリリースノートに記載する:
- `loadMergedArticles()` → `loadMergedGuardrails()`
- `parseGuardrailArticles()` → 削除
- `filterByPhase()` — 引数名のみ変更
- `serializeArticle()` → 削除
- `guardrail.md` → `guardrail.json`
- `.sdd-forge/guardrail.md` を持つプロジェクトは `guardrail.json` に手動変換が必要。alpha 版のためユーザー数は極めて限定的であり、移行ツールは提供しない。リリースノートに JSON フォーマット例を記載して対応する

## Acceptance Criteria
- `sdd-forge flow get guardrail <phase>` が JSON ファイルから正しく guardrail を読み込み、フェーズフィルタリングが動作する
- `sdd-forge flow run gate` が JSON 形式の guardrail で正常に動作する
- プリセットチェーンのマージが id ベースで正しく動作する（同 id は子で上書き、新 id は追加）
- `lint` フィールドの文字列→RegExp 変換が正しく動作する
- 全プリセットの `guardrail.md` が `guardrail.json` に置き換わっている
- `parseGuardrailArticles()`, `serializeArticle()`, `loadGuardrailTemplate()` が削除されている
- コード内に `articles` という名前の guardrail 関連変数が残っていない
- 既存テストが全てパスする

## Open Questions
- [x] 既存の md→json 変換コードの場所を特定し、参考にできるか確認する
  - 専用の変換コードは存在しない。`parseGuardrailArticles()` が md→オブジェクト変換を担っており、変換スクリプトでこれを利用して md→JSON 変換を行う。
