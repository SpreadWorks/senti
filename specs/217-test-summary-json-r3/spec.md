# Feature Specification: 217-test-summary-json-r3

**Feature Branch**: `feature/217-test-summary-json-r3`
**Created**: 2026-04-23
**Status**: Approved (autoApprove)
**Input**: GitHub Issue #226

## Goal
- `flow set test-summary --json` の JSON 検証失敗時 envelope の `errors[0].code` を、spec 213 R3 の「原因別 SCREAMING_SNAKE_CASE code」ポリシーに揃える。

## Background
- spec 213 R3 で CLI 引数検証エラーの code は原因別 code (`INVALID_JSON`, `INVALID_ARG_VALUE` 等) に細分化された。
- 同一ファイル `src/flow/lib/set-test-summary.js` でも `parseLegacy` / tool-monopoly 分岐は既に原因別 code に揃っている。
- 一方、同ファイルの `parseJsonPayload` / `validateFailedArray` は throw ベースのまま残り、全 8 種の失敗原因が共通 code `TEST_SUMMARY_INVALID` にまとめられている。R3 のポリシー違反。

## Scope
- `src/flow/lib/set-test-summary.js` の JSON mode 検証処理の code 割当変更。
- `tests/unit/flow/throw-to-envelope-codes.test.js` の R3 table-driven CASES へ `--json` 検証の回帰テストを追加。

## Out of Scope
- legacy flag mode（`--unit` / `--integration` / `--acceptance`）: 既に R3 準拠。
- tool-monopoly 分岐 (`TEST_SUMMARY_LOCKED`): throw 経由ではない。
- 正常系応答フォーマット (`{ summary, target, mode }`)。
- CLI 引数仕様（flag 名・argument 数）。
- `set-test-summary.js` 以外のファイルの変更。

## Constraints
- 外部依存追加禁止（Node.js 組み込みのみ）。
- alpha 版ポリシー: 後方互換コード (`TEST_SUMMARY_INVALID`) は保持しない、削除する。
- 既存テストの改変禁止（R3 CASES テーブルへの項目追加は増分変更として許容）。
- `src/` 以下にプロジェクト固有情報を書かない。

## Design Principles
- Envelope.fail 返却パターンを既存の `parseLegacy` / tool-monopoly と統一する（一貫性）。
- `JSON.parse` 失敗は `INVALID_JSON`、payload 構造・型・値違反は `INVALID_ARG_VALUE` で統一（spec 213 R3 の `set summary` マッピングに準拠）。

## Overview
### Modules
- `src/flow/lib/set-test-summary.js`
  - `parseJsonPayload`
  - `validateFailedArray`
  - `SetTestSummaryCommand.execute`
- `tests/unit/flow/throw-to-envelope-codes.test.js`
  - R3 table-driven CASES

### Data Flow
- `execute(ctx)` → `parseJsonPayload(ctx.json)` → `validateFailedArray(payload.failed)` → summary 組立 → `flowManager.setTestSummary(...)`
- 失敗時は該当ヘルパーが `Envelope.fail` を返し、`execute` が即座に `return` する（throw 経由をやめる）。

### Decisions
- `TEST_SUMMARY_INVALID` を削除し、原因別 code に差し替える。
- `parseJsonPayload` / `validateFailedArray` のシグネチャを変更: 成功時 `{ payload }` / `{ failed }`、失敗時 `{ fail: Envelope }` を返す。
- 呼び出し元は `result.fail` を短絡 return。

## Clarifications (Q&A)
- Q: `INVALID_JSON` と `INVALID_ARG_VALUE` の境界は何か。
  - A: `JSON.parse` 自体が失敗する場合のみ `INVALID_JSON`。JSON が valid でも payload の構造（非 object / 非 array）・型・空値・長さ超過のいずれかに違反したら `INVALID_ARG_VALUE`。
- Q: `TEST_SUMMARY_INVALID` を残すか。
  - A: 残さない。alpha 版ポリシーで後方互換 code は持たない。呼出元で参照する箇所は無いことを `grep` で確認済み。
- Q: テスト件数は何件か。
  - A: R3 table-driven CASES に 2 件追加（`INVALID_JSON` 1 件 + `INVALID_ARG_VALUE` 1 件）。粒度は既存 `set summary` ケースに揃える。
- Q: 長さ超過ケース（`MAX_ID_CHARS`, `MAX_REASON_CHARS`）は全てテスト化するか。
  - A: 化さない。`INVALID_ARG_VALUE` 代表 1 件で充分。細分ケースはテーブルを冗長にし、同一 code を重複確認するだけで価値が低い。

## Alternatives Considered
- **案 A（採用）**: ヘルパーを `{ payload } | { fail: Envelope }` 形式に変更。
  - 理由: 同ファイル内の `parseLegacy` と同一パターン。呼出元の制御フローも揃い、ファイル全体で統一される。
- **案 B**: throw を維持し、`execute` 側で code を原因別に分岐。
  - 不採用理由: `parseLegacy` は既に戻り値形式に移行済み。ファイル内で 2 つの失敗伝播パターンが混在する。R3 の精神（原因を発生箇所で命名する）にも合致しない。
- **案 C**: `TEST_SUMMARY_INVALID` を残しつつ、原因別 code と並立させる。
  - 不採用理由: alpha 版ポリシーに反する。code が 2 値あると呼出元がどちらを参照すべきか曖昧になり、R3 の原則「1 失敗 = 1 code」に違反する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-23
- Notes: autoApprove=true (auto-check 24/24)

## Requirements
1. **[P1] R1 JSON.parse 失敗 code** — When: `flow set test-summary --json <payload>` で `<payload>` が JSON として parse できない / Shall: envelope `ok:false`, `errors[0].code = "INVALID_JSON"` を返し exitCode は非ゼロ。
2. **[P1] R2 JSON 構造・型違反 code** — When: payload が JSON として valid だが、非 object、非 array の failed、entry の型違反、id の空文字・長さ超過、reason の長さ超過のいずれかを含む / Shall: envelope `ok:false`, `errors[0].code = "INVALID_ARG_VALUE"` を返し exitCode は非ゼロ。
3. **[P1] R3 旧 code 削除** — When: `src/flow/lib/set-test-summary.js` を grep する / Shall: `TEST_SUMMARY_INVALID` の文字列が存在しない。
4. **[P2] R4 回帰テスト** — When: `npm test -- tests/unit/flow/throw-to-envelope-codes.test.js` を実行する / Shall: 次の 2 ケースが含まれ合格する。
   - `{ name: "set test-summary with invalid JSON", argv: ["flow", "set", "test-summary", "--json", "{not-json}"], code: "INVALID_JSON" }`
   - `{ name: "set test-summary with non-object JSON", argv: ["flow", "set", "test-summary", "--json", "\"a\""], code: "INVALID_ARG_VALUE" }`
5. **[P2] R5 既存テスト維持** — When: `npm test` を実行する / Shall: exitCode 0（既存 unit 2019 件・integration 260 件全合格）。

## Acceptance Criteria
- `grep -n "TEST_SUMMARY_INVALID" src/flow/lib/set-test-summary.js` が 0 件。
- `grep -n "INVALID_JSON\|INVALID_ARG_VALUE" src/flow/lib/set-test-summary.js` が 1 件以上ずつマッチ。
- `npm test -- tests/unit/flow/throw-to-envelope-codes.test.js` が合格し、追加 2 ケースが table-driven で実行される。
- `npm test` 全体の exitCode が 0。

## Implementation Targets
- `src/flow/lib/set-test-summary.js`
- `tests/unit/flow/throw-to-envelope-codes.test.js`

## Open Questions
- なし
