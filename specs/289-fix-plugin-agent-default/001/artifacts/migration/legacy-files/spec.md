# Feature Specification: 289-fix-plugin-agent-default

**Feature Branch**: `feature/289-fix-plugin-agent-default`
**Created**: 2026-06-11
**Status**: Draft
**Input**: GitHub Issue #378

## Goal
Fix Issue #378 by making core Agent resolution handle plugin command ids with the same profile/default fallback policy used by normal commands, while preserving plugin-specific overrides and producing diagnostic errors when no provider resolves.

## Background
Issue #378 was opened after a workflow plugin publish command reached ctx.agent.call but failed with "No agent configured". The observed config had agent.default set to "codex" and agent.useProfile set to "codex-only"; the active profile did not include workflow.publish or workflow.*. Plugin commands are expected to use the public core Agent context, so a plugin command id should not require every project profile to list every plugin operation when a normal default fallback can resolve. The current generic error also hides which commandId, profile, and default value were checked.

## Scope
- Resolve plugin command ids passed through ctx.agent.call(prompt, { commandId }) when the active profile has no matching plugin command prefix but a default profile or generic default provider can resolve.
- Keep explicit plugin provider/profile overrides ahead of active profile, default profile, and generic default fallback.
- Define agent.default behavior for bare built-in provider-family keys: "codex" resolves to "codex/gpt-5.4" and "claude" resolves to "claude/sonnet"; unknown keys fail with diagnostics that name the default key.
- Replace generic Agent resolution failures with errors that include commandId, selected/active profile, default key, and explicit provider override state without including prompt text or provider command arguments.
- Add focused regression coverage for Agent.resolve, unresolved Agent.call diagnostics without _dryRun, and createPluginAgentApi override behavior.

## Out of Scope
- Do not redesign plugin command discovery, workflow board publishing semantics, or GitHub Projects behavior.
- Do not hardcode workflow.publish as a special case; the behavior must apply to plugin command ids generically.
- Do not add external dependencies, TypeScript, or project-specific source text under src/.
- Do not change npm publish, release, setup wizard, or upgrade behavior unless tests show docs/config artifacts must be synced after source edits.

## Constraints
- Use only Node.js built-in modules and existing project helpers.
- src/ changes must remain generic and must not contain workflow board item ids, project-local paths, or environment-specific values.
- backward-compatible-cli-interface: no CLI command, option, or positional argument is removed or renamed. The migration plan is to keep full provider keys such as "codex/gpt-5.4" valid, keep unknown defaults failing, and make bare built-in provider-family defaults resolve through the explicit aliases "codex" -> "codex/gpt-5.4" and "claude" -> "claude/sonnet".
- exit-code-contract: this spec introduces no new CLI command. Commands that call Agent.call keep their existing success/failure exit behavior; invalid agent configuration still fails the command, but the thrown error must include the resolution context required by this spec.
- validate-user-input-at-entry-point: this spec adds no user-facing CLI arguments. commandId, provider, and profile are internal Agent.call options supplied by core/plugin code and must be normalized at the Agent resolution boundary.
- No prompt text, system prompt text, provider args, secrets, tokens, or local config file paths may be included in the new diagnostic error message.
- If source changes make generated docs or deployed skill/preset artifacts stale, run the existing project sync/upgrade command required by project rules and include evidence.

## Design Principles
- Treat plugin command agent resolution as a core Agent fallback bug, not as a workflow plugin special case.
- Keep Agent.resolve as the single public resolution surface; helper extraction is allowed only to make the fallback order and diagnostics explicit.
- Prefer verifiable behavior over broad compatibility claims: each fallback path must be covered by a unit or spec-local regression test.
- Preserve existing precedence for normal docs.* and flow.* command ids while extending the same fallback behavior to plugin command ids.

## Overview
### Modules
- src/lib/agent.js owns Agent.resolve, Agent.call, resolveProfileKey, provider override handling, and createPluginAgentApi.
- src/lib/provider.js owns ProviderRegistry and provider/profile key resolution for full profile keys; Agent default normalization owns the bare built-in provider-family alias rule required by this spec.
- tests/unit/lib/agent.test.js and tests/unit/lib/agent-service.test.js already cover Agent resolution precedence and are the closest shared regression surface.
- specs/289-fix-plugin-agent-default/tests/ will contain spec-local tests with requirement headers for the Issue #378 behavior.

### Data Flow
- Plugin code calls ctx.agent.call(prompt, options). createPluginAgentApi converts non-dotted command ids to <pluginId>.<operation>, leaves dotted command ids unchanged, and forwards plugin provider/profile overrides.
- Agent.call invokes Agent.resolve(commandId, options). Resolution checks explicit provider override, explicit profile option, SENTI_PROFILE, config.agent.useProfile, profile prefix matches, default profile prefix matches, and generic default provider key.
- ProviderRegistry resolves full provider profile keys such as codex/gpt-5.4 directly. This spec requires Agent default normalization to resolve bare built-in provider-family keys before registry lookup: codex maps to codex/gpt-5.4 and claude maps to claude/sonnet.
- When no provider resolves, Agent.call throws an error that reports the commandId and resolution inputs checked, but not prompt/provider command details.

