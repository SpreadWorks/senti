# Feature Specification: 305-reduce-flow-ai-calls

**Feature Branch**: `feature/305-reduce-flow-ai-calls`
**Created**: 2026-06-17
**Status**: Draft
**Input**: GitHub Issue #398

## Goal
flow の AI 呼び出し回数、入力 token、応答待ち時間を減らすため、AI 判断そのものは残しつつ、周辺処理を deterministic な前処理・圧縮・分離・監査可能 artifact に寄せる調査結果と実装方針を spec-local artifact として整理する。

## Background
Issue #398 targets flow latency and AI round trips outside the separate concern of deterministic guardrail judgment. Recent specs 293-299 show heavy AI usage in impl-review, spec-review, test-review, impl-gate, and finalize-sync. The root problem is not only whether AI judgments are correct, but that large surrounding context, repeated prompt inputs, docs generation, JSON repair, and review/gate artifact processing can force AI calls or large prompts where deterministic preprocessing, compression, artifact normalization, or delayed execution may preserve quality with less wait time.

## Scope
- specs/305-reduce-flow-ai-calls/research/ 配下に、phase 別候補、skill 責務分割、review manifest prototype、test coverage matrix prototype、fallback policy、docs/staticization policy、JSON normalizer policy、findings aggregation policy、measurement results、migration parity map を含む research artifact を作成する。
- Issue #398 が挙げた impl-review、spec-review、test-review、impl-gate、finalize-sync、skill slimming、context.search、auto-check、docs.enrich/docs.text/README/AGENTS、AI JSON repair、triage/repair artifact、requirement compliance precheck を調査対象に含める。
- clarifications の `Primary measurement sample directories` に列挙した 8 spec directories を primary sample とし、agent call count、duration、input token、retry count、finalize-sync time、completion rate の baseline と projected-after model を記録する。
- manifest / matrix / static score / normalizer / docs classification が不足した場合に既存 full AI path へ fallback する条件を phase ごとに定義する。
- 移動・分割・置換候補ごとに、既存公開表層 inventory、retained behavior owner mapping、intentional removal decision、behavior-level verification を定義する。
- spec-local tests で research artifact の schema、必須 phase coverage、fallback 条件、measurement coverage、migration parity coverage を検証する。

## Out of Scope
- AI guardrail 判定そのものを deterministic 化しない。
- pre-auto-check UX / preflight loop の改善をこの spec で扱わない。
- AI 判断を全面撤去しない。
- review / gate / docs / auto-check の production path へ全候補を一括統合しない。
- npm publish、dist-tag、external release 操作は行わない。
- Issue #398 を複数 spec に分割しない。

## Constraints
- 外部依存は追加しない。research artifact 検証や helper が必要な場合は Node.js built-in modules のみを使う。
- `src/` に project 固有情報を埋め込まない。specs 293-299 の metrics や Issue #398 固有の計測結果は spec-local research artifact に閉じる。
- AI 判断を削除しない。deterministic artifact が不足または不一致を検出した場合は既存 full AI path へ fallback する条件を必ず残す。
- Migration parity guardrail に従い、既存公開振る舞いを移動・分割・置換する候補は inventory、owner mapping、intentional removal decision、behavior-level verification を持つ。
- `bounded-resource-usage`: measurement と artifact validation は clarifications の `Primary measurement sample directories` と spec-local research files に範囲を限定し、全 specs / 全 prompt logs の無制限 scan をしない。
- docs と source が矛盾する場合は source を正とする。draft 前確認では src 側が docs より新しいため、source verification を優先する。
- `src/skills/` または `src/presets/` を変更する場合は `senti upgrade` を実行し、upgrade evidence artifact を残す。

## Design Principles
- 調査結果は prose だけでなく JSON artifact として残し、review / gate / acceptance の後続判断が機械的に参照できる形にする。
- AI call 削減候補は、期待効果、品質リスク、fallback 条件、behavior-level verification を同じ単位で比較する。
- skill slimming は user approval / destructive recovery など安全例外を skill に残し、通常 step metadata と retry/context 指示を CLI envelope に寄せる方向で評価する。
- manifest / matrix / normalizer は AI prompt 入力を圧縮するための補助 artifact であり、AI 判断の代替ではない。
- measurement は call count / token だけでなく retry、issue-log、acceptance loop、finding detection、docs quality、completion rate を含める。

## Overview
### Modules
- `src/flow/lib/get-next-action.js`: next-action envelope を構築し、step、instructions、context、output_schema、requires_approval、maxAttempts、retryRecovery 相当の dispatcher input を返す。
- `src/flow/commands/review.js`: draft/spec/test/impl review の prompt、diff、coverage、findings、review artifact、JSON repair integration を扱う。
- `src/flow/lib/run-auto-check.js`: auto mode eligibility を static gates と AI scoring で判定する。
- `src/flow/lib/run-finalize-sync.js`: finalize-sync で docs build を実行し、docs / AGENTS / CLAUDE / README / analysis を commit 対象にする。
- `src/docs/commands/build.js`: scan / enrich / init / data / text / readme / agents / translate の docs build pipeline を実行する。
- `src/lib/json-parse.js`: AI response の壊れた JSON を parser ベースで修復する。
- `specs/305-reduce-flow-ai-calls/research/`: この spec の調査結果と prototype specification を保持する spec-local artifact directory。
- `specs/305-reduce-flow-ai-calls/tests/`: research artifact の schema、coverage、measurement、migration parity を検証する spec-local tests。

