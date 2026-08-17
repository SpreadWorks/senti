# Feature Specification: 306-docs-text-json-schema

**Feature Branch**: `feature/306-docs-text-json-schema`
**Created**: 2026-06-17
**Status**: Draft
**Input**: GitHub Issue #399

## Goal
Make docs.text batch generation reliably return and consume directive id -> markdown text JSON objects, while preventing non-JSON responses from being cached and allowing target-file retry after parse failure.

## Background
docs.text batch mode depends on an AI response shaped as a JSON object whose keys are directive ids and whose values are generated markdown strings. The current code parses that response after agent.call returns. If the provider returns ordinary natural language, docs.text throws batch JSON parse failed. During active flows, Agent.call can cache the raw returned text before docs.text discovers the parse failure, so reruns may replay the same invalid response from .senti/agent-cache. Issue #399 requires schema enforcement, provider schema default alignment, cache exclusion for parse-invalid responses, target-file retry, and diagnostics for local override mismatches.

## Scope
- Pass a JSON schema to docs.text batch agent calls.
- Align jsonSchemaFlag/jsonSchemaMode defaults for every built-in default provider entry reachable by docs.text, including claude/sonnet and codex/gpt-5.4.
- Prevent docs.text JSON parse failure responses from being written to active-flow prompt cache.
- Retry failed docs.text target files so a later valid JSON response can continue the build.
- Diagnose or explicitly specify project-local provider/profile overrides that omit schema support.
- Preserve migration parity for senti docs build, senti docs text, textFillFromAnalysis, processTemplateFileBatch, agent config, generated markdown, and prompt cache behavior.

## Out of Scope
- Changing the docs.text batch response contract away from directive id -> markdown text JSON objects.
- Adding external npm dependencies.
- Hardcoding project-specific paths, provider names beyond generic provider keys, issue ids, or local config values in src/.
- Rewriting docs generation phases outside the text phase unless required by shared agent/cache contracts.

## Constraints
- Use only Node.js built-in modules and existing project helpers.
- Keep src/ package code generic and free of project-specific values.
- Do not weaken existing tests to make the new behavior pass.
- User provider/profile overrides continue to win; missing schema support must be visible through diagnostics or explicit behavior.

## Design Principles
- Treat docs.text JSON schema enforcement as contract repair, not a new feature.
- Keep retry bounded by existing agent retry configuration or an explicitly bounded file-level retry count.
- Keep cache exclusion tied to parse-invalid docs.text responses so successful cacheable responses retain existing behavior.

## Overview
### Modules
- src/docs/commands/text.js owns docs.text batch prompt construction, JSON parsing, per-file application, file-level error aggregation, and generated markdown writes.
- src/lib/agent.js owns provider/profile resolution, prompt cache keying, cache reads/writes, jsonSchema invocation arguments, and cacheable response handling.
- src/lib/provider.js and src/lib/agent-defaults.js own built-in provider/profile defaults that determine whether jsonSchema reaches CLI invocation.
- tests/unit/docs/commands and tests/unit/lib contain the existing unit coverage targets for docs.text batch processing and agent/provider invocation behavior.

### Data Flow
- senti docs build runs DocsTextCommand, which reads target docs files, strips existing text content, builds one batch prompt per target file, calls agent.call with commandId docs.text, parses returned JSON, applies values by directive id, validates the result, and writes changed files.
- During an active flow, Agent.call resolves the current flow context, reads .senti/agent-cache by prompt/profile/schema key, invokes the provider on cache miss, and writes the returned text unless cacheable is false.
- With this spec, docs.text batch calls include jsonSchema in the agent options; parse-invalid responses are retried at file scope and are marked or handled so they are not persisted to prompt cache.

### Decisions
- [VERIFY] checked docs.text batch parse path; result=match. processTemplateFileBatch calls invokeAgent, then parseBatchJsonResponse, and throws batch JSON parse failed when parsing returns null.
- [VERIFY] checked active-flow prompt cache path; result=match. Agent.call writes returned text to prompt cache when promptCache exists and cacheCandidate.cacheable is not false.
- [VERIFY] checked schema default mismatch; result=match. Provider builtin profiles include schema flags, while defaultAgentProviders pool entries omit jsonSchemaFlag/jsonSchemaMode.
- [VERIFY] checked migration inventory; result=match. Public surfaces affected are docs build/text commands, textFillFromAnalysis, processTemplateFileBatch, agent profiles/providers, markdown outputs, and prompt cache artifacts.
- Migration parity mapping: docs build/text remain owned by DocsTextCommand/runText; textFillFromAnalysis/processTemplateFileBatch remain text.js exports; schema defaults stay in agent-defaults/provider/agent invocation; markdown writes stay in text.js; prompt cache stays in AgentPromptCache with only parse-invalid docs.text responses excluded. No removals.
- The spec keeps user overrides winning and requires diagnostics for missing schema fields instead of silently assuming built-in provider capability.

