# Feature Specification: 262-formalize-specid-opts

**Feature Branch**: `feature/262-formalize-specid-opts`
**Created**: 2026-05-20
**Status**: Draft
**Input**: GitHub Issue #335

## Goal
FlowStore / FlowManager の specId 指定 mutation を正式 API として揃え、main-repo authority 操作と CLI setter が active-flow registry に依存せず既知の spec の flow.json を更新できるようにする。

## Background
Spec 251 introduced a targeted fix for finalize post hooks: FlowStore.mutate can load a flow.json by opts.specId so main-repo authority operations can update a spec before that spec is registered in the main repo active-flow registry. Issue #335 identifies the remaining inconsistency: FlowManager does not expose the same option, request/issue/note/metric setters drop or ignore specId, and CLI setters other than step do not thread ctx.specId. This spec formalizes that API and extends it to construction-time binding through FlowManager.forRoot(root, { specId }).

## Scope
- must: FlowStore.mutate と FlowManager.mutate の specId option 伝播を正式化する。
- must: FlowManager.forRoot(root, { specId }) の作成時固定を実装し、per-call opts.specId を作成時固定より優先する。
- must: setRequest、setIssue、addNote、appendMetric、incrementMetric、accumulateAgentMetrics の FlowStore / FlowManager API を specId 指定で使えるようにする。
- must: flow set request、flow set issue、flow set note、flow set metric が CLI 解決済み specId を mutation API へ渡す。
- must: note / metric の taskId scope と、specId なし ambient metric no-op を維持する。
- should: active-flow registry 登録なしの main-repo authority 更新を spec-local tests で覆う。

## Out of Scope
- finalize merge strategy や cleanup workflow の意味を変えること。
- active-flow registry discovery の全面書き換え。
- 外部依存追加や TypeScript 移行。
- npm publish、dist-tag、release metadata の変更。
- Issue #335 を複数 spec に分割すること。

## Constraints
- 外部依存は追加しない。Node.js 組み込みモジュールのみを使う。
- alpha 版方針に従い、旧 API の互換 shim や deprecated path は追加しない。
- specId 解決優先度は method opts.specId > FlowManager bound specId > active-flow registry とする。
- FlowManager.forRoot(root, { specId }) の specId は明示的に渡された場合のみ binding として使う。未指定の場合、既存と同じ active-flow registry / worktree branch 解決に fallback する。
- CLI surface は増やさない。`flow set request`、`flow set issue`、`flow set note`、`flow set metric` は既存引数を維持し、specId は CLI context の internal field として扱う。
- User-facing input validation: `flow set request <text>` は text 非空、`flow set issue <number>` は正の整数、`flow set note <text> [--task-id <id>] [--run-id <id>]` は text 非空、`flow set metric <phase> <counter> [--task-id <id>]` は既存 VALID_PHASES / VALID_METRIC_COUNTERS と taskId validation を entry point で維持する。
- Exit code contract: 既存 setter の valid input と successful mutation は ok:true / exit 0。invalid input、unknown taskId、対象 spec の flow.json 不在、schema validation failure、write failure は Envelope.fail または thrown error の dispatcher 変換により ok:false / non-zero exit とする。
- backward-compatible-cli-interface: 既存コマンド名、位置引数、option の意味は変えない。ctx.specId がない環境では従来どおり current active flow を更新する。
- src/ 配下に Issue #335 や spec 262 固有の固定文字列を入れない。API コメントや error message は汎用的な specId / flow state 表現にする。
- src/templates または src/presets を変更した場合のみ sdd-forge upgrade を実行する。この spec は原則として runtime source と tests の変更に限定する。

## Design Principles
- FlowStore が flow.json の所在解決と保存を所有し、FlowManager は caller-facing contract と default option 合成を担う。
- 作成時固定は明示的に作られた FlowManager instance に閉じ込め、per-call opts.specId で上書き可能にする。
- taskId scope は specId scope と直交する。specId は flow.json の選択、taskId は選択済み flow.json 内の entry scope を決める。
- CLI setter は新しい user-facing option を増やさず、dispatcher が既に解決した ctx.specId を既存 mutation API に渡すだけにする。

## Overview
### Modules
- src/lib/flow-store.js - specId 指定 mutation、setter、note/metric entry append、ambient metric no-op の中核。
- src/lib/flow-manager.js - FlowStore facade、forRoot(root, { specId }) binding、per-call option 優先度の caller-facing contract。
- src/flow/lib/set-request.js / set-issue.js / set-note.js / set-metric.js - ctx.specId を既存 setter API へ渡す CLI 境界。
- tests/unit/lib と specs/262-formalize-specid-opts/tests - FlowManager / FlowStore contract と spec-local behavior coverage。

### Data Flow
- caller opts.specId または FlowManager bound specId -> FlowStore.load(specId) -> selected specs/<id>/flow.json mutation -> FlowStore.save(state)
- flow set request/issue/note/metric -> dispatcher ctx.specId -> FlowManager setter opts -> FlowStore mutate by specId -> envelope result
- appendMetric without taskId/specId/active-flow -> ambient no-op; appendMetric with specId or bound specId -> direct flow.json metric append

