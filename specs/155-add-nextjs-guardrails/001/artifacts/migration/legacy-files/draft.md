# Draft: Add Framework-Specific Guardrails to nextjs Preset

**開発種別:** 機能追加（プリセット拡張）

**目的:** nextjs プリセットに Next.js 固有の guardrail を9件追加し、AI の実装品質を向上させる。既存の重複チェック済みリストから抽出した新規ルールのみを追加する。

---

## Q&A

**Q1: `await-async-request-apis` はバージョン固有ルール。body の記述方針は？**

A: body の文章内で "In Next.js 15 and later, ..." と自然に説明する（Issue テキストのまま採用）。タグ形式は使わない。

**Q2: テスト方針は？**

A: `npm test` を実行して既存テストが通ることを確認するのみ。guardrail.json への追加はデータ変更のみであり、新規テストは不要。

---

## 要件整理

### 対象ファイル

- `src/presets/nextjs/guardrail.json` — 既存3件に9件を追加
- `src/presets/nextjs/NOTICE` — 新規作成

### 追加する guardrail（9件）

| id | phase |
|----|-------|
| server-components-by-default | spec, impl |
| route-handler-vs-server-action | spec |
| use-nextjs-optimized-components | impl, review |
| await-async-request-apis | impl |
| suspense-boundary-for-search-params | impl |
| parallel-route-default-required | impl |
| error-boundary-client-component | impl |
| no-dynamic-ssr-false-in-server-components | review |
| no-route-page-coexistence | review |

### 制約

- 既存3件（no-server-code-in-client-bundle, audit-next-public-env-vars, verify-against-official-docs）は変更しない
- body の文章は元コンテンツのコピーではなく独自記述（Issue テキストを採用）
- NOTICE ファイルは `src/presets/web-design/NOTICE` の形式に準拠

### 影響範囲

- nextjs プリセットのみ。親プリセット（webapp / js-webapp）には変更なし
- docs 生成時の guardrail 表示件数が 3 → 12 件に増加

### 関連する影響事項

- **`sdd-forge upgrade` の要否**: `src/presets/` 配下の変更に該当するため、実装後に `sdd-forge upgrade` を実行する。guardrail.json はスキルテンプレートではないためスキル更新は発生しないが、CLAUDE.md のルールに従い実行する。
- **NOTICE ファイルと `sdd-forge build` 出力**: NOTICE は npm パッケージ同梱の属性表示ファイルであり、docs 生成パイプライン（scan/data/text）の対象外。`sdd-forge build` の出力には影響しない。

---

- [x] User approved this draft
