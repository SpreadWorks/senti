# Draft: Save structured test design data in flow.json

## Goal
テストフェーズで作成したテストの種別ごとの件数を flow.json に構造化データとして保存する。

## Decisions

### Q1: 生成方法
テストファイルの静的解析は言語ごとにパーサーが必要で非現実的。
AI に複雑な JSON を出力させるとブレる。
→ スキルが `flow set test-summary` コマンドでテスト件数を自己申告する方式。

### Q2: データ構造
シンプルに種別:件数のみ。flow.json の `test.summary` に保存。

```json
{
  "test": {
    "summary": {
      "unit": 5,
      "integration": 2,
      "acceptance": 1
    }
  }
}
```

### Q3: コマンド
`sdd-forge flow set test-summary --unit N --integration N --acceptance N`
→ flow.json の `test.summary` フィールドに書き込む。

## Requirements Summary
1. `sdd-forge flow set test-summary` コマンドの新設
2. flow.json の `test.summary` フィールドへの保存
3. 既存 flow state への影響なし

---
- [x] User approved this draft
