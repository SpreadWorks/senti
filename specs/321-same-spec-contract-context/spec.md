# Feature Specification: 321-same-spec-contract-context

**Feature Branch**: `feature/321-same-spec-contract-context`
**Created**: 2026-07-18
**Status**: Draft
**Input**: GitHub Issue #439

## Goal
impl-gate の requirement evaluation に bounded authoritative same-spec contract context を追加し、明示的に置換または無効化された legacy contract ではなく current contract に対して preservation を判定する。

## Background
spec-level impl-gate は file-map が存在すると related diff を共有する requirements を batch 化し、各 batch に requirement excerpts と diff だけを送る。#437 の R6 preservation evaluation では、同じ spec の R1/R2 が nullable/optional legacy output を required enum contract に置換し、clarification が legacy [] を invalid としていたが、その authoritative context が R6 prompt に無く、廃止済み contract の preservation を要求した。Issue #439 は full #436 context redesign を待たず、この bootstrap subset だけを deterministic and bounded に渡す。

## Scope
- spec-level integration impl-gate の requirement batch prompt に same-spec contract context を追加する。
- current batch requirements の full text、same-spec requirement summaries、overview decisions、clarifications を input array の zero-based JSON locator 付きで serialize する。
- count、per-item、total size と item-boundary truncation を deterministic に適用する。
- current-contract preservation guidance と #437 R6-equivalent positive/negative regression coverage を追加する。
- 既存 impl-gate prompt/cache、output、counter、retry、artifact、routing contract の非回帰を検証する。

## Out of Scope
- task-impl gate、draft/spec/test/acceptance gate、impl-review、guardrail evaluation prompt の変更。
- #436 が所有する acceptance criteria、task ownership、implementationTargets、file map、evidence、full schema、design/data-flow/full architecture context の追加。
- finding output schema、global citation、obligation classification、retry architecture の再設計。
- legacy nullable/optional/[] behavior の compatibility fallback。
- gate bypass、manual disposition、retry reset、retry-limit extension。

## Constraints
- Node.js built-in modules だけを使い、外部依存と context summary 用 agent call を追加しない。
- requirement summaries は最大 64 items、各 item 最大 768 characters とする。
- overview decisions は最大 24 items、各 item 最大 1024 characters とする。
- clarifications は最大 24 items、各 item 最大 1024 characters とする。
- same-spec contract context の serialized total は最大 48000 characters とする。
- 文字途中の truncation を行わず、選択済み item を whole item として含めるか省略する。
- current batch requirement full text が total bound に収まらない場合は bounded context construction を tooling error として停止し、semantic PASS/FAIL や retry counter に変換しない。
- src は generic に保ち、Issue/spec/run 固有値を埋め込まない。
- invariant を持つ context representation は constructor で検証する専用 class とし、既存 RequirementGateBatch/PromptBuilder pattern に合わせる。

## Design Principles
- 同一 spec の current contract だけが legacy preservation obligation を置換できる authoritative source である。
- 既存 batch grouping と一 batch 一 agent call を維持し、batch の全 evaluated requirement full text を current items として先頭に置く。
- structured spec source order と explicit requirement references だけを使い、AI や repository state に依存しない。
- 省略は固定 record で可視化し、same input から同じ prompt/cache input bytes を生成する。
- contract context の追加は integration requirement prompt に閉じ、既存 output and lifecycle contracts を変更しない。

## Overview
### Modules
- src/flow/lib/run-gate.js の RequirementPromptExcerpt と RequirementGateBatch が integration requirement prompt の requirement/diff batching を所有する。
- 同 module の dedicated same-spec contract context model が structured spec selection、bounds、zero-based JSON locators、serialization invariants を所有する。
- buildImplCheckPrompt が existing schema/rules に bounded contract section と current-contract preservation guidance を追加する。
- spec-local tests と gate evaluation/integration regression tests が prompt bytes、bounds、semantic boundary、non-regression を検証する。

### Data Flow
- executeIntegrationGate は parent spec.json と existing file-map diff から RequirementGateBatch を計画する。
- 各 batch は evaluated current requirement IDs を context model に渡し、current full texts、referenced summaries、remaining summaries、decisions、clarifications に input array index locator を付ける。
- context model は section count/per-item limits と 48000-character total を whole-item 境界で適用し、各省略 section に fixed truncation record を付ける。
- RequirementGateBatch.buildPrompt は contract section を既存 requirement IDs/requirements/diff と同じ PromptBuilder input に加え、existing agent call と evaluation parser をそのまま使う。

### Decisions
- [VERIFY] integration gate の current prompt は batch requirement excerpts と related diff のみで、same-spec decisions/clarifications は含まない。
- [VERIFY] existing batching と one-call-per-batch を維持し、batch 内 evaluated requirements 全件を current full-text records として扱う。
- Requirement summary order は current batch IDs、current text が明示参照する IDs、remaining IDs の順とし、各 group 内は spec requirements source order を使う。
- overview.decisions と clarifications は schema に semantic type がないため source order で bounded inclusionし、明示的な replacement/invalidation 文だけを override authority とする guidance を付ける。
- Migration parity: integration requirement prompt input だけを拡張し、output schema、cache algorithm、semantic counters、retry policy、artifacts、task/integration routing は既存 owner のまま保持する。
- Over-limit item は whole item omission と固定 record で扱い、current full texts 自体が total bound を超える場合は tooling failure とする。

