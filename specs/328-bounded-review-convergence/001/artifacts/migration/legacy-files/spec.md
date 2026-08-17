# Feature Specification: 328-bounded-review-convergence

**Feature Branch**: `feature/328-bounded-review-convergence`
**Created**: 2026-07-22
**Status**: Draft
**Input**: GitHub Issue #452

## Goal
reviewer の判定と review 実行機構の失敗を別々の型付き状態として永続化し、同じ target tree と evidence に対する review recovery を有限回に制限して、各 review step を通常の次工程、acceptance handoff、または明示的 blocker へ決定的に収束させる。

## Background
The current flow has separate pieces for review verdicts, subprocess retry, review retry metrics, reviewStop, retryRecovery, StepAttempt outcomes, phase artifacts, and acceptance findings. These pieces do not share one target/evidence identity or one terminal operation. A valid ADVISORY result can therefore remain operationally incomplete when provider launch, parsing, post-hook, or artifact recording fails, and recovery can re-enter the same review against unchanged evidence. Issue #452 requires review content and tooling execution to become independent persisted facts, with finite recovery and deterministic handoff. The change replaces an existing public behavior contract, so command, hook, config, artifact, state, side-effect, and acceptance parity are specified explicitly.

## Scope
- must: draft questions、draft coverage、spec、test、implementation、task review に共通する PASS・ADVISORY・REJECTED disposition と TOOLING_ERROR outcome。
- must: blocking finding 0 件の review 完了、ADVISORY finding の acceptance handoff、REJECTED の semantic remediation 上限後の handoff。
- must: provider 起動、通信・subprocess、parse、post-hook、canonical result 記録 failure の独立した tooling attempt state。
- must: review phase、task scope、target tree SHA、provenance、canonical evidence digest を含む duplicate identity と再実行拒否。
- must: finalized independent audit evidence を登録する target-guarded CLI と、その acceptance evidence 利用。
- must: next-action と status が一意の review operation、残り tooling attempt、handoff findings または blocker を返す contract。
- must: 既存 review commands、phase artifact paths、hooks、semantic maxAttempts、target guard、revision・CAS、acceptance judgment の migration parity。

## Out of Scope
- must: 外部 app server、review provider、sandbox、OS permission system 自体の修正。
- must: permission check の迂回、自動 privilege escalation、autoApprove による execution authority の付与。
- must: 個別 feature Issue の product Acceptance Criteria に属する implementation。
- must: review finding を同じ Issue に無制限に追加または修復する運用。
- must: review 以外の gate retry と recovery contract の再設計。

## Constraints
- Node.js built-in modules だけを使用し、外部 dependency を追加しない。
- ReviewDisposition、ReviewToolingOutcome、ReviewEvidenceIdentity、ReviewEvidence、ReviewPermittedOperation など意味のある値は専用 class と constructor invariant で表現し、type field を持つ object literal union を domain model として使用しない。
- src 以下に Issue #451・#452、特定 provider、特定 sandbox、利用 project 固有の値を埋め込まない。Regression fixture の Issue 固有値は spec-local tests にだけ置く。
- alpha policy に従い、artifact disposition の legacy FAIL と TOOLING_FAILURE、および next-action の同時 reviewStop・retryRecovery authority は保持しない。FAIL は REJECTED、tooling failure は disposition ではない TOOLING_ERROR outcome、recovery 表示は単一 reviewAction に置き換える。
- Canonical review evidence input は 1 MiB 以下、finding は合計 100 件以下、各 authored string は 4000 文字以下とし、超過は finding を生成しない TOOLING_ERROR とする。
- Independent evidence input file は active worktree 内の current spec directory に限定し、regular file、bounded read、JSON schema、target guard、current HEAD tree SHA、flow revision を state mutation 前に検証する。
- Semantic remediation maxAttempts と toolingMaxAttempts は別 budget とする。全 review node の toolingMaxAttempts は 1 とし、provider 切替や process 再起動で counter を分割しない。
- Canonical evidence file は immutable digest path へ idempotent に書き、flow state は CAS mutation で evidence reference、attempt、operation、step transition を一度に記録する。既存 phase artifact と acceptance projection は state-bound idempotent effect とし、projection failure が valid disposition を消さない。
- Target guard、revision・CAS、task scope、normal PASS・ADVISORY、acceptance user decision、exit-code error visibility を維持する。Error を empty catch で破棄しない。
- src/skills または src/presets を変更した場合は senti upgrade を実行し、active-flow upgrade artifact を gate evidence として残す。

