# Feature Specification: 256-prompt-cache-review

**Feature Branch**: `feature/256-prompt-cache-review`
**Created**: 2026-05-10
**Status**: Draft
**Input**: GitHub Issue #320

## Goal
Restore prompt-cache creation for review-spec and review-draft on providers that report cache_creation_input_tokens by moving current reviewer role, focus/rule, and output-format instructions into system prompts through PromptBuilder. Refactor PromptBuilder's section API and record provider/profile attribution in flow metrics.

## Background
Issue #320 reports cacheCreation=0 for review-spec and review-draft after prior PromptBuilder work. The affected review prompts still assemble reviewer role, rules/focus, format guidance, and dynamic artifact/context into a single user prompt. That prevents providers with system-prompt cache creation from seeing stable review instructions through the system prompt path. The same investigation found that flow metrics record token/cache/cost totals but not provider/profile attribution, making future cache regressions harder to diagnose.

## Scope
- [must] src/lib/prompt-builder.js exposes addUserPrompt(header, content) and addSystemPrompt(header, content); setRole, setRules, setJsonSchema, and setFmtFallback remain overwrite-only.
- [must] Every production PromptBuilder.add(...) call in src/ is migrated; a targeted scanner for PromptBuilder variables finds no `<promptBuilder>.add(...)` calls.
- [must] src/flow/commands/review.js review-spec and review-draft prompts use PromptBuilder and pass systemPrompt/userPrompt to agent calls.
- [must] src/flow/commands/review.js test-review gap-analysis and gap-fix calls pass the pre-loop testDesign value through systemPrompt.
- [must] Flow agent metrics include string fields provider and profileKey; get-status / metrics token JSON aggregate them under providers[provider][profileKey] with exact bucket schemas.
- [must] Tests cover PromptBuilder output, migrated review prompts, absence of PromptBuilder.add in src/, provider/profile metric attribution, and exact numeric metric aggregation.

## Out of Scope
- Public CLI command names and options.
- External npm dependencies.
- Provider token parsing semantics except passing provider/profile identity into metrics.
- Behavioral redesign of docs prompts beyond renaming PromptBuilder.add to addUserPrompt.
- npm publish, npm dist-tag, release tagging.

## Constraints
- Node.js built-in modules only; no dependency additions.
- Alpha policy: remove the old PromptBuilder.add API instead of keeping compatibility aliases.
- PromptBuilder remains provider-agnostic; provider-specific CLI behavior stays in agent/provider layers.
- Metric readers must tolerate older flow.json entries without provider/profile by aggregating them under providers.unknown.unknown.
- No public CLI interface changes; exit-code contracts for existing commands remain unchanged.

## Design Principles
- Make prompt section target explicit at the call site: addUserPrompt for user content, addSystemPrompt for system content.
- Keep docs command migrations behavior-preserving: docs call sites use user prompt sections unless they already passed a systemPrompt.
- Make cache and cost diagnostics provider-aware; cacheCreation=0 is meaningful only with provider/profile context.
- Use exact string and numeric assertions in tests instead of subjective prompt quality checks.

