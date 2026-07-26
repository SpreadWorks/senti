# Feature Specification: 332-acceptance-test-migration

**Feature Branch**: `feature/332-acceptance-test-migration`
**Created**: 2026-07-25
**Status**: Draft
**Input**: GitHub Issue #455

## Goal
削除済み buildAcceptanceReviewArtifactFromEvidence export に依存する6件の historical regression scenario を現行 production lifecycle へ移行し、その実行で検証された flow-runtime defect を限定修正する。

## Background
Six historical regression files import a deleted specDir-only acceptance artifact builder and fail before reaching their intended behavior assertions. The current lifecycle binds acceptance to complete mechanical evidence, repair fingerprints, deferred source findings, class-based normalization, writer validation, and flow-state transitions. The migration must retain each scenario through those owners without restoring the obsolete contract.

## Scope
- specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js の mechanical evidence と verdict policy scenario。
- specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs の deferred finding disposition scenario。
- specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js の producer-to-acceptance artifact contract scenario。
- specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js の review/gate retry exhaustion handoff scenario。
- specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js の no-tests downstream lifecycle scenario。
- specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js の test-review post-hook handoff scenario。
- 現行 production APIs を呼び出すための共通 test fixture assembly と spec-local migration coverage。

## Out of Scope
- buildAcceptanceReviewArtifactFromEvidence または同等の compatibility export、shim、alias の再導入。
- acceptance-review production lifecycle、schema、verdict policy、flow transition の再設計。
- Issue #443 の変更。
- production から到達不能な acceptance outcome builder や test-only product API の追加。
- acceptance-review lifecycle と無関係で、今回の flow 実行を妨げない既存 product defect の修正。

## Constraints
- Node.js 組み込みモジュールだけを使用し、外部 dependency を追加しない。
- acceptance-review lifecycle の production behavior、公開 export、user-facing command、CLI help、config entry、schema を変更しない。
- 対象テストは現行 buildAcceptanceReviewContext、artifactFromAcceptanceJudgments、writeAcceptanceReviewArtifact、applyAcceptanceReviewResult、または RunAcceptanceReviewCommand の production-reachable contract を使用する。
- 共通 test helper は production inputs と flow fixture を組み立てて現行 production API を呼ぶ責務に限定し、acceptance outcome や verdict を独自生成しない。
- AcceptanceReviewOutcome、DeferredAcceptanceFinding、MechanicalBlocker など現行 class-based value contract を迂回する object-literal compatibility layer を作らない。
- test skip、assertion 削減、旧 behavior に合わせた期待値の弱体化、対象 scenario の部分実行で回帰を隠さない。
- 今回の flow 実行を直接妨げ、原因 owner と回帰範囲を確認した flow-runtime defect は、ユーザーの明示承認により issue-log と回帰テストを伴って限定修正する。その他の product defect はテストを弱めず別 BUG として切り分ける。
- flow-runtime 修正は repair artifact freshness、uncommitted diff identity、semantic retry reset、current-review obligation、spec-correction rewind の各 owner に限定する。
- 対象6 complete regression file を個別に実行し、最後に project full regression を通す。

## Design Principles
- Historical test consumer を現行 production owner に追従させ、削除済み consumer contract を復活させない。
- Scenario の元の意味を、現行 verdict、deferred disposition、artifact persistence、flow transition の behavior-level assertion で証明する。
- 同じ production context assembly が2箇所以上で繰り返される場合は共通 test fixture helper に抽出する。
- Acceptance artifact は current repair fingerprint、required mechanical artifacts、deferred source evidence と結び付ける。