## Clarifications (Q&A)
- Q: Does one existing requirement batch represent more than one current requirement?
  - A: Yes. Every evaluated requirement in the unchanged batch is rendered as a current full-text record before referenced and remaining same-spec requirement records.
- Q: How are migration/contract decisions and legacy-validity clarifications selected without a new classifier or agent call?
  - A: Bounded overview.decisions and clarifications are included in source order because the current schema has no semantic type field. Evaluation guidance grants override authority only to text that explicitly replaces, retires, or invalidates a legacy contract.
- Q: What happens when an individual summary, decision, or clarification exceeds its per-item limit?
  - A: The item is omitted whole and counted in that section's fixed truncation record; its text is never sliced. Current full-text records are not subject to summary per-item limits but must fit the 48000-character total.
- Q: What happens when current full-text records alone cannot fit the total bound?
  - A: Context construction stops with a tooling error before the agent call. The failure does not become a semantic gate result and does not consume semantic retry budget.

## Alternatives Considered
- Send the full spec to every integration requirement batch. — Rejected because it reverses existing prompt-volume batching and does not satisfy the explicit bounded subset contract.
- Create one agent call per requirement. — Rejected because it changes batch/call count, retry and cache behavior, and the no-new-agent-call boundary.
- Use keyword filtering to classify only replacement decisions and validity clarifications. — Rejected because the schema has no semantic tag and keyword filtering can omit authoritative statements expressed with other vocabulary.
- Truncate long item text at an arbitrary character limit. — Rejected because it violates full current text and item-boundary truncation requirements and can change contract meaning.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-18T09:04:37.834Z
- Notes: Parent approved the gate-passed R1-R7 spec and T-1 task.

## Requirements
- R1 [must]: Each spec-level integration impl-gate requirement batch shall receive every evaluated current requirement ID and full description plus same-spec requirement summaries, overview decisions, and clarifications; every record shall carry its exact zero-based input locator formatted as requirements[<index>], overview.decisions[<index>], or clarifications[<index>].
- R2 [must]: Requirement context shall order current batch requirements first, requirements explicitly referenced by current descriptions next, and remaining requirements last, preserving spec source order within each group and excluding duplicate IDs.
- R3 [must]: Contract context shall enforce limits of 64 requirement summaries at 768 characters each, 24 decisions at 1024 characters each, 24 clarifications at 1024 characters each, and 48000 serialized characters total using whole-item omission and a fixed per-section record containing omitted item count and original character count.
- R4 [must]: For identical structured spec and batch inputs, context selection, reference detection, ordering, bounds, truncation records, serialization, and resulting prompt/cache input bytes shall be identical.
- R5 [must]: The requirement evaluation guidance shall assess preservation against explicit same-spec current-contract replacement and invalidation statements, PASS the #437 R6-equivalent replacement case, and FAIL an implementation that violates the new required enum contract or current-contract non-interception behavior.
- R6 [must]: The change shall retain existing requirement batch grouping, one agent call per batch, output schema, parser/tooling-failure boundary, cache identity algorithm, semantic counters, retry policy, artifacts, previously-passed handling, and task/integration routing; built prompt bytes may differ only by the inserted Same-Spec Contract Context section and the added current-contract preservation rule lines.
- R7 [must]: Task-impl and non-impl gates shall retain their existing prompt and lifecycle behavior, no external dependency or legacy compatibility fallback shall be added, and the new bounded context invariants shall be represented by dedicated classes in generic src code.

## Acceptance Criteria
- AC1: A prompt fixture for one current requirement contains its full text, ID-keyed same-spec requirement records, overview decision records, and clarification records; each record's locator equals its zero-based input position formatted as requirements[<index>], overview.decisions[<index>], or clarifications[<index>].
- AC2: A fixture whose current requirement references R1 and R2 orders current IDs first, R1/R2 next in spec source order, then all remaining unique requirement IDs in source order.
- AC3: Boundary fixtures verify 64/768, 24/1024, 24/1024, and 48000 limits; no included item is partially sliced; every truncated section has the exact fixed omitted-items/original-characters record.
- AC4: Rebuilding normal, boundary, and overflow contexts repeatedly produces byte-identical serialized context, built prompt, and cache input.
- AC5: An agent-independent #437 R6-equivalent prompt/evaluator fixture treats R1/R2 replacement plus legacy [] invalidation as the current contract and produces PASS evidence.
- AC6: The paired negative fixture that breaks the new required enum output or intercepts valid current-contract output produces FAIL evidence.
- AC7: specs/321-same-spec-contract-context/tests and tests/unit/flow/gate-evaluation-schema.test.js assert unchanged batch count and one call per batch plus unchanged schema/parser/tooling failure, semantic counter, retry, artifact, skip/previous-pass, and routing results.
- AC8: Tests assert task-impl plan/prompt output and draft, spec, test, and acceptance gate prompt builders contain no Same-Spec Contract Context section and retain their existing bytes; diff inspection shows no external dependency, project-specific src text, or legacy fallback.
- AC9: Spec-local tests under specs/321-same-spec-contract-context/tests carry // spec: R<N> headers covering R1 through R7 and pass at integration scope.

## Implementation Targets
- src/flow/lib/run-gate.js
- tests/unit/flow/gate-evaluation-schema.test.js
- tests/e2e/flow/gate-impl-integration.test.js
- specs/321-same-spec-contract-context/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add same-spec contract context
  - Build and integrate the bounded authoritative same-spec contract context into spec-level integration requirement prompts while preserving existing gate lifecycle contracts.
  - see `tasks/T-1.md` for full spec
