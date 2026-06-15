## Background

Full project regression can be very heavy depending on the project, significantly increasing flow completion time.

Investigation showed that in recent specs 293-299, `full` regression was run 8/8 times inside `test-execute`, and `final-regression` was also run 8/8 times. Across just the latest 8 specs, full regression on the `test-execute` side took about 21 minutes, and `final-regression` took about 21 minutes, meaning we were paying twice for the same `node tests/run.js`-style guarantee.

In this repository, `.senti/config.json` sets `test.testExecuteRegression: "full"`, so full regression is forced in `test-execute` instead of using the default deferred behavior.

## Goal

Clarify the responsibilities of `test-execute` and `final-regression`, and run full regression only when necessary.

Proposed approach:

1. `test-execute` always runs spec-local tests.
2. If project test files were edited, prefer targeted execution when the runner supports it.
3. If changes to project test files / shared fixtures / runners, etc. cannot be guaranteed by targeted execution, run full regression in `test-execute`.
4. If equivalent or stronger full regression has already passed in `test-execute`, and there have been no subsequent changes that make the regression evidence stale, skip rerunning in `final-regression` with evidence.
5. For changes where `final-regression` can determine full regression is unnecessary, leave a risk-based static proof artifact and skip.
6. For runtime-sensitive / config-sensitive / external integration / unknown changes, fail closed and run `final-regression`.

## Current State

- Project regression in `test-execute` branches into full execution / targeted execution / skip / final-regression deferred based on `test.testExecuteRegression` and changed-file classification.
- The current project config has `test.testExecuteRegression: "full"`, so recent specs had `test-execute` run full regression.
- `final-regression` exists in the flow definition as a mainline step after acceptance-review.
- Once `run-final-regression.js` enters the step, it obtains changed files, discovers the regression command, and executes it with `runProcessDetailed(rootCommand, ...)`.
- The `final-regression` side currently has no checks for "skip if full already ran in test-execute" or "risk-based skip".

## Investigation Candidates

### 1. Organize full / targeted / deferred behavior in test-execute

Revisit the conditions under which `test-execute` performs full regression.

Candidates:

- spec-local tests: always run
- project test file only: targeted if the runner supports target paths
- project test shared fixture / test runner / helper change: full if targeted execution cannot guarantee coverage
- source/runtime/config change: generally do not run full in `test-execute`; hand it off to final-regression
- explicit config: keep `test.testExecuteRegression=full`, but treat it together with duplicate execution avoidance

### 2. covered-by-test-execute skip

If full regression passed in `test-execute` and there have been no subsequent changes that make the regression evidence stale, `final-regression` should skip execution.

Example skip artifact:

```json
{
  "version": "1",
  "result": "skipped",
  "skipKind": "covered_by_test_execute_full_regression",
  "reason": "full regression already passed after the latest relevant change",
  "reusedArtifact": "test-execute-result.json",
  "reusedCommand": "node tests/run.js",
  "changedFilesAfterRegression": [],
  "nextAction": "finalize-commit"
}
```

Key points:

- Confirm `test-execute-result.json` has `regression.required=true`, `mode=full`, and `result=pass`.
- Confirm that the changed files snapshot at final-regression execution time matches the snapshot in the test-execute artifact, or that no changes after test-execute make the regression evidence stale.
- If the artifact is stale, do not skip; run full regression.

### 3. risk-based final-regression skip

Investigate whether final-regression can be skipped for changes whose implementation can be guaranteed without running full regression by classifying changed files.

Skip candidates:

- docs-only
- spec artifact only
- prompt / skill / template only
- test-only changes that do not affect project runtime
- pure CLI formatting / report / metadata changes
- flow metadata / board / docs sync only

Candidates that require full regression:

- test command / runner / project test framework configuration
- package / dependency / lockfile / build config
- DB migration / schema / entity / repository
- HTTP route / controller / middleware
- runtime config / env / secrets / auth
- external API / payment / mail / queue / storage
- plugin load / DI / service registration
- unknown binary / non-text / unclassified source changes

### 4. final-regression exemption artifact

When skipping full regression, leave an artifact explaining why it can be safely omitted, rather than just skipping.

