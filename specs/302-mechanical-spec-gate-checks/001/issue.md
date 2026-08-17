## Background

To improve flow progression speed and reduce retry counts, move the AI guardrail checks that can be judged deterministically into mechanical checks that run before AI execution.

The goal is not to weaken the quality gate. The goal is to short-circuit obvious structural violations, protocol violations, and missing spec fields before sending them to AI, and to return the same failure for the same input, thereby reducing AI judgment variance, schema errors, semantic retry consumption, and issue-log growth.

## Assessment Based on the Current Implementation

In the current implementation, `runGateFlow()` in `src/flow/lib/run-gate.js` runs `textCheck()` before the AI guardrail, and if there are issues, returns `gateFail()` without proceeding to AI evaluation.

In the `spec` phase, `RunGateCommand.executeSpec()` processes in the following order:

1. `completeSpecArtifactChange()` confirms spec artifact parse / schema-ish preconditions / producer completion.
2. `validateSpecJsonObject()` performs schema validation using `src/flow/schemas/spec.schema.json`.
3. Only if schema validation succeeds, `checkSpecJson()`, `checkTasksMonotonic()`, and `validateSpecRepairAudit()` are run as `textCheck()`.
4. If `textCheck()` returns issues, the result is `gateFail(..., evaluations=[], issues)`, and the AI semantic guardrail is not reached.
5. Because `--skip-guardrail` is evaluated after `textCheck()`, mechanical failures are not skipped even with `--skip-guardrail`.

The following are already mechanically checked:

- `checkSpecJson()`: unresolved markers, empty `goal` / `requirements` / `acceptance_criteria`, missing / empty / depth issues in `tasks`
- `completeSpecArtifactChange()`: spec artifact parse / minimal schema-ish preconditions, mechanical failures on the producer completion surface (`executeSpec()` handles repair audit via `validateSpecRepairAudit()`)
- `checkDraftJson()` / `completeDraftArtifactChange()`: draft lifecycle / schema-like consistency
- `validateTestHeaders()`: `// spec: R<N>` headers, unknown IDs, uncovered requirements, duplicates, malformed headers, incorrect `testable: false`, header/test name mismatch
- diff based gate: diff existence, file-map reconciliation warnings, test artifact schema / trust-related preconditions

Therefore, the migration target for this flow scope is not a new gate mechanism, but the existing spec gate precheck. The implementation target is limited to `checkSpecJson()`. Adding responsibilities on the producer completion side or moving this into `completeSpecArtifactChange()` is not required for this scope.

## Request to Flow

Of the `spec` gate AI guardrails, migrate the obvious structural failures for `prioritize-requirements` and `spec-includes-test-strategy`, which can be judged deterministically with high confidence, into the spec precheck before AI execution.

Add the implementation to `checkSpecJson()` in `src/flow/lib/run-gate.js`. Do not change the structure of `runGateFlow()`, the AI guardrail execution order, the meaning of `--skip-guardrail`, or retry counter / issue-log semantics.

Mechanical failures should be returned in `gateFail()`'s `artifacts.issues` with concrete messages that include the field path, array index, target ID, and missing content. Preserve the existing `failureKind: "mechanical"` nature so they remain distinguishable from AI semantic FAIL results.

## Flow Scope for This Change

### 1. `prioritize-requirements`

Migration details:

- If `spec.requirements.length > 3`, deterministically check that every requirement has a `priority` field.
- The failure message must include `requirements[N].priority` and the requirement ID so the relevant requirement can be identified.
- The value of `priority` is already restricted by the enum in `spec.schema.json` to `must` / `should` / `nice-to-have`, so do not duplicate enum validation in `checkSpecJson()` for this change.
- With the current runtime, `priority: ""` or invalid values become `schema:` mechanical failures during schema validation before reaching `checkSpecJson()`. Do not change this behavior.

Leave to AI:

- Whether the priority choice is appropriate.
- Priority granularity and product judgment.

### 2. `spec-includes-test-strategy`

Migration details:

- The current schema has no top-level `test_strategy`. The schema-level test strategy is the optional `tasks[].test_strategy`.
- Do not change the schema. Do not add top-level `test_strategy`.
- If `spec.tasks` exists and is non-empty, deterministically check that each task has a non-empty `test_strategy`.
- Existing `checkSpecJson()` should continue to handle missing / empty `tasks`; the test strategy check should report only missing values when tasks exist.
- The failure message must include `tasks[N].test_strategy` and the task ID.