## Overview
### Modules
- src/lib/prompt-builder.js — refactor section storage into system/user append lists and expose addUserPrompt/addSystemPrompt.
- src/flow/commands/review.js — migrate review-spec, review-draft, and test-review gap prompts to PromptBuilder system/user payloads.
- src/flow/commands/review.js buildDraftSystemPrompt — keep impl-review reviewer/guardrail perspectives in the system prompt when migrating its PromptBuilder.add usage.
- src/lib/agent.js / src/lib/provider.js / src/lib/flow-store.js — pass provider/profileKey identity into agent metric entries.
- src/flow/lib/get-status.js / src/metrics/commands/token.js — aggregate provider/profile metric buckets and preserve existing token/cache/cost totals; metrics token cache version is bumped because row JSON shape changes.
- src/flow/commands/report.js — consumes buildMetricsSummary totals; report output preserves existing tokenMetrics totals and does not add provider buckets in this spec.
- src/docs/** and src/flow/** PromptBuilder consumers — rename generic user-section usage from add(...) to addUserPrompt(...).
- specs/256-prompt-cache-review/tests/ — focused regression tests for PromptBuilder, review prompt split, call-site migration, and metrics.

### Data Flow
- Review call site → PromptBuilder.setRole/setRules/addSystemPrompt/addUserPrompt → build() → agent.call(userPrompt, { systemPrompt, jsonSchema, fmtFallback }).
- Agent.resolve(commandId) → { provider, profile, profileKey } → runWithLogging → flowManager.accumulateAgentMetrics(phase, { usage, provider, profileKey, ... }).
- flow.json metrics[] → get-status / metrics token aggregation → existing totals plus providers[provider][profileKey] buckets; missing provider/profileKey becomes unknown/unknown.
- metrics token cache: CACHE_VERSION changes when provider buckets are added so .sdd-forge/output/metrics.json is rebuilt with the new row shape.

### Decisions
- [VERIFY] PromptBuilder currently has setRole, setRules, setJsonSchema, setFmtFallback, and generic add(header, content); add only appends userPrompt sections.
- [VERIFY] review-spec and review-draft currently construct one string prompt containing reviewer role/focus/output-format plus artifact/context sections.
- [VERIFY] test-review creates testDesign before runReviewLoop, then reuses it in gap analysis/fix prompt construction.
- [VERIFY] Agent.resolve already knows provider/profile/profileKey, but metrics currently receive model:null and no provider/profileKey.
- [VERIFY] flow-store records token/cache/cost totals but has no provider/profileKey fields.
- Provider bucket shape is nested providers[provider][profileKey] to avoid escaping rules for compound keys. Missing metadata is normalized to provider=unknown and profileKey=unknown.
- Docs command PromptBuilder migrations are API-only. They must not introduce a systemPrompt where the call site previously used only user prompt content.

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- Keep PromptBuilder.add as an alias — Rejected by alpha policy: deprecated compatibility paths are removed rather than retained.
- Migrate only review.js — Rejected because old and new PromptBuilder section APIs would coexist across src/ and make future prompt changes error-prone.
- Use a flat provider:profileKey bucket key — Rejected because provider or profileKey values could contain a colon; nested providers[provider][profileKey] avoids escaping rules.
- Assert total cost decreases — Rejected because providers account for systemPrompt tokens differently; the testable requirement is exact provider/profile cost attribution, not a universal cost decrease.
- Expose provider buckets in report.json — Rejected for this spec because get-status and metrics token JSON are the diagnostic surfaces; report output remains compatibility-only and preserves existing tokenMetrics totals.
- Combine review-spec and review-draft prompt builders — Rejected because the reviewed artifacts and output formats differ; shared helper extraction can happen only for duplicated mechanics, not for distinct reviewer criteria.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-10T00:35:11.531Z
- Notes: autoApprove; review-spec remaining proposals accepted by user as non-blocking

## Requirements
- R1 [must]: PromptBuilder exposes addUserPrompt(header, content) and addSystemPrompt(header, content). addUserPrompt appends `${header}\n${content}` to userPrompt in insertion order. addSystemPrompt appends `${header}\n${content}` to systemPrompt after setRole and setRules output. setRole, setRules, setJsonSchema, and setFmtFallback remain overwrite-only. The old add(header, content) method is removed.
- R2 [must]: All production PromptBuilder call sites in src/ use addUserPrompt or addSystemPrompt. A targeted static test scans imports/new PromptBuilder variables and fails on any `<promptBuilderVariable>.add(...)` call, while ignoring unrelated Set.add and Map-like add calls. Docs command migrations preserve current user-prompt-only behavior unless the call site already passed a systemPrompt before this spec. src/flow/commands/review.js buildDraftSystemPrompt keeps `## Additional Guardrail Review Perspectives` in systemPrompt by using addSystemPrompt.
- R3 [must]: review-spec prompt construction in src/flow/commands/review.js uses PromptBuilder. The systemPrompt contains `You are a spec completeness reviewer`, the current `Focus on:` bullet section, and `Output a numbered list of proposals`. The userPrompt contains artifact/context sections including `## Spec` and `## Codebase Context` and does not contain those three instruction blocks.
- R4 [must]: review-draft prompt construction in src/flow/commands/review.js uses PromptBuilder. The systemPrompt contains `You are a draft QA quality reviewer`, the current `Focus on:` bullet section, and `Output a numbered list of issues`. The userPrompt contains artifact/context sections including `## Request / Issue` and `## Draft QA Entries` and does not contain those three instruction blocks.
- R5 [must]: test-review gap-analysis and gap-fix calls pass the single testDesign value created before runReviewLoop through the systemPrompt argument, remove `## Test Design` from their userPrompt content, and keep changing test files/gap data in userPrompt. A test asserts `systemPrompt.includes(testDesign)` and `!userPrompt.includes("## Test Design")` for both calls.
- R6 [must]: Agent metric entries include string fields provider and profileKey for new agent calls. provider is the resolved Provider class key for built-ins or `user` for UserProvider. profileKey is the resolved profile key returned by Agent.resolve. accumulateAgentMetrics({ provider, profileKey }) persists provided strings and normalizes missing/null/non-string values to `unknown` at the storage boundary. Existing tokens.input, tokens.output, tokens.cacheRead, tokens.cacheCreation, cost, costIncomplete, callCount, responseChars, durationMs, and model aggregation behavior is unchanged.
- R7 [must]: src/flow/lib/get-status.js metricsSummary aggregates provider/profile buckets as nested providers[provider][profileKey] objects whose bucket shape is { callCount, responseChars, durationMs, tokens: { input, output, cacheRead, cacheCreation }, cost, costIncomplete, models }. Entries without provider/profileKey aggregate under providers.unknown.unknown. Numeric totals equal exact source-entry sums; costIncomplete is true when any source entry in the bucket has costIncomplete true.
- R10 [must]: src/metrics/commands/token.js JSON rows aggregate provider/profile buckets as nested providers[provider][profileKey] objects whose bucket shape mirrors row field names: { tokenInput, tokenOutput, cacheRead, cacheCreate, callCount, cost, costIncomplete, durationMs }. phaseSummary[phase].providers is required with the same bucket shape summed across phase rows; costIncomplete is true when any source row in the bucket has costIncomplete true. CACHE_VERSION is incremented so cached .sdd-forge/output/metrics.json rows are rebuilt after the row shape change.
- R11 [must]: src/flow/commands/report.js remains in scope as a compatibility consumer. buildReportTotals ignores provider buckets and report.json / report text preserve the existing tokenMetrics totals without adding provider/profile output in this spec.
- R8 [must]: Tests using mocked review-spec and review-draft agent usage with cache_creation_tokens > 0 record cacheCreation > 0 in flow metric entries and in providers[provider][profileKey] buckets. Tests using mocked provider usage with cache_creation_tokens = 0 record cacheCreation = 0 while still recording provider/profileKey, making non-reporting providers visible without requiring a live provider run.
- R9 [must]: No public CLI command names, options, or exit-code contracts change. `sdd-forge flow get status` and `sdd-forge metrics token --format json` remain successful with older flow.json files that lack provider/profileKey.

## Acceptance Criteria
- A targeted static test over PromptBuilder variables finds no `<promptBuilderVariable>.add(...)` call and ignores unrelated Set.add calls.
- PromptBuilder tests assert systemPrompt/userPrompt section ordering, jsonSchema pass-through, fmtFallback pass-through, and absence of add().
- review-spec tests assert systemPrompt includes `You are a spec completeness reviewer`, `Focus on:`, and `Output a numbered list of proposals`, while userPrompt includes `## Spec` and `## Codebase Context` and excludes those instruction blocks.
- review-draft tests assert systemPrompt includes `You are a draft QA quality reviewer`, `Focus on:`, and `Output a numbered list of issues`, while userPrompt includes `## Request / Issue` and `## Draft QA Entries` and excludes those instruction blocks.
- test-review prompt tests assert gap-analysis and gap-fix calls receive systemPrompt that includes the exact testDesign fixture string and userPrompt does not include `## Test Design`.
- Metric tests assert new entries carry provider/profileKey, direct/internal missing values normalize to unknown, and older entries aggregate under providers.unknown.unknown.
- Metric aggregation tests assert exact numeric sums and costIncomplete OR behavior for get-status bucket shape and metrics token JSON row / phaseSummary bucket shapes.
- metrics token cache tests assert CACHE_VERSION changed and stale cached rows are rebuilt.
- report tests assert buildReportTotals/report output preserve existing tokenMetrics totals and ignore providers buckets.
- Mocked review-spec and review-draft agent usage with cache_creation_tokens > 0 records cacheCreation > 0 in flow metrics and provider/profile buckets.
- npm test passes.
- `node --test specs/256-prompt-cache-review/tests/*.test.js` passes for spec-local tests because npm test does not discover specs/<id>/tests by default.
- npm run test:agent passes because src/lib/agent.js and src/flow/commands/review.js are modified.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Refactor PromptBuilder API
  - Replace the generic PromptBuilder.add API with explicit addUserPrompt and addSystemPrompt methods while preserving setter behavior and build output fields.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Migrate PromptBuilder call sites
  - Update every production PromptBuilder consumer to the explicit section API without changing docs command prompt behavior.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Split review prompts
  - Move review-spec and review-draft reviewer instructions into systemPrompt while keeping artifact/context sections in userPrompt.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Move testDesign to system prompt
  - Pass the pre-loop testDesign value as systemPrompt context for test-review gap-analysis and gap-fix calls.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Add provider metrics
  - Carry provider and profileKey identity from Agent.resolve through flow metric entries.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Aggregate provider metrics
  - Expose provider/profile buckets in status and metrics token JSON while preserving exact numeric totals.
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Verify review cache metrics
  - Validate that review-spec and review-draft metric paths preserve cacheCreation values from mocked provider usage and attach provider/profile attribution.
  - see `tasks/T-7.md` for full spec
