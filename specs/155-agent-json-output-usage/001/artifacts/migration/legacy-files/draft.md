**開発種別:** 機能追加 (Enhancement)

**目的:** agent 呼び出しの JSON 出力を解析して usage（token 数・cache hit・cost）を計測できるようにする。prompt caching の効果観測のベースライン（Phase 0）。

---

## Q&A

**Q1: provider 判定方法**

- 採用: `agent.command` の部分一致判定
  - `"claude"` を含む → claude
  - `"claude"` は含まないが `"codex"` を含む → codex
  - どちらも含まない → unknown
- 完全一致ではなく部分一致を採用した理由: 将来的なコマンド名変更（例: `claude/opus` 等）に対応するため。

**Q2/Q3: JSON 出力の有効化 / config フィールド名**

- agent config に `jsonOutputFlag` フィールドを追加（`systemPromptFlag` と同パターン）
- 設定あり → そのフラグを args に追加して JSON モードで実行 → usage 解析
- 設定なし → plain text モード（現状と同じ動作）
- 既存ユーザーへの影響: ゼロ（未設定はすべて plain text fallback）

**Q4: unknown provider の扱い**

- `jsonOutputFlag` が設定されていても provider が unknown の場合は plain text として扱う
- サポート対象を明示することで予期しない挙動を防ぐ

---

## 要件まとめ

**スコープ**: `src/lib/agent.js` の内部実装のみ。呼び出し側 12 箇所は変更なし（Phase 0）。

**config の変更**:
- `agent.providers.<key>` に任意フィールド `jsonOutputFlag` を追加可能
  - 例（claude）: `"jsonOutputFlag": "--output-format json"`
  - 例（codex）: `"jsonOutputFlag": "--json"`

**provider 判定**:
- `resolveAgent` が返す agent オブジェクトに `providerKey` を追加
- 判定: `agent.command` 部分一致（claude / codex / unknown）

**JSON パース**:
- `jsonOutputFlag` が設定されている場合のみ有効
- provider に応じた形式で stdout を解析し、テキスト本文と usage 情報を取り出す
  - claude / codex: それぞれの JSON 形式に対応したパース
  - unknown: `jsonOutputFlag` が設定されていても plain text として扱う
  - パース失敗時: plain text fallback（エラーを伝播させない）
- usage は入力トークン数・出力トークン数・cache hit・cost（provider によって取得可能な項目が異なる）を統一形式で記録する

**戻り値**:
- すべての呼び出し元への戻り値は `text`（trimmed string）のまま変更なし

**ログ**:
- `buildAgentLogPayload` に `usage` フィールドを追加
- `jsonOutputFlag` 未設定または unknown の場合は `usage: null`
- 保存先: 既存の `.tmp/logs/prompts.jsonl`（パス変更なし）

**テスト観点**:
- JSON パース（claude 形式 / codex 形式 / unknown / パース失敗）の各ケース
- provider 判定（部分一致）の各ケース
- ログ payload への usage 記録の確認

---

## 既存機能への影響

- 呼び出し側 12 箇所: 変更なし（戻り値の型が変わらないため）
- `jsonOutputFlag` 未設定: plain text fallback で現状と完全に同じ動作
- config スキーマ: 任意フィールドの追加のみ（後方互換）

---

## Open Questions

なし

---

- [x] User approved this draft
