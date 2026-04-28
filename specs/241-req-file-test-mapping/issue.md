# Requirement-File-Test Mapping Infrastructure

## Background

The following three features require the same mapping:

| Use Case | Required Mapping |
|---|---|
| retro (static evaluation) | Requirement → test/verification means → PASS/FAIL |
| impl review loop | Requirement → modified files → review |
| test review | Requirement → test design existence check |

All three require "mapping centered on requirement IDs," and the infrastructure can be shared.

## Data Model

Attach `files` and `tests` to each requirement in spec.json:

```json
{
  "requirements": [
    {
      "id": "R1",
      "desc": "Add lifecycle field to FlowNode",
      "status": "done",
      "files": ["src/flow/definition.js", "src/flow/registry.js"],
      "tests": ["237-definition-structure.test.js > lifecycle field exists"]
    },
    {
      "id": "R2",
      "desc": "dispatcher interprets and executes lifecycle",
      "status": "done",
      "files": ["src/lib/dispatcher.js"],
      "tests": ["dispatcher.test.js > executes lifecycle pre hook"]
    }
  ]
}
```

## When and How to Record

### files: Record incrementally with `flow set` during impl (Method C confirmed)

Each time the agent modifies a file during impl, record it along with the corresponding requirement ID:

```bash
sdd-forge flow set files R1 src/flow/definition.js src/flow/registry.js
```

- Accuracy: High (agent judges in real time)
- Additional AI cost: None (recording command only)
- Missing record prevention: At gate-impl, detect "files included in git diff but not yet recorded in files" and have the agent fill in the gaps

### tests: Record during the test phase

During test design, associate test case names or [R1] tags.

Verification means other than tests (grep checks, file existence checks, etc.) can also be included as verification commands in the tests array:

```json
"tests": [
  "237-test.js > finalize has 4 children",
  "! test -f src/flow/schemas/context-rules.json",
  "grep -q 'finalize-commit' src/flow/registry.js"
]
```

## Usage in Each Context

### retro (static evaluation)

Use `tests` as the verification means for each requirement:

- All tests linked to a requirement PASS → done
- Some PASS → partial (can be expressed clearly as M of N passing)
- All FAIL → not_done
- tests not recorded → unverified

Replaces the current approach of passing the entire diff to AI, enabling static PASS/FAIL determination.

### impl review loop (#332c)

Retrieve the diff for `files` per requirement and review in small units:

1. Retrieve diff from files for each requirement
2. Run review using requirement + corresponding file diff (token count stays bounded)
3. Aggregate review results for all requirements
4. Final cross-check pass (detect cross-file issues)

### test review (#b810)

Match the presence of `tests` per requirement:

- tests is empty → flagged as test not yet designed
- tests exist but don't cover the requirement's intent → AI judges

## Open Questions

- Details on how to record tests: [R1] tags within test code, or write directly in spec.json
- Fallback strategy for requirements with unrecorded files/tests
- Security constraints for verification commands (grep, etc.)
- Concrete interface for the `flow set files` command (append vs. overwrite)

<details>
<summary>ja</summary>

[ENHANCE] 要件-ファイル-テストマッピング基盤（retro / review / test review 共通）

# 要件-ファイル-テストマッピング基盤

## 背景

以下の3つの機能が同じマッピングを必要としている:

| 用途 | 必要なマッピング |
|---|---|
| retro（静的判定） | 要件 → テスト/検証手段 → PASS/FAIL |
| impl review ループ | 要件 → 修正ファイル → review |
| test review | 要件 → テスト設計の存在確認 |

いずれも「要件 ID を軸にしたマッピング」が必要で、インフラを共通化できる。

## データモデル

spec.json の各 requirement に `files` と `tests` をぶら下げる:

```json
{
  "requirements": [
    {
      "id": "R1",
      "desc": "FlowNode に lifecycle フィールドを追加",
      "status": "done",
      "files": ["src/flow/definition.js", "src/flow/registry.js"],
      "tests": ["237-definition-structure.test.js > lifecycle field exists"]
    },
    {
      "id": "R2",
      "desc": "dispatcher が lifecycle を解釈して実行",
      "status": "done",
      "files": ["src/lib/dispatcher.js"],
      "tests": ["dispatcher.test.js > executes lifecycle pre hook"]
    }
  ]
}
```

## 記録タイミングと方法

### files: impl 中に `flow set` で都度記録（方式 C 確定）

agent が impl 中にファイルを変更するたびに、対応する要件 ID と共に記録する:

```bash
sdd-forge flow set files R1 src/flow/definition.js src/flow/registry.js
```

- 正確性: 高（agent がリアルタイムで判断）
- AI 追加コスト: なし（記録コマンドのみ）
- 記録漏れ対策: gate-impl 時に「git diff に含まれるが files 未記録のファイル」を検出し、agent に補完させる

### tests: test フェーズで記録

テスト設計時にテストケース名 or [R1] タグを紐付ける。

テスト以外の検証手段（grep チェック、ファイル存在確認等）も tests 配列に検証コマンドとして含められる:

```json
"tests": [
  "237-test.js > finalize has 4 children",
  "! test -f src/flow/schemas/context-rules.json",
  "grep -q 'finalize-commit' src/flow/registry.js"
]
```

## 各用途での利用

### retro（静的判定）

要件ごとの検証手段として `tests` を使う:

- 要件に紐付く全テストが PASS → done
- 一部 PASS → partial（N件中M件通過と明確に表現可能）
- 全 FAIL → not_done
- tests 未記録 → unverified

AI に diff 全文を渡す現行方式を置き換え、静的に PASS/FAIL を判定する。

### impl review ループ（#332c）

要件ごとに `files` の diff を取得し、小さな単位でレビュー:

1. 各要件の files から diff を取得
2. 要件 + 該当ファイルの diff でレビュー実行（トークン量が一定）
3. 全要件のレビュー結果を集約
4. 最後に cross-check パス（ファイル横断の問題検出）

### test review（#b810）

要件ごとに `tests` の有無を突合:

- tests が空 → テスト未設計として指摘
- tests があるが要件の意図をカバーしていない → AI が判断

## 未決事項

- tests の記録方法の詳細: テストコード内の [R1] タグか、spec.json に直接書くか
- files/tests が未記録の要件へのフォールバック戦略
- 検証コマンド（grep 等）のセキュリティ制約
- `flow set files` コマンドの具体的インターフェース（追記型 or 上書き型）

</details>