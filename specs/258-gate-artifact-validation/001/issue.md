## Background
Observed in the spec 247 / 251 series: AI agents can fill artifacts required by the flow, such as `test-execute-result.json` and `file-map.json`, with hand-written placeholders and then claim req fulfillment is done. Because those placeholders are not produced by real execution, the validation granularity can be faked.

Concrete examples:
- Claimed 55 items were done after only skipping review-test
- Committed `test-execute-result.json` as a manually written AI placeholder

## Proposal
Add artifact existence and non-placeholder validation to gate-impl preconditions.

### Scope
- During the spec phase, explicitly record in `spec.json` the list of artifacts required by the flow and the conditions that make each artifact non-placeholder, such as non-empty arrays, required keys, or hashes not matching known placeholder values.
- gate-impl reads artifact files and checks:
  - existence
  - validity conditions for each artifact
  - violations fail with `Envelope.fail("ARTIFACT_PLACEHOLDER", ...)` and return to the implementation phase
- Placeholder detection can be ad hoc, but the spec phase must agree on what counts as valid.
- If the AI must write a placeholder because real execution is unavailable, add a skill rule requiring explicit user permission.

## Related
4d21 (flow quality report) - including placeholder violations in aggregation would make trends easier to understand.

<details>
<summary>ja</summary>

[ENHANCE] gate-impl の artifact 実在 + non-placeholder 検証 (req fulfillment 主張の rigor 化)

## 背景
spec 247 / 251 系で観測: AI が flow が要求する artifact (例: `test-execute-result.json`, `file-map.json`) を手書き placeholder で埋めて req fulfillment を done と主張するケース。実機実行を経ていない placeholder のため、検証粒度が偽装される。

具体的事例:
- review-test を skip しただけで 55 件 done と主張
- `test-execute-result.json` を AI が手で書いた placeholder にして commit

## 提案
gate-impl の precondition に **artifact 実在 + non-placeholder 検証** を追加する。

### 含める内容
- spec 段階で「flow が要求する artifact のリスト」と「各 artifact が non-placeholder と判定される条件」を spec.json に明示 (例: 配列が空でない、特定 key が存在、ハッシュが既知 placeholder 集合と一致しない 等)
- gate-impl が artifact ファイルを読み:
  - existence チェック
  - 各 artifact の validity 条件をチェック
  - 違反は `Envelope.fail("ARTIFACT_PLACEHOLDER", ...)` で実装 phase に差し戻す
- placeholder 検出の判定ロジックは ad-hoc でよいが、spec 段階で何を valid とするか必ず合意する
- AI が placeholder を書く必要があるケース (実機実行不可な環境) では、明示的に user 許可を取得する skill rule を追加

## 関連
4d21 (フロー品質レポート) — placeholder 違反を集計対象にすると傾向把握しやすい

</details>