## Design Principles
- Review content is authoritative independently from its delivery mechanism: valid disposition and tooling outcome can coexist without collapsing into one incomplete state.
- Use one canonical evidence identity and one persisted operation resolver so every caller observes the same bounded transition.
- Write immutable evidence before CAS state reference; make downstream projections replayable so recording-path recovery never requires rerunning the reviewer.
- Keep semantic remediation and mechanical tooling recovery separate in state, accounting, status, and next-action.
- Preserve public command and artifact ownership explicitly while removing ambiguous alpha-format values instead of maintaining compatibility branches.

## Overview
### Modules
- src/flow/lib/review-convergence.js owns dedicated disposition, tooling outcome, evidence identity, canonical evidence, attempt state, and permitted-operation classes plus deterministic resolution.
- src/flow/lib/review-evidence-store.js owns bounded input validation, canonical SHA-256 digesting, immutable spec-local evidence files, idempotent writes, and phase artifact projections.
- src/flow/lib/run-review.js and src/flow/commands/review.js normalize provider results and all execution/parse/recording failures into the shared convergence model without manufacturing findings from tooling errors.
- src/flow/registry.js keeps review command metadata and hook connection points; lifecycle hooks delegate typed result persistence and transition to the convergence module.
- src/flow/lib/set-review-evidence.js registers finalized independent audit evidence through a new flow set review-evidence command with normal target guards.
- src/flow/lib/get-next-action.js, get-status.js, set-retry.js, and definition.js expose the single permitted review operation and separate semantic/tooling attempt budgets.
- src/flow/lib/flow-findings.js and acceptance-review-artifacts.js project ADVISORY, exhausted REJECTED, and independent audit evidence into existing acceptance disposition ownership.
- src/flow/lib/review-convergence.js owns bounded review findings, dispositions, provenance, evidence identities, tooling outcomes, convergence state, and permitted-operation classes.

### Data Flow
- A review invocation resolves phase/task scope, current HEAD tree SHA, target guards, flow revision, and tooling budget before any provider execution.
- Provider output is normalized into PASS, ADVISORY, or REJECTED ReviewEvidence; startup, communication, parse, post-hook, or persistence failures are normalized separately into ReviewToolingOutcome(TOOLING_ERROR).
- Validated evidence is canonicalized and written idempotently to an immutable digest path, then one CAS flow-state mutation records its reference, disposition, tooling attempt, permitted operation, and lifecycle transition.
- Idempotent effects update the existing phase artifact path and acceptance finding projection. Effect failure remains tooling state; it does not remove the canonical disposition or authorize reviewer re-execution.
- next-action and status derive one ReviewPermittedOperation: retry_review, register_alternative_evidence, move_to_acceptance, or stop_as_blocker, including remaining attempts and exactly one handoff/blocker payload.
- Independent evidence registration follows the same canonicalization and CAS path, rejects stale/foreign/duplicate identity, and completes the same review lifecycle without launching a provider.
- Review evidence canonicalizes target and finding data before deriving its SHA-256 identity; convergence state then resolves exactly one typed recovery or handoff operation.

### Decisions
- [VERIFY] Current review execution already recognizes PASS, ADVISORY, FAIL, and TOOLING_FAILURE, but phase parsers and retry updates treat tooling outcomes differently; result=match with the reported convergence problem.
- [VERIFY] Current failure and dispatcher code can display review stop and retry recovery simultaneously rather than selecting one operation; result=match.
- [VERIFY] Existing acceptance owns impl-review, deferred flow findings, repair fingerprint validation, and final finding disposition; result=match for extending this owner with typed review evidence.
- [VERIFY] Existing review registry retains command metadata and post-hook connection points; result=match for keeping registry ownership while delegating convergence decisions.
- [CORRECTION] Draft inventory listed --log-file as a retained flow run review option; source contract does not expose it, so the spec preserves only source-verified options and does not add --log-file.
- Apply the shared convergence contract to all flow and task review phases while preserving phase-specific finding schemas and standard downstream ordering.
- Use one tooling retry after the initial failed attempt, then select finalized evidence registration, acceptance handoff, or blocker in that order when its preconditions hold.
- Make target-bound immutable evidence the recovery boundary so a post-result recording failure can be repaired without rerunning review.
- Review judgment and tooling failure remain separate immutable class hierarchies, with legacy verdict aliases rejected at construction boundaries.

## Clarifications (Q&A)
- Q: Does move_to_acceptance skip gate, implementation, retro, or other normal flow leaves?
  - A: No. It completes the current review leaf and persists handoff evidence. The definition promotes normal downstream leaves; acceptance consumes the evidence when its existing step is reached.
- Q: Is TOOLING_ERROR a fourth review disposition?
  - A: No. It is a separate execution outcome. A finalized PASS, ADVISORY, or REJECTED disposition may coexist with a later projection TOOLING_ERROR.
