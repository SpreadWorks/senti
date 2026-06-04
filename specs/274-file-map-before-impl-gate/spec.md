# Feature Specification: 274-file-map-before-impl-gate

**Feature Branch**: `feature/274-file-map-before-impl-gate`
**Created**: 2026-06-04
**Status**: Draft
**Input**: GitHub Issue #353

## Goal
impl-gate 前に file-map.json 作成手順を AI 向け flow instruction へ明示し、要件と変更ファイルの対応記録が不足したまま integration gate に進んで artifact validation で停止する再発を防ぐ。

## Background
Issue #353 records a recurrence-prevention bug in the implementation flow. After impl-review passed, impl-gate stopped before AI evaluation because file-map.json was missing. The existing system already has a command for writing file-map.json and validation that checks it at integration gate. The missing piece is the AI-facing procedure: before impl-gate, the instructions do not explicitly tell the agent to record requirement-to-file mappings with `sdd-forge flow set files <reqId> <path...>`.

## Scope
- must: flow-level implementation path の instruction は、impl-gate 前に file-map.json を作成する手順を表示する。
- must: instruction は `sdd-forge flow set files <reqId> <path...>` の CLI 例を含め、reqId と path の意味を説明する。
- must: instruction は testable requirement ごとに repo-relative changed path を記録することを説明する。
- must: spec-local test は next-action instruction に file-map 作成タイミング、対象、CLI 例が出ることを検証する。
- should: acceptance criteria は既存 gate validation、file-map.json schema、`flow set files` CLI 仕様を変更しない前提を明記する。

## Out of Scope
- file-map.json の schema 変更。
- diff から file-map.json を自動生成する新機能。
- 既存 artifact validation の緩和。
- `flow set files` のコマンド名、引数、出力 envelope の変更。
- task-impl gate の仕様変更。
- GitHub Issue、workflow board、npm publish、dist-tag 操作。

## Constraints
- 外部依存は追加しない。Node.js 組み込みモジュールと既存 test helper のみを使う。
- src/ 配下へ特定プロジェクト固有の値を書かない。prompt 文言は任意の spec / requirement に適用できる汎用表現にする。
- file-map.json schema、artifact validation、`flow set files` CLI interface は変更しない。
- 対象は flow-level impl-gate / integration gate に進む通常実装フローに限定する。task-impl gate の挙動変更は含めない。
- backward-compatible-cli-interface: 既存 CLI の command、option、argument、exit code contract は変更しない。instruction text と test coverage だけを変更する。
- exit-code-contract: 新しい user-facing command と failure condition は追加しないため、CLI exit code contract は変えない。
- validate-user-input-at-entry-point: 新しい user-facing input は追加しない。既存 `flow set files <reqId> <path...>` の validation をそのまま使う。
- spec-test-coverage: 新しい spec behavior coverage は specs/274-file-map-before-impl-gate/tests/ に置き、`// spec: R<N>` header で testable requirements を明示する。

## Design Principles
- gate validation を弱めず、gate 到達前の手順表示を補強する。
- `flow set files` を file-map 作成の単一 CLI 境界として維持する。
- prompt 変更は next-action instruction の contract として test で固定する。

## Overview
### Modules
- src/flow/prompts/impl/implement.md - implementation step の AI 向け instruction。file-map 記録手順の候補表示箇所。
- src/flow/prompts/impl/impl-gate.md - impl-gate 実行前の AI 向け instruction。gate 前 checklist の候補表示箇所。
- src/flow/lib/get-step-instructions.js - next-action instruction content を prompt file から読み、include を解決する loader。
- src/flow/lib/set-files.js - `flow set files <reqId> <path...>` で requirement と file path を file-map.json に追記する command。
- src/flow/lib/req-map.js - file-map.json の load/save/append と diff reconciliation helper。
- src/flow/lib/test-artifacts.js - integration artifact validation で file-map.json の requirement entries を検証する。
- specs/274-file-map-before-impl-gate/tests/ - R1-R4 の spec-local regression coverage。