Leave to AI:

- Whether the test strategy content is sufficient.
- Whether the test strategy is appropriate for the task decomposition.

### 3. `spec-test-coverage`

Do not add a new migration target in this flow scope.

Reason:

- The guardrail ID `spec-test-coverage` already exists, but spec-local test headers / coverage / unknown IDs / duplicates / incorrect `testable: false` are already mechanically checked by `validateTestHeaders()`.
- If a testable requirement exists and there are zero spec-local tests, it already fails as an uncovered requirement.
- Any additional handling should be treated as a separate scope for responsibility cleanup among the test step / test-review / producer completion, rather than as a guardrail migration.

## Explicitly Excluded from This Flow Scope

Do not implement the following in this flow scope. Treat them as separate boards or follow-up flows.

- `no-disabling-existing-tests`
  - Adding `.skip(` / `describe.skip` / `it.skip` / `test.skip` in diffs could be an obvious fail, but distinguishing legitimate removal or migration is required.
- `no-silent-error-swallowing`
  - Empty catch blocks or `catch { return; }` are candidates, but string detection without ASTs is prone to false positives.
- `no-hardcoded-secrets` / `no-sensitive-data-in-logs`
  - Knowledge from `src/lib/log-masking.js` can be used, but handling fixtures / placeholders / documented dummy values requires design.
- `bounded-resource-usage`
  - Obvious patterns such as `while (true)` are candidates, but distinguishing legitimate bounded loops and proving upper bounds is required.
- `single-responsibility`
- `complete-context`
- `impact-on-existing-features`
- `migration-parity`
- `code-placement`
- `no-overengineering`

These require semantic understanding, design judgment, and diff context. Moving them fully to mechanical checks risks quality degradation or false positives.

## Implementation Policy

- Keep this flow scope limited to the spec gate structural precheck.
- Do not change the ordering of `runGateFlow()` or retry accounting.
- Add deterministic checks to `checkSpecJson()`.
- Do not move responsibilities to `completeSpecArtifactChange()`. If the same check becomes necessary in two or more places during implementation, extract it only as a helper called from `checkSpecJson()`.
- Do not add top-level `test_strategy` to `spec.schema.json`. Assume the current schema's `tasks[].test_strategy`.
- Do not make `tasks[].test_strategy` schema-required. The goal of this change is to move obvious structural failures from the AI guardrail into the spec gate precheck, not to change the schema contract.
- Do not remove the AI guardrail definitions. Mechanical checks are short-circuits for obvious failures, and content validity judgment remains with AI.
- Make failure messages more specific than abstract AI guardrail failures, and include field path / ID / index.
- Preserve the current property that deterministic failures do not consume AI semantic retries.

## Migration Policy by Guardrail

| guardrail | Handling in this change | Hard fail condition | Condition left to AI |
|---|---|---|---|
| `prioritize-requirements` | Migrate | Requirements count is 4 or more and the `priority` field is missing | Appropriateness of priority selection |
| `spec-includes-test-strategy` | Migrate | A task in `tasks[]` has missing / empty `test_strategy` | Sufficiency of test strategy content |
| `spec-test-coverage` | Use existing mechanical checks; do not newly migrate | Existing failures from `validateTestHeaders()` | Appropriateness of test design |
| `no-disabling-existing-tests` | Exclude | None | Validity based on diff context |
| `no-silent-error-swallowing` | Exclude | None | Appropriateness of exception handling |
| `no-hardcoded-secrets` | Exclude | None | Distinguishing fixture / dummy / real secrets |
| `no-sensitive-data-in-logs` | Exclude | None | Log context and masking appropriateness |
| `bounded-resource-usage` | Exclude | None | Sufficiency of limits and validity of exceptions |
| `single-responsibility` | Exclude | None | Semantic judgment of scope / concerns |
| `complete-context` | Exclude | None | Understandability of requirements |
| `impact-on-existing-features` | Exclude | None | Semantic judgment of impact scope |
| `migration-parity` | Exclude | None | Judgment of retained behavior / removal |
| `code-placement` | Exclude | None | Architecture judgment |
| `no-overengineering` | Exclude | None | Necessity / abstraction appropriateness |

## Acceptance Criteria

