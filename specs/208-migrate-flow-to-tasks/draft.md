# Draft: migrate-flow-to-tasks

**Development Type:** Enhancement — one-shot data migration script for cac6/T11 (final task of the cac6 decomposition).

**Goal:** Convert all legacy `specs/*/flow.json` to the cac6/T2+T10 schema and all legacy `specs/*/spec.md` to schema-valid `specs/*/spec.json`, so that `FlowStore.load()` and `loadSpecJson()` accept every historical spec without error.

## Requirements (Priority-Ordered)

### P1 — Primary migration (MUST)

- **R1** (flow.json): **When** the migration runs against a legacy `specs/*/flow.json` (lacking `tasks` field), **it shall** transform the file so that `FlowStore.load()` accepts it under T2/T10 strict checks.
- **R2** (spec.json): **When** a `specs/*/` directory lacks `spec.json`, **it shall** produce a `spec.json` that validates against `src/flow/schemas/spec.schema.json`.
- **R3** (idempotency): **When** the migration is re-invoked on a spec that already satisfies the new schema, **it shall** make no changes to that spec.

### P2 — Data fidelity (MUST)

- **R4** (flat steps preserved): **If** a legacy flow.json carries a flat `steps[]`, **the migration shall** leave the step list untouched (rationale: current production runs with flat steps + empty `tasks: []`; remapping would break active flows).
- **R5** (notes normalization): **When** a legacy flow.json has `notes: string[]`, **the migration shall** convert each entry to `{taskId: null, text, ts}` to satisfy T10 strict validation.
- **R6** (metrics normalization): **When** a legacy flow.json has `metrics` as a `{[phase]: {[counter]: n}}` dictionary, **the migration shall** convert it to a flat entry array compatible with T10.
- **R7** (existing-value preservation): **If** a field is already in T10 shape, **the migration shall not** rewrite or reorder it.

### P3 — spec.md → spec.json mapping (MUST)

- **R8** (section extraction): **When** the migration parses a legacy spec.md, **it shall** map recognized H2 sections (Goal, Scope, Out of Scope, Requirements, Acceptance Criteria, Clarifications, Open Questions, Alternatives Considered, Background, Constraints, Design Principles, Overview) into the corresponding `spec.schema.json` fields.
- **R9** (missing-field defaults): **When** a schema-required field has no counterpart section in spec.md, **the migration shall** fill it with the empty default (`""`, `[]`, `{"in":[],"out":[]}`, `{"modules":[],"data_flow":[],"decisions":[]}`) and shall not fabricate historical content.
- **R10** (schema validation): **When** the produced spec.json fails schema validation, **the migration shall** skip writing that file, emit a warning, and continue with the remaining specs (no partial spec.json is persisted).

### P4 — Safety & observability (MUST)

- **R11** (dry-run): **When** the script is invoked with `--dry-run`, **it shall** report every intended change to stdout without writing any file.
- **R12** (per-file fault isolation): **If** processing a single spec throws, **the script shall** log the failure and proceed with the next spec instead of halting the batch.
- **R13** (no backup files): **When** the migration overwrites a file, **it shall not** create a `.bak` copy (rollback relies on the git worktree).
- **R14** (warnings): **When** a condition requires human follow-up (ambiguous parsing, unknown step ids, etc.), **the script shall** emit a warning to stdout and include the entry in an aggregated summary at the end, so the AI operator can address them manually after the batch.

### P5 — Scope boundaries (MUST)

- **R15** (placement): **When** the script is added to the repo, **it shall** live under `specs/208-migrate-flow-to-tasks/` (not under `src/`), because it is one-shot and not shipped as part of the `sdd-forge` package.
- **R16** (target): **When** the migration is invoked, **it shall** only process this repository's `specs/` tree; consumer projects are out of scope.

## Out of Scope

- Remapping flow.json flat `steps[]` into `TASK_STEPS_PLAN` task-level steps.
- Deleting `spec.md` after conversion (both files coexist; `spec render` regeneration is a separate concern).
- Fabricating missing historical content for sections like `background`, `constraints`, `design_principles`.
- Backup file creation.
- Non-sdd-forge-self projects.

## Impact on Existing

- **FlowStore.load()**: after migration, all 197 legacy flow.json files will be accepted (no code change needed to FlowStore).
- **loadSpecJson()**: after migration, all 280 legacy spec directories will expose a spec.json, enabling uniform consumption by `docs changelog` / `metrics token`.
- **No production code is modified.** The script is data-only migration.
- **No test regressions expected.** Existing unit tests are unaffected because migration changes data on disk, not code paths.