## Overview
### Modules
- src/flow/lib/acceptance-review-artifacts.js owns current acceptance value classes, mechanical blocker classification, context construction, artifact normalization, validation, persistence, deferred finding mirror, and flow result application.
- src/flow/lib/run-acceptance-review.js owns production orchestration from implementation diff and evidence context through response binding, artifact construction, and flow application.
- The six historical spec regression files remain the behavior owners for verdict policy, deferred producer handoff, retry exhaustion, no-tests state, and post-hook deferral.
- A shared test fixture helper may assemble complete production inputs when two or more target files require the same root, flow state, repair fingerprint, and mechanical artifact setup; it must call existing production exports.
- specs/332-acceptance-test-migration/tests provides requirement-header coverage that rejects the deleted export and proves every target file executes through the current contract.
- tests/helpers/acceptance-review-fixture.js owns reusable current acceptance-review input assembly for complete flow state, repair fingerprints, mechanical evidence, deferred source findings, and no-tests state.
- spec 290 verdict-policy regression now uses AcceptanceReviewFixture with buildAcceptanceReviewContext and artifactFromAcceptanceJudgments to preserve persisted mechanical blocker coverage.
- spec 301 no-tests regression now reuses AcceptanceReviewFixture and runAcceptanceReviewFixture while retaining downstream artifact, report, and finalize assertions.
- Specs 293, 295, 296, and 310 now use AcceptanceReviewFixture for deferred finding acceptance coverage while retaining their producer and post-hook setup.
- Flow runtime repair owners now validate repair-migration freshness, include tracked worktree diffs in review identity, and recover exhausted tooling reviews through the existing retry mutation.

### Data Flow
- Historical fixture setup writes current spec, flow state, mechanical evidence, review/gate source findings, and repair fingerprint inputs.
- buildAcceptanceReviewContext validates required artifacts, projects test/review evidence, and collects deferred findings with their source evidence.
- artifactFromAcceptanceJudgments binds requirement judgments and deferred dispositions into an AcceptanceReviewOutcome whose verdict is derived by current policy.
- writeAcceptanceReviewArtifact validates schema, requirement and deferred coverage, requires the current fingerprint, writes acceptance-review.json, and mirrors final dispositions to flow-findings.json.
- applyAcceptanceReviewResult records acceptance state and routes pass to final-regression, repair_required to impl-triage, user_decision_required to acceptance-decision, and mechanical blocked evidence back to acceptance review.
- AcceptanceReviewFixture creates a bounded temporary repository, pins a repair baseline, stamps current evidence artifacts, and exposes state/context inputs; runAcceptanceReviewFixture then composes only existing production context, artifact, writer, and application exports.
- Partial persisted test evidence enters buildAcceptanceReviewContext, produces missing_tests and missing_required_tests blockers, and reaches artifactFromAcceptanceJudgments plus current blocked verdict derivation.
- No-tests fixture evidence flows through buildTestResultsFromArtifacts, integration trust validation, current acceptance construction, report rendering, and finalize artifact loading.
- Producer-generated finding identifiers and source coordinates feed the shared fixture; current context binding resolves explicit dispositions, persistence mirrors finalDisposition, and flow application routes unresolved risk to acceptance-decision.
- Current repair fingerprints flow through test evidence, repair deltas, review artifacts, gate obligations, and spec-correction rewind validation so stale evidence cannot authorize resumption.