### Data Flow
- Existing source and Issue #398 metrics are summarized into `phase-candidates.json`, with one row per phase/candidate and fields for current AI surface, deterministic candidate, expected effect, quality risk, fallback condition, related code, and verification.
- Review-related candidates are specified as `review-manifest-prototype.json` and `test-coverage-matrix-prototype.json`; both define producer inputs, JSON shape, consumer phase, fallback condition, and audit fields.
- Search/check/docs/JSON/finding candidates are specified as policy artifacts that define static pass/fail/boundary rules and the condition that returns to the existing AI path.
- Measurements from the exact directories in clarifications `Primary measurement sample directories` are normalized into `measurement-results.json`, which records before baseline and projected-after impact by candidate group.
- Migration parity information is normalized into `migration-parity-map.json`, mapping each retained public surface to its current owner, proposed owner, fallback owner, and behavior-level verification.

### Decisions
- [VERIFY] next-action already owns dispatcher envelope fields that skill slimming can target.
- [VERIFY] review command is the central source for manifest and matrix opportunities.
- [VERIFY] finalize-sync currently runs docs build on the blocking finalize path.
- [VERIFY] docs build contains deterministic and AI-capable steps that can be separated by policy.
- [VERIFY] JSON repair already has deterministic parser behavior that can be extended into normalizer policy.
- Keep this spec research-first and artifact-driven.
- Use the exact directories in clarifications `Primary measurement sample directories` as the primary measurement sample, including both 299-prefixed directories.
- Fallback and audit are mandatory for every staticization candidate.

## Clarifications (Q&A)
- Q: Primary measurement sample directories
  - A: The primary sample is exactly: specs/293-bounded-defer-review; specs/294-setup-preset-options; specs/295-producer-artifact-contract; specs/296-review-gate-defer; specs/297-setup-official-presets; specs/298-fix-presets-list-tree; specs/299-agent-config-setup; specs/299-worktree-config-preflight.
- Q: Minimum retained public surfaces
  - A: The migration parity minimum surfaces are exactly: flow skill dispatch procedure; senti flow get next-action envelope; senti flow run review --phase draft; senti flow run review --phase spec; senti flow run review --phase test; implementation review command path; senti flow run gate; senti flow get context --search; senti flow run auto-check; senti flow run finalize-sync; senti docs build pipeline; AI JSON repair behavior; flow-findings artifact; issue-log artifact; acceptance-review evidence artifact.
- Q: Does this spec implement every production optimization candidate?
  - A: No. It produces audited research artifacts, prototype specifications, measurement results, and tests. Full production integration of individual candidates can be scheduled from these artifacts.
- Q: Does this spec remove AI judgment?
  - A: No. Each deterministic candidate must define fallback to the existing AI path when the artifact is insufficient or quality risk is detected.
- Q: What does projected-after mean in measurement results?
  - A: It is a model derived from candidate fallback policies and baseline metrics, not a claim that production runtime has already changed.
- Q: Why are research artifacts JSON rather than only markdown?
  - A: JSON artifacts allow spec-local tests to verify coverage, fallback fields, and migration parity fields mechanically.

## Alternatives Considered
- Implement all production optimizations in one spec. — Rejected because it would span review, gate, docs, context search, auto-check, skill deployment, findings, and JSON repair production paths, making fallback quality comparison too broad for one flow.
- Write only a prose research note. — Rejected because Issue #398 requires measurable before/after results and auditable candidate/fallback conditions; prose alone is not mechanically testable.
- Treat static artifacts as replacements for AI review. — Rejected because the issue explicitly excludes removing AI judgment entirely and requires fallback to existing AI paths when static artifacts are insufficient.
- Measure only token and call count reduction. — Rejected because quality preservation also requires finding detection, docs quality, retries, issue-log, acceptance loop, finalize-sync wait time, and completion rate.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-17T14:55:59.674Z
- Notes: User approved the gate-passed spec for Issue #398.