## Constraints

- External deps: none (Node.js built-ins only, per project CLAUDE.md).
- alpha policy: no backward-compat shims; the migration produces the new shape outright.
- Temporary files use `SDD_FORGE_WORK_DIR` / `.tmp` (per flow rule).
- Warnings that need human judgment are resolved manually by the AI post-migration (per Q1).

## Edge Cases

- flow.json with invalid JSON syntax → warn + skip.
- spec.md with no recognizable H2 section → warn + skip (no spec.json written).
- flow.json already in new schema → silent skip (idempotent).
- spec.json already exists → silent skip (idempotent).
- notes / metrics already in T10 shape → silent skip.
- Per-task metrics/notes that leaked into `tasks[]` → hoist to top-level arrays preserving taskId.

## Test Strategy

- Unit tests for migration transforms (flow.json fields, notes, metrics, spec.md section extraction, idempotency, schema validation).
- Smoke test: dry-run against the full `specs/` tree exits 0; apply run completes and all files pass `FlowStore.load()` / `loadSpecJson()` afterward.

## Alternatives Considered

1. Remap flat steps into task-level `TASK_STEPS_PLAN` steps (Issue A). Rejected — incompatible with current production which runs flat steps + empty `tasks: []` (T5–T7 never re-structured flat steps into tasks).
2. AI-generated content for missing schema sections. Rejected — historical data is gone; fabrication violates truthfulness and provides no value.
3. Place script under `src/scripts/`. Rejected per user directive — one-shot, not shipped code.
4. Halt on first error. Rejected — with 477 files (197 flow.json + 280 spec.md), per-file fault isolation is mandatory for batch completion and actionable error reporting.

## Future Extensibility

The script is one-off. After merge it may remain in `specs/208-...` as a historical reference or be deleted; it is not a reusable tooling pattern.

## Q&A

- Q1: spec.md → spec.json 変換は全 280 件実施するか？
  - A: Yes — 全件実施。自動化不可な warning は AI が手動補完する。
  - Rationale source: Issue #181 (T1) の Out-of-Scope に「既存 specs/*/spec.md から spec.json への一括マイグレーション (T11 のスクリプトが担当)」と明記され、T11 の責務として委譲されている（existing project docs — spec 207-spec-json-primary の scope.out を参照）。
- Q2: 旧 flow.json の flat `steps[]` を task 内 step に再マップするか？
  - A: No — `tasks:[]` + `currentTaskId:null` 追加と notes/metrics 正規化のみ行う。
  - Rationale source: 現行コードの実態（existing code pattern — `src/lib/flow-store.js` の strict チェックは `tasks` と `currentTaskId` の存在のみ要求し、flat `steps[]` はそのまま受け入れる；22 件の新形式 flow.json が flat steps + `tasks:[]` で動作している）。
- Q3: `.bak` バックアップを作るか？
  - A: No — git worktree のロールバックに依存する。
  - Rationale source: project CLAUDE.md の alpha ポリシー「後方互換コードを書かない。旧フォーマット・非推奨パスは保持せず削除する」（guardrail principle）と、マイグレーションが git worktree で実行されるため git restore で十分な復旧手段が既に存在すること（existing code pattern — worktree 運用ルール）。
- Q4: schema 必須セクションで spec.md に存在しないものの扱いは？
  - A: 空デフォルトで自動補完する。復元不可の historical information は fabrication しない。
  - Rationale source: `src/flow/schemas/spec.schema.json` の required 定義は key の存在のみを要求し空配列・空文字列を許容する（existing code pattern — schema definition）。加えて guardrail「Unambiguous Requirements」は検証不能な記述を避ける原則を掲げ、過去情報の捏造は検証不能なため違反となる（guardrail principle）。
- Q5: テスト戦略は？
  - A: unit テスト + `--dry-run` による smoke test。
  - Rationale source: project CLAUDE.md のテストルール「シンプルなインターフェースに十分な実装を隠す」モジュール設計と、一度限りの migration なので広範な integration test 整備のコストが回収できないこと（project guardrail + pragmatic rationale）。

## Open Questions

None. Issues discovered during implementation will be recorded in `issue-log.json`.

## User Confirmation

- [x] User approved this draft
- Confirmed at: 2026-04-21
