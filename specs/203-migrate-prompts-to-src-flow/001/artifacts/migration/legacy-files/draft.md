# Draft: Migrate step prompt templates to src/flow/

**Development Type:** ENHANCE
**開発種別:** ENHANCE

**Goal:** Resolve the divergence between two distribution channels for per-step procedural guidance: the skill channel (read by Claude Code at session start) and the CLI channel (queried at each step). Today the per-step text exists only in the skill channel, so the CLI channel cannot return the same content. This spec establishes a single source of truth for per-step instructions consumed by both channels.
**目的:** skill 配布と CLI 配布の真実源を一本化する。

## Source Issue

GitHub Issue #188 — `[ENHANCE] [cac6/T6] Migrate step prompt templates to src/flow/`

cac6 decomposition task 6/11. Builds on T5 (#187, merged on main) which defined the step-key contract.

## Q&A

All Q&A turns below were decision questions; none were brainstorming exploration. Where investigation revealed factual errors in earlier framing, the affected question was re-asked with the corrected premise (Q3 → Q6).

### Q1 — Intent confirmation
- **Recommended:** [1] approve the AI summary of the issue.
- **Basis:** issue body (project docs).
- **Decision:** [1] approved.

### Q2 — Granularity of per-step content
- **Recommended:** [1] one file per step.
- **Basis:** code pattern — the CLI registry already keys content by step ID, so a step-level file mapping aligns with the existing data structure.
- **Decision:** [1].

### Q3 — Initial i18n placement
- **Recommended (initial):** [1] per-language directory.
- **Basis:** code pattern — the short-choice CLI is bilingual.
- **Decision:** [1] — but **revoked in Q6** after deeper investigation.

### Q4 — Cross-cutting partials handling
- **Investigation correction:** initial framing assumed cross-cutting guidance was duplicated across the three skill files. Investigation showed it is already extracted into shared partials and included into each skill. No duplication exists today.
- **Recommended:** [1] step prompts contain only step-specific procedure; cross-cutting policies remain in skills via the existing partials mechanism.
- **Basis:** code state — partials already exist; project guardrail "シンプルなインターフェースに十分な実装を隠す" disfavours duplication.
- **Decision:** [1].

### Q5 — Single source of truth structure
- **Recommended:** [1] per-step content files are the truth source; skill templates embed them via the existing include mechanism at deploy time.
- **Basis:** code pattern — partials already use the same include mechanism; project guardrail forbids derivation parallel to an existing mechanism.
- **Investigation correction:** initial framing claimed the include mechanism needed extension. Investigation showed the existing pkgDir-rooted absolute path syntax already supports this reference. No include extension is needed.
- **Decision:** [1].

### Q6 — i18n strategy (revised)
- **Investigation:** the actual current state is asymmetric — short-choice labels are bilingual, but skill templates and partials are monolingual; the include mechanism does not consume language.
- **Recommended:** [1] step prompts stay monolingual to match the surrounding ecosystem; defer ecosystem-wide i18n to a coordinated future spec.
- **Basis:** code state — present asymmetry; project guardrail "後方互換コードは書かない" but also "シンプルなインターフェース" — partial i18n increases surface area without solving the asymmetry.
- **Decision:** [1].

### Q7 — Boundary with the next-action CLI work (T5)
- **Investigation:** T5 was reported merged on main; the worktree was rebased to pick up the change. The CLI today returns only the step key, not the content.
- **Recommended:** [1] T6 enriches the CLI output so the same field carries both the key and the resolved content.
- **Basis:** explicit user instruction "実装を横に置いておくとか、そういう対応はしない" plus issue body requirement that the CLI return markdown-rendered instructions.
- **Decision:** [1].

### Q8 — Final scope confirmation
- **Recommended:** [1] proceed with the scope summarised in the Requirements section below.
- **Basis:** issue body + accumulated Q1–Q7 decisions.
- **Decision:** [1].

### Q9 — Test strategy placement
- **Recommended:** [1] long-lived contract tests under the project test root.
- **Basis:** project guardrail "tests/ (formal tests, run by npm test): tests where breakage indicates a bug regardless of which spec introduced them" — these tests verify a long-lived contract (loader behaviour, registry-content coverage, CLI shape).
- **Decision:** [1].

## Requirements

Listed in priority order (P1 highest):

- **P1 — Single source of truth.** When the registry of step keys lists a step, the system shall provide exactly one corresponding content artefact for that step. Verifiable: a coverage check reports zero missing and zero orphan artefacts.
- **P2 — Loader contract.** When a caller requests content by step key, the loader shall return the content for the corresponding artefact. If the key is not registered or the artefact is missing, the loader shall raise an error identifying the offending key. Verifiable: tests for happy path and both error paths.
- **P3 — CLI channel returns content.** When the next-action CLI returns its instructions, the response shall include both the existing step key and the resolved content. Verifiable: the CLI test asserts both fields present and content non-empty for representative steps.
- **P4 — Skill channel reuses the same source.** When the skill templates are deployed, the per-step procedural sections of the deployed output shall come from the same artefacts as the CLI channel. Verifiable: the spec author confirms each per-step block in the skill templates references the shared artefact rather than embedding content directly.
- **P5 — No content loss during migration.** When new artefacts are populated from existing skill text, the deployed skill output (after include expansion) shall, for each procedural section that was migrated, contain a body whose non-whitespace text is byte-equal to the corresponding original section's non-whitespace text. Verifiable: a one-shot diff captured during implementation between the pre-change deployed skill output and the post-change deployed skill output, with results recorded in the spec retro.

## Out of Scope

- i18n of the skill ecosystem (deferred).
- Changes to the short-choice prompt CLI.
- Changes to the include mechanism itself.
- Other cac6 tasks (T1–T5, T7–T11).
- Restructuring of cross-cutting partials.

## Constraints

- No external dependencies (Node.js built-ins only).
- Monolingual content (matches surrounding ecosystem).
- No backwards-compatibility shims (alpha policy).
- Source tree may not contain project-specific information.
- When the skill files are deployed after this change, the deployed output shall contain the same set of procedural section bodies as before, even if their source has moved.

## Migration Plan

The CLI output shape changes additively: the existing step-key field is preserved, and resolved content is added alongside. No fields are renamed or removed.

If existing in-tree callers read only the step key, they continue to work. The CLI is part of an alpha release with no documented stable contract for the shape of its instructions field, so the additive change does not require a deprecation period and no compatibility shim is added.

## Impact on Existing

- **Skill templates (3 files).** When this change ships, per-step procedural blocks shall be sourced from the new artefacts; deployed output remains functionally equivalent.
- **Next-action CLI.** When this change ships, the CLI's instructions field shall include resolved content alongside the existing key. The existing CLI test is extended to cover the new shape.
- **Step-key contract registry.** Unchanged.
- **Short-choice prompt CLI.** Unchanged.
- **Include mechanism.** Unchanged.
- **Cross-cutting partials.** Unchanged.

## Edge Cases

- **Missing artefact for a registered step key.** If the artefact is missing at runtime, the loader shall fail loudly; the coverage check prevents this state from reaching the test suite.
- **Loader called with an unregistered key.** If the key is unknown, the loader shall raise the same loud failure — no silent empty-string fallback.
- **Skill template referencing a non-existent artefact.** If the include target does not exist, the existing include resolution error path surfaces the failure.

## Alternatives Considered

- **Lean skill (key-only references, no embedded content).** Rejected: forces the skill channel to depend on the CLI channel for every step and breaks the "read the skill to understand the phase" UX.
- **Skill templates as the truth source, artefacts derived by a build script.** Rejected: introduces a fragile parser parallel to the existing include mechanism, with drift risk between manual edits and re-extraction runs.
- **Bilingual step prompts upfront.** Rejected: the surrounding ecosystem is monolingual; partial i18n would create inconsistent half-state.

## Future Extensibility

- **i18n.** When needed across the skill ecosystem, the same pattern used for the short-choice CLI applies. The single-source-of-truth structure is preserved either way.
- **Adding a new step.** Adding a new step entails appending to the step-key registry and creating a matching artefact; the coverage check catches missing artefacts automatically.
- **External skills.** External skills can reference the same shared artefacts via the existing include syntax.

## User Confirmation

- [x] User approved this draft (autoApprove)
- Confirmed via Q1–Q9 sequence; auto mode enabled at Q9.
