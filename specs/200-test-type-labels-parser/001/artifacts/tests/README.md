# spec 200 — test-type-labels-parser: test plan

このディレクトリには spec 200 固有の履歴的テスト配置は行わず、すべて formal な
`tests/` ディレクトリに配置する（将来同じ契約が壊れれば常にバグであるため）。

## 対象テスト

| REQ | 検証テストファイル | 内容 |
|-----|--------------------|------|
| REQ-1 | `tests/unit/test-runner-labels.test.js` | test runner helper が unit/integration/acceptance を常に 3 行出力すること |
| REQ-2 | `tests/unit/flow/run-tests-three-keys.test.js` | `flow run tests` がラベル付き出力を受けて 3 キー + exitCode を記録 |
| REQ-3 | `tests/unit/flow/test-log-parser.test.js` | 組込 parser が各ラベル行を独立にパース・欠損キーは omit |
| REQ-4 | 既存テストで pass 継続（`tests/unit/flow/flow-run-tests.test.js`） |
| REQ-5 | `tests/unit/flow/test-parser-loader.test.js` | preset parser が優先され、未提供なら組込みへフォールバック |
| REQ-6 | `tests/unit/flow/test-parser-loader.test.js` | preset parser は 3 / 2 / 0 キーの戻り値いずれも正しく summary へ反映 |

## 実行方法

```bash
npm test -- --scope unit
# もしくは単一ファイル:
node --test tests/unit/flow/test-log-parser.test.js
```

## 期待される結果

- 実装前: 4 本のテストファイルのうち、新規追加 3 本は import エラー or 動作未実装で fail。既存 `flow-run-tests.test.js` は pass 継続。
- 実装後: 全て pass。

## 実装ターゲット（参考）

- `src/flow/lib/test-log-parser.js` 新設（parseCountsFromLog を export）
- `src/flow/lib/test-parser-loader.js` 新設（`loadTestParser({ root, presetKey })`）
- `src/flow/lib/run-tests.js` 改修（loader 経由で parser を取得、config.type を presetKey として渡す）
- `tests/helpers/test-runner-labels.js` 新設（categorize + formatLabelSummary）
- `tests/run.js` 改修（helpers を使ってカテゴリ別に `node --test` 実行し、末尾にラベル出力）