Example:

```json
{
  "version": "1",
  "result": "skipped",
  "skipKind": "risk_based_static_proof",
  "reason": "no runtime-sensitive or regression-sensitive files changed",
  "changedFiles": [],
  "sensitivePathsChecked": [],
  "staticEvidence": {
    "fileMapComplete": true,
    "requirementsCovered": true,
    "runtimeConfigChanged": false,
    "dependencyConfigChanged": false,
    "databaseSchemaChanged": false
  },
  "nextAction": "finalize-commit"
}
```

The existing schema assumes `result: pass|fail`, so if skip is allowed, the schema / post-hook / report / prompt handling needs to be designed.

### 5. Reuse last-known-green evidence

Investigate whether the latest full regression pass can be stored with a hash and reused only when the following conditions are met:

- previous full regression passed
- regression command / dependency lock / runtime config have not changed
- changed files are only risk-based skip targets
- assumptions about the base branch / worktree / dependency state have not been invalidated

However, for the initial scope, prioritize reusing a `test-execute` full pass within the same flow first, and defer cross-flow last-known-green reuse to a later phase.

### 6. full regression execution classifier

Allow each project to configure and determine which changes require full regression.

Candidate config:

```json
{
  "test": {
    "finalRegression": {
      "policy": "risk-based",
      "requiredPaths": [
        "package.json",
        "package-lock.json",
        "composer.json",
        "composer.lock",
        "src/Controller/**",
        "src/Entity/**",
        "migrations/**"
      ],
      "skipCandidatePaths": [
        "docs/**",
        "specs/**",
        "src/flow/prompts/**",
        "src/skills/**"
      ]
    }
  }
}
```

For the initial implementation, it is safer to fail closed than to use an allowlist approach, and require full regression for anything unclassified.

### 7. Relationship with CI / manual fallback

Also consider an operating model where local flow performs risk-based skips, while CI / nightly / pre-release runs full regression. The flow artifact should explicitly state something like "local final-regression skipped, full regression required externally".

## Policy for Preserving Quality

- Even when full regression has been run in `test-execute`, final-regression skip is only allowed after confirming evidence freshness.
- In the initial scope, only changes that clearly do not touch runtime should be eligible for risk-based skip.
- unknown / unclassified / runtime-sensitive changes must always fall back to full regression required.
- When skipping, the artifact must include changed files, classification results, rationale, reused artifact, and previous pass hash.
- Even if acceptance-review / impl-gate have passed, stop if the rationale for final-regression skip is insufficient.
- Paths requiring full regression / skip candidate paths should be extensible via project config.

## Proposed Acceptance Criteria

- The conditions for choosing full / targeted / deferred in `test-execute` are documented.
- The conditions under which a `test-execute` full regression pass can be reused by `final-regression` are documented.
- The conditions for running final-regression / allowing skip / always requiring execution are documented.
- Risk classification and covered-by-test-execute checks are performed before entering `run-final-regression`, or inside it.
- Even when skipped, an audit artifact equivalent to `final-regression-result.json` is left behind.
- report / finalize-commit / flow status can distinguish whether final-regression was executed, skipped as covered by test-execute, or skipped based on risk.
- When runtime-sensitive / regression-sensitive files change, full regression runs as before.
- For clearly non-runtime changes such as docs/spec/prompt-only changes, full regression is omitted.
- Unit tests verify covered-by-test-execute skip / risk-based skip / run / fail-closed / stale evidence.

## Related Code

- `src/flow/definition.js`
- `src/flow/lib/run-final-regression.js`
- `src/flow/lib/run-test-execute.js`
- `src/flow/lib/test-regression.js`
- `src/flow/lib/test-artifacts.js`
- `src/flow/schemas/test-execute-result.schema.json`
- `src/flow/schemas/next-action/final-regression.schema.json`
- `src/flow/prompts/impl/test-execute.md`
- `src/flow/prompts/impl/final-regression.md`
- `src/flow/commands/report.js`

<details>
<summary>ja</summary>

[ENHANCE] final-regression を毎回ではなく必要時だけ実行する

## 背景

