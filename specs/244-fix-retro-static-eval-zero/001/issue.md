## Problem

Retro's static evaluation (based on test-map.json) always returns rate: 0.

### Root Cause

1. **TAP parser regex ignores subtests**: The `^(ok|not ok)` regex in `parseTapOutput` does not capture indented child test lines. Node.js `--test-reporter tap` outputs nested tests with 4-space indentation, which is rejected by the `^` anchor.
2. **Mismatch between test-map.json test names and TAP output names**: test-map.json uses `file > describe > it` format, while TAP output contains only the leaf name.

### Fix Strategy

Make the TAP parser indent-aware and map directly using requirement IDs (R1, R2, etc.) found in test names. Switch away from relying on exact string matching against test-map.json.

### Target Files

- src/flow/lib/req-map.js (parseTapOutput, evaluateRequirement)
- src/flow/lib/run-retro.js (tryStaticEvaluation)

<details>
<summary>ja</summary>

[BUG] retro静的評価が常に0%になるバグ修正

## 問題

retro の静的評価（test-map.json ベース）が常に rate: 0 になる。

### 原因

1. **TAPパーサーの正規表現がサブテストを無視**: `parseTapOutput` の正規表現 `^(ok|not ok)` がインデントされた子テスト行を捕捉しない。Node.js `--test-reporter tap` はネストされたテストを4スペースインデントで出力するが、`^` アンカーで弾かれる
2. **test-map.json のテスト名と TAP 出力名の形式不一致**: test-map.json は `file > describe > it` 形式、TAP 出力はリーフ名のみ

### 修正方針

TAPパーサーをインデント対応にし、テスト名に含まれる要件ID（R1, R2等）で直接マッピングする。test-map.json の文字列完全一致に依存しない方式に変更。

### 対象ファイル

- src/flow/lib/req-map.js（parseTapOutput, evaluateRequirement）
- src/flow/lib/run-retro.js（tryStaticEvaluation）

</details>