# Feature Specification: 326-update-overview-contract

**Feature Branch**: `feature/326-update-overview-contract`
**Created**: 2026-07-21
**Status**: Draft
**Input**: GitHub Issue #450

## Goal
update-overview の CLI help、コマンド境界、merge、永続化が一つの additions payload 契約を共有し、入口で受理した payload を shape 不整合で失敗させずに保存できるようにする。

## Background
update-overview の next-action schema と merge 層は、3 category をすべて持つ bounded string-array payload を要求する。一方、user-facing help と command boundary は category 省略と `{text}` object entry を受理するため、入口を通過した payload が merge で拒否され、利用者には入力違反ではなく `PERSIST_FAILED` として見える。既存 schema と merge を変更せず、境界と help を同じ contract へ揃えることでこの二重定義を除去する。

## Scope
- `src/flow/registry.js` の update-overview help を既存 next-action schema の additions 契約へ合わせる。
- `src/flow/lib/run-update-overview.js` の JSON 入口 validation を `overview-merge.js` の既存 validation 契約へ統一する。
- 既存 merge と persistence の正常系、determinism、入力非破壊、`added_by_task` stamp を維持する。
- spec-local tests と指定された update-overview unit tests で正常系、拒否 matrix、境界値を検証する。

## Out of Scope
- Issue #443、flow completion recovery、task lifecycle、review/gate/finalize tooling の修正。
- `src/flow/schemas/next-action/update-overview.schema.json` の意味または field 構成の変更。
- update-overview 以外の command、overview の removal/modification、無関係な refactor。
- allowlist、外部 dependency、互換入力変換の追加。

## Constraints
- Canonical additions payload は `modules`、`data_flow`、`decisions` の全 category を持つ object とし、unknown key を許可しない。
- 各 category は最大 50 要素の string array、各 string は最大 500 文字とし、現行 schema と merge の境界値を変更しない。
- `--json` の欠落は `MISSING_JSON`、JSON parse failure は `INVALID_JSON`、parse 後の契約違反は永続化前に `INVALID_SHAPE` とする。
- Node.js 組み込みモジュールだけを使用し、外部 dependency を追加しない。
- テストの assertion 削減、skip、allowlist は行わない。
- spec-local behavior test はファイル先頭に `// spec: R<N>` header を持ち、shared tests だけで requirement coverage を代替しない。

## Design Principles
- 既存 merge validator をコマンド境界から再利用し、同じ契約を別実装で複製しない。
- 不正な shape は state lookup や filesystem write より前に fail-closed で拒否する。
- 入口で受理した additions object は変換せず persistence へ渡し、merge が storage entry へ `added_by_task` を付与する責務を維持する。

## Overview
### Modules
- `src/flow/lib/overview-merge.js`: canonical additions validation と pure merge を所有する。
- `src/flow/lib/run-update-overview.js`: `--json` parse、境界 error code、active flow 解決、永続化 orchestration を所有する。
- `src/flow/registry.js`: update-overview の user-facing usage と JSON shape を表示する。
- src/flow/lib/run-update-overview.js
- src/flow/registry.js

### Data Flow
- CLI は `--json` を parse し、既存 merge validator で完全な additions shape を検査する。違反は state lookup と永続化より前に `INVALID_SHAPE` で終了する。
- 妥当な additions は同じ object のまま persistence へ渡り、pure merge が既存 overview の末尾へ category 順・入力順で追加して task id を stamp し、spec.json と spec.md を更新する。
- flow run update-overview parses JSON, delegates the parsed payload to overview-merge validation, then persists the same accepted payload

