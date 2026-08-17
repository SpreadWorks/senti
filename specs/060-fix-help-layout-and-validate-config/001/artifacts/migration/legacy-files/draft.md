# Draft: fix-help-layout-and-validate-config

## 決定事項

### 修正 A: help.js に flow サブコマンドを追加

- `src/help.js` LAYOUT に `flow review`, `flow merge`, `flow cleanup` を追加
- `src/locale/en/ui.json` と `src/locale/ja/ui.json` に対応する翻訳を追加
- flow.js のヘルプテキストに合わせた説明文にする

### 修正 B: validateConfig() をネスト構造に対応させる

- `src/lib/types.js` の validateConfig() を修正
  - 旧フラット構造（`raw.providers`, `raw.defaultAgent`）のバリデーションを削除
  - ネスト構造（`raw.agent.providers`, `raw.agent.default`）のバリデーションを追加
  - `raw.agent.commands` のバリデーション追加
- JSDoc typedef を実際の config 構造に合わせて更新
- alpha 版ポリシーに従い、旧フラット構造の後方互換は保持しない

## Open Questions

（なし）

---

- [x] User approved this draft
- Date: 2026-03-16