### Decisions
- [VERIFY] FlowStore.mutate already supports per-call opts.specId for direct flow.json selection.
- [VERIFY] FlowManager.mutate does not yet expose opts and forRoot does not yet bind specId.
- [VERIFY] Current setter gaps match Issue #335.
- [VERIFY] CLI step update is the precedent for ctx.specId propagation.
- Implement forRoot(root, { specId }) in this spec.
- Include CLI setter propagation in this spec.

## Clarifications (Q&A)
- Q: What does main-repo authority mean here?
  - A: It means a FlowManager scoped to the main repository updates the main repository copy of specs/<specId>/flow.json directly, even when that spec is not present in the main repo active-flow registry.
- Q: Does forRoot(root, { specId }) replace per-call { specId }?
  - A: No. It supplies a default target specId for that FlowManager instance. A method-level opts.specId always takes precedence for that call.
- Q: Does this add a new CLI option for --spec?
  - A: No. The modified CLI setters use ctx.specId that the dispatcher already resolves. User-facing command syntax and validation remain unchanged.
- Q: What happens when no specId is available?
  - A: Existing behavior remains: methods without explicit or bound specId resolve the current active flow through existing worktree / active-flow registry rules. Ambient metrics still no-op when no current flow path exists.

## Alternatives Considered
- Only formalize per-call { specId } and skip forRoot(root, { specId }) — Rejected because the user selected construction-time binding during draft refinement, and it is part of Issue #335's explicit consideration.
- Only update FlowStore / FlowManager APIs and leave CLI setters unchanged — Rejected because the user selected CLI setter propagation, and leaving request/issue/note/metric CLI paths unchanged would keep active-flow registry dependence in user-facing operations.
- Add user-facing --spec options to flow set request/issue/note/metric — Rejected because this spec can use existing dispatcher ctx.specId and should not expand CLI surface for the same behavior.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-20T02:04:16.023Z
- Notes: User approved spec and requested auto progression.

## Requirements
- R1 [must]: FlowStore mutation helpers must accept opts.specId for setRequest, setIssue, addNote, appendMetric, incrementMetric, and agent metric accumulation, and must update specs/<specId>/flow.json when opts.specId is provided.
- R2 [must]: FlowManager.mutate and all FlowManager setter/metric facade methods must accept an optional opts object and forward the effective specId to FlowStore.
- R3 [must]: FlowManager.forRoot(root, { specId }) must return a manager whose load(), mutate(), setRequest(), setIssue(), addNote(), appendMetric(), incrementMetric(), and accumulateAgentMetrics() use the bound specId when no per-call opts.specId is supplied.
- R4 [must]: When both a bound specId and per-call opts.specId exist, per-call opts.specId must select the target flow.json for that call.
- R5 [must]: SpecId selection must not change taskId behavior: when opts has a taskId property, null writes a flow-scope entry, a known task id writes that task id, and an unknown task id throws; when opts.taskId is absent, the entry uses state.currentTaskId or null.
- R6 [must]: appendMetric and incrementMetric without explicit specId, bound specId, or active-flow current path must continue to no-op instead of throwing or creating a flow state.
- R7 [must]: flow set request, flow set issue, flow set note, and flow set metric must pass ctx.specId to their FlowManager mutation calls when ctx.specId is present, while preserving all existing user-facing arguments and validation.
- R8 [should]: Spec-local tests must demonstrate active-flow registry independent updates for per-call specId, bound specId, CLI setter propagation, taskId preservation, and ambient metric no-op preservation.

## Acceptance Criteria
- Given a FlowManager scoped to a root containing specs/001-alpha/flow.json but no active-flow registry entry, mutate(fn, { specId: '001-alpha' }) updates that file and exits without resolving current active flow.
- Given forRoot(root, { specId: '001-alpha' }), load(), setRequest(), setIssue(), addNote(), appendMetric(), incrementMetric(), and accumulateAgentMetrics() update specs/001-alpha/flow.json without per-call specId.
- Given forRoot(root, { specId: '001-alpha' }) and a per-call opts.specId of '002-beta', the per-call call updates specs/002-beta/flow.json and leaves specs/001-alpha/flow.json unchanged for that call.
- Given addNote or appendMetric receives both specId and taskId options, the selected flow.json is determined by specId; opts.taskId null writes taskId:null, a known opts.taskId writes that id, an unknown opts.taskId throws, and absent opts.taskId falls back to currentTaskId or null.
- Given appendMetric is called with no active flow and no explicit or bound specId, it returns without writing metrics and without throwing.
- Given flow set request/issue/note/metric runs in a context with ctx.specId, each command passes { specId: ctx.specId } to the corresponding FlowManager method and preserves existing invalid-input failures.
- New spec-local tests under specs/262-formalize-specid-opts/tests include `// spec: R<N>` headers for every testable requirement.

## Implementation Targets
- src/lib/flow-store.js
- src/lib/flow-manager.js
- src/flow/lib/set-request.js
- src/flow/lib/set-issue.js
- src/flow/lib/set-note.js
- src/flow/lib/set-metric.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Formalize flow-state API
  - Add effective specId handling to FlowStore and FlowManager, including construction-time binding through forRoot(root, { specId }).
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Thread CLI setter specId
  - Pass dispatcher-resolved ctx.specId from request, issue, note, and metric setter commands into the FlowManager mutation API.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Add contract tests
  - Add focused tests that lock the new specId API and CLI propagation behavior.
  - see `tasks/T-3.md` for full spec