- `checkSpecJson()` returns a deterministic issue for any requirement missing the `priority` field when there are 4 or more requirements.
- Validity of `priority` enum / empty string / invalid values is left to existing schema validation; do not duplicate the same validation in `checkSpecJson()`.
- `checkSpecJson()` returns a deterministic issue for missing / empty `test_strategy` in `tasks[]`.
- Do not add top-level `test_strategy`. Assume the current `tasks[].test_strategy`.
- Do not make `tasks[].test_strategy` schema-required.
- Do not change the spec gate AI guardrail execution order, `skipGuardrail`, retry counter, or issue-log semantics.
- If the above mechanical failures exist in the spec gate, do not proceed to the AI agent call; return `gateFail()`.
- The above mechanical failures are not skipped even when `--skip-guardrail` is specified.
- Existing checks for unresolved markers / empty goal / empty requirements / empty acceptance criteria / missing tasks / empty tasks / task depth do not regress.
- Existing coverage behavior in `validateTestHeaders()` does not regress.
- Add unit tests for the following regression cases:
  - Missing priority fails when there are 4 or more requirements
  - Missing priority alone does not fail when there are 3 or fewer requirements
  - Empty string / invalid priority is handled as a schema validation failure, and `checkSpecJson()` does not duplicate enum checks
  - Missing / empty `test_strategy` in tasks fails
  - Valid priority + valid task test strategy does not fail
  - Determinism test confirming the same spec input returns the same issues in the same order
- Add a CLI-level or command-level test confirming that spec gate mechanical failures are returned as issues even with `--skip-guardrail`.

## Recommended Test Targets

- `tests/unit/flow/gate-spec-sanity.test.js`
- `tests/unit/specs/commands/gate.test.js`
- If necessary, `tests/unit/226-task-decomp-wiring/t1-entry-enforcement.test.js`

## Post-Implementation Verification

- `node --test tests/unit/flow/gate-spec-sanity.test.js`
- `node --test tests/unit/specs/commands/gate.test.js`
- If the impact is broad, `node tests/run.js --scope unit`

## Excluded Items for Separate Consideration

The following are not included in this flow scope, but should be considered as separate scopes if needed:

- Design a diff-based obvious fail checker.
- Organize `meta.lint` operation for lint guardrails.
- Classify skip test addition detection, empty catch detection, secret/log literal detection, and unbounded pattern detection into hard fail / advisory / AI evidence.
- Separate test-review header validation failures into tooling/protocol failures and semantic test design findings.

## Related Code

- `src/flow/lib/run-gate.js`
- `src/flow/lib/artifact-completion.js`
- `src/flow/lib/test-headers.js`
- `src/flow/lib/test-artifacts.js`
- `src/flow/schemas/spec.schema.json`
- `src/presets/base/guardrail.json`
- `src/lib/schema-validate.js`
- `src/lib/lint.js`

## Related Boards

- `9e77`: Commonize mechanical validation after artifact changes as a producer responsibility
- `251a`: gate-impl artifact existence / non-placeholder validation

<details>
<summary>ja</summary>

[ENHANCE] AI gate の guardrail 判定を機械判定へ移行する

## 背景

flow の進行速度改善と retry 回数削減のため、AI guardrail 判定のうち deterministic に判定できるものを AI 実行前の機械判定へ寄せる。

狙いは品質ゲートを弱めることではない。明白な構造違反・プロトコル違反・spec field 欠落を AI に投げる前に短絡し、同じ入力に対して同じ failure を返すことで、AI 判定揺れ、schema error、semantic retry 消費、issue-log 増加を減らす。

## 現行実装に基づく判断

現行実装では `src/flow/lib/run-gate.js` の `runGateFlow()` が `textCheck()` を AI guardrail より先に実行し、issue があれば `gateFail()` を返して AI 判定に進まない。

`spec` phase では `RunGateCommand.executeSpec()` が以下の順に処理する。

1. `completeSpecArtifactChange()` で spec artifact の parse / schema-ish precondition / producer completion を確認する。
2. `validateSpecJsonObject()` で `src/flow/schemas/spec.schema.json` による schema validation を行う。
3. schema validation が成功した場合だけ `checkSpecJson()`、`checkTasksMonotonic()`、`validateSpecRepairAudit()` を `textCheck()` として実行する。
4. `textCheck()` が issue を返した場合は `gateFail(..., evaluations=[], issues)` となり、AI semantic guardrail には進まない。
5. `--skip-guardrail` は `textCheck()` の後に評価されるため、mechanical failure は `--skip-guardrail` でも skip されない。

