# Feature Specification: 268-codex-timeout-json-retry

**Feature Branch**: `feature/268-codex-timeout-json-retry`
**Created**: 2026-05-29
**Status**: Draft
**Input**: GitHub Issue #346

## Goal
Fix codex provider {{text}} generation failures so timeout exits are retried by the existing retry policy, agent subprocess failures expose a 200-character stdout preview, and docs text JSON parse failures expose a 200-character normalized response preview.

## Background
Issue #346 reports docs build/docs text {{text}} generation hanging with codex provider, then failing after timeout without retry and with insufficient partial JSON parse diagnostics. The relevant code paths are the shared agent subprocess runner, codex provider profile/parser configuration, and docs text batch JSON parsing.

## Scope
- Verify codex provider JSON output configuration in built-in profiles.
- Retry agent subprocess timeout exits under the existing retryCount policy.
- Include provider/profile context and stdout preview capped at 200 characters in relevant agent failure errors when stdout exists.
- Include normalized agent response preview capped at 200 characters in docs text batch JSON parse failure errors.
- Add regression tests covering timeout retry, codex JSON profile settings, and parse error preview.

## Out of Scope
- Do not add external dependencies.
- Do not rename or remove docs build, docs text, or agent profile CLI interfaces.
- Do not add project-specific handling for OOS_spread_commerce paths or logs.
- Do not rewrite the provider architecture or introduce a new output normalization model.
- Do not publish to npm or change package release metadata.

## Constraints
- Use only Node.js built-in modules.
- Preserve backward-compatible CLI behavior: existing commands and options keep their names and meanings.
- Preserve docs text fail-fast behavior: a batch JSON parse failure still makes the affected command fail with a non-zero exit code.
- Do not change default timeout duration or config.agent.timeout semantics.
- Do not hardcode project-specific absolute paths or observed project names in src/.
- Retries must remain bounded by existing retryCount normalization and MAX_RETRY.

## Design Principles
- Keep provider-specific parsing in src/lib/provider.js and shared subprocess behavior in src/lib/agent.js.
- Prefer explicit diagnostic snippets over silent fallback when provider output is malformed.
- Use small helper functions for repeated error preview formatting.

## Overview
### Modules
- src/lib/agent.js owns external agent subprocess execution, timeout handling, retry policy, provider/profile resolution, and agent telemetry.
- src/lib/provider.js owns built-in claude/codex profile definitions and provider stdout parsing into text/usage.
- src/docs/commands/text.js owns {{text}} batch generation, batch JSON parsing, and failure propagation for docs text/docs build.

### Data Flow
- docs text builds a batch prompt, calls agent.call(commandId=docs.text), receives provider-normalized text, parses JSON, and applies generated text to directive locations.
- agent.call resolves the profile, builds CLI args, spawns the provider command, collects stdout/stderr, parses provider JSON output when jsonOutputFlag is set, and records telemetry.
- On timeout, the child exits by SIGTERM; the retry layer must treat that timeout error as retryable until retryCount is exhausted.

### Decisions
- [VERIFY] Codex JSON profile configuration matches the draft policy.
- [VERIFY] The no-retry timeout bug is source-verifiable.
- [VERIFY] docs text batch parse failure currently lacks thrown preview context.
- Default timeout duration remains unchanged.
- Provider output normalization redesign is out of scope.

## Clarifications (Q&A)
- Q: Should this change increase the default timeout duration?
  - A: No. Timeout duration and config.agent.timeout semantics remain unchanged.
- Q: Should this change introduce provider-wide output normalization?
  - A: No. Existing provider parse contracts remain in place; this spec only fixes retry and diagnostics around the current contracts.
- Q: Should tests invoke a real codex CLI and wait for 300 seconds?
  - A: No. Tests must simulate or control the relevant failure path and run without a long external timeout.

## Alternatives Considered
- Increase DEFAULT_AGENT_TIMEOUT_MS or config defaults. — Rejected because it broadens runtime policy, can hide hangs, and is not required to verify retry behavior.
- Silently fall back to raw text when batch JSON parsing fails. — Rejected because docs text expects JSON keyed by directive id; applying malformed output risks corrupting generated documentation.
- Redesign provider output normalization in this spec. — Rejected because CodexProvider already normalizes codex JSON events for the affected path, and the related normalization proposal is separate from this timeout/diagnostics bug.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-29T01:08:02.493Z
- Notes: User approved spec without changes.

## Requirements
- R1 [must]: Timeout exits identified by SIGTERM from agent subprocess timeout must be retried by _callOnceWithRetry until the normalized retryCount is exhausted; after exhaustion, the final timeout error must be thrown.
- R2 [must]: Built-in codex profiles used by ProviderRegistry must keep --json in args and jsonOutputFlag set to --json for codex/gpt-5.4 and codex/gpt-5.3.
- R3 [must]: Agent errors that include captured stdout must include provider key, profile key, and a stdout preview capped at 200 characters in the thrown error message.
- R4 [must]: docs text batch JSON parse failures must throw an error containing the file name and a preview of the normalized agent response capped at 200 characters.
- R5 [must]: docs text batch JSON parse failures must preserve fail-fast behavior: the affected file is counted as an error and the command exits non-zero through the existing DocsTextCommand error path.
- R6 [must]: Regression coverage must include spec-local tests for timeout retry, codex JSON profile settings, and docs text parse error preview without waiting for a real 300 second codex CLI timeout.

## Acceptance Criteria
- A controlled timeout/SIGTERM agent failure is retried according to retryCount and throws only after retries are exhausted.
- The final timeout/provider error message includes provider key, profile key, and no more than 200 characters of stdout preview when stdout exists.
- ProviderRegistry exposes codex/gpt-5.4 and codex/gpt-5.3 profiles with --json args and jsonOutputFlag='--json'.
- A malformed docs text batch response throws an error that includes the target file name and no more than 200 characters from the normalized agent response passed to parseBatchJsonResponse.
- docs text still reports parse-failed files through the existing command error path rather than silently skipping or applying fallback content.
- Spec-local tests under specs/268-codex-timeout-json-retry/tests/ cover R1-R6 with // spec: R<N> headers.

## Implementation Targets
- src/lib/agent.js
- src/lib/provider.js
- src/docs/commands/text.js
- specs/268-codex-timeout-json-retry/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Retry timeout exits
  - Make agent subprocess timeout exits participate in the existing bounded retry policy and preserve final failure after retries are exhausted.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Add agent diagnostics
  - Add provider/profile context and a stdout preview capped at 200 characters to relevant agent failure errors.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Verify codex JSON profiles
  - Lock the codex JSON profile contract with regression coverage for built-in codex profiles.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Expose batch parse preview
  - Make docs text batch JSON parse failures throw a file-specific error containing a response preview capped at 200 characters while preserving fail-fast behavior.
  - see `tasks/T-4.md` for full spec
