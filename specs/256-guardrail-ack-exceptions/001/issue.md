## Related
- Same "whack-a-mole loop prevention" series as dbf7 (draft-scope-boundary) / b808 (vague-expression).
- This task addresses the pattern where "a guardrail keeps mechanically firing failures even though the spec has intentionally decided to opt out of the rule."

## Target Guardrails and Collision Cases

Across multiple guardrails, the following pattern has been observed: the guardrail keeps looping with failures even though the spec has explicitly made a decision.

| guardrail | colliding spec | spec's decision |
|---|---|---|
| backward-compatible-cli-interface | 235-remove-flow-test-management | Explicitly states "remove immediately without a migration period" (alpha release) |
| exit-code-contract | 228-fix-baseline-exit-code | Explicitly states "baseline mode exits 0 even on test failure" |
| bounded-resource-usage | 229-test-runner-file-filter | globSync upper bound is practically bounded by project structure; explicit limit unnecessary |
| no-synchronous-io-in-hot-paths | 229-test-runner-file-filter | CLI startup is not a hot path; sync I/O is acceptable |

## Existing Fields (No New Field Needed)

The following fields already exist in spec.json, and authors already write guardrail collision rationale there:

- `constraints`: array of string
- `design_principles`: array of string
- `clarifications`: `[{q, a}]`
- `alternatives_considered`: `[{option, reason}]`

Real example (228 spec.json):
- constraints: "The exit-code-contract guardrail evaluates code changes; this spec does not change the existing exit code behavior…"
- clarifications: "Q: How does this align with the exit-code-contract guardrail? A: The responsibility of the baseline command is…"

Authors are already writing the guardrail name directly with an acknowledgment rationale, but the guardrail eval prompt does not read this, so it keeps failing.

## Fix Policy

1. **Inject spec's constraints / clarifications / alternatives_considered into the guardrail eval prompt**
   - Present to the AI any entries that mention the relevant guardrail_id
2. **Add a common "acknowledgment clause" to guardrail bodies**
   - Example: "Exceptions are permitted only when the spec explicitly acknowledges this guardrail_id with documented rationale in constraints/clarifications/alternatives_considered."
3. **Establish a convention**
   - Spec authors write the guardrail_id directly when acknowledging an exception (formalizing the pattern already practiced in 228)

## Benefits

- No spec.json schema changes
- No new fields needed
- Simply formalizes existing operational patterns
- Minimal impact on author experience (those already doing it just keep doing it)

## Risks

- Accuracy of the AI evaluator in judging "explicit acknowledgment" — mitigated by the convention (always write the guardrail_id)
- Abuse of acknowledgments (passing anything by acknowledging it) — room to evaluate rationale quality via a separate guardrail

## Distinction from dbf7 / b808

| ticket | target | approach |
|---|---|---|
| dbf7 | draft-scope-boundary (reviewer judgment is subjective) | Relax guardrail, move safety net to spec phase |
| b808 | complete-context, unambiguous-requirements (loops from partial fixes) | Have reviewer enumerate all violations at once |
| this task | 4 guardrails (flagging intentional violations literally) | Reflect spec's explicit acknowledgment in eval |

<details>
<summary>ja</summary>

[ENHANCE] もぐら叩きループ対策: spec の明示的容認を guardrail eval に反映（acknowledged exception）

## 関連
- dbf7（draft-scope-boundary）/ b808（vague 表現系）と同じ「もぐら叩きループ対策」シリーズ。
- 本タスクは「spec が意図的にルールを外す決定をしているのに guardrail が機械的に fail を出し続ける」系統に対処。

## 対象 guardrail と衝突事例

複数の guardrail で「spec が明示的に意思決定しているのに guardrail が字義通り fail を出してループする」現象が観測されている。

| guardrail | 衝突 spec | spec の意思決定 |
|---|---|---|
| backward-compatible-cli-interface | 235-remove-flow-test-management | 「移行期間は設けず即削除」と明示（alpha 版） |
| exit-code-contract | 228-fix-baseline-exit-code | 「baseline モードはテスト失敗時も exit 0」と明示 |
| bounded-resource-usage | 229-test-runner-file-filter | globSync の上限はプロジェクト構造で実質有界、明示上限不要 |
| no-synchronous-io-in-hot-paths | 229-test-runner-file-filter | CLI 起動処理は hot path ではないため sync I/O 許容 |

## 既存の置き場所（新フィールド不要）

spec.json には以下のフィールドが既に存在し、author は実際に guardrail との衝突理由を書いている:

- `constraints`: array of string
- `design_principles`: array of string
- `clarifications`: `[{q, a}]`
- `alternatives_considered`: `[{option, reason}]`

実例（228 spec.json）:
- constraints: 「exit-code-contract guardrail はコード変更を評価するものであり、本 spec は既存の exit code 動作を変更しない…」
- clarifications: 「Q: exit-code-contract guardrail との整合性は？ A: baseline コマンドの責務は…」

guardrail 名を直接書いて容認理由を説明しているが、guardrail eval プロンプト側がこれを読まないため fail し続ける。

## 修正方針

1. **guardrail eval プロンプトに spec の constraints / clarifications / alternatives_considered を注入する**
   - 当該 guardrail_id に言及している記述を AI に提示
2. **guardrail 本文に共通の「容認条項」を追加**
   - 例: 「Exceptions are permitted only when the spec explicitly acknowledges this guardrail_id with documented rationale in constraints/clarifications/alternatives_considered.」
3. **コンベンションを定める**
   - spec author は容認時に guardrail_id を直接書く（既に 228 で実践されている形式を正式化）

## メリット

- spec.json schema 変更なし
- 新フィールド不要
- 既存 spec の運用パターンを正式化するだけ
- author 体験変化最小（既に書いている人は書き続けるだけ）

## リスク

- AI evaluator が「明示的容認」を判定する精度。コンベンション（guardrail_id を必ず書く）でカバー
- 容認の濫用（何でも容認すれば pass する）。rationale の質を別の guardrail で評価する余地

## dbf7 / b808 との切り分け

| ticket | 対象 | アプローチ |
|---|---|---|
| dbf7 | draft-scope-boundary（reviewer 判定が主観的） | guardrail を緩和、保険を spec phase に |
| b808 | complete-context, unambiguous-requirements（部分修正によるループ） | reviewer に違反全数列挙させる |
| 本タスク | 4 guardrail（意図的違反を字義通り叩く） | spec の明示的容認を eval に反映 |

</details>