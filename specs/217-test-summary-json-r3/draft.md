# Draft: 217-test-summary-json-r3

**開発種別:** bugfix
**目的:** `flow set test-summary --json` の JSON 検証失敗時に返される Envelope の error code を、spec 213 R3 の「原因別 SCREAMING_SNAKE_CASE code」ポリシーに揃える。

## Scope Verification
- In scope:
  - 対象コマンド: `flow set test-summary --json <payload>`
  - 変更ファイル: `src/flow/lib/set-test-summary.js`
  - 追加テスト: `tests/unit/flow/throw-to-envelope-codes.test.js` の R3 table-driven CASES
- Out of scope:
  - legacy flag mode（`--unit` / `--integration` / `--acceptance`）: 既に R3 準拠
  - tool-monopoly 分岐（`TEST_SUMMARY_LOCKED`）: 既に原因別 code
  - `set-test-summary.js` 以外のファイル

## Impact on Existing Features
- 影響ありの既存機能:
  - When: `flow set test-summary --json <payload>` で JSON 検証が失敗する。
  - Shall: 返却される envelope は `ok:false` のまま、`errors[0].code` は従来の `TEST_SUMMARY_INVALID` から原因別 code (`INVALID_JSON` または `INVALID_ARG_VALUE`) に変わる。
- 影響なし:
  - CLI 引数仕様（flag 名・argument 数）は不変
  - 正常系応答（`{ summary, target, mode }`）は不変
  - legacy flag mode、tool-monopoly 分岐の挙動は不変

## Requirements (優先順)
1. **[P1] 原因別 code 割当** — When: `--json` の payload 検証が失敗する / Shall: `JSON.parse` 失敗時は `INVALID_JSON`、それ以外の構造・型・空値・長さ超過違反は `INVALID_ARG_VALUE` を返す。`TEST_SUMMARY_INVALID` は廃止。
2. **[P1] 回帰テスト追加** — When: R3 table-driven CASES (`tests/unit/flow/throw-to-envelope-codes.test.js`) を実行する / Shall: 次の 2 ケースが含まれ、各々が期待 code を返す。
   - `flow set test-summary --json {not-json}` → `INVALID_JSON`
   - `flow set test-summary --json "\"a\""` → `INVALID_ARG_VALUE`
3. **[P2] 既存挙動の維持** — When: 現状パスする他のテスト (unit / integration) を実行する / Shall: すべて従来通り合格する（`npm test` の exitCode が 0）。

## Q&A
- Q: code の 2 値 (`INVALID_JSON` / `INVALID_ARG_VALUE`) のどちらに割り当てるべきか、境界は何か。
  - A: spec 213 R3 の既存マッピング（`set summary` の CASES L194-195）に揃える。`JSON.parse` 失敗のみ `INVALID_JSON`、JSON 自体は valid だが payload 構造・型・値が不正なものは `INVALID_ARG_VALUE`。
- Q: 既存の `TEST_SUMMARY_INVALID` を残す必要はあるか。
  - A: 不要。alpha 版ポリシーで後方互換 code は持たない。呼出元で `TEST_SUMMARY_INVALID` を参照する箇所は存在しない（`grep` で確認済み）。
- Q: テストは何件追加するか。
  - A: 2 件（`INVALID_JSON` 1 件 + `INVALID_ARG_VALUE` 1 件）。`set summary` の既存粒度に合わせ、原因別 code の代表を各 1 件。
- Q: `TEST_SUMMARY_LOCKED` は対象か。
  - A: 対象外。原因別 code として既に機能しており、throw 経由ではない。

## Open Questions
- なし

## User Approval
- [x] User approved this draft (autoApprove)
- Confirmed at: 2026-04-23
- Notes: autoApprove=true (score 24/24)
