# Spec 209 verification tests

Spec 209 (gate-impl baseline failure diff awareness) 固有の検証テスト。

## 対象

| ファイル | 検証 REQ |
|---|---|
| `set-test-summary-failed.test.js` | REQ-4, REQ-5, REQ-9（failed[] schema, fallback mode, baseline routing）|
| `summarize-test-log.test.js` | REQ-2, REQ-3（agent 要約モジュールの境界値・失敗処理）|
| `build-impl-check-prompt.test.js` | REQ-7, REQ-8（structured summary prompt 組立、baseline 未取得時 fallback）|
| `run-tests-baseline.test.js` | REQ-1, REQ-3（--baseline フラグ経路、summarized envelope フィールド）|

## 実行

```
node --test specs/209-gate-impl-baseline-diff/tests/
```

## 期待結果

実装完了後、全テスト PASS。実装前（test-first）ではモジュール未定義で ERR となる。