- Q: How are semantic and tooling attempts counted?
  - A: REJECTED consumes the existing definition maxAttempts for semantic remediation. TOOLING_ERROR uses a separate persisted toolingMaxAttempts=1 per phase/task/tree target and never increments semantic reviewRetry.
- Q: What is the independent evidence input shape?
  - A: A version-1 JSON document supplies provenance {provider, invocationId, capturedAt}, phase, taskId, treeSha, disposition, blockingFindings, and advisoryFindings. The CLI validates it and computes evidenceDigest; callers cannot supply or override the digest.
- Q: What public artifact changes intentionally break alpha-format consumers?
  - A: FAIL becomes REJECTED, TOOLING_FAILURE is removed from disposition values in favor of separate TOOLING_ERROR outcome, and simultaneous reviewStop/retryRecovery choices become a single reviewAction. Paths and phase-specific finding content remain.
- Q: Can autoApprove authorize provider or sandbox execution?
  - A: No. autoApprove only satisfies flow requires_approval choices and cannot change external execution authority.

## Alternatives Considered
- Extend ReviewFailure only and leave valid review results owned by existing phase artifacts. — Rejected because it cannot represent a valid finalized disposition together with a later recording-path failure, which is the Issue #451 regression.
- Keep FAIL, TOOLING_FAILURE, reviewStop, and retryRecovery as compatibility aliases beside the new model. — Rejected because the alpha policy prohibits compatibility branches and dual authorities would preserve the ambiguity that prevents convergence.
- Add evidence registration flags to flow run review. — Rejected because provider execution and authoritative state registration are different boundary operations; a dedicated flow set command keeps validation and mutation explicit.
- Track one tooling retry counter per provider or failure stage. — Rejected because switching provider or failure stage could multiply attempts against the same tree and evidence, violating the bounded process.
- Treat post-hook or recording failures as review rejection findings. — Rejected because tooling errors are not reviewer judgments and would reintroduce non-product findings into semantic remediation.
- Stop immediately on the first tooling error without alternative evidence registration. — Rejected because a finalized target-bound result may already exist and can safely complete the review without another provider execution.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-22T01:28:02.981Z
- Notes: autoApprove: spec review PASS、spec gate PASS、未解決 open question 0 件のため approval option [1] を自動選択

## Requirements
- R1 [must]: The review domain shall use dedicated classes that enforce these invariants: ReviewDisposition is exactly PASS, ADVISORY, or REJECTED; PASS has no findings; ADVISORY has zero blocking findings and at least one advisory finding; REJECTED has at least one blocking finding; TOOLING_ERROR is represented only by ReviewToolingOutcome and can never be a disposition or finding.
- R2 [must]: Every review execution or independent evidence registration shall bind phase, taskId-or-null, current target tree SHA, provenance, and a CLI-computed canonical evidence digest into ReviewEvidenceIdentity. The CLI shall reject a stale tree SHA, foreign phase/task target, target-guard or revision mismatch, malformed evidence, and a repeated phase/task/tree/digest identity before a new provider execution or state mutation; rejection shall leave canonical evidence files and flow-state bytes unchanged.
- R3 [must]: A valid PASS or ADVISORY result shall complete the current review step exactly once without another review invocation. ADVISORY findings shall be projected with target tree SHA and provenance for later acceptance disposition. REJECTED shall consume only the definition-driven semantic remediation budget; at exhaustion its blocking findings shall be handed to acceptance and the same phase/task/tree/evidence review shall not run again.
- R4 [must]: Provider startup, communication/subprocess, JSON parse/schema, post-hook, canonical evidence write, phase projection, and result-recording failures shall persist as TOOLING_ERROR outcomes with stage and attempt data, shall not create review findings or consume the semantic remediation budget, and shall share one persisted toolingMaxAttempts=1 budget per phase/task/tree target regardless of provider or process. After the permitted retry is consumed, another unchanged provider execution shall be rejected.
- R5 [must]: senti flow set review-evidence --file <path> with normal target guards shall accept a version-1 finalized independent audit document located under the current spec directory. It shall require provenance.provider, provenance.invocationId, provenance.capturedAt, phase, taskId-or-null, treeSha, disposition, blockingFindings, and advisoryFindings; enforce bounded input and disposition/finding consistency; compute the digest itself; persist canonical evidence idempotently; and use the same CAS convergence transition as provider review without launching a provider.
- R6 [must]: For an active review recovery state, next-action and status shall expose exactly one reviewAction kind among retry_review, register_alternative_evidence, move_to_acceptance, and stop_as_blocker. The projection shall include remainingToolingAttempts and exactly one of handoffFindings or blocker; it shall not emit simultaneous authoritative reviewStop and retryRecovery choices. move_to_acceptance means persist the handoff and complete the review leaf while normal definition ordering promotes subsequent non-review steps until acceptance consumes the evidence.
- R7 [must]: Migration shall preserve flow run review command routing, source-verified options, target guards, exit-visible failures, phase artifact paths, review.md, phase-specific finding content, post-hook lifecycle ownership, semantic maxAttempts, task scope, revision/CAS checks, normal PASS/ADVISORY promotion, flow-findings final disposition, and acceptance judgment. Legacy artifact verdict FAIL shall be replaced by REJECTED, TOOLING_FAILURE shall be replaced by separate TOOLING_ERROR outcome, and ambiguous reviewStop plus retryRecovery authority shall be replaced by reviewAction without compatibility aliases.
- R8 [must]: autoApprove shall affect only definition actions whose requires_approval is true. A sandbox, OS, provider, subprocess, or filesystem permission failure shall produce TOOLING_ERROR or stop_as_blocker according to the persisted tooling state, shall not request flow approval, and shall not trigger privilege escalation or provider-repair work outside this spec's acceptance criteria.
- R9 [must]: Spec-local tests shall cover R1 through R8 with separate fixtures for PASS, ADVISORY, REJECTED before and at remediation exhaustion, provider startup failure, communication/subprocess failure, JSON parse failure, post-hook failure, canonical write/projection failure after result retrieval, independent evidence registration, duplicate identity rejection, tree change revalidation, next-action/status operation uniqueness, autoApprove permission separation, and the Issue #451 ADVISORY with zero blocking findings plus recording-path failure regression.