既に以下は機械判定済みである。

- `checkSpecJson()`: unresolved marker、空の `goal` / `requirements` / `acceptance_criteria`、`tasks` missing / empty / depth
- `completeSpecArtifactChange()`: spec artifact parse / minimal schema-ish precondition、producer completion surface の mechanical failure（`executeSpec()` では repair audit は `validateSpecRepairAudit()` が扱う）
- `checkDraftJson()` / `completeDraftArtifactChange()`: draft lifecycle / schema 的な整合
- `validateTestHeaders()`: `// spec: R<N>` header、unknown id、未カバー requirement、duplicate、malformed、`testable: false` の誤指定、header/test name 不整合
- diff based gate: diff existence、file-map reconciliation warning、test artifact schema / trust 系の precondition

したがって今回の flow scope の移行先は新しい gate 仕組みではなく、既存の spec gate precheck である。実装対象は `checkSpecJson()` に閉じる。producer completion 側の責務追加や `completeSpecArtifactChange()` への移動は今回の必須範囲にしない。

## flow に渡す request

`spec` gate の AI guardrail のうち、高確度で deterministic に判定できる `prioritize-requirements` と `spec-includes-test-strategy` の obvious structural failure を、AI 実行前の spec precheck に移行する。

実装は `src/flow/lib/run-gate.js` の `checkSpecJson()` に追加する。`runGateFlow()` の構造、AI guardrail 実行順、`--skip-guardrail` の意味、retry counter / issue-log semantics は変えない。

mechanical failure は `gateFail()` の `artifacts.issues` に、field path、array index、対象 id、欠落内容を含む具体的な message として返す。AI semantic FAIL と区別できるように、既存の `failureKind: "mechanical"` の性質を維持する。

## 今回の flow scope

### 1. `prioritize-requirements`

移行内容:

- `spec.requirements.length > 3` の場合、全 requirement に `priority` field が存在することを deterministic に判定する。
- failure message は該当 requirement を特定できるように `requirements[N].priority` と requirement id を含める。
- `priority` の値そのものは `spec.schema.json` の enum で既に `must` / `should` / `nice-to-have` に制限されているため、今回 `checkSpecJson()` で enum validation を二重実装しない。
- `priority: ""` や不正値は、現行 runtime では `checkSpecJson()` 到達前に schema validation の `schema:` mechanical failure になる。この挙動は変更しない。

AI に残す内容:

- priority の選び方が妥当かどうか。
- priority の粒度や product 判断。

### 2. `spec-includes-test-strategy`

移行内容:

- 現行 schema には top-level `test_strategy` はない。schema 上の test strategy は optional な `tasks[].test_strategy` である。
- schema は変更しない。top-level `test_strategy` も追加しない。
- `spec.tasks` が存在し非空の場合、各 task に非空の `test_strategy` があることを deterministic に判定する。
- `tasks` が missing / empty の failure は既存 `checkSpecJson()` に任せ、test strategy check は task が存在する場合にだけ不足分を報告する。
- failure message は `tasks[N].test_strategy` と task id を含める。

AI に残す内容:

- test strategy の内容が十分かどうか。
- task 分解に対して test strategy が適切かどうか。

### 3. `spec-test-coverage`

今回の flow scope では新規移行対象にしない。

理由:

- guardrail id `spec-test-coverage` は既に存在するが、spec-local test header / coverage / unknown id / duplicate / `testable: false` 誤指定は `validateTestHeaders()` が機械判定している。
- testable requirement が存在して spec-local tests が 0 件の場合も uncovered requirement として既に fail する。
- 追加で扱うなら、guardrail 移行ではなく test step / test-review / producer completion の責務整理として別 scope にする。

## 今回の flow scope から明示的に除外するもの

以下は今回の flow scope では実装しない。別ボードまたは後続 flow として扱う。

- `no-disabling-existing-tests`
  - diff で `.skip(` / `describe.skip` / `it.skip` / `test.skip` 追加などは obvious fail にできるが、正当な削除・移行との切り分けが必要。
- `no-silent-error-swallowing`
  - empty catch や `catch { return; }` は候補だが、AST なしの文字列検出では false positive が出やすい。