### Decisions
- [VERIFY] checked createPluginAgentApi command id forwarding; result=match with plugin fallback target.
- [VERIFY] checked Agent.resolve fallback order; result=partial gap around diagnostics and observed default resolution failure.
- [CORRECTION] checked ProviderRegistry family key behavior; bare built-in family keys need explicit Agent default normalization.
- [VERIFY] checked user-facing docs; result=agent.default is a provider key.
- Unit-level coverage is sufficient for the core bug.

## Clarifications (Q&A)
- Q: Does this require every plugin command id to be added to each project profile?
  - A: No. Explicit profile mappings remain supported, but plugin command ids must fall back to default profile or generic default provider when no mapping exists.
- Q: Does agent.default accept a profile name or provider key?
  - A: For this spec, agent.default is treated as a provider/profile key resolved by ProviderRegistry after explicit built-in family normalization. The supported bare built-in family aliases are codex -> codex/gpt-5.4 and claude -> claude/sonnet; unknown keys fail with diagnostics.
- Q: Does this change workflow publish logic?
  - A: No. workflow.publish is only the observed plugin command id. The fix belongs to the generic Agent resolution path.
- Q: Are new CLI options introduced?
  - A: No. commandId, provider, and profile are internal Agent.call options supplied by core/plugin code.

## Alternatives Considered
- Require workflow.publish or workflow.* entries in every active project profile. — Rejected because plugin commands should be able to use the public core Agent context and normal default fallback when a plugin-specific override is absent.
- Fix only the workflow plugin by adding a local plugin provider override. — Rejected because the observed workaround already proves that path works, while Issue #378 identifies the direct bug as core Agent fallback and diagnostics.
- Reject provider-family defaults such as "codex" and require full keys. — Rejected because the observed config relies on codex having meaning. The spec instead defines a narrow deterministic alias: codex -> codex/gpt-5.4 and claude -> claude/sonnet. Unknown keys still fail with diagnostics.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-11T16:07:02.079Z
- Notes: Auto-approved after draft-gate and spec-gate passed for Issue #378.

## Requirements
- R1 [must]: Agent.resolve must resolve a plugin command id through the active profile prefix match, then the default profile prefix match, then the generic default provider key when no explicit plugin provider/profile override is supplied.
- R2 [must]: Explicit plugin provider/profile overrides forwarded by createPluginAgentApi must take precedence over active profile, default profile, and generic default fallback.
- R3 [must]: agent.default bare built-in provider-family values must normalize before ProviderRegistry lookup: "codex" maps to "codex/gpt-5.4" and "claude" maps to "claude/sonnet". Unknown default keys must fail without silently selecting another provider.
- R4 [must]: When Agent.call cannot resolve a provider, the thrown error must include commandId, explicit provider override state, explicit/profile environment selection, active profile name, default key, and a concise reason for the failed lookup.
- R5 [must]: The diagnostic error message must exclude prompt text, system prompt text, provider command arguments, secrets, tokens, and absolute local config paths.
- R6 [must]: Existing docs.* and flow.* command resolution precedence must remain unchanged except for the improved unresolved-configuration diagnostic text.
- R7 [must]: Regression tests must cover plugin command fallback, active profile without plugin mapping, default profile fallback, plugin-specific provider override precedence, bare built-in provider-family default resolution, unknown default diagnostics, and diagnostic redaction.

## Acceptance Criteria
- AC1: With agent.useProfile set to a profile that lacks workflow.publish and agent.default set to "codex", Agent.resolve("workflow.publish") returns the codex/gpt-5.4 provider instead of null.
- AC2: With an active profile lacking a plugin command mapping and a default profile containing a matching plugin command prefix, Agent.resolve("workflow.publish") returns the default profile provider.
- AC3: With createPluginAgentApi configured with a plugin provider override, ctx.agent.call(..., { commandId: "workflow.publish" }) resolves the override provider before any core profile/default fallback.
- AC4: With createPluginAgentApi called using a non-dotted commandId, the command id is prefixed with the plugin id and still follows R1 fallback behavior.
- AC5: With agent.default set to an unknown value and no matching profile fallback, Agent.call throws an error containing commandId, active/use profile, default key, and provider override state.
- AC6: The error from AC5 does not contain the prompt body, system prompt body, provider args, secrets, tokens, or absolute local config paths.
- AC7: Existing normal command tests for docs.* and flow.* profile precedence still pass.
- AC8: Spec-local tests under specs/289-fix-plugin-agent-default/tests/ include // spec: R<N> headers covering R1 through R7, and shared tests are updated only where the core Agent contract changes.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Clarify Agent fallback
  - Make Agent resolution select plugin command providers through the existing active/default/default-provider precedence and expose the resolution inputs for diagnostics.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Preserve plugin overrides
  - Ensure createPluginAgentApi provider/profile overrides continue to win before core Agent profile/default fallback.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Add resolution diagnostics
  - Replace the generic unresolved Agent error with a bounded diagnostic message that names the resolution context and redacts sensitive inputs.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Cover Agent regressions
  - Add spec-local tests and update shared Agent tests for all Issue #378 resolution and diagnostic requirements.
  - see `tasks/T-4.md` for full spec