### Decisions
- [VERIFY] acceptance-review-artifacts.js exposes the current class-based artifact, context, writer, verdict, and flow-application contracts and does not expose buildAcceptanceReviewArtifactFromEvidence; result=match.
- [VERIFY] production command orchestration builds current diff/context, binds response evidence, constructs the artifact, and applies the result; result=match.
- [VERIFY] the writer requires current fingerprint evidence, validates deferred finding coverage, and mirrors final dispositions; result=match.
- [CORRECTION] historical amend_required expectations map to current user_decision_required when unresolved deferred risk remains; blocked is reserved for mechanical blockers.
- [CORRECTION] the deleted specDir-only evidence builder is replaced by complete production context plus current artifact construction, writer, and application contracts.
- Existing-feature impact is limited to six historical test consumers, their shared fixture, and the bounded flow-runtime owners needed to resume this flow; acceptance-review lifecycle, user-facing commands, config, public exports, and schemas remain unchanged.
- [CORRECTION] The migration exposed flow-runtime defects whose continued presence prevents deterministic resumption; repair is limited to their established owners rather than changing acceptance-review behavior.
- Use one class-based test fixture for repeated current acceptance input setup while keeping verdict derivation, normalization, persistence, and flow transitions in production modules. Evidence: T-1 imports and invokes the current production exports without implementing those decisions.
- Keep spec 290 blocker assertions on context.mechanicalBlockers and additionally assert the current derived blocked verdict instead of reconstructing the deleted specDir-only builder.
- Use the shared no-tests fixture for spec 301 so acceptance, report, finalize, and durable path assertions consume one current fingerprint-bound evidence state.
- Translate historical amend_required and deferred-only blocked expectations to user_decision_required, while preserving blocked assertions for missing deferred source evidence as a mechanical blocker.
- Filter review obligations by the latest repair fingerprint while retaining legacy artifacts without a fingerprint; share the supported spec-correction stages between rewind eligibility and audit validation.

## Clarifications (Q&A)
- Q: Can a shared test helper be introduced without violating the test-only shortcut prohibition?
  - A: Yes, only when it assembles production inputs and calls existing production exports. It may not derive verdicts, normalize acceptance outcomes, bypass writer validation, or expose a replacement product contract.
- Q: How should old amend_required or blocked assertions be migrated?
  - A: Assert the current policy: unresolved deferred hard blockers route to user_decision_required, mechanical blockers produce blocked, notMet judgments produce repair_required, and fully met evidence produces pass.
- Q: What happens if the production path exposes a current defect?
  - A: Keep the scenario and assertion strength. For a flow-runtime defect that directly prevents this migration from resuming, has a verified owner and regression coverage, the user's explicit authorization permits a bounded same-flow repair; otherwise record the evidence and separate it as another BUG.

## Alternatives Considered
- Restore buildAcceptanceReviewArtifactFromEvidence as a compatibility export. — Rejected because Issue #455 explicitly prohibits the deleted compatibility contract and the alpha policy does not retain deprecated paths.
- Replace each call with a test-only artifact object builder. — Rejected because it bypasses current production context, fingerprint, validation, writer, and flow transition behavior.
- Change only imports or weaken old verdict assertions until files pass. — Rejected because module-load success alone does not preserve scenario semantics or migration parity.
- Redesign acceptance-review lifecycle while migrating tests. — Rejected as outside Issue #455 and incompatible with separating newly exposed product defects.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-25T11:41:28.461Z
- Notes: Auto-approved from the user's explicit instruction to repair verified flow-runtime defects and continue.

## Requirements
- R1 [must]: All six target regression files shall remove every import, require, or invocation of buildAcceptanceReviewArtifactFromEvidence, and production source shall not add an equivalent compatibility export.
- R2 [must]: Repeated acceptance fixture assembly shall call current production context, artifact, writer, and flow-application exports with complete flow state, mechanical evidence, deferred source evidence, and repair fingerprint inputs, without independently constructing acceptance outcomes.
- R3 [must]: The spec 290 regression shall derive missing_tests and missing_required_tests from persisted evidence and shall validate the current blocked, repair_required, user_decision_required, and pass verdict policy.
- R4 [must]: The spec 293 regression shall preserve all six deferred final dispositions, exact source finding identity and evidence binding, and current unresolved-risk verdict behavior.
- R5 [must]: The spec 295 regression shall preserve producer artifact aggregation into flow-findings and acceptance-review artifacts for every covered review and gate producer.
- R6 [must]: The spec 296 regression shall preserve review/gate retry exhaustion dispositions, acceptance-review persistence, flow-findings mirror side effects, missing-source blocking, and current acceptance routing.
- R7 [must]: The spec 301 regression shall consume no-tests artifacts as a valid acceptance pass state and preserve downstream report, finalize, durable pathspec, and final-regression skip behavior.
- R8 [must]: The spec 310 regression shall preserve test-review post-hook deferred finding handoff, source identity, final disposition, acceptance verdict, and flow transition behavior.
- R9 [must]: Each of the six complete target regression files, spec-local migration tests, and the final project regression shall pass without weakened assertions.
- R10 [must]: The user-authorized flow-runtime repairs shall: skip a completed repair migration only when its raw evidence, v2 test result repairFingerprint, and repair delta all match the current fingerprint; include tracked uncommitted diff bytes in review identity; create a tooling recovery mutation only after the configured single tooling review attempt is exhausted; evaluate review obligations only for the latest repairFingerprint while retaining legacy evidence without a fingerprint; accept spec-correction rewinds from implement, impl-review, impl-gate, retro, acceptance-review, and final-regression; and bypass scenario-validity's implementation-diff preflight only when the latest plan rewind category is spec-correction. Acceptance-review lifecycle contracts remain unchanged.

