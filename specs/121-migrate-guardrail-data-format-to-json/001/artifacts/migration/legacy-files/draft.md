# Draft: Migrate guardrail data format to JSON

## Goal
guardrail の保存形式を Markdown (`guardrail.md`) から JSON (`guardrail.json`) に移行し、独自パーサーを廃止する。

## Decisions

### JSON フォーマット
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

- JSON キーは `guardrails`（`articles` ではない）
- 内部コードの変数・関数・型名もすべて `articles` → `guardrails` にリネーム
- `id` は title から kebab-case で自動生成（変換スクリプトで付与）
- `meta` 構造は現在の Article 型と一致させる（フラット化しない）
- `lint` は文字列で保持、ロード時に `new RegExp()` に変換
- `scope`, `lint` は省略可

### マージルール
- プリセットチェーン: base → 中間 → リーフ → `.sdd-forge/` の順に適用
- 同じ `id` → 子が完全上書き
- 新しい `id` → 追加

### 言語
- プリセット側は英語で記述
- プロジェクト側（`.sdd-forge/guardrail.json`）は任意の言語
- 言語フィールドは設けない

### 変換方法
- 使い捨てスクリプトで全プリセット（18ファイル）を一括変換
- 既存の md→json 変換コードがあれば参考にする

### 不要コードの整理
- `parseGuardrailArticles()` — 独自パーサー廃止
- `serializeArticle()` — 未使用、削除
- `loadGuardrailTemplate()` — 未使用、削除
- `GUARDRAIL_OPEN_RE`, `GUARDRAIL_CLOSE_RE` — 正規表現定数削除
- `parseMetaValue()` — 独自メタデータパーサー削除
- 既存の md→json 変換に使われていたコードも不要なら削除

### インターフェース
- `loadMergedArticles()` の戻り値（Article 型）は維持
- 呼び出し側（gate.js, lint.js, flow/get/guardrail.js）は変更不要
- 関数名は `loadMergedGuardrails()` 等にリネーム

### template-merger.js
- 影響なし（guardrail は template-merger を経由していない）

## Scope
- guardrail の JSON 移行と不要コード整理のみ
- 出力形式整備（b5cd）、exemption 廃止（0fa0）、draft 差し込み（02df）は別 spec

## Impact on existing
- `guardrail.js` の内部実装を全面的に書き換え
- 呼び出し側は変数名リネーム（articles → guardrails）のみ
- 全プリセットのテンプレートファイルを md → json に置換
- プロジェクト側 `.sdd-forge/guardrail.md` を持つユーザーは手動対応（alpha、changelog で告知）

- [x] User approved this draft (2026-04-02)
