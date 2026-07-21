# Feature Specification: 324-standalone-plugin-attribution

**Feature Branch**: `feature/324-standalone-plugin-attribution`
**Created**: 2026-07-21
**Status**: Draft
**Input**: GitHub Issue #445

## Goal
Prevent standalone plugin agent calls from reading or mutating ambient SDD flow attribution while preserving existing agent resolution, logging, and explicit flow attribution contracts.

## Background
The shared core Agent resolves the current FlowManager context for cache and metrics, and its Logger resolves that context again for agent log identity. Standalone plugin commands receive this shared Agent even though they do not own the active SDD flow. Consequently, a standalone command such as workflow refine or publish can add metrics and cache entries to an unrelated flow and label its logs with that flow identity.

## Scope
- Add a generic call attribution policy in src/lib/agent.js with ambient as the existing default and none for standalone plugin calls.
- Bind standalone plugin command agent APIs to no-flow attribution in src/lib/plugin-registry.js without plugin-name branching.
- Change src/lib/log.js only to make call-scoped explicit null flow identity override ambient logger lookup.
- Add spec-local fake-provider tests for standalone and retained explicit-flow behavior.

## Out of Scope
- Workflow plugin source or workflow-command special cases.
- FlowManager, FlowStore, active-flow discovery, or flow transition behavior.
- Issue #443 review/transition changes and Issue #444 test-runner changes.
- Dependencies, release operations, and live AI calls.

## Constraints
- Use Node.js built-ins only.
- Represent the constrained attribution mode with a class that rejects unsupported values at construction.
- Keep validation at the Agent/plugin API boundary and trust FlowManager/FlowStore internal interfaces.
- Do not expose a plugin-call option that can override the core-bound standalone attribution policy.
- All spec-local provider execution must use a fake executable or injected fake supervision; no live AI process is allowed.

## Design Principles
- The Agent owns cache and metric attribution; Logger owns log identity rendering.
- Standalone-versus-flow attribution is a generic invocation-context distinction, not a workflow-plugin distinction.
- Ambient behavior is retained unless a core-owned boundary explicitly selects no-flow attribution.

## Overview
### Modules
- src/lib/agent.js: resolve profiles, invoke providers, apply prompt-cache policy, emit logs, and accumulate agent metrics.
- src/lib/plugin-registry.js: construct standalone command and explicit flow-hook plugin contexts.
- src/lib/log.js: write agent JSONL and prompt logs with resolved or explicitly supplied flow identity.
- specs/324-standalone-plugin-attribution/tests/: verify the plugin-agent attribution boundary without live AI.

### Data Flow
- Standalone command dispatch resolves the plugin and constructs a plugin agent API bound by core to no-flow attribution.
- Plugin resolve/call delegates through commandId namespacing and configured provider/profile resolution while preserving the bound attribution.
- No-flow calls invoke the provider and emit logs, but skip flow-scoped cache reads/writes, cache-hit metrics, and invocation metrics.
- Core flow calls and explicit flow hooks continue using ambient flow context for cache, logs, and metrics.

### Decisions
- [VERIFY] src/lib/agent.js owns all three affected side effects: prompt-cache access, Logger.agent events, and flow metric accumulation; result=match.
- [VERIFY] src/lib/plugin-registry.js currently passes the shared raw agent from globalThis.__sentiPluginAgent into buildPluginContext; result=match.
- [CORRECTION] createPluginAgentApi currently delegates call only; add resolve delegation because the installed workflow service already probes context.agent.resolve when available.
- The published Issue defines one boundary concern; adjacent flow-state and test-runner mechanisms remain excluded.
- AgentAttributionMode is the core-owned value object for ambient and none attribution; unsupported modes fail before provider execution.

## Clarifications (Q&A)
- Q: Does no-flow attribution disable logging?
  - A: No. Logging remains enabled according to existing config; only flow identity is explicitly null.
- Q: Does cacheMode=bypass satisfy no-flow attribution?
  - A: No. cacheMode controls provider-response caching only; no-flow attribution independently disables every flow cache and metric side effect and nulls log identity.