## Requirements
- R1 [must]: Create `phase-candidates.json` with entries for skill slimming, spec-review, impl-review, test-review, impl-gate, context.search, auto-check, finalize-sync/docs build, docs.enrich/docs.text/README/AGENTS, AI JSON repair, findings aggregation, triage/repair artifact generation, and requirement compliance precheck; each entry records current AI surface, deterministic candidate, expected effect, quality risk, fallback condition, related code, and behavior-level verification.
- R2 [must]: Define skill slimming responsibility split with rules that move normal step branching, retry metadata, context instructions, output schema, and post-hook guidance toward CLI next-action envelope fields while retaining user approval boundaries, autoApprove exceptions, worktree boundary, and destructive recovery prompts in the skill.
- R3 [must]: Define `review-manifest-prototype.json` for spec-review and impl-review with producer inputs, JSON fields, consumer phase, fallback conditions, audit fields, and behavior-level verification for full review parity.
- R4 [must]: Define `test-coverage-matrix-prototype.json` for test-review with requirement IDs, test files, test names, assertion or executable block counts, skipped/helper-only markers, scenario-validity/test-execute references, fallback conditions, audit fields, and behavior-level verification.
- R5 [must]: Define fallback policies for context.search and auto-check that separate rule-based pass/fail cases from boundary cases requiring AI, including the condition that context.search AI keyword selection runs only when deterministic search is insufficient and fallback is explicitly allowed.
- R6 [must]: Define finalize-sync/docs build separation policy and docs staticization inventory covering deterministic docs build, AI enrich/text/readme/agents/translate steps, warning or follow-up artifact options, differential run conditions, and docs quality verification.
- R7 [must]: Define JSON normalizer, findings de-dupe/aggregation, generated triage/repair artifact, and requirement compliance precheck policies with keys, schema normalization rules, severity merge rules, grouped audit representation, and AI fallback or hard-fail boundaries.
- R8 [must]: Create `migration-parity-map.json` that covers every surface listed in clarifications `Minimum retained public surfaces`, maps current owner to proposed owner or explicit removal decision, names fallback owner, and lists at least one behavior-level verification for each retained surface.
- R9 [must]: Create `measurement-results.json` using every directory listed in clarifications `Primary measurement sample directories` as the primary sample and recording before baseline plus projected-after model for agent call count, duration, input token, retry count, finalize-sync time, completion rate, finding detection risk, docs quality risk, issue-log impact, and acceptance-loop impact.
- R10 [must]: Add spec-local tests under `specs/305-reduce-flow-ai-calls/tests/` that validate required research artifact files, required phase coverage, required fallback fields, measurement metric coverage, and migration parity coverage.

## Acceptance Criteria
- R1: `phase-candidates.json` contains at least one candidate for every phase or topic listed in R1, and every candidate has non-empty current AI surface, deterministic candidate, expected effect, quality risk, fallback condition, related code, and verification fields.
- R2: The skill responsibility split artifact lists at least the retained skill responsibilities and CLI envelope responsibilities named in R2, and maps them to related code or generated skill surfaces.
- R3: `review-manifest-prototype.json` defines spec-review and impl-review sections with producer inputs, fields, fallback conditions, audit fields, and parity verification.
- R4: `test-coverage-matrix-prototype.json` defines requirement-to-test fields and skipped/helper-only/execution evidence markers with fallback conditions.
- R5: The fallback policy artifact includes context.search and auto-check, with deterministic pass/fail/boundary conditions and explicit AI fallback conditions.
- R6: The docs policy artifact separates deterministic docs build candidates from AI-capable docs steps and defines quality verification and warning/follow-up handling.
- R7: The normalization/aggregation policy artifact defines JSON repair normalization boundaries, de-dupe keys, severity merge, grouped audit representation, generated triage/repair template boundaries, and requirement compliance precheck fallback.
- R8: `migration-parity-map.json` includes every surface listed in clarifications `Minimum retained public surfaces` and gives current owner, proposed owner or removal decision, fallback owner, and behavior verification.
- R9: `measurement-results.json` includes every directory listed in clarifications `Primary measurement sample directories`, records all required metrics, and distinguishes observed before baseline from projected-after model values.
- R10: Spec-local tests pass and fail if a required artifact, phase/topic, fallback field, measurement metric, or migration parity field is missing.

## Implementation Targets
- specs/305-reduce-flow-ai-calls/research/
- specs/305-reduce-flow-ai-calls/tests/
- src/flow/lib/get-next-action.js
- src/flow/commands/review.js
- src/flow/lib/run-auto-check.js
- src/flow/lib/run-finalize-sync.js
- src/docs/commands/build.js
- src/lib/json-parse.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Inventory AI reduction candidates
  - Create the phase-by-phase candidate inventory and skill responsibility split artifacts.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Specify review input artifacts
  - Define review manifest and test coverage matrix prototype specifications.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Define fallback policies
  - Define fallback and staticization policies for context.search, auto-check, finalize-sync/docs build, docs staticization, JSON normalization, findings aggregation, triage/repair artifacts, and requirement compliance prechecks.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Record measurement evidence
  - Create migration parity and measurement artifacts for the research plan.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Validate research artifacts
  - Add spec-local tests that fail when required research artifacts, phase coverage, fallback fields, measurement metrics, or migration parity fields are missing.
  - see `tasks/T-5.md` for full spec
