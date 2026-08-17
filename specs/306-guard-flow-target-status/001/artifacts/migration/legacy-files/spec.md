# Feature Specification: 306-guard-flow-target-status

**Feature Branch**: `feature/306-guard-flow-target-status`
**Created**: 2026-06-17
**Status**: Draft
**Input**: GitHub Issue #400

## Goal
Issue 指定で Spec-Driven Development flow に入るとき、別 Issue の active flow を誤って継続対象として扱わないようにする。

## Background
Issue #400 reports that `$senti.flow #399` can accidentally continue another active flow such as Issue #397 because the skill mandates a bare `senti flow get status` before choices. The CLI already has a safer runId-based status path, but it has no expected-Issue input for mismatch validation. The fix must add an Issue/runId mismatch guard while preserving current-context status display, runId status lookup, preparing auto-mode inheritance, normal autoApprove behavior, and finalize recovery exceptions.

## Scope
- Issue 指定付き flow entry で、active flow の issue が要求 Issue と異なる場合に停止する。
- runId が既知の autoApprove 確認で、対象 runId の status を使う。
- src/skills/partials/core-principle.md の裸 status 強制を runId-aware guidance に置き換える。
- CLI 側に ACTIVE_FLOW_MISMATCH 相当の明確な不一致 error を追加する。
- 旧 unsafe guidance の削除、新 guidance の存在、Issue mismatch guard、migration parity を specs/306-guard-flow-target-status/tests/ の spec-local coverage に含める。

## Out of Scope
- flow state schema の大規模再設計は行わない。
- GitHub Issue 取得や board workflow の仕様変更は行わない。
- finalize-cleanup の orphan commit recovery policy は変更しない。
- npm publish や release 操作は行わない。

## Constraints
- 外部 npm dependency は追加しない。
- src/ 配下には特定プロジェクトや環境固有の値を hardcode しない。
- src/skills/ を変更した場合は senti upgrade を実行し、生成済み skill への反映を検証する。
- prompt guidance の配置を変更する場合は、旧配置削除と新配置存在を regression test または placement assertion で検証する。
- Issue mismatch 時は next-action、flow run、finalize-cleanup などの継続系コマンドを実行しない。
- 新しい spec behavior coverage は specs/306-guard-flow-target-status/tests/ に配置し、各 test file は `// spec: R<N> ...` header で対象 requirement を明示する。

## Design Principles
- 対象 flow が確定してから autoApprove を読む。runId が存在する場合は runId を優先し、context-based status は current-context 表示と active flow 有無確認に限定する。
- 不一致は silent fallback せず、machine-readable error code と user-facing mismatch detail で停止する。
- 既存の current-context status、runId status、通常 autoApprove、manual recovery exception は public behavior として保持する。

## Overview
### Modules
- src/skills/partials/core-principle.md: flow skill の autoApprove/status guidance を定義する共有 partial。
- src/flow/lib/get-status.js: status command の実行本体。runId 指定時は resolveByRunId、未指定時は current context を返す。
- src/flow/registry.js: flow get status の positional runId と help text を定義する command registry。
- src/skills/senti.flow/SKILL.md: Issue parsing、entry branch、dispatcher loop の手順を定義する main flow skill。
- src/lib/flow-manager.js: active flow と preparing flow を runId で解決する FlowManager.resolveByRunId を提供する。

### Data Flow
- Issue 指定 entry は `senti flow get status [runId] --expect-issue <n>` を mismatch check の integration point とし、dispatcher / next-action 前に要求 Issue と resolved flow issue を比較する。
- runId が判明した後の autoApprove check は get status <runId> 相当の target status を読み、別 active context の autoApprove を参照しない。
- preparing state の autoApprove は status ではなく set-auto envelope と preparing state inheritance で扱い、prepare 後の active flow から runId-targeted status check に切り替える。
- Issue mismatch は ACTIVE_FLOW_MISMATCH 相当の envelope として expected/active の Issue/runId 情報を返し、継続系 command を起動しない。

### Decisions
- [VERIFY] get-status runId path exists and returns target state before context fallback.
- [VERIFY] flow registry already exposes runId as positional status argument.
- [VERIFY] flow manager can resolve runId from active and preparing flows.
- Issue mismatch must stop before dispatcher actions.
- The mismatch integration point is status with an expected Issue option.
- Preparing autoApprove remains separate from active-flow status.
- Migration parity keeps current-context status and runId status as separate public behaviors.

## Clarifications (Q&A)
- Q: Issue mismatch 時の user-facing behavior は何か。
  - A: dispatcher に入らず停止し、要求 Issue と active Issue の不一致を明示する。
- Q: runId が判明した後の autoApprove check は何を読むか。
  - A: active flow では対象 runId の status を読む。preparing state では status の autoApprove が false として表示されるため、set-auto response と prepare inheritance を使う。裸の status は runId 未確定時の active flow 有無確認と current-context 表示に限定する。