### Decisions
- [VERIFY] draft の canonical contract を update-overview.schema.json と overview-merge.js へ照合し、3 category 必須、string array、50 要素、500 文字、unknown key 拒否が一致することを確認した。
- [VERIFY] 契約不一致は command boundary の独自 validator に限定され、現行 help は optional category と `{text}` object entry を案内している。
- [VERIFY] migration parity は error boundary 以外を保持する。完全な string-array payload、merge 順序、入力非破壊、task stamp、spec.md render、MISSING_JSON、INVALID_JSON の所有者は変えない。
- 旧 help が案内した optional object-entry payload は alpha policy に従って互換変換せず廃止し、以後は永続化前の `INVALID_SHAPE` とする。
- Reuse validateAdditions as the single additions-shape authority and keep merge/schema behavior unchanged

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- Expand the schema and merge layer to accept optional categories and `{text}` objects. — Rejected because it changes the canonical schema semantics, broadens the storage contract, and exceeds Issue #450 scope.
- Keep separate validators and manually duplicate the schema checks in the command module. — Rejected because the current defect is contract duplication; another independent implementation can drift again.
- Convert legacy object entries into strings at the command boundary. — Rejected because the alpha policy does not retain backward compatibility and the Issue explicitly requires object entries to fail as `INVALID_SHAPE`.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-21T13:48:58.867Z
- Notes: Auto-approved under the user's explicit no-confirmation policy after spec-review PASS and spec-gate PASS; scope remains limited to Issue #450.

## Requirements
- R1 [must]: `validateOverviewAdditions()` shall accept a parsed additions value only when it is a non-array object containing exactly `modules`, `data_flow`, and `decisions`; every category shall be an array with at most 50 entries, every entry shall be a string with at most 500 characters, and any missing category, unknown key, non-array category, non-string entry, 51st entry, or 501st character shall return `INVALID_SHAPE` before active-flow lookup or persistence.
- R2 [must]: The update-overview help shall describe the same required three-category string-array JSON shape, and a valid complete payload accepted at the command boundary shall be passed unchanged to `persistOverviewUpdate()` instead of later failing because of additions shape.
- R3 [must]: For a valid payload, overview merge and persistence shall preserve category order and input order deterministically, shall not mutate the input spec or additions object, shall stamp each stored entry with the current non-empty task id, and shall retain the existing render-planning rollback behavior.
- R4 [must]: Missing `--json` shall remain `MISSING_JSON`, malformed JSON shall remain `INVALID_JSON`, parsed shape violations shall be `INVALID_SHAPE`, and this change shall not alter the next-action schema, other commands, flow lifecycle, or add dependencies, allowlists, skipped tests, or reduced assertions.

## Acceptance Criteria
- AC1 (R1, R2): A complete payload `{modules:["m"],data_flow:["f"],decisions:["d"]}` is accepted by `validateOverviewAdditions()`, reaches persistence unchanged, and the command does not return `PERSIST_FAILED` for payload shape.
- AC2 (R1, R4): Missing category, unknown key, non-array category, `{text}` object entry, null, scalar, and array top-level values each return `INVALID_SHAPE` before flow state lookup or filesystem write.
- AC3 (R1): Exactly 50 entries per category and exactly 500 characters per string are accepted; 51 entries or a 501-character string are rejected as `INVALID_SHAPE`.
- AC4 (R2): `senti flow run update-overview --help` describes all three category keys as required arrays of strings and no longer advertises optional category keys or `{text}` entries.
- AC5 (R3): Existing append, category/input ordering, input non-mutation, deterministic JSON/Markdown rendering, `added_by_task`, and render-planning rollback tests continue to pass for complete string-array additions.
- AC6 (R4): Missing JSON and malformed JSON retain `MISSING_JSON` and `INVALID_JSON`; the schema file, unrelated commands, flow lifecycle, and tests outside the scope lock have no product behavior changes.
- AC7 (R1-R4): Spec-local coverage under `specs/326-update-overview-contract/tests/` has a `// spec: R1 R2 R3 R4` header and covers AC1-AC6; the three allowed shared unit files remain enabled with no assertion reduction, skip, or allowlist.
- AC8 (R1-R4): The fixed commit passes spec-local and focused update-overview tests plus `git diff --check`; an independent fixed-commit audit confirms the diff-to-AC mapping before the single full `npm test` run.

## Implementation Targets
- src/flow/lib/run-update-overview.js
- src/flow/registry.js
- tests/unit/flow/run-update-overview.test.js
- tests/unit/flow/overview-merge.test.js
- tests/unit/flow/update-overview-schema.test.js
- specs/326-update-overview-contract/tests/update-overview-contract.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Unify update-overview payload validation
  - Make the update-overview help and command boundary consume the existing merge contract so every accepted payload is persistable without shape translation.
  - see `tasks/T-1.md` for full spec