- `no-hardcoded-secrets` / `no-sensitive-data-in-logs`
  - `src/lib/log-masking.js` の知見は使えるが、fixture / placeholder / documented dummy 値の扱いを設計する必要がある。
- `bounded-resource-usage`
  - `while (true)` など obvious pattern は候補だが、正当な bounded loop との区別や上限証明が必要。
- `single-responsibility`
- `complete-context`
- `impact-on-existing-features`
- `migration-parity`
- `code-placement`
- `no-overengineering`

これらは意味理解・設計判断・diff 文脈を必要とするため、完全な機械判定に移すと品質劣化または false positive のリスクが高い。

## 実装方針

- 今回の flow scope は spec gate の structural precheck に閉じる。
- `runGateFlow()` の順序や retry accounting は変更しない。
- `checkSpecJson()` に deterministic check を追加する。
- `completeSpecArtifactChange()` へ責務を移さない。実装中に同じ判定が 2 箇所以上必要になった場合のみ、`checkSpecJson()` から呼ぶ helper として抽出する。
- `spec.schema.json` に top-level `test_strategy` を追加しない。現行 schema の `tasks[].test_strategy` を前提にする。
- `tasks[].test_strategy` を schema required にしない。今回の狙いは AI guardrail の obvious structural failure を spec gate precheck へ移すことであり、schema contract の変更ではない。
- AI guardrail 定義は削除しない。機械判定は obvious fail の short-circuit であり、内容の妥当性判断は AI に残す。
- failure message は AI guardrail の抽象的な fail より具体的にし、field path / id / index を含める。
- deterministic failure は AI semantic retry を消費しない現在の性質を維持する。

## guardrail ごとの移行方針

| guardrail | 今回の扱い | hard fail 条件 | AI に残す条件 |
|---|---|---|---|
| `prioritize-requirements` | 移行する | requirements が 4 件以上で `priority` field が欠落 | priority 選択の妥当性 |
| `spec-includes-test-strategy` | 移行する | `tasks[]` の task に `test_strategy` が欠落 / 空 | test strategy 内容の十分性 |
| `spec-test-coverage` | 既存機械判定を利用し、新規移行しない | `validateTestHeaders()` の既存 failure | test design の妥当性 |
| `no-disabling-existing-tests` | 除外 | なし | diff 文脈での正当性判断 |
| `no-silent-error-swallowing` | 除外 | なし | 例外処理の妥当性判断 |
| `no-hardcoded-secrets` | 除外 | なし | fixture / dummy / real secret の区別 |
| `no-sensitive-data-in-logs` | 除外 | なし | log 文脈と masking 妥当性 |
| `bounded-resource-usage` | 除外 | なし | 上限の十分性、例外妥当性 |
| `single-responsibility` | 除外 | なし | scope / concern の意味判断 |
| `complete-context` | 除外 | なし | requirement の理解可能性 |
| `impact-on-existing-features` | 除外 | なし | 影響範囲の意味判断 |
| `migration-parity` | 除外 | なし | retained behavior / removal 判断 |
| `code-placement` | 除外 | なし | アーキテクチャ判断 |
| `no-overengineering` | 除外 | なし | 必要性 / 抽象化妥当性 |

## 受け入れ条件

- `checkSpecJson()` が requirements 4 件以上かつ `priority` field 欠落の requirement を deterministic issue として返す。
- `priority` enum / 空文字 / 不正値の妥当性は既存 schema validation に委ね、同じ validation を `checkSpecJson()` で二重実装しない。
- `checkSpecJson()` が `tasks[]` 内の `test_strategy` 欠落 / 空 task を deterministic issue として返す。
- top-level `test_strategy` は追加しない。現行 `tasks[].test_strategy` を前提にする。
- `tasks[].test_strategy` は schema required にしない。
- `runGateFlow()` の AI guardrail 実行順、`skipGuardrail`、retry counter、issue-log semantics は変えない。
- spec gate で上記 mechanical failure がある場合、AI agent call に進まず `gateFail()` になる。
- 上記 mechanical failure は `--skip-guardrail` 指定時も skip されない。
- 既存の unresolved marker / empty goal / empty requirements / empty acceptance criteria / tasks missing / tasks empty / tasks depth checks は退行しない。
- 既存 `validateTestHeaders()` の coverage behav
... (truncated)