## Acceptance Criteria
- [AC1/R1] Repository search finds no buildAcceptanceReviewArtifactFromEvidence reference in the six target files or src/, and src/ exports contain no replacement compatibility entry.
- [AC2/R2] Shared fixture code, where used, assembles current inputs and invokes production exports; it contains no custom acceptance verdict derivation, outcome normalizer, writer bypass, or test-only product export.
- [AC3/R3] The complete spec 290 file passes and asserts persisted mechanical blockers plus all current verdict categories represented by its scenarios.
- [AC4/R4] The complete spec 293 file passes and asserts six deferred dispositions, source identities/evidence, and user_decision_required for unresolved deferred risk.
- [AC5/R5] The complete spec 295 file passes and asserts every covered producer reaches flow-findings aggregation and the current acceptance artifact path.
- [AC6/R6] The complete spec 296 file passes and asserts retry exhaustion disposition, acceptance-review.json persistence, flow-findings.json mirror, missing-source handling, and current routing.
- [AC7/R7] The complete spec 301 file passes and asserts no-tests acceptance pass, schema validation, report/finalize consumption, durable artifacts, and skipped final regression policy.
- [AC8/R8] The complete spec 310 file passes and asserts test-review finding handoff, source identity, fixed/still_open/blocking dispositions, current verdict, and flow-state routing.
- [AC9/R9] Spec-local tests with // spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 coverage pass, all six target files pass in full without weakened assertions, and final-regression passes.
- [AC10/R10] tests/unit/flow/repair-state-identity.test.js, review-evidence-tree.test.js, finding-gate-readiness.test.js, reopen-draft-spec-correction.test.js, and run-scenario-validity.test.js pass. Guarded scenario-validity runs after the spec-correction rewind; test-execute writes result=ok with version=2; test-result-review writes verdict=pass; impl review has zero blocking findings; integration gate returns pass; retro returns ok; final-regression writes result=pass; and the diff changes no acceptance-review lifecycle public export, schema, or user-facing command.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Create production acceptance fixture
  - Provide reusable test input assembly for current acceptance-review production contracts without creating a replacement outcome builder.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Migrate verdict state regressions
  - Move the spec 290 verdict-policy and spec 301 no-tests scenarios onto current context, artifact, validation, and downstream lifecycle contracts.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Migrate deferred finding regressions
  - Move producer, retry exhaustion, and post-hook deferred finding scenarios onto current context, disposition, writer, mirror, and flow-application contracts.
  - see `tasks/T-3.md` for full spec

### Round 1
- **T-4** [pending]: Repair flow resumption defects
  - Repair only the flow-runtime ownership boundaries that made the verified migration evidence stale, misidentified, or impossible to resume from a gate-stage correction.
  - see `tasks/T-4.md` for full spec