- Q: When is the full project regression evaluated?
  - A: The single-execution flow policy defers the full project regression from test-execute to final-regression after retro. Task gates evaluate the focused evidence already recorded and do not require an earlier duplicate full regression, so regression.result=skipped is the expected task-gate evidence rather than a test-integrity violation.

## Alternatives Considered
- Add a workflow-plugin name check to FlowManager or plugin dispatch. — Rejected because the bug applies to every standalone plugin command and the Issue explicitly excludes workflow special cases and FlowManager changes.
- Use cacheMode=bypass for standalone calls. — Rejected because it does not prevent invocation metrics or ambient Logger identity and remains plugin-overridable.
- Remove flow attribution from the shared Agent default. — Rejected because core flow commands and explicit hooks must retain current cache and metric ownership.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-20T09:37:40.910Z
- Notes: Auto-approved under the explicit Issue #445 autoApprove directive after draft review, spec review, and spec gate PASS.

## Requirements
- R1 [must]: Agent calls support a validated attribution mode whose default preserves ambient behavior and whose no-flow mode performs no flow-context resolution for prompt-cache or metrics.
- R2 [must]: A no-flow call skips flow-scoped cache reads, cache writes, cache-hit metrics, success metrics, and failure metrics while preserving provider execution, return text, thrown errors, and cache-decision callbacks.
- R3 [must]: Agent start/end logs for a no-flow call retain the existing log files and payload shape but set spec, sentiPhase, and taskId to null without resolving an ambient flow.
- R4 [must]: createPluginAgentApi delegates resolve and call with existing plugin commandId namespacing and provider/profile configuration precedence, and applies a core-bound attribution mode after plugin-supplied options so the plugin cannot override it.
- R5 [must]: dispatchPluginCommand supplies the standalone plugin context through createPluginAgentApi bound to no-flow attribution, while runFlowCommandHooks retains ambient attribution without plugin-name or workflow-command special cases.
- R6 [must]: Spec-local tests snapshot every seeded foreign specs/*/flow.json file and active-flow .senti/agent-cache file before and after standalone provider success, provider failure, and repeated equivalent calls, and assert byte-identical content.
- R7 [must]: Spec-local tests construct an active managed worktree layout, main repository layouts with one and multiple active flows, and a no-flow repository layout, then assert the R6 byte snapshots remain equal for each layout.
- R8 [must]: Existing core flow agent calls and explicit flow-hook agent calls retain ambient cache attribution and exactly one invocation metric for each provider call; existing cache-hit attribution remains unchanged.

## Acceptance Criteria
- AC1: Spec-local fake-provider tests demonstrate that standalone success, failure, and repeated equivalent calls do not change SHA-256 or byte length for any seeded foreign flow.json or active-flow agent-cache file.
- AC2: The same tests exercise managed-worktree, main-single-flow, main-multiple-flow, and no-flow layouts and observe no foreign flow/cache mutation in each layout.
- AC3: Standalone success and failure logs contain null spec, sentiPhase, and taskId in JSONL and prompt context, and contain no seeded foreign spec identifier.
- AC4: A plugin call that supplies an ambient attribution option still executes under the core-bound no-flow policy.
- AC5: Plugin resolve/call tests preserve commandId namespacing, plugin-config provider and agentProfile selection, explicit plugin option precedence, response text, and provider errors.
- AC6: Existing and spec-local regressions show explicit flow/core calls still write one provider-call metric and their existing cache entry, and cache hits retain cache-hit metrics.
- AC7: The production diff is limited to src/lib/agent.js, src/lib/plugin-registry.js, src/lib/log.js only if needed, and spec-local tests/artifacts; it contains no FlowManager, FlowStore, workflow-plugin, #443, or #444 changes.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add call attribution policy
  - Make cache, metric, and log flow attribution selectable per core-owned agent boundary while retaining ambient defaults.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Bind standalone plugin attribution
  - Expose resolve/call through the plugin agent API and bind standalone dispatch to no-flow attribution without changing explicit hook behavior.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Verify attribution isolation
  - Prove foreign state isolation across the Issue #445 runtime matrix and prove retained explicit-flow behavior.
  - see `tasks/T-3.md` for full spec
