# spec 209 Tests

spec 209（draft.md skeleton + gate 強化）の検証テスト。

## 配置

- **formal test**: `tests/unit/flow/check-draft-text.test.js`
  - `checkDraftText()` は public export の検証関数。将来の変更で壊れたら常にバグ（仕様変更を除く）なので `tests/` 配下に置く

## 内容

- `valid draft` — enum 7 値すべてで pass、`**Development Type:**` 英語ラベル許容
- `section requirements (REQ-2)` — `## Scope Verification` / `## Impact on Existing Features` 欠落で FAIL
- `enum validation (REQ-3)` — enum 外 / 大文字 / 空値で FAIL
- `existing checks regression (REQ-6)` — Q&A / 承認 / 目的 / 開発種別ラベルの既存検証が壊れていない

## 実行方法

```bash
node --test tests/unit/flow/check-draft-text.test.js
```

## 期待結果

- 実装前: 5 件失敗（REQ-2 の section 検証 2 件、REQ-3 の enum 検証 3 件）、13 件 pass
- 実装後: 全 18 件 pass
