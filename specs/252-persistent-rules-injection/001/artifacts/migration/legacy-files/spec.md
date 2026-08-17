# Feature Specification: 252-persistent-rules-injection

**Feature Branch**: `feature/252-persistent-rules-injection`
**Created**: 2026-05-08
**Status**: Draft
**Input**: GitHub Issue #311

## Goal
Inject phase- and state-filtered persistent rules into every `flow get next-action` response, and migrate dispersed rule bodies to a single `rules.json` SSOT bundled with the package (file path: `src/templates/skills/rules.json`), to mitigate long-session AI drift away from skill rules.

## Background
Long sessions show repeated AI norm violations (Q&A structure collapse, worktree boundary crossing, premature conclusion, sycophancy, auto-mode runaway). Empirical investigation of 149 sessions (Issue #311) found that rules written directly in CLAUDE.md show 0 violations while rules referenced via memory feedback files show 15 violations — the dominant failure is initial-load failure rather than mid-session drift. Rule placement (loaded layer vs. dormant link) determines deterrence by an order of magnitude. Promoting dormant rules into the layer the AI reads on every step turn (skill instructions injected by `flow get next-action`) is therefore expected to attack the primary drift cases. Empirical prompt experiments (v5b verbose ~800 tokens vs v6 terse ~250 tokens) confirm verbose well-structured prompts maintain effect even at 168K context, while over-compression collapses; the design therefore retains expressive markdown bodies while filtering by phase + state to keep the per-call payload bounded.

## Scope
- Rule SSOT file shipped with the package (single JSON file under existing skills templates location).
- Rule loader that enforces the schema and applies a phase=any-match (OR), state=all-required (AND) filter. `state: []` means always-on. Drift-prone rules (curated set) require body containing MUST + 'why' + 'how to apply'.
- DataSource adapter file `skills.js` (under `src/docs/data/`) registering source name `skills`, method `rule`, returning a Renderable for `params.id`.
- Prerequisite plumbing extending the existing data-directive resolver path so directive option objects (e.g. `{id: "..."}`) reach the DataSource method.
- Marker-strip helper exposed by the directive parser module; strips paired data-directive comment markers; idempotent; throws on any unexpanded data block remaining at strip time.
- Integration of the skill-rule expansion + marker strip into the existing skill deploy pipeline. Public surface (functions called by setup / upgrade) keeps its current call shape.
- Modification of `flow get next-action` so `instructions.content` is prepended with the phase- and state-filtered rule block. The state set is derived from flow.json: `worktree === true → 'worktreeActive'`; `autoApprove === true → 'autoApproveOn'`. Other envelope fields are unchanged. When zero rules match, no prepend occurs.
- Migration of 10 rule bodies (per Issue #311 inventory + user-confirmed merge of partials #14/#15/#16 into separate entries) out of partials and into `rules.json`. Partials retain non-rule prose plus the new directive placeholders.
- Addition of a `code-quality` guardrail entry (covering 'no single-caller indirection / DRY first / present design direction') to `src/presets/base/guardrail.json`, with `meta.phase: ['integration', 'task-impl']`.
- Append 6 personal-principle rules (Issue #311 rows #1, #4, #5-abstract, #6, #7, #10-abstract) to project-root `CLAUDE.md` (separate file from `AGENTS.md`).
- Add skill > memory precedence statement (non-rule prose) to `partials/core-principle.md` so it is included into deployed SKILL.md.
- Tests in `specs/252-persistent-rules-injection/tests/` with `// spec: R<N>` header per file: loader schema and filter, DataSource adapter, parser/resolver param plumbing, deploy pipeline integration, get-next-action injection (including auto-promotion path), guardrail loading, package-files inclusion, loader path resolution.
- Issue #311 body update post-merge to reflect the user-confirmed 10-rule inventory and the rules.js → skills.js filename override (deliverable acknowledged in spec).
- Re-run `sdd-forge upgrade` post-implementation to materialize SKILL.md / CLAUDE skill copies.

## Out of Scope
- Structural renames `src/templates/` → `src/skill/` and `src/docs/data/` → `src/data/` (deferred to issue 7da8).
- Real-time violation detection / auto-correction (deferred to issue 6f7d).
- Static enforcement of finalize PR route (separate issue, Issue #311 #12).
- Backward-compatibility shims for prior rule placement (alpha policy: no compat shims).
- Adding state values beyond `worktreeActive` / `autoApproveOn` (extensible array — additions can come later without schema change).
- Wildcards or parent-id aliases in the phase enum.
- Project-local override of rules.json (would re-introduce the drift this spec eliminates).
- Re-implementation of guardrail loading (skill-rules and guardrails are separate domains).
- Conversion of the skill deploy pipeline's public call shape from sync to async.

## Constraints
- External-dependency-free: only Node.js built-in modules.
- Alpha-policy: no backward-compat shims, no preserved deprecated paths.
- OOP-typed values: structural value classes (Renderables, etc.) instead of `{type: "..."}` dispatch objects, per existing project policy.
- `src/` content must remain project-agnostic (no project-specific values inlined).
- Tests must not be modified to pass; product code is the variable.
- Commit messages in English; no sign-off lines, no co-authored-by trailers.
- Bundled `rules.json` must be included in the npm `files` field so it ships in `node_modules/sdd-forge/`.

## Design Principles
- Single source of truth (SSOT) for the 10 Issue #311 persistent skill rule bodies: `rules.json` is the only place where the wording for those 10 rules lives. Rule-like wording in skill structural prose (e.g. SKILL.md narrative sections) and in non-migrated partials remains in place, per R34's explicit out-of-scope list.
- Strict-by-default for skill rules: unknown id, malformed schema, or unexpanded marker each cause build failure.
- Tolerant default preserved for general DataSource consumers (no behavior change for opportunistic data lookups).
- Filter by phase (any-match) and state (all-required) — bounded payload per call, expressive enough to differentiate drift-prone state-dependent rules.
- Scope-aware leaf id strings (`flow.<step>` / `task.<step>`) for unambiguous filtering across the FLOW vs TASK definition collisions.
- Author-controlled order: matched rules emit in the order they are authored in `rules.json`.

## Overview
### Modules
- rules-ssot — Holds the canonical, schema-validated set of skill rule entries. Bundled with the package.
- skill-rules-loader — Loads and validates rules.json; exposes filter (phase + state) and the strict skill-rule directive expander used by the skill deploy pipeline.
- skills-datasource-adapter — Registers the docs-style DataSource (filename `skills.js`, source `skills`, method `rule`) so partials/SKILL.md directives can be expanded by the existing resolver path. Returns a Renderable for `params.id`.
- directive-resolver-params-plumbing — Carries directive option objects through resolveDataDirectives and resolver.resolve so DataSource methods can receive `{id: ...}`. Existing call sites are migrated; existing DataSources that ignore the new argument are unaffected.
- marker-strip-helper — Removes paired data-directive comment markers from an already-expanded markdown string. Idempotent. Throws if any unexpanded data block remains.
- skill-deploy-pipeline-integration — Wires skill-rule expansion + marker strip into the existing skill deploy pipeline so deployed SKILL.md contains rule bodies and no markers. Public surface unchanged.
- next-action-rule-injection — Modifies the next-action assembler to derive state from flow.json (worktree → worktreeActive, autoApprove → autoApproveOn) and prepend the filtered rule block to instructions.content. Other envelope fields are unchanged.
- rule-migration — Moves 10 rule bodies from existing partials into rules.json; partials retain non-rule prose plus the new directive placeholders.
- preset-guardrail-extension — Adds one `code-quality` guardrail entry to base preset, covering integration and task-impl phases.
- claude-md-extension — Appends the 6 personal-principle rules to project-root CLAUDE.md as a single contiguous Japanese section.
- skill-memory-precedence-statement — Adds non-rule prose to core-principle.md partial stating that skill rules take precedence over conflicting memory entries.

### Data Flow
- Source: rules.json is loaded once at deploy time by the skill pipeline and at request time by the next-action assembler.
- Skill deploy: include resolution → skill-rule directive expansion (loader) → marker strip → write to .agents/skills/, .claude/skills/.
- Next-action: flow.json (worktree, autoApprove) → state set → loader filters rules by phase + state → assembled rule block → prepended to instructions.content.

### Decisions
- D1 State derivation: derive state set from existing flow.json boolean fields (worktree → worktreeActive, autoApprove → autoApproveOn). Missing/false fields contribute nothing. Reuses existing SSOT, avoids duplicate-source drift.
- D2 Filter semantics: phase=any-match (OR), state=all-required (AND), state=[] or absent means always-on. Phase is required and non-empty. No wildcards, no parent aliases.
- D3 Injection point: prepend the rule block to instructions.content. No new envelope field. Zero-match → no prepend. Other envelope fields byte-equal to baseline.
- D4 Unknown-id failure: fails fast wherever rendered. Skill deploy caller propagates failure to non-zero exit. DataSource throws when invoked directly. General docs-style resolver path keeps its existing tolerant-null behavior so other DataSource consumers are unaffected.
- D5 DataSource file naming override: adapter file is named skills.js (not rules.js as Issue originally named it). Loader derives source name from filename, so the directive source segment `skills` requires the file to be named skills.js. User-confirmed at draft Q&A round 2.
- D6 Phase enum: scope-aware leaf ids. Each rule.phase entry is exactly one of 24 strings (21 flow.<leaf> + 3 task.<leaf>). FLOW_DEFINITION and TASK_DEFINITION share leaf ids `review` and `gate-impl`; scope prefix disambiguates. No wildcards.
- D7 Strict file format for rules.json: unique kebab-case ids; required non-empty phase/body; optional state; no extra/unknown fields; no meta.section.
- D8 Strict marker handling at deploy time: deployed SKILL.md must contain no {{data}} markers. Any unexpanded data block remaining at strip time triggers a build failure.
- D9 Body-quality criteria for drift-prone rules: must contain MUST + brief why + brief how-to-apply. Other rules may be a single MUST line. Mechanical loader check, not AI judgment.
- D10 Memory-vs-skill precedence: stated as non-rule prose in partials/core-principle.md, not as a rule entry in rules.json. Meta about rule application, not itself an injected behavior.

## Clarifications (Q&A)
- Q: Where does the rule filter derive 'state' (worktreeActive / autoApproveOn) from?
  - A: From existing flow.json boolean fields (worktree, autoApprove). User-confirmed at draft Q&A round 1.
- Q: What filter semantics for phase + state?
  - A: phase=any-match (OR), state=all-required (AND), state=[] or absent means always-on. User-confirmed at draft Q&A round 1.
- Q: Where is the rule block injected in the next-action envelope?
  - A: Prepended to instructions.content. User-confirmed at draft Q&A round 1.
- Q: What happens if a directive references an unknown rule id during sdd-forge upgrade?
  - A: Build fails fast with a recognizable error. User-confirmed at draft Q&A round 1.
- Q: Where do new tests live?
  - A: Under specs/252-persistent-rules-injection/tests/ per the Spec Test Coverage guardrail; each file carries // spec: R<N> header. (Earlier draft mentioned tests/unit/ siblings; the spec guardrail mandates the specs/ location.)
- Q: What rule body format?
  - A: Free-form markdown overall; drift-prone subset (curated, initially three rules) must include MUST + why + how-to-apply. User-confirmed at draft Q&A round 1; refined at draft Q&A round 2.
- Q: Should the DataSource adapter file be named rules.js (per Issue) or skills.js?
  - A: skills.js — loader convention derives source name from filename, and the directive's source segment must be `skills`. User-confirmed at draft Q&A round 2 as override of Issue body.
- Q: Should partial integrations #14/#15/#16 be folded into existing rule bodies (8 total) or extracted as separate rule entries (10 total)?
  - A: Extracted as separate entries: 10 total rules.json entries. User-confirmed at draft Q&A round 2 as override of Issue body's 8 tally.

## Alternatives Considered
- Add a flow.json `state[]` field instead of deriving state from existing booleans — Duplicates SSOT; requires synchronous updates on every transition; drift-prone.
- Filter semantics where both phase and state use OR — Cannot express AND across multiple state requirements.
- New top-level envelope field `persistentRules` — Schema migration; consumers may not read it; defeats the goal of guaranteed visibility.
- Silent skip + warn on unknown rule id — Easy to miss in CI; ships broken markers in deployed artifacts.
- Reuse the existing tolerant resolver for skill rules — Resolver catches errors and returns null, silently leaving unexpanded markers in SKILL.md.
- Keep the file named rules.js and use directive `base.rules.rule` — Directive reads as a stutter; Issue body intent was `base.skills.rule`.
- Encode rule id as a method name (e.g. `base.skills.<rule-id>`) — Requires runtime dynamic method dispatch; clutters the class with synthetic methods; harder static analysis.
- Mandatory must/why/how on every rule (not just drift-prone subset) — Adds noise to mechanical rules whose constraint is fully self-explanatory; v6 over-compression failure was content-driven, not template-driven.
- Allow `*` wildcard in phase array — Marginal author convenience; introduces a parsing edge case and obscures coverage.
- Permit project-local override of rules.json (`.sdd-forge/skill-rules.json`) — Re-introduces the multi-source drift the issue is trying to remove.
- Generate CLAUDE.md additions from a `personal-rules.json` — Overkill for 6 short paragraphs; adds another generation pipeline.
- Append the 6 personal-principle rules automatically via `sdd-forge upgrade` — Risks duplicate inserts and silent overwrites of user edits.
- Convert deploySkills* to async to use createResolver — Propagates `await` upward through setup/upgrade; cost not justified for a static-asset transform.
- Make the existing resolver strict by default — Breaks current consumers that rely on null-on-error tolerant behavior.
- Ship the precedence rule as a rule entry in rules.json with phase=all 24 — Redundant once the AI has read SKILL.md; meta-rules belong as non-rule prose, not injected per step.

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: A package-bundled rules SSOT file ships under `src/templates/skills/` (filename irrelevant to consumers; verifiable by `npm pack --dry-run` listing it). Each rule entry has unique kebab-case id, required non-empty `phase` array of canonical scope-aware leaf ids, optional `state` array of documented state names, and required non-empty markdown `body`. Unknown / extra fields cause load failure.
- R2 [must]: The rules loader applies filter semantics: phase=any-match (OR), state=all-required (AND), state empty/absent means always-on. Loading an invalid file fails by throwing an `Error` whose message contains both (a) the literal substring `rules.json` and (b) a description of the offending field/value (e.g. for an unknown phase: the literal substring `unknown phase` plus the bad phase string; for a duplicate id: the literal substring `duplicate id` plus the duplicated id string). The same convention applies to: missing required field, unknown phase value, unknown state value, duplicate id, malformed kebab-case id, extra unknown field. Tests assert each case raises an `Error` whose message contains the expected literal substrings.
- R3 [must]: A DataSource adapter named `skills` registers under preset `base` and exposes a method `rule` that returns a Renderable for the rule body when given a valid id via the directive option object. Direct invocation with an unknown id throws an `Error` whose message contains the literal substring `unknown skill rule id` plus the offending id string. Direct invocation with no `id` option throws an `Error` whose message contains the literal substring `missing skill rule id`.
- R4 [must]: The data-directive resolver path forwards directive option objects (e.g. `{id: "foo"}`) to DataSource methods. Existing DataSource methods that did not previously consume options keep working unchanged.
- R5 [must]: A marker-strip helper exists in the directive parser module. Given expanded markdown that still contains paired data-directive comment markers, calling the helper produces output where the markers are removed and surrounding markdown is byte-equal to the input minus those markers. Calling it twice is a no-op. If the input still contains an unexpanded data directive (paired marker bracketing content that itself is or contains an unprocessed data marker — i.e. expansion did not run), the helper throws an `Error` whose message contains the literal substring `unexpanded data directive` plus the line number of the offending opening marker.
- R6 [must]: Deployed SKILL.md (in `.agents/skills/<name>/SKILL.md` and `.claude/skills/<name>/SKILL.md`) contains the rule bodies referenced from the source partials/SKILL.md, AND contains zero matches for the regex `<!--\s*\{\{data\(` (no opening data-directive markers), AND contains zero matches for the regex `<!--\s*\{\{/data\}\}` (no closing data-directive markers), after `sdd-forge upgrade` runs successfully. The grep-style regexes above are the canonical assertion form used by the verification test.
- R7 [must]: When a skill source template references a non-existent rule id, `sdd-forge upgrade` exits with a non-zero status code and emits an error message to stderr containing the literal substring `unknown skill rule id` plus the offending id string. No deployed SKILL.md file is updated as a side effect of the failed run.
- R8 [must]: The `flow get next-action` envelope's `instructions.content` is prepended with a markdown rule block listing all rules whose phase array contains the active scope-aware step id (`flow.<stepId>` or `task.<stepId>`) and whose state array is satisfied by the current state set derived from flow.json. State derivation: `worktree === true` adds `worktreeActive`; `autoApprove === true` adds `autoApproveOn`; absence/false fields contribute nothing. Other envelope fields (`taskId`, `step`, `action`, `instructions.key`, `context`, `output_schema`, `requires_approval`, `maxAttempts`, `autoUpgrade`) are byte-equal to a no-rules baseline for the same step.
- R9 [must]: When zero rules match the active phase + state, `instructions.content` is byte-equal to a no-rules baseline (no heading, no separator).
- R10 [must]: When `flow get next-action` is invoked with no `in_progress` step (auto-promotion path), the envelope reflects the promoted step's id and the rule block is filtered against the promoted step's id (not against a stale or null state).
- R11 [must]: rules.json contains exactly 10 rule entries with these literal `id` values (kebab-case, in this order): `no-premature-conclusion`, `no-auto-mode-override-skill`, `thoroughness`, `no-shortcuts`, `wait-for-instruction-skill`, `commit-split-strategy`, `no-scope-splitting`, `choice-format-discipline`, `no-chain-sddforge`, `no-shared-repo-git-ops`. Each entry's source row in Issue #311, phase array, and state array per the draft Q14 inventory table — modified by R36 (no-auto-mode-override-skill state is `[]` not `['autoApproveOn']`). A test asserts the loaded rules' id list equals the literal list above in order.
- R12 [must]: Drift-prone rule entries (id list curated initially as `no-premature-conclusion`, `no-auto-mode-override-skill`, `wait-for-instruction-skill`) have `body` markdown that contains three explicit headed sections in this order: an `### MUST` heading followed by the constraint, a `### Why` heading followed by the rationale, and a `### How to apply` heading followed by operational guidance. The loader rejects a drift-prone rule whose body is missing any of these three exact heading strings (case-sensitive). Localized headings (e.g. Japanese variants) are NOT supported — the headings are deliberately English to enable a single deterministic regex check.
- R13 [must]: `src/presets/base/guardrail.json` contains a new entry with `meta.category: "code-quality"` and `meta.phase` array containing `integration` and `task-impl`. The entry is loaded by `loadMergedGuardrails` and surfaces in `filterByPhase(_, 'integration')` and `filterByPhase(_, 'task-impl')`. It does NOT surface in `filterByPhase(_, 'spec')` or `filterByPhase(_, 'draft')`.
- R14 [must]: Project-root `CLAUDE.md` (separate file from `AGENTS.md`) gains a single contiguous Japanese section appended at end-of-file with the EXACT literal heading `## AI との協働原則`. Under that heading the section contains exactly 6 sub-headings written as `### <タイトル>` lines, in this order and with these literal titles: `### 一貫したコミュニケーション`, `### 独立分析`, `### AI 判断権の限界`, `### ファシリテートのキャッチボール`, `### 過去判断の推測禁止`, `### 指示なしに行動しない`. Each sub-heading is followed by 1-3 sentences of body text expressing the principle from the corresponding Issue #311 row (#1, #4, #5-abstract, #6, #7, #10-abstract respectively). After running `sdd-forge upgrade`, this section remains in CLAUDE.md unchanged. A grep test asserts the exact literal heading and exactly 6 `### ` lines under it.
- R15 [must]: `partials/core-principle.md` contains a non-rule-prose paragraph that begins with the literal string `**MUST: When a rule in this skill conflicts with a memory entry` and contains the literal substring `the skill rule takes precedence`. After `sdd-forge upgrade`, deployed `.agents/skills/sdd-forge.flow/SKILL.md` contains this paragraph verbatim. A grep test asserts both source partial and deployed SKILL.md contain these literal substrings.
- R16 [must]: All test files added by this spec live under `specs/252-persistent-rules-injection/tests/` and each carries a `// spec: R<N>` header naming the requirement(s) it covers.
- R17 [must]: The skill deploy pipeline's public surface (functions called by setup / upgrade) keeps its existing call shape — callers do not need to migrate from sync to async invocations and existing tests of those callers continue to pass without signature changes.
- R18 [should]: Issue #311 body is updated post-merge to (a) reflect the user-confirmed 10-rule inventory and (b) note the rules.js → skills.js filename override.
- R19 [must]: The canonical scope-aware phase enum (24 strings) is derived programmatically from `collectLeafIds(FLOW_DEFINITION)` and `collectLeafIds(TASK_DEFINITION)` rather than hardcoded as a literal list. A test asserts that the loader's accepted-phase set equals `{flow.<id>: id ∈ collectLeafIds(FLOW_DEFINITION)} ∪ {task.<id>: id ∈ collectLeafIds(TASK_DEFINITION)}` so the enum stays in sync if leaves are added/removed.
- R20 [must]: The skill deploy pipeline uses the synchronous skill-rules-loader expander directly (NOT the async docs-style resolver). The `skills` DataSource adapter is registered for docs-style directive compatibility but is not invoked during skill deploy. Existing setup/upgrade callers continue to invoke `deploySkills*` synchronously without `await`.
- R21 [must]: Existing tests under `tests/unit/flow/` that assert byte equality of `instructions.content` against on-disk prompt files are updated: in cases where rules match, the assertion is changed to require the on-disk prompt content as a suffix of `instructions.content` (i.e. the injected rule block is a prefix). Existing tests where zero rules match keep their byte-equality assertion.
- R22 [must]: Existing tests under `tests/unit/templates/` (e.g. `worktree-mode.test.js`) that asserted specific rule-body MUST text inside source partials are updated: assertions now target either the new `rules.json` body or the deployed SKILL.md (post-`sdd-forge upgrade`) rather than the source partial. Source partials are expected to retain only non-rule prose plus directive placeholders.
- R23 [must]: Directive option params plumbing has a defined contract for which keys go where: (a) parser-owned controls (`labels`, `header`, `footer`, `ignoreError` and any other existing parse-side option) continue to be processed by the parser/resolver layer with no behavior change, (b) any other key (e.g. `id`) is forwarded to the DataSource method via the params argument. Every `resolveDataDirectives` caller and `resolver.resolve(...)` signature is updated to thread params through. Existing synthetic label injection behavior in `src/docs/commands/data.js`, `readme.js`, `agents.js`, and `forge.js` (e.g. `docs.nav`, `docs.langSwitcher`, `lang.links` label rewriting) is preserved. A test asserts that `header` / `footer` / `ignoreError` continue to behave unchanged AND that `{id: "foo"}` reaches `skills.rule`'s params argument.
- R24 [must]: The skill deploy pipeline is atomic with respect to rule expansion failure: it expands and validates every skill's output in memory before writing any target file or removing obsolete skills. If any expansion fails (unknown id, marker leftover, body-quality failure), no `.agents/skills/` or `.claude/skills/` file is created or modified by that run.
- R25 [must]: The CLAUDE.md additions in R14 are scoped to this repository's `CLAUDE.md` only (sdd-forge project root). They are NOT propagated to user projects via `sdd-forge setup` or `sdd-forge upgrade`. The package's `src/` content remains project-agnostic.
- R26 [nice-to-have]: Stale references to non-existent task step ids (e.g. `task.run-tests` in `src/flow/prompts/task/impl.md`) introduced by earlier specs are explicitly out of scope for this spec and tracked separately. This spec does not add or remove such references.
- R27 [must]: The canonical SSOT file path is exactly `src/templates/skills/rules.json` (the on-disk filename is `rules.json`; the conceptual name 'skill-rules.json' from the Issue body is a working name that does NOT match the on-disk file). All references in source code, tests, prompts, error messages, and documentation use `rules.json` as the filename. The Issue #311 body update (R18) acknowledges this filename.
- R28 [must]: The default `npm test` invocation runs the new tests under `specs/252-persistent-rules-injection/tests/` automatically. This is achieved by extending the test runner's search-directories list to include `specs/*/tests/` (one place to change). The `tests/unit/` mirror option is rejected: spec-test colocation is mandated by the Spec Test Coverage guardrail, so duplicating files into `tests/unit/` would violate the guardrail. R16 (specs/<id>/tests/ location) and R28 (search-dir extension) are consistent: R16 fixes the location, R28 ensures the runner picks it up.
- R29 [must]: Existing e2e tests under `tests/e2e/` that compare deployed SKILL.md bytes against `resolveIncludes(rawTemplate)` (e.g. `tests/e2e/051-skill-namespace.test.js`) are updated to compare against the full skill deploy rendering path (include resolution + skill-rule expansion + marker strip) so they remain meaningful after rule injection changes deployed content.
- R30 [must]: Upgrade-phase atomicity: `sdd-forge upgrade`'s skill phase pre-expands and validates ALL skills (both main and project/experimental skills covered by `deploySkills` and `deployProjectSkills`) in memory before writing any skill target file or running cleanup. A failure during expansion of any one skill aborts the upgrade phase before any file is written or removed, leaving `.agents/skills/` and `.claude/skills/` in their pre-upgrade state.
- R31 [must]: The rules loader resolves `rules.json` relative to the bundled package directory (e.g. via `PKG_DIR` / `import.meta.url`-derived path) rather than relative to the current working directory. This ensures correctness whether sdd-forge is invoked from a development checkout, an `npm install`-ed `node_modules/sdd-forge/`, an npx invocation, or any user project root. A test asserts the loader succeeds from a temporary fixture cwd that is unrelated to the package root.
- R32 [must]: spec.md (rendered by `sdd-forge spec render`) and/or implementation_notes for T-8 contain a complete migration mapping table with the following columns per rule entry: `rule id` (working), Issue #311 row, source file path + section/line range, replacement directive placeholder (i.e. the directive form to be added at that location), phase array (per Q14 inventory), state array, and drift-prone flag. This table is the authoritative reference during implementation; implementers do not invent additional rules nor leave stale rule prose in source partials.
- R33 [nice-to-have]: Existing prompts that reference the deprecated guardrail phase value `impl` (e.g. `src/flow/prompts/impl/implement.md` may invoke `sdd-forge flow get guardrail impl` while the new guardrail uses `task-impl` / `integration`) are either updated within this spec to reference the active phase value(s), OR explicitly declared out of scope with a follow-up issue link. This spec chooses to declare it OUT OF SCOPE; rationale: the existing prompts have been functional under the current phase enum since spec 184 and changing them is independent of this spec's deliverables. The new guardrail will surface in `gate-impl` evaluations regardless of the prompts' wording, and follow-up issue 7da8 (or a sibling) tracks prompt-text cleanup.
- R34 [must]: rules.json's SSOT scope is narrowed to 'Issue #311 persistent skill rules' (the 10 entries listed in R11). Other rule-like wording that currently lives elsewhere is EXPLICITLY OUT OF SCOPE for migration in this spec and remains in place — including: (a) sections inside `src/templates/skills/sdd-forge.flow/SKILL.md` such as 'Approval-gated transitions', 'No-auto-promote', 'Worktree boundary', 'Command execution discipline', 'Hard Stops' (these stay as direct skill prose because they are skill-structural narrative, not migrate-able rule entries); (b) rule-like prose in partials not on the migration list (flow-tracking.md, context-recording.md, issue-log-recording.md, plus any non-#14/#15/#16 prose remaining in core-principle.md or worktree-mode.md after migration). A future spec may migrate any of these following the same pattern; this spec does not.
- R35 [must]: Generated AGENTS templates `src/presets/base/templates/ja/AGENTS.sdd.md` and `src/presets/base/templates/en/AGENTS.sdd.md` are NOT modified by this spec. Any rule-like wording that currently exists in those templates is intentionally left as project-agent guidance independent of skill-rules.json (different audience, different lifecycle). `{{data("base.skills.rule", ...)}}` placeholders are FORBIDDEN inside `AGENTS.sdd.md` because `loadSddTemplate` reads them raw during setup without running the docs resolver — the spec adds a test or lint asserting no skill-rule directive appears in `AGENTS.sdd.md` to enforce this prohibition.
- R36 [must]: Rule entry `no-auto-mode-override-skill` (sourced from Issue #311 row #5-skill — the `skill-rules.json` half of the dual-destination split) has `state: []` (always-on), NOT `state: ['autoApproveOn']` as initially proposed in the draft inventory. Rationale: the rule must apply BEFORE auto mode is enabled — its constraint is 'do not enable auto mode yourself / do not bypass user choice in interactive flows', which is most critical when auto is OFF. The inventory table in spec.md and the migration notes in T-1 reflect this state assignment. R11's reference to 'phase and state assignments per the draft inventory table (Q14)' is interpreted with this R36 override.
- R37 [must]: The injected rule block in `instructions.content` has an exact, deterministic markdown shape:
- Line 1: the literal heading text `## Persistent Rules`.
- Line 2: blank line.
- For each matched rule, in author order from rules.json: one HTML comment line of the literal form `<!-- rule: ID -->` (where ID is the rule's id field, with no surrounding whitespace inside the comment beyond the single spaces shown), followed by the rule's body markdown verbatim (with `body.trimEnd()` applied — see R39), followed by exactly one blank-line separator.
- After the last rule's separator, one additional blank line, then the original prompt content (existing instructions.content) appended verbatim.
- When zero rules match, no heading and no block are emitted; `instructions.content` equals the original prompt content byte-for-byte.
A test asserts the exact rendered shape for a fixture with two rules (one drift-prone, one not) and a fixture with zero matches.
- R38 [nice-to-have]: The generated docs under `docs/` are NOT regenerated as part of this spec. Following the project rule that 'docs and code may diverge; code is authoritative', a follow-up `sdd-forge build` run is left to a separate cleanup pass and is OUT OF SCOPE here. Rationale: docs regeneration runs AI prompts and would expand the cost of this spec materially; the affected sections (next-action envelope, directive parsing, DataSource behavior) are documented sufficiently in this spec's own files (spec.md, draft.json) for downstream readers.
- R39 [must]: Rule body normalization: the loader rejects rule entries whose `body` field starts or ends with a blank line (i.e. `body !== body.trim()` would discard whitespace at either end). Renderers (the next-action assembler in R37 and the deploy-time expander) emit the body with `body.trimEnd()` applied so a trailing newline does not produce an extra blank line in the output. Leading whitespace is preserved as authored. This ensures the deterministic markdown shape in R37 is stable regardless of JSON authoring quirks (e.g. accidental trailing newline in a rule body).

## Acceptance Criteria
- Running `sdd-forge upgrade` after applying this spec produces deployed `SKILL.md` files that contain rule bodies inline and contain no data-directive markers.
- An integration test invoking `flow get next-action` against a fixture with `worktree: true` and step `flow.draft` yields an `instructions.content` whose top contains exactly the rule bodies that match those filters in the order they appear in rules.json; with `worktree: false`, the worktreeActive-tagged rule is absent.
- An integration test where SKILL.md references a non-existent rule id confirms `sdd-forge upgrade` exits non-zero with a recognizable error.
- Unit test confirms loader rejects (a) duplicate id, (b) unknown phase entry, (c) missing required field, (d) extra unknown field, (e) invalid kebab-case id, (f) drift-prone rule missing why/how.
- Unit test confirms DataSource adapter throws on unknown id when invoked directly.
- Unit test confirms parser/resolver param plumbing carries `{id: "foo"}` from a directive into the DataSource method's call.
- Test confirms `npm pack --dry-run` includes the bundled rules.json file.
- Test confirms the `code-quality` guardrail loads and filters as specified in R13.
- Test confirms deployed SKILL.md contains the skill > memory precedence statement (R15).
- Auto-promotion test (no `in_progress` step) confirms rule injection uses the promoted step's id (R10).

## Implementation Targets
-

## Open Questions
- [ ] Exact rule body markdown wording for each entry in rules.json — drafted at implementation time by extracting/tightening the current partial prose. Constraints (R12, R39) bound the shape; exact prose is content authoring.
- [ ] Whether the Issue body update (R18) is mandatory or nice-to-have — flagged should-priority pending user direction post-merge.

## Tasks
### Round 0
- **T-1** [pending]: Add rules.json SSOT file with the 10 migrated rule entries
  - Bundle the canonical rule SSOT with the package, populated with the 10 entries per the inventory table.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Add the rules loader module
  - Provide schema validation and phase+state filter capabilities for rules.json. Surface a strict expander for the skill deploy pipeline.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Add the skills DataSource adapter
  - Register a docs-style DataSource so partials and SKILL.md directives can resolve `base.skills.rule`.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Extend the data-directive resolver path to forward directive option objects
  - Make `{id: "..."}` (and any other future option) reach DataSource methods through `resolveDataDirectives` and `resolver.resolve`.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Add stripDataMarkers helper to the directive parser
  - Expose a pure helper that strips paired data-directive markers from already-expanded markdown and throws on any unexpanded data block remaining.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Wire skill-rule expansion + marker strip into the skill deploy pipeline
  - Deployed SKILL.md contains rule bodies inline and no data-directive markers.
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Inject filtered rule block into get-next-action instructions.content
  - Every `flow get next-action` response prepends the phase- and state-filtered rule block to instructions.content; other envelope fields are unchanged.
  - see `tasks/T-7.md` for full spec
- **T-8** [pending]: Migrate rule bodies from existing partials into rules.json with placeholders
  - Move rule bodies out of partials' prose into rules.json. Partials retain non-rule prose plus the directive placeholders that point to the migrated entries.
  - see `tasks/T-8.md` for full spec
- **T-9** [pending]: Add code-quality guardrail entry to base preset
  - Inherit a single composite `code-quality` rule (no single-caller indirection / DRY first / present design direction) at integration and task-impl phases for every project on sdd-forge.
  - see `tasks/T-9.md` for full spec
- **T-10** [pending]: Append 6 personal-principle rules to project CLAUDE.md
  - Project-root CLAUDE.md gains a single contiguous Japanese section with 6 sub-headings, one per Issue #311 personal-principle row.
  - see `tasks/T-10.md` for full spec
- **T-11** [pending]: Add skill > memory precedence statement to core-principle.md partial
  - Deployed SKILL.md contains a non-rule-prose paragraph stating that skill rules take precedence over conflicting memory entries.
  - see `tasks/T-11.md` for full spec
