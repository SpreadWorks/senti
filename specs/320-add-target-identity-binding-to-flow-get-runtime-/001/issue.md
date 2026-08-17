## Background

In the flow for Issue #437 (runId: `3b5c1463-e8c1-47dd-920b-635833912000`, spec: `320-impl-review-finding-contract`), spec-review did not return a stdout envelope, so the step did not progress. The following command needed to be run for failure inspection, but `senti flow get runtime-log` does not accept expectation options and failed with `ARGS_ERROR: Unknown option: --expect-run-id`.

```bash
senti flow get runtime-log \
  --expect-run-id 3b5c1463-e8c1-47dd-920b-635833912000 \
  --expect-issue 437 \
  --expect-spec 320-impl-review-finding-contract
```

The operations policy prohibits bare execution of target-sensitive commands. Since the current `senti flow get runtime-log` cannot bind the target identity, safe failure inspection is not possible.

## Goal

Add `--expect-run-id` / `--expect-issue` / `--expect-spec` to `senti flow get runtime-log` so that it can validate the target identity under the same contract as existing target-aware flow commands. The runtime log should be returned only when the resolved actual target's run ID, issue, and spec all match the expectations.

## Requirements

- Accept `--expect-run-id` / `--expect-issue` / `--expect-spec` with the same types, validation, and error contract as existing target-aware flow commands.
- Before returning the runtime log, compare the resolved actual target's run ID, issue, and spec against the expectations.
- Return each run ID / issue / spec mismatch as a structured mismatch error that follows the existing contract.
- If the target or runtime log does not exist, return a structured not-found error that follows the existing contract.
- Do not infer or fall back to another active/preparing flow when there is a mismatch or the target does not exist.
- Do not treat only the worktree or current working directory as an implicit target.
- Preserve the content, format, and read-only semantics of the runtime log returned on match.
- Do not change the behavior of other `flow get` subcommands.
- Do not add external dependencies.
- Keep `src/` generic and follow the existing OOP, alpha policy, and target-aware command design patterns.

## Acceptance Criteria

- With the correct run ID / issue / spec combination, the same runtime log as before is returned.
- Run ID mismatch, issue mismatch, and spec mismatch each return the corresponding structured mismatch error and do not return log content.
- If the target or runtime log is missing, the corresponding structured not-found error is returned and no fallback to another flow occurs.
- Even when multiple active/preparing flows exist, only the target for the specified identity is resolved, and logs from another target are not mixed in.
- Neither successful nor failed reads modify flow state, runtime logs, metadata, or board/issue state.
- The CLI contract using expectation options is verified with automated tests.
- There are no regressions in the existing runtime log content/format or in other `flow get` subcommands.

## Test Points

- All identities match
- Run ID mismatch
- Issue mismatch
- Spec mismatch
- Missing target
- Missing runtime log
- Isolation of multiple active/preparing flows
- No mutation on both success and error paths
- Regression coverage for other `flow get` subcommands

<details>
<summary>ja</summary>

flow get runtime-log に対象 identity binding を追加する

## 背景

Issue #437 の flow（runId: `3b5c1463-e8c1-47dd-920b-635833912000`、spec: `320-impl-review-finding-contract`）で spec-review が stdout envelope を返さず、step が進行しなかった。failure inspection のために次を実行する必要があったが、`senti flow get runtime-log` は expectation option を受け付けず、`ARGS_ERROR: Unknown option: --expect-run-id` で失敗した。

```bash
senti flow get runtime-log \
  --expect-run-id 3b5c1463-e8c1-47dd-920b-635833912000 \
  --expect-issue 437 \
  --expect-spec 320-impl-review-finding-contract
```

運用 policy では target-sensitive command の bare 実行を禁止している。現状の `senti flow get runtime-log` は対象 identity を bind できないため、安全な failure inspection が成立しない。

## Goal

`senti flow get runtime-log` に `--expect-run-id` / `--expect-issue` / `--expect-spec` を追加し、既存の target-aware flow command と同じ契約で対象 identity を検証できるようにする。runtime log は、解決された実対象の run ID・issue・spec がすべて expectations と一致した場合のみ返す。

## 要件

- `--expect-run-id` / `--expect-issue` / `--expect-spec` を、既存の target-aware flow command と同じ型・validation・error contract で受け付ける。
- runtime log を返す前に、解決された実対象の run ID・issue・spec を expectations と照合する。
- run ID / issue / spec の各不一致は、それぞれ既存契約に沿った structured mismatch error として返す。
- 対象または runtime log が存在しない場合は、既存契約に沿った structured not-found error として返す。
- 不一致や不存在時に、別の active/preparing flow を推測したり fallback したりしない。
- worktree や current working directory だけを implicit target として扱わない。
- 一致時に返す runtime log の content・format・read-only semantics は維持する。
- `flow get` の他 subcommands の挙動は変更しない。
- 外部依存は追加しない。
- `src/` は汎用性を維持し、既存の OOP・alpha policy・target-aware command の設計 pattern に従う。

## 受け入れ条件

- 正しい run ID / issue / spec の組み合わせでは、従来と同じ runtime log を返す。
- run ID mismatch、issue mismatch、spec mismatch がそれぞれ対応する structured mismatch error を返し、log content は返さない。
- 対象または runtime log が missing の場合、対応する structured not-found error を返し、他 flow へ fallback しない。
- active/preparing flow が複数存在しても、指定 identity の対象だけを解決し、別対象の log を混入させない。
- 成功・失敗のいずれの読み取りでも flow state、runtime log、metadata、board/issue 状態を変更しない。
- expectation options を使った CLI contract を自動テストで検証する。
- 既存の runtime log content/format と `flow get` の他 subcommands に回帰がない。

## テスト観点

- 全 identity 一致
- run ID mismatch
- issue mismatch
- spec mismatch
- missing target
- missing runtime log
- multiple active/preparing flow の isolation
- success/error path 双方の no mutation
- 他の `flow get` subcommands の回帰

</details>