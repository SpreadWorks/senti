Parent item: 2c8f

## Background

Through the design review of 2c8f, the policy to separate the project test management mechanism from flow has been finalized. Reorganize guardrails in advance.

## Changes

### Deletions
- `impl-test-preservation` (guardrail definition; the mechanical check `checkTestChanges()` will be removed in spec B)
- `changes-require-test-coverage` (split into two and replaced)
- `test-covers-spec-requirements` (absorbed into `spec-test-coverage`)
- `impl-flag-obsolete-tests` (absorbed into `no-disabling-existing-tests`)

### Enhancements
- `no-disabling-existing-tests` → assign critical/must. Add the following:
  - If the feature under test is itself deleted, deleting the corresponding test is justified
  - Skipping, commenting out, or deleting tests to make them pass is prohibited (preserving the original intent)

### Rename + Rewrite
- `impl-test-conflict-escalation` → `pre-existing-test-failure-escalation`
- New wording: "If a test that was already failing before implementation is discovered, report it to the user and confirm the remediation policy. Do not independently fix test failures that were not caused by your own implementation."

### New Additions
- `spec-test-coverage` (phase: spec, impl, test): Verify that the implementation conforms to requirements and specifications; test code must be written under `specs/<specid>/tests/` and all tests must pass
- `project-test-integrity` (phase: impl): Add or update project test code as needed to ensure that implemented code continues to work after merging, and confirm that all tests pass

### Keep (no changes)
- `spec-includes-test-strategy`

<details>
<summary>ja</summary>

[ENHANCE] テスト guardrail 再編 — プロジェクトテスト管理分離に伴う整理

親アイテム: 2c8f

## 背景

2c8f の設計レビューにより、flow からプロジェクトテスト管理機構を分離する方針が確定。先行して guardrail を再編する。

## 変更内容

### 削除
- `impl-test-preservation`（guardrail 定義。機械的チェック `checkTestChanges()` は spec B で削除）
- `changes-require-test-coverage`（2つに分割して置き換え）
- `test-covers-spec-requirements`（`spec-test-coverage` に吸収）
- `impl-flag-obsolete-tests`（`no-disabling-existing-tests` に吸収）

### 強化
- `no-disabling-existing-tests` → critical/must 付与。以下を追記:
  - テスト対象の機能自体を削除した場合は、対応するテストの削除は正当
  - テストをスキップ・コメントアウト・削除して通す行為は禁止（既存の趣旨を維持）

### リネーム + 書き換え
- `impl-test-conflict-escalation` → `pre-existing-test-failure-escalation`
- 新文言: 「実装前から失敗していたテストを発見した場合はユーザーに報告し、対処方針を確認すること。自分の実装が原因でないテストの失敗を自力で修正してはならない」

### 新設
- `spec-test-coverage`（phase: spec, impl, test）: 要求・仕様通りに実装されているか、`specs/<specid>/tests/` に必ずテストコードを実装してテストを通過させること
- `project-test-integrity`（phase: impl）: 実装したコードがマージ後も動作するようプロジェクトのテストコードを適宜追加・修正し、テストが通過することを確認すること

### 残す（変更なし）
- `spec-includes-test-strategy`

</details>