# Draft: 107-test-inventory-and-organization

## Issue
#40 Test Inventory and Organization Policy

## 背景
- テスト 102 件が `tests/` に蓄積、仕様テストと spec 検証テストが混在
- `specs/<spec>/tests/` に置くルールがあるが機能していない
- AI がテスト配置先を判断する基準がスキルに明文化されていない

## 決定事項

### テスト分類基準
- `tests/` に置く（正式テスト）: 公開 API・関数のインターフェース契約、CLI コマンド動作仕様、プリセット整合性、壊れたら「バグ」と判断できるもの
- `specs/<spec>/tests/` に置く（実装確認テスト）: spec 要件確認のみ、バグ修正再現、一時的セットアップ検証

### スコープ
1. flow-plan スキル (SKILL.md) のテストフェーズに分類基準を追記
2. 精査済み 9 件を `specs/<spec>/tests/` に移動

### 移動対象 9 件
- `unit/docs/lib/073-b3-chapter-order.test.js` → specs/073/
- `unit/docs/data/073-b4-strip-markdown.test.js` → specs/073/
- `unit/docs/lib/081-directive-parser-new-syntax.test.js` → specs/081/
- `unit/docs/lib/081-template-merger-new-syntax.test.js` → specs/081/
- `unit/specs/commands/081-guardrail-new-syntax.test.js` → specs/081/
- `unit/lib/082-multi-select-defaults.test.js` → specs/082/
- `unit/presets/079-preset-chapter-hierarchy.test.js` → specs/079/
- `e2e/081-flow-steps.test.js` → specs/081/
- `e2e/082-setup-wizard-bugs.test.js` → specs/082/

### 不要と判断したもの
- `npm test:spec` コマンド — spec テストは実装中に直接パス指定で実行すれば十分。一括実行する場面がない
- CLAUDE.md への分類基準記載 — sdd-forge 全プロジェクト共通ルールなのでスキルに記載

- [x] User approved this draft (2026-03-31)