full project regression はプロジェクトによって非常に重く、flow の完了時間を大きく伸ばす。

調査では、最近の spec 293-299 は `test-execute` 内でも `full` regression が 8/8 実行され、さらに `final-regression` も 8/8 実行されていた。直近 8 spec だけで、`test-execute` 側 full regression が約 21 分、`final-regression` が約 21 分かかっており、同じ `node tests/run.js` 系の保証を二重に払っている状態だった。

このリポジトリでは `.senti/config.json` に `test.testExecuteRegression: "full"` が設定されているため、default の deferred 挙動ではなく、`test-execute` でも full regression が強制されている。

## やりたいこと

`test-execute` と `final-regression` の責務を整理し、full regression を必要な時だけ実行する。

方針案:

1. `test-execute` は spec-local tests を必ず実行する。
2. project test files を編集した場合、targeted 実行できるなら targeted を優先する。
3. project test files / shared fixture / runner 変更などで targeted では保証できない場合は、`test-execute` で full regression を実行する。
4. `test-execute` で同等以上の full regression が pass しており、その後に regression evidence を stale にする変更がない場合、`final-regression` では再実行せず、証跡付きで skip する。
5. `final-regression` で full regression が不要と判断できる変更は、risk-based static proof を artifact に残して skip する。
6. runtime-sensitive / config-sensitive / external integration / unknown な変更は fail-closed で `final-regression` を実行する。

## 現状確認

- `test-execute` の project regression は `test.testExecuteRegression` と changed-file classification により、full 実行 / targeted 実行 / skip / final-regression deferred に分かれる。
- 現在の project config は `test.testExecuteRegression: "full"` なので、最近の spec では `test-execute` が full regression を実行していた。
- `final-regression` は flow definition 上、acceptance-review 後の mainline step として存在する。
- `run-final-regression.js` は step に入ると changed files を取得し、regression command を discovery し、`runProcessDetailed(rootCommand, ...)` で実行する。
- `final-regression` 側には、現時点で「test-execute で full 済みなら skip」「risk-based skip」の判定がない。

## 調査候補

### 1. test-execute の full / targeted / deferred 整理

`test-execute` で full regression を行う条件を見直す。

候補:

- spec-local tests: always run
- project test file only: targeted if runner supports target paths
- project test shared fixture / test runner / helper change: full if targeted では保証できない
- source/runtime/config change: 原則 `test-execute` では full せず、final-regression 側に渡す
- explicit config: `test.testExecuteRegression=full` は維持するが、二重実行回避とセットで扱う

### 2. covered-by-test-execute skip

`test-execute` で full regression が pass しており、その後に regression evidence を stale にする変更がない場合、`final-regression` は実行せず skip する。

skip artifact 例:

```json
{
  "version": "1",
  "result": "skipped",
  "skipKind": "covered_by_test_execute_full_regression",
  "reason": "full regression already passed after the latest relevant change",
  "reusedArtifact": "test-execute-result.json",
  "reusedCommand": "node tests/run.js",
  "changedFilesAfterRegression": [],
  "nextAction": "finalize-commit"
}
```

ポイント:

- `test-execute-result.json` の `regression.required=true`, `mode=full`, `result=pass` を確認する。
- final-regression 実行時点の changed files snapshot が test-execute artifact の snapshot と一致する、または test-execute 後に regression evidence を stale にする変更がないことを確認する。
- artifact が stale なら skip せず full regression を実行する。

### 3. risk-based final-regression skip

changed files を分類し、full regression を実行しなくても実装内容を担保できる変更では final-regression を skip できるか調査する。

skip 候補:

- docs-only
- spec artifact only
- prompt / skill / template only
- test-only change で project runtime に影響しないもの
- pure CLI formatting / report / metadata 変更
- flow metadata / board / docs sync だけの変更

full regression 必須候補:

- test command / runner / project test framework configuration
- package / dependency / lockfile / build config
- DB migration / schema / entity / repository
- HTTP route / controller / middleware
- runtime config / env / secrets / auth
- external API / payment / mail / queue / storage
- plugin load / DI / service registration
- unknown binary / non-text / unclassified source changes

### 4. final-regression exemption artifact