## Clarifications (Q&A)
- Q: Should docs.text switch away from batch JSON mode?
  - A: No. The retained contract is batch JSON object output keyed by directive id; the fix enforces and recovers that contract.
- Q: Should project-local agent provider overrides be overwritten to add schema fields?
  - A: No. Existing override precedence is retained. Missing schema support must be diagnosed or explicitly specified, not silently overwritten.

## Alternatives Considered
- Fallback permanently to per-directive docs.text generation after parse failure — This avoids one batch failure but does not satisfy the Issue requirement to enforce the batch JSON schema contract or prevent invalid batch responses from being cached.
- Only add prompt wording asking for JSON — Prompt wording alone does not ensure provider invocation receives jsonSchema and does not prevent active-flow cache from storing parse-invalid responses.
- Disable prompt cache for all docs.text calls — This would remove retained successful cache behavior. The required change is limited to parse-invalid docs.text responses.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-17T16:11:18.337Z
- Notes: auto-approved after user selected Enable auto for Issue #399

## Requirements
- R1 [must]: docs.text batch generation passes a JSON schema to agent.call that constrains the response to an object mapping directive id strings to markdown text strings.
- R2 [must]: Every built-in default provider entry reachable by docs.text, including claude/sonnet and codex/gpt-5.4, includes jsonSchemaFlag and jsonSchemaMode so schema options are represented in provider invocation.
- R3 [must]: When a docs.text batch response cannot be parsed as the required JSON object, that response is not saved to .senti/agent-cache during active flow execution.
- R4 [must]: When docs.text batch parsing fails for a target file, the failed target file can be retried within a bounded retry path, and a later valid JSON response lets the build continue.
- R5 [must]: When the resolved docs.text provider/profile lacks schema support because of project-local overrides or custom providers, diagnostics name commandId docs.text and the missing schema fields jsonSchemaFlag/jsonSchemaMode.
- R6 [must]: Existing docs.text public behavior is retained for successful JSON responses, per-directive mode, user override precedence, generated markdown writes, and successful prompt cache reuse.
- R7 [must]: Implementation uses no external npm dependencies and does not hardcode project-specific values in src/.

## Acceptance Criteria
- A unit test confirms that docs.text batch calls pass jsonSchema to agent.call.
- A unit test confirms that docs.text-reachable built-in default provider entries include schema-related flag/mode and provider invocation uses them when jsonSchema is provided.
- A unit test confirms that a docs.text JSON parse failure response is not saved to .senti/agent-cache.
- A test confirms that a first natural-language response followed by a valid JSON response succeeds through target-file retry.
- A test or explicit diagnostic behavior confirms that local provider/profile overrides missing jsonSchemaFlag/jsonSchemaMode are visible for docs.text.
- Existing tests for successful docs.text batch insertion and data directive preservation continue to pass.
- Parity check: senti docs build and senti docs text still route through DocsTextCommand/runText and write generated markdown for a valid JSON response.
- Parity check: textFillFromAnalysis and processTemplateFileBatch remain exported with their existing call contracts and existing successful batch tests pass.
- Parity check: agent profile/provider override precedence remains user-wins and diagnostics do not overwrite custom providers.
- Parity check: successful prompt cache reuse remains available while parse-invalid docs.text responses are excluded from cache writes.
- Spec-local tests under specs/306-docs-text-json-schema/tests/ include // spec: R<N> headers for testable requirements.

## Implementation Targets
- src/docs/commands/text.js
- src/lib/agent.js
- src/lib/provider.js
- src/lib/agent-defaults.js
- tests/unit/docs/commands/text-batch.test.js
- tests/unit/lib/agent-service.test.js
- tests/unit/lib/provider.test.js
- specs/306-docs-text-json-schema/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add batch schema contract
  - Ensure docs.text batch calls provide a JSON schema that matches directive id -> markdown text output.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Prevent invalid cache writes
  - Ensure parse-invalid docs.text batch responses are not persisted to active-flow prompt cache.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Add file retry
  - Retry only the target file whose docs.text batch parsing failed, allowing a later valid JSON response to complete the build.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Align schema defaults
  - Make every built-in default provider entry reachable by docs.text carry jsonSchemaFlag/jsonSchemaMode through default provider materialization and invocation.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Diagnose schema overrides
  - Expose missing schema support for docs.text when resolved provider/profile settings omit jsonSchemaFlag or jsonSchemaMode.
  - see `tasks/T-5.md` for full spec
