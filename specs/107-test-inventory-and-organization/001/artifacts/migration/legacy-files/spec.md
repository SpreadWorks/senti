# Feature Specification: 107-test-inventory-and-organization

**Feature Branch**: `feature/107-test-inventory-and-organization`
**Created**: 2026-03-31
**Status**: Draft
**Input**: GitHub Issue #40

## Goal
テストの配置ルールを flow-plan スキルに明文化し、spec 検証テスト 9 件を `specs/<spec>/tests/` に移動することで、`tests/` を正式テストのみにする。

## Scope
- `src/templates/skills/sdd-forge.flow-plan/SKILL.md` のテストフェーズにテスト配置の分類基準を追記する
- 精査済み 9 件のテストファイルを `tests/` から `specs/<spec>/tests/` に移動する

## Out of Scope
- `tests/` 内の spec 番号プレフィックス付きファイル名のリネーム（正式テストとして残すものの名前変更はしない）
- `npm test:spec` のような新規コマンド追加
- テストの内容修正（移動のみ）

## Clarifications (Q&A)
- Q: テスト配置の分類基準はどこに書くか？
  - A: flow-plan スキル (SKILL.md) のテストフェーズ。sdd-forge 全プロジェクト共通ルールなので CLAUDE.md ではなくスキルに記載する。
- Q: `npm test:spec` は必要か？
  - A: 不要。spec テストは実装中に `node --test specs/<spec>/tests/*.test.js` で直接実行すれば十分。
- Q: `tests/` に残る spec 番号付きテスト（043-, 090- 等）はどうするか？
  - A: 精査の結果、公開 API の契約テストとして価値があるため `tests/` に残す。プレフィックス除去もリスクが高いため行わない。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-31
- Notes: 承認済み

## Requirements
1. [P0] flow-plan スキル (`src/templates/skills/sdd-forge.flow-plan/SKILL.md`) のテストフェーズ（step 8）に、テスト配置先の分類基準を追記する。基準: 公開 API 契約・CLI 仕様・プリセット整合性テストは `tests/` に、spec 要件確認・バグ修正再現・一時的検証テストは `specs/<spec>/tests/` に配置する
2. [P0] 以下 9 件のテストファイルを `tests/` から対応する `specs/<spec>/tests/` に移動する:
   - `tests/unit/docs/lib/073-b3-chapter-order.test.js` → `specs/073-*/tests/`
   - `tests/unit/docs/data/073-b4-strip-markdown.test.js` → `specs/073-*/tests/`
   - `tests/unit/docs/lib/081-directive-parser-new-syntax.test.js` → `specs/081-*/tests/`
   - `tests/unit/docs/lib/081-template-merger-new-syntax.test.js` → `specs/081-*/tests/`
   - `tests/unit/specs/commands/081-guardrail-new-syntax.test.js` → `specs/081-*/tests/`
   - `tests/unit/lib/082-multi-select-defaults.test.js` → `specs/082-*/tests/`
   - `tests/unit/presets/079-preset-chapter-hierarchy.test.js` → `specs/079-*/tests/`
   - `tests/e2e/081-flow-steps.test.js` → `specs/081-*/tests/`
   - `tests/e2e/082-setup-wizard-bugs.test.js` → `specs/082-*/tests/`
3. [P1] 移動後に `npm test` を実行し、残った正式テストが全て PASS することを確認する

## Impact on Existing Code
- `src/templates/skills/sdd-forge.flow-plan/SKILL.md` に分類基準テキストを追加（既存の指示との矛盾なし）
- テスト 9 件の移動により `npm test` の実行対象が 102 → 93 件に減少
- 移動するテストは `specs/<spec>/tests/` に配置されるため `npm test` では実行されなくなる
- 移動先の spec ディレクトリに `tests/` が存在しない場合は作成する

## Acceptance Criteria
- flow-plan スキルのテストフェーズに「テストを `tests/` に置くか `specs/<spec>/tests/` に置くか」の判断基準が記載されていること
- 9 件のテストが `specs/<spec>/tests/` に移動されていること
- `npm test` が PASS すること（移動したテストは含まれない）

## Open Questions
- [ ]