### Data Flow
- flow get next-action -> getStepInstructions() -> implement / impl-gate prompt content -> AI sees file-map preparation instruction before integration gate.
- AI follows instruction -> `sdd-forge flow set files <reqId> <path...>` -> appendFiles() -> specs/<specId>/file-map.json.
- test-execute / test-result-review artifacts -> flow-level impl-gate -> validateIntegrationArtifactTrust() checks file-map.json before AI guardrail evaluation.

### Decisions
- [VERIFY] `flow set files` is the existing boundary for file-map writes; result=match.
- [VERIFY] integration artifact validation already requires file-map entries; result=match.
- [VERIFY] gate uses file-map for requirement-to-diff evaluation and warnings; result=match.
- [VERIFY] current implementation prompts do not explicitly show the file-map preparation command; result=match.
- Keep the fix at the instruction layer instead of changing validation or CLI behavior.
- Limit scope to flow-level impl-gate / integration gate.

## Clarifications (Q&A)
- Q: What does "before impl-gate" mean in this spec?
  - A: It means before the overall flow's impl-gate runs with phase integration. The spec does not change task-impl gate behavior.
- Q: What is a file-map entry?
  - A: A mapping from a spec requirement id to one or more repo-relative changed file paths, written through `sdd-forge flow set files <reqId> <path...>` into specs/<specId>/file-map.json.
- Q: Does this spec require automatic file-map generation?
  - A: No. The agent is instructed to record the mapping through the existing command; no diff-to-file-map generation feature is added.
- Q: Does this spec change CLI behavior?
  - A: No. Command names, options, argument validation, output envelopes, and exit codes remain unchanged.

## Alternatives Considered
- Auto-generate file-map.json from git diff before gate — Rejected because the Issue targets missing procedure guidance, and automatic inference would add behavior that may map files to the wrong requirement without user-visible judgment.
- Relax integration artifact validation when file-map.json is missing — Rejected because validation is the trust boundary that detects missing requirement-to-diff coverage. Weakening it would hide the recurrence instead of preventing it.
- Extend this change to task-impl gate instructions — Rejected because Issue #353 targets flow-level impl-gate / integration gate. task-impl gate is a separate context and should be handled by a separate Issue if needed.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-04T05:08:42.095Z
- Notes: User approved spec and requested to proceed

## Requirements
- R1 [must]: The flow-level implementation instructions shown before impl-gate shall state that file-map.json must be prepared before running the flow-level impl-gate / integration gate.
- R2 [must]: The instructions shall include the exact CLI example `sdd-forge flow set files <reqId> <path...>` and explain that reqId is a spec requirement id and each path is a repo-relative changed file path.
- R3 [must]: The instructions shall tell the agent to record at least one file-map entry for every testable requirement before proceeding to flow-level impl-gate.
- R4 [must]: Spec-local tests shall verify that next-action instruction content for the flow-level implementation path includes file-map preparation timing, target requirement/path semantics, and the `flow set files` CLI example.
- R5 [should]: The implementation shall not change file-map.json schema, `flow set files` CLI interface, or existing integration artifact validation behavior.

## Acceptance Criteria
- The implementation path instruction displayed before flow-level impl-gate contains `sdd-forge flow set files <reqId> <path...>`.
- The same instruction explains that file-map.json must be ready before the flow-level impl-gate / integration gate runs.
- The instruction explains that every testable requirement needs at least one file-map entry before flow-level impl-gate.
- The instruction explains that paths passed to `flow set files` are repo-relative changed file paths.
- Spec-local tests under specs/274-file-map-before-impl-gate/tests/ include `// spec: R1 R2 R3 R4` coverage or equivalent per-file headers.
- No production diff changes src/flow/lib/set-files.js argument handling, src/flow/lib/req-map.js schema behavior, or src/flow/lib/test-artifacts.js file-map validation.

## Implementation Targets
- src/flow/prompts/impl/implement.md
- src/flow/prompts/impl/impl-gate.md
- src/flow/lib/get-step-instructions.js
- specs/274-file-map-before-impl-gate/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Clarify file-map preparation
  - Add explicit file-map preparation guidance to the flow-level implementation instructions and lock that guidance with spec-local regression tests.
  - see `tasks/T-1.md` for full spec