full regression を skip する場合、単なる skip ではなく、なぜ安全に省略できるかを artifact に残す。

例:

```json
{
  "version": "1",
  "result": "skipped",
  "skipKind": "risk_based_static_proof",
  "reason": "no runtime-sensitive or regression-sensitive files changed",
  "changedFiles": [],
  "sensitivePathsChecked": [],
  "staticEvidence": {
    "fileMapComplete": true,
    "requirementsCovered": true,
    "runtimeConfigChanged": false,
    "dependencyConfigChanged": false,
    "databaseSchemaChanged": false
  },
  "nextAction": "finalize-commit"
}
```

既存 schema は `result: pass|fail` 前提なので、skip を許容する場合は schema / post-hook / report / prompt の扱いを要設計。

### 5. last-known-green evidence の再利用

直近の full regression pass を hash 付きで保存し、以下を満たす場合だけ再利用できるか調査する。

- 前回 full regression が pass
- regression command / dependency lock / runtime config が変わっていない
- changed files が risk-based skip 対象のみ
- base branch / worktree / dependency state の前提が崩れていない

ただし初期スコープでは、まず同一 flow 内の `test-execute` full pass 再利用を優先し、cross-flow last-known-green は後段に回す。

### 6. full regression execution classifier

project ごとに、どの変更が full regression 必須かを設定・判定できるようにする。

候補 config:

```json
{
  "test": {
    "finalRegression": {
      "policy": "risk-based",
      "requiredPaths": [
        "package.json",
        "package-lock.json",
        "composer.json",
        "composer.lock",
        "src/Controller/**",
        "src/Entity/**",
        "migrations/**"
      ],
      "skipCandidatePaths": [
        "docs/**",
        "specs/**",
        "src/flow/prompts/**",
        "src/skills/**"
      ]
    }
  }
}
```

初期実装では allowlist 方式より fail-closed にし、分類不能なら full regression required にするのが安全。

### 7. CI / manual fallback との関係

local flow では risk-based skip し、CI / nightly / release 前には full regression を走らせる運用も検討する。flow artifact には「local final-regression skipped, full regression required externally」などを明示する。

## 品質を落とさない方針

- `test-execute` で full regression をした場合でも、final-regression skip は evidence freshness を確認してから行う。
- 初期スコープでは明らかに runtime に触れない変更だけ risk-based skip する。
- unknown / unclassified / runtime-sensitive は必ず full regression required に倒す。
- skip した場合は artifact に changed files、分類結果、根拠、再利用した artifact、前回 pass hash を残す。
- acceptance-review / impl-gate が pass していても、final-regression skip の根拠が不足していれば止める。
- full regression 必須 path / skip 候補 path は project config で拡張可能にする。

## 受け入れ条件案

- `test-execute` で full / targeted / deferred を選ぶ条件が明文化される。
- `test-execute` full regression pass を `final-regression` で再利用できる条件が明文化される。
- final-regression を実行する条件 / skip できる条件 / 必ず実行する条件が明文化される。
- `run-final-regression` に入る前、または内部で risk classification と covered-by-test-execute 判定が行われる。
- skip 時にも `final-regression-result.json` 相当の監査 artifact が残る。
- report / finalize-commit / flow status で final-regression が実行済みなのか、covered-by-test-execute skip なのか、risk-based skip なのか判別できる。
- runtime-sensitive / regression-sensitive files 変更時は従来通り full regression が走る。
- docs/spec/prompt-only など明白な非 runtime 変更では full regression が省略される。
- unit tests で covered-by-test-execute skip / risk-based skip / run / fail-closed / stale evidence を検証する。

## 関連コード

- `src/flow/definition.js`
- `src/flow/lib/run-final-regression.js`
- `src/flow/lib/run-test-execute.js`
- `src/flow/lib/test-regression.js`
- `src/flow/lib/test-artifacts.js`
- `src/flow/schemas/test-execute-result.schema.json`
- `src/flow/schemas/next-action/final-regression.schema.json`
- `src/flow/prompts/impl/test-execute.md`
- `src/flow/prompts/impl/final-regression.md`
- `src/flow/commands/report.js`

</details>