- Q: CLI-side mismatch error は何を返すか。
  - A: `senti flow get status [runId] --expect-issue <n>` が ACTIVE_FLOW_MISMATCH 相当の code と、利用可能な expectedIssue / activeIssue / expectedRunId / activeRunId を返す。

## Alternatives Considered
- 常に裸の `senti flow get status` を使い続ける。 — Issue #400 の再現原因そのものであり、別 active flow の autoApprove を読めるため採用しない。
- 別 active flow を自動 cleanup してから要求 Issue の flow を開始する。 — 対象外 flow を勝手に進めるため採用しない。Issue mismatch は停止してユーザーに明示する。
- runId status に一本化して裸 status を廃止する。 — current-context status display の既存 public behavior を壊すため採用しない。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-17T16:17:53.957Z
- Notes: autoApprove accepted gate-passed spec for Issue #400

## Requirements
- R1 [must]: Issue 指定付き flow entry は、`senti flow get status [runId] --expect-issue <n>` を mismatch check の integration point とし、resolved flow issue が要求 Issue と異なる場合、ACTIVE_FLOW_MISMATCH 相当の error で停止し、next-action、flow run、finalize-cleanup を実行しない。
- R2 [must]: active flow の runId が判明した後の autoApprove status check は、対象 runId の status を読み、別 active context の autoApprove を参照しない。preparing state では status の autoApprove を信頼せず、set-auto envelope と prepare inheritance を使う。
- R3 [must]: src/skills/partials/core-principle.md は、`exactly senti flow get status` / `no extra options` 前提を削除し、runId がある場合に `senti flow get status <runId>` を優先する guidance を含む。
- R4 [must]: `senti flow get status [runId] --expect-issue <n>` の ACTIVE_FLOW_MISMATCH 相当 error は、利用可能な範囲で expectedIssue、activeIssue、expectedRunId、activeRunId を machine-readable に返す。
- R5 [must]: Migration parity として、bare `senti flow get status` の current-context 表示、`senti flow get status <runId>` の target lookup、requires_approval / autoApprove の通常承認 behavior、finalize recovery exception behavior を保持する。
- R6 [must]: src/skills/ を変更した場合、senti upgrade を実行し、生成済み skill への反映差分を検証する。

## Acceptance Criteria
- specs/306-guard-flow-target-status/tests/ 配下の spec-local test が、`// spec: R1 ...` header 付きで、Issue #399 を要求している状態で active Issue #397 が存在する場合に `senti flow get status --expect-issue 399` または同等の entry check が ACTIVE_FLOW_MISMATCH 相当で停止し、#397 の next-action や finalize-cleanup を実行しないことを検証する。
- specs/306-guard-flow-target-status/tests/ 配下の spec-local test が、`// spec: R2 ...` header 付きで、active flow の runId がある autoApprove 確認は別 active flow の status ではなく対象 runId の status から値を読むことを検証する。
- specs/306-guard-flow-target-status/tests/ 配下の spec-local test が、`// spec: R2 ...` header 付きで、preparing flow の auto mode 承認直後は `senti flow get status <runId>` の autoApprove 値を信頼せず、`senti flow set auto on --run-id <runId>` の response と prepare inheritance を根拠に進むことを検証する。
- specs/306-guard-flow-target-status/tests/ 配下の spec-local test が、`// spec: R5 ...` header 付きで、bare `senti flow get status` は current execution context status display として従来どおり使えることを検証する。
- specs/306-guard-flow-target-status/tests/ 配下の spec-local test が、`// spec: R5 ...` header 付きで、`senti flow get status <runId>` は active/preparing の対象 runId state を返し、current context の別 active flow に影響されないことを検証する。
- specs/306-guard-flow-target-status/tests/ 配下の spec-local test が、`// spec: R5 ...` header 付きで、requires_approval=true / autoApprove=true の通常 auto-selection behavior と、autoApprove=true でも自動選択しない finalize recovery exception behavior が保持されることを検証する。
- specs/306-guard-flow-target-status/tests/ 配下の spec-local test が、`// spec: R3 ...` header 付きで、旧 skill guidance の `exactly senti flow get status` / `no extra options` 前提は削除され、新しい runId-aware guidance が skill source と upgraded skill の両方に存在することを検証する。

## Implementation Targets
- src/skills/partials/core-principle.md
- src/skills/senti.flow/SKILL.md
- .agents/skills/senti.flow/SKILL.md
- src/flow/lib/get-status.js
- src/flow/registry.js
- src/lib/flow-manager.js
- tests/
- specs/306-guard-flow-target-status/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add mismatch guard
  - Add flow entry protection so an Issue-specified request cannot continue an active flow for another Issue.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Rewrite status guidance
  - Update flow skill guidance so autoApprove checks use target runId status when runId is available.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Verify migration parity
  - Add regression coverage and upgrade evidence proving retained flow status and approval behaviors still work after the mismatch guard.
  - see `tasks/T-3.md` for full spec
