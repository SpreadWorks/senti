# Feature Specification: 064-generic-coverage-check-and-patch

**Feature Branch**: `feature/064-generic-coverage-check-and-patch`
**Created**: 2026-03-16
**Status**: Draft
**Input**: User request
**Draft**: `specs/064-generic-coverage-check-and-patch/draft.md`

## Goal

review コマンドの WARN を廃止して全チェックを FAIL に統一し、不要な機能（snapshot, analysis mtime チェック）を削除する。FAIL メッセージに解決手順を含めることで、forge ループおよび flow-merge での問題解決を容易にする。

## Scope

### A. review.js の WARN → FAIL 昇格

現在 WARN（`fail` を設定しない）の項目を FAIL に変更する：

| 項目 | 現在 | 変更後 |
|---|---|---|
| `{{text}}` 未充填 | WARN | FAIL |
| `{{data}}` 未充填 | WARN | FAIL |
| analysis.json がない | WARN | FAIL |
| README.md がない | WARN | FAIL |
| 未カバー analysis カテゴリ | WARN | FAIL |

### B. 削除する機能

1. **analysis.json mtime チェック**（review.js 228-235行目）— package.json/composer.json との mtime 比較。spec #062 のハッシュベース差分検知で代替済み。
2. **snapshot 差分チェック**（review.js 327-344行目）— snapshot が使われていないため不要。
3. **snapshot コマンド**（`src/docs/commands/snapshot.js`）— 機能自体を削除。
   - `src/docs/commands/snapshot.js` を削除
   - `tests/docs/commands/snapshot.test.js` を削除
   - `src/docs/commands/review.js` から snapshot import と使用箇所を削除
   - `src/docs.js` から snapshot ルーティングを削除（存在する場合）
   - `src/sdd-forge.js` から snapshot ルーティングを削除（存在する場合）

### C. FAIL メッセージに解決手順を含める

各 FAIL メッセージに `— run: <command>` 形式で解決コマンドを付記する：

| FAIL | 解決手順 |
|---|---|
| analysis.json がない | `run: sdd-forge docs scan` |
| `{{data}}` 未充填 | `run: sdd-forge docs data` |
| `{{text}}` 未充填 | `run: sdd-forge docs text` (requires agent) |
| README.md がない | `run: sdd-forge docs readme` |
| 未カバー analysis カテゴリ | テンプレートに `{{data}}` ディレクティブの追加が必要 |

既存の FAIL 項目（行数不足、H1 なし、露出ディレクティブ等）はメッセージ変更不要。

## Out of Scope

- エントリ単位のカバレッジ検知（個々のファイル/クラスが docs に記述されているか）
- forge のパッチ機能の復活（旧 patchGeneratedForMisses の汎用化）
- forge.js のフィードバックループ変更

## Clarifications (Q&A)

- Q: forge で解決できない FAIL が出た場合の対処は？
  - A: forge は例外終了する。flow-merge では AI がエラーメッセージを読み、解決手順をユーザーに提示する。FAIL メッセージに解決手順を含めることでこれを容易にする。
- Q: WARN という概念自体を廃止するか？
  - A: はい。review の出力は FAIL か PASS のみにする。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-16
- Notes: WARN廃止、snapshot削除、FAILメッセージに解決手順を含める

## Requirements

1. review.js の `{{text}}` 未充填チェックを FAIL にする（`fail = 1` を設定）
2. review.js の `{{data}}` 未充填チェックを FAIL にする
3. review.js の analysis.json 不在チェックを FAIL にする
4. review.js の README.md 不在チェックを FAIL にする
5. review.js の未カバー analysis カテゴリチェックを FAIL にする
6. review.js から analysis.json mtime チェックを削除する
7. review.js から snapshot 差分チェックを削除する
8. snapshot コマンド（snapshot.js）を削除する
9. snapshot テスト（snapshot.test.js）を削除する
10. docs.js / sdd-forge.js から snapshot ルーティングを削除する
11. FAIL メッセージに解決手順（`— run: <command>`）を付記する
12. i18n メッセージを更新する（WARN → FAIL 表記の変更、解決手順の追加）
13. 既存テストが通ること

## Acceptance Criteria

- `npm test` が全て PASS
- review.js に WARN 出力が存在しないこと
- review.js に snapshot / mtime チェックが存在しないこと
- snapshot.js が削除されていること
- 全 FAIL メッセージに解決手順が含まれていること

## Open Questions
- (なし)
