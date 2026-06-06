# Feature Specification: 282-flow-local-prompt-cache

**Feature Branch**: `feature/282-flow-local-prompt-cache`
**Created**: 2026-06-06
**Status**: Draft
**Input**: GitHub Issue #368

## Goal
Agent.call 境界に flow-local prompt hash cache を追加し、同一 prompt 入力の再送で provider process を起動しないようにする。

## Background
Saved prompt logs show exact duplicate prompt calls across multiple phases, with Issue #368 reporting 572 surplus calls and 12,703,553 duplicate characters. Provider-side cache may reduce token cost, but it does not remove CLI process startup, latency, retry, or log-volume overhead. Because review, gate, docs, and flow AI calls pass through Agent.call, suppressing exact duplicate successful calls at that boundary addresses the repeated invocation root cause without phase-specific prompt rewrites.

## Scope
- Agent.call の同一 commandId/provider/profileKey/systemPrompt/userPrompt/jsonSchema/fmtFallback 入力に対して、同じ active flow 内の2回目以降は保存済みの成功応答を返す。
- cache key は commandId、provider、profileKey、resolved profile invocation identity、systemPrompt、userPrompt、jsonSchema、fmtFallback から sha256 で導出する。
- 保存対象は成功した非空応答だけにする。
- provider/profileKey、systemPrompt、userPrompt、jsonSchema、fmtFallback、commandId のいずれかが異なる場合は cache miss にする。
- cache hit を metrics または runtime log で確認できるようにする。
- cache は active flow の current spec-local artifact に閉じ、別 project / 別 flow へ再利用しない。

## Out of Scope
- global prompt cache は作らない。
- provider 側 prompt cache の設定や integration は変更しない。
- prompt 本文の縮小、構造変更、phase 別 prompt 最適化は対象外。
- 既存 CLI command の user-facing option、意味、exit code contract は変更しない。

## Constraints
- 外部依存は追加しない。hash 生成とファイル永続化は Node.js built-in module だけを使う。
- src/ 以下に特定 project や環境固有の値を書かない。
- cache は FlowManager で active flow と current spec が解決できる場合だけ有効にする。active flow がない Agent.call では cache を無効化する。
- cache artifact は active flow の current spec 配下から解決し、repository global / user global の保存先を使わない。
- `bounded-resource-usage`: cache artifact の読み書きは current flow / current spec の1ファイル単位に限定し、全 specs や prompt logs の横断 scan をしない。
- 既存の Agent.call public option contract を維持し、既存 caller が新 option を渡さなくても動作する。

## Design Principles
- 重複抑止は provider 呼び出し境界に置き、review / gate / docs など phase 個別の prompt 生成処理には広げない。
- provider callCount と cache hit count は区別し、metrics 利用者が実 provider 呼び出し数を読み取れる状態を保つ。
- 失敗や空応答は retry / error handling の対象として扱い、cache によって再試行機会を失わせない。

## Overview
### Modules
- `src/lib/agent.js` owns provider/profile resolution, prompt invocation, retry, logging, and agent metric accumulation.
- `src/lib/flow-store.js` owns flow.json persistence and append-only metrics entries for active flow state.
- `src/lib/agent-metrics.js`, `src/flow/lib/get-status.js`, and `src/metrics/commands/token.js` own agent metric dimension normalization and aggregation.
- Spec-local tests under `specs/282-flow-local-prompt-cache/tests/` verify cache behavior and isolation.

### Data Flow
- Agent.call resolves commandId to provider/profile, builds a cache key from the resolved invocation identity plus prompt inputs, checks the active flow current-spec cache artifact, and returns a cached response on hit.
- On cache miss, Agent.call invokes the provider through the existing retry path. Only a successful non-empty parsed response is stored in the flow-local cache.
- Agent metrics or runtime logs record cache-hit evidence separately from real provider invocations so call reduction is auditable.

### Decisions
- [VERIFY] Source check: Agent.call is the centralized provider invocation boundary and already has access to commandId, systemPrompt, jsonSchema, fmtFallback, provider, and profileKey.
- [VERIFY] Source check: flow metrics are flat append-only entries and can represent cache-hit evidence without changing caller commands.
- Use active-flow current-spec storage rather than global storage.
- [CORRECTION] Source check: cache is enabled only when FlowManager resolves an active flow/current spec; non-active Agent.call executions bypass cache.
- [CORRECTION] Source check: include resolved profile invocation identity in cache identity.
- Cache only successful non-empty responses after required parsing has succeeded.
- Expose cache hits separately from provider callCount.
- Existing feature impact: repeated identical successful Agent.call inputs in an active flow may return from cache. Existing caller options, provider configuration, CLI commands, and exit codes remain unchanged.

