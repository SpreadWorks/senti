# Tests: 197-guardrail-3tier-format

本 spec の検証テスト一覧。

## Formal tests (`tests/`) — `npm test` で実行

| ファイル | 検証対象 | 対応要件 |
|---|---|---|
| `tests/unit/flow/gate-phase-validation.test.js` | phase enum の新語彙と level/phase 許容 5 組 | REQ-1, REQ-2 |
| `tests/unit/flow/gate-evaluation-schema.test.js` | AI 応答の構造化 schema 強制、不適合時のエラー停止 | REQ-5, REQ-6, REQ-7 |
| `tests/unit/flow/gate-report-shape.test.js` | gate 結果に level/phase/evaluations/category が必須 | REQ-8 |
| `tests/unit/presets/guardrail-category-integrity.test.js` | 全 preset guardrail の category / phase が新語彙 | REQ-9, REQ-10 |

## Spec-local tests — 本 spec 履歴用

本 spec 固有の統合検証は formal tests 側でカバー済みのため、`specs/197-guardrail-3tier-format/tests/` には単体の一時テストは追加していない。本 README が検証スコープの唯一の証跡となる。

## 実行方法

```bash
# 全体
node tests/run.js --scope unit > /tmp/test-output.log 2>&1

# 個別
node tests/run.js --scope unit --filter gate-phase-validation
node tests/run.js --scope unit --filter gate-evaluation-schema
node tests/run.js --scope unit --filter gate-report-shape
node tests/run.js --scope unit --filter guardrail-category-integrity
```

## 期待結果

- test phase 完了時点（impl 未実施）: 上記 4 つのテストは **全て FAIL**（対応する export / 定数が未実装）。
- impl phase 完了時点: 全テスト PASS。`npm test` 全体がグリーン。

## 残差

- 既存 `tests/unit/specs/commands/guardrail.test.js` は旧 phase 名（`impl`）と自由行 parser を前提にしているため、impl phase で新 schema に合わせて書き換える。
- `tests/unit/specs/commands/gate.test.js` / `gate-draft.test.js` / `guardrail-metadata.test.js` の旧 phase 参照も impl で更新。