## Acceptance Criteria
- ReviewDisposition and ReviewToolingOutcome unit tests reject TOOLING_ERROR as a disposition, reject inconsistent finding counts, and accept only the three specified dispositions.
- A valid PASS or ADVISORY fixture for each flow review phase and task review completes its review leaf once; ADVISORY evidence remains available to acceptance with matching phase, tree SHA, provenance, and digest, and a repeated run against the same identity is rejected without state-byte changes.
- REJECTED fixtures use the existing semantic maxAttempts, enter the existing repair route before exhaustion, and after exhaustion record acceptance findings and never return the same phase/task/tree/evidence to review.
- Startup, subprocess, parse, post-hook, evidence-write, and projection-write fixtures persist TOOLING_ERROR stage/attempt data without semantic findings or reviewRetry consumption; after one retry, unchanged execution returns the same deterministic refusal and unchanged state.
- A target-guarded flow set review-evidence command registers a valid bounded spec-local document, computes its digest, writes one immutable canonical artifact, updates the current review transition, and does not invoke a provider.
- Independent evidence with a stale tree SHA, foreign phase/task, malformed provenance, invalid disposition/finding relationship, out-of-worktree path, oversized input, target mismatch, revision drift, or duplicate identity fails before state mutation. Repeating the same failure is deterministic; changing HEAD allows a new identity.
- next-action and status fixtures for every recovery branch contain one reviewAction only, accurate remainingToolingAttempts, and either handoffFindings or blocker but never both; no reviewStop/retryRecovery pair remains authoritative.
- Behavior-level CLI tests confirm flow run review retains --phase, --agent-work-dir, --dry-run, --skip-confirm, target guards, runtime logging, exit-visible errors, review.md, and existing phase artifact paths; --log-file is not introduced.
- Hook and artifact integration tests confirm normal PASS/ADVISORY phase promotion, task scope, semantic maxAttempts, target guards, revision/CAS, phase-specific findings, flow-findings final dispositions, and existing acceptance judgments still work through the typed path.
- With autoApprove enabled, permission-related fixtures return TOOLING_ERROR or stop_as_blocker and no requires_approval prompt, privilege escalation, provider switch, or unrelated repair instruction.
- Spec-local files under specs/328-bounded-review-convergence/tests/ carry // spec: R<N> headers covering R1 through R9, targeted project regression passes in test-execute, and full project regression remains owned by final-regression.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Model review convergence values
  - Introduce the dedicated class model for review dispositions, tooling outcomes, evidence identities, canonical evidence, attempt state, and permitted operations.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Persist review execution outcomes
  - Route provider review results and tooling stages through one canonical evidence and CAS state transition path.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Register independent review evidence
  - Add the target-guarded flow set review-evidence boundary for finalized spec-local audit documents.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Resolve bounded review actions
  - Make definition, retry reset, next-action, and status derive one permitted review recovery operation from persisted semantic and tooling state.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Project review evidence into acceptance
  - Extend existing flow-finding and acceptance ownership to consume typed ADVISORY, exhausted REJECTED, and independent audit evidence.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Add convergence regression fixtures
  - Provide complete spec-local and shared behavior-level regression coverage for the migrated review surfaces.
  - see `tasks/T-6.md` for full spec
