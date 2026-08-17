# Tests — spec 192 (Log Sensitive Information Masking)

## 何を検証するか

Logger (`src/lib/log.js`) が永続化する全ログ（agent prompt log, git log, event log）に対する機微情報マスキングの動作。

## 配置

- `tests/unit/lib/log.test.js` — Logger のパブリック契約変更のため formal tests に配置
  - `describe("Logger — sensitive information masking", ...)` ブロックに spec 192 のテストを集約

## 実行方法

```bash
# このテストファイルのみ
node tests/run.js --scope unit --filter log

# unit 全体
npm run test:unit
```

## 期待結果

spec 192 実装後、マスキングブロック内の全テストが PASS する。
実装前は全テストが FAIL する（TDD: 先にテストを書く方針）。

## 検証項目と AC 対応

| Test | AC |
|---|---|
| `masks GitHub classic PAT (ghp_...) in git stderr` | AC1, AC2 |
| `masks all GitHub token prefixes` | AC1, AC3 |
| `masks HTTPS user:token credentials in URL` | AC2 |
| `masks Bearer tokens` | AC3 |
| `masks AWS access key IDs` | AC3 |
| `masks absolute paths outside SDD_WORK_ROOT` | AC6 |
| `does NOT mask paths inside SDD_WORK_ROOT` | AC5 |
| `masks values in nested objects (recursive traversal)` | AC4 |
| `preserves non-string values` | AC7 |
| `masks multiple matches within one string` | AC8 |
| `masks sensitive data in agent prompt payload` | AC1 |
| `handles circular references without infinite recursion` | R8 (巡回参照処理) |

AC9 (呼び出し側無変更) / AC10 (disable フラグなし) は git diff および config スキーマで確認する運用検証。
