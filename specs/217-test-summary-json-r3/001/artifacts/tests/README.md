# Tests: 217-test-summary-json-r3

## What is tested and why
`flow set test-summary --json <payload>` の JSON 検証失敗時に返る envelope の `errors[0].code` が、spec 213 R3 の原因別 SCREAMING_SNAKE_CASE code ポリシーに沿っていることを確認する。

- `{not-json}` (JSON.parse 失敗) → `INVALID_JSON`
- `"a"` (valid JSON だが非 object) → `INVALID_ARG_VALUE`

これまでは両者とも共通 code `TEST_SUMMARY_INVALID` にまとめられていたため、原因別に区別できるようにする。

## Test location
`tests/unit/flow/throw-to-envelope-codes.test.js` の `R3: flow set argument validation → structured codes (table-driven)` CASES テーブルに 2 件追加。

これは「public API（CLI）の interface contract 違反検査」であり、将来壊れた場合は常にバグである（spec 固有ではない）ため `tests/` 配下に配置する。

## How to run
```bash
node --test tests/unit/flow/throw-to-envelope-codes.test.js
# or full suite
npm test
```

## Expected results
- 実装前（TEST_SUMMARY_INVALID のまま）: 2 件 fail、exit code 非 0。
- 実装後 (Envelope.fail 化): 全 25 件 pass、exit code 0。

## Baseline
この spec 着手直前の `flow run tests --baseline` は exit=0（全 2279 件合格）。