## Clarifications (Q&A)
- Q: Should cache hits count as provider calls?
  - A: No. Cache-hit evidence must be recorded separately so provider callCount remains real provider invocation count.
- Q: Can empty successful stdout be cached?
  - A: No. Empty responses are excluded from cache storage even when a caller has opted out of retry.
- Q: Can another flow reuse a previous flow's cached response?
  - A: No. Cache reuse is limited to the current active flow's current spec-local artifact.
- Q: What happens when no active flow/current spec is resolved?
  - A: Caching is disabled and Agent.call uses the existing provider invocation path.
- Q: What profile fields are part of the invocation identity?
  - A: At minimum, the identity includes the resolved profile command, args, jsonOutputFlag, jsonSchemaFlag, and jsonSchemaMode, or an equivalent deterministic representation of the resolved invocation shape.

## Alternatives Considered
- Rely only on provider-side prompt cache. — Rejected because provider-side cache does not remove local provider process startup, latency, retry, and log-volume overhead.
- Add phase-specific caches in review or gate commands. — Rejected because duplicate prompts occur across multiple phases and Agent.call is the shared boundary.
- Create a global cache across projects and flows. — Rejected because Issue #368 requires active-flow/spec-local scope and no cross-project or cross-flow leakage.
- Cache raw provider stdout before parse. — Rejected because failures before required parsing must not be cached.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-06T14:06:01.791Z
- Notes: autoApprove: spec-gate passed and approval step auto-selected [1].

## Requirements
- R1 [must]: On the second and later Agent.call with identical commandId, provider, profileKey, resolved profile invocation identity, systemPrompt, userPrompt, jsonSchema, and fmtFallback within the same active flow current-spec cache scope, return the saved response without invoking the provider process.
- R2 [must]: Compute the cache key as a sha256 digest over commandId, provider, profileKey, resolved profile invocation identity, systemPrompt, userPrompt, jsonSchema, and fmtFallback using deterministic serialization for structured fields.
- R3 [must]: Treat a changed provider, profileKey, resolved profile invocation identity, commandId, systemPrompt, userPrompt, jsonSchema, or fmtFallback as a cache miss.
- R4 [must]: Persist only successful non-empty responses after required provider output parsing has succeeded; do not cache empty responses, provider errors, or parse failures.
- R5 [must]: Record cache-hit evidence separately from real provider callCount in metrics or runtime logs.
- R6 [must]: Keep cached responses scoped to the current active flow's current spec-local artifact, and disable caching when no active flow/current spec is resolved, so another project or another flow cannot reuse them.
- R7 [must]: Preserve existing Agent.call caller behavior for cache misses, including retry handling, provider parsing, logging, and returned response text.

## Acceptance Criteria
- R1: A spec-local test calls Agent.call twice with the same cache identity inside one active flow/current spec scope and observes that the provider process is invoked once while both calls return the same response.
- R2: A spec-local test verifies that equivalent jsonSchema/fmtFallback input produces a stable cache key and that the key includes commandId, provider, profileKey, resolved profile invocation identity, systemPrompt, userPrompt, jsonSchema, and fmtFallback.
- R3: Spec-local tests change provider/profileKey, resolved profile invocation identity, and prompt fields and observe cache misses.
- R4: Spec-local tests cover provider failure, empty response, and parse failure cases and observe that the next valid call does not reuse those outputs from cache.
- R5: Cache-hit evidence is visible in metrics or runtime log output, and provider callCount remains the count of real provider invocations.
- R6: A spec-local test creates a second active flow/current spec scope and observes no cache hit from the first scope; a no-active-flow Agent.call path does not read or write the cache.
- R7: Existing Agent.call retry, parse, stdin fallback, and logging tests continue to pass for cache misses.

## Implementation Targets
- src/lib/agent.js
- src/lib/flow-store.js
- src/lib/agent-metrics.js
- src/flow/lib/get-status.js
- src/metrics/commands/token.js
- specs/282-flow-local-prompt-cache/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add prompt cache storage
  - Provide flow-local or spec-local cache storage for Agent.call responses and deterministic cache-key calculation.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Use cache in Agent.call
  - Integrate cache lookup and save behavior into Agent.call while preserving existing miss-path invocation behavior.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Record cache hit evidence
  - Expose cache hits through metrics or runtime logs without inflating real provider call counts.
  - see `tasks/T-3.md` for full spec
