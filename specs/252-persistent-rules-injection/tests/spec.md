# Test Design

### Test Design

- **TC-1: `rules.json` is package-bundled**
  - Type: acceptance
  - Input: Run `npm pack --dry-run`.
  - Expected: Listing includes `src/templates/skills/rules.json`.

- **TC-2: Valid rules load successfully**
  - Type: unit
  - Input: Load a valid `rules.json` containing unique kebab-case ids, non-empty canonical `phase`, optional `state`, and non-empty markdown `body`.
  - Expected: Loader returns rules in source order.

- **TC-3: Missing required field fails**
  - Type: unit
  - Input: Rule missing `id`, `phase`, or `body`.
  - Expected: Throws `Error`; message contains `rules.json` and describes the missing field.

- **TC-4: Unknown phase fails**
  - Type: unit
  - Input: Rule with `phase: ["flow.not-real"]`.
  - Expected: Throws `Error`; message contains `rules.json`, `unknown phase`, and `flow.not-real`.

- **TC-5: Unknown state fails**
  - Type: unit
  - Input: Rule with `state: ["notAState"]`.
  - Expected: Throws `Error`; message contains `rules.json`, `unknown state`, and `notAState`.

- **TC-6: Duplicate id fails**
  - Type: unit
  - Input: Two rules with id `same-id`.
  - Expected: Throws `Error`; message contains `rules.json`, `duplicate id`, and `same-id`.

- **TC-7: Malformed id fails**
  - Type: unit
  - Input: Rule id `Not_Kebab`.
  - Expected: Throws `Error`; message contains `rules.json` and the bad id.

- **TC-8: Extra unknown field fails**
  - Type: unit
  - Input: Rule containing unsupported field `extra`.
  - Expected: Throws `Error`; message contains `rules.json` and `extra`.

- **TC-9: Empty phase fails**
  - Type: unit
  - Input: Rule with `phase: []`.
  - Expected: Throws `Error`; message contains `rules.json` and `phase`.

- **TC-10: Empty body fails**
  - Type: unit
  - Input: Rule with blank or whitespace-only `body`.
  - Expected: Throws `Error`; message contains `rules.json` and `body`.

- **TC-11: Phase filter is OR**
  - Type: unit
  - Input: Rule has phases `["flow.plan", "task.impl"]`; active phase is `task.impl`.
  - Expected: Rule matches.

- **TC-12: State filter is AND**
  - Type: unit
  - Input: Rule requires `["worktreeActive", "autoApproveOn"]`; current state only has `worktreeActive`.
  - Expected: Rule does not match.

- **TC-13: Empty or absent state is always-on**
  - Type: unit
  - Input: Rule has no `state`, or `state: []`.
  - Expected: Rule matches when phase matches regardless of current state.

- **TC-14: Canonical phase enum is derived from definitions**
  - Type: unit
  - Input: Compare loader accepted phases with `collectLeafIds(FLOW_DEFINITION)` and `collectLeafIds(TASK_DEFINITION)`.
  - Expected: Set equals `flow.<id>` plus `task.<id>` for every leaf id.

- **TC-15: Loader resolves from package path, not cwd**
  - Type: integration
  - Input: Change cwd to unrelated temp directory and load bundled rules.
  - Expected: Loader succeeds.

- **TC-16: Canonical inventory is exact**
  - Type: unit
  - Input: Load bundled `rules.json`.
  - Expected: Id list equals exactly: `no-premature-conclusion`, `no-auto-mode-override-skill`, `thoroughness`, `no-shortcuts`, `wait-for-instruction-skill`, `commit-split-strategy`, `no-scope-splitting`, `choice-format-discipline`, `no-chain-sddforge`, `no-shared-repo-git-ops`.

- **TC-17: `no-auto-mode-override-skill` is always-on**
  - Type: unit
  - Input: Load bundled rule `no-auto-mode-override-skill`.
  - Expected: `state` is `[]`.

- **TC-18: Drift-prone bodies contain required headings**
  - Type: unit
  - Input: Load drift-prone rules.
  - Expected: Each body contains `### MUST`, `### Why`, `### How to apply` in that order.

- **TC-19: Drift-prone body missing heading fails**
  - Type: unit
  - Input: Drift-prone fixture missing one required heading.
  - Expected: Throws `Error`; message contains `rules.json` and the offending heading/body field.

- **TC-20: Body boundary whitespace is rejected**
  - Type: unit
  - Input: Rule body starts or ends with blank line.
  - Expected: Throws `Error`; message contains `rules.json` and `body`.

- **TC-21: Body rendering trims trailing newline**
  - Type: unit
  - Input: Render a rule body with trailing newline through deploy expander and next-action assembler.
  - Expected: Output uses `body.trimEnd()` and has no extra blank line.

- **TC-22: `skills.rule` returns renderable body**
  - Type: unit
  - Input: Invoke base preset DataSource `skills.rule({ id: "known-id" })`.
  - Expected: Returns a Renderable whose markdown equals the rule body.

- **TC-23: `skills.rule` unknown id fails**
  - Type: unit
  - Input: Invoke `skills.rule({ id: "missing-id" })`.
  - Expected: Throws `Error`; message contains `unknown skill rule id` and `missing-id`.

- **TC-24: `skills.rule` missing id fails**
  - Type: unit
  - Input: Invoke `skills.rule({})`.
  - Expected: Throws `Error`; message contains `missing skill rule id`.

- **TC-25: Directive params reach DataSource methods**
  - Type: integration
  - Input: Resolve directive like `{{data("base.skills.rule", id="foo")}}`.
  - Expected: DataSource method receives params containing `{ id: "foo" }`.

- **TC-26: Parser-owned directive options remain parser-owned**
  - Type: integration
  - Input: Resolve directives using `labels`, `header`, `footer`, and `ignoreError`.
  - Expected: Existing behavior is unchanged; those controls are not incorrectly consumed by DataSource methods.

- **TC-27: Existing DataSource methods still work without params**
  - Type: integration
  - Input: Resolve existing directives such as docs navigation, language links, or forge data.
  - Expected: Outputs match previous behavior, including synthetic label rewriting.

- **TC-28: Marker strip removes expanded data markers**
  - Type: unit
  - Input: Markdown containing paired data-directive comments around expanded content.
  - Expected: Markers are removed; surrounding bytes equal original input minus markers.

- **TC-29: Marker strip is idempotent**
  - Type: unit
  - Input: Call marker-strip helper twice on already-stripped markdown.
  - Expected: Second call returns byte-equal output.

- **TC-30: Marker strip rejects unexpanded directives**
  - Type: unit
  - Input: Paired marker content still contains an unprocessed data marker.
  - Expected: Throws `Error`; message contains `unexpanded data directive` and opening marker line number.

- **TC-31: Upgrade deploys expanded SKILL.md without markers**
  - Type: acceptance
  - Input: Run `sdd-forge upgrade`.
  - Expected: `.agents/skills/<name>/SKILL.md` and `.claude/skills/<name>/SKILL.md` contain referenced rule bodies and zero matches for opening/closing data marker regexes.

- **TC-32: Upgrade fails on missing rule id**
  - Type: acceptance
  - Input: Skill template references non-existent rule id.
  - Expected: `sdd-forge upgrade` exits non-zero; stderr contains `unknown skill rule id` and the id.

- **TC-33: Failed upgrade does not modify deployed skills**
  - Type: acceptance
  - Input: Same failure as TC-32 with pre-existing deployed files.
  - Expected: No deployed `SKILL.md` file is created, modified, or removed.

- **TC-34: Skill deploy pipeline is fully atomic**
  - Type: integration
  - Input: One main or project skill fails expansion after other skills would otherwise succeed.
  - Expected: No `.agents/skills/` or `.claude/skills/` target file is written or cleaned up.

- **TC-35: Skill deploy public API remains synchronous**
  - Type: unit
  - Input: Existing setup/upgrade callers invoke `deploySkills*` without `await`.
  - Expected: Call shape works unchanged; existing caller tests pass.

- **TC-36: Deploy uses synchronous rule expander**
  - Type: integration
  - Input: Spy/fake docs-style `skills` DataSource during skill deploy.
  - Expected: Deploy expands rules directly through sync loader; docs-style DataSource is not invoked.

- **TC-37: Next-action injects matching rule block**
  - Type: integration
  - Input: `flow get next-action` for active step with matching phase/state rules.
  - Expected: `instructions.content` is prepended with matching rules; other envelope fields are byte-equal to no-rules baseline.

- **TC-38: Next-action zero match preserves prompt bytes**
  - Type: integration
  - Input: Active phase/state matches no rules.
  - Expected: `instructions.content` equals no-rules baseline byte-for-byte.

- **TC-39: Auto-promotion filters against promoted step**
  - Type: integration
  - Input: `flow get next-action` with no `in_progress` step.
  - Expected: Envelope step is promoted step; injected rules are filtered against promoted step id.

- **TC-40: State derivation from flow.json**
  - Type: unit
  - Input: `flow.json` combinations of `worktree` and `autoApprove`.
  - Expected: `true` adds `worktreeActive` / `autoApproveOn`; false or absent adds nothing.

- **TC-41: Persistent rule block has exact markdown shape**
  - Type: unit
  - Input: Fixture with two matching rules and original prompt content.
  - Expected: Output starts with `## Persistent Rules`, blank line, ordered `<!-- rule: ID -->` comments, trimmed bodies, separators, then original prompt verbatim.

- **TC-42: Guardrail entry loads and filters by phase**
  - Type: integration
  - Input: Load merged guardrails and call `filterByPhase`.
  - Expected: New `code-quality` entry appears for `integration` and `task-impl`, not for `spec` or `draft`.

- **TC-43: Root `CLAUDE.md` collaboration section is exact**
  - Type: acceptance
  - Input: Inspect project-root `CLAUDE.md`.
  - Expected: EOF contains `## AI との協働原則` with exactly six `### ` subheadings in required order.

- **TC-44: Upgrade preserves root `CLAUDE.md` section**
  - Type: acceptance
  - Input: Run `sdd-forge upgrade`.
  - Expected: The `## AI との協働原則` section remains byte-equal.

- **TC-45: `CLAUDE.md` additions are not propagated to user projects**
  - Type: acceptance
  - Input: Run setup/upgrade in a fixture user project.
  - Expected: Generated project files do not contain the repository-specific collaboration section.

- **TC-46: Core principle paragraph remains source and deployed**
  - Type: acceptance
  - Input: Inspect `partials/core-principle.md` and deployed `.agents/skills/sdd-forge.flow/SKILL.md`.
  - Expected: Both contain `**MUST: When a rule in this skill conflicts with a memory entry` and `the skill rule takes precedence`.

- **TC-47: Spec tests are colocated and labeled**
  - Type: unit
  - Input: Enumerate added test files.
  - Expected: All live under `specs/252-persistent-rules-injection/tests/` and include `// spec: R<N>` headers.

- **TC-48: Default test runner discovers spec tests**
  - Type: integration
  - Input: Run default `npm test`.
  - Expected: Tests under `specs/*/tests/` are included automatically.

- **TC-49: Existing prompt equality tests are updated correctly**
  - Type: unit
  - Input: Existing `tests/unit/flow/` prompt assertions.
  - Expected: Matching-rule cases assert on-disk prompt as suffix; zero-match cases retain byte equality.

- **TC-50: Existing template tests target new rule source**
  - Type: unit
  - Input: Existing `tests/unit/templates/` assertions for migrated rule text.
  - Expected: Assertions target `rules.json` body or deployed `SKILL.md`, not source partial rule prose.

- **TC-51: E2E skill namespace expected output uses full deploy rendering**
  - Type: e2e
  - Input: Existing e2e comparing deployed `SKILL.md`.
  - Expected: Expected bytes are produced by include resolution plus rule expansion plus marker stripping.

- **TC-52: `AGENTS.sdd.md` templates contain no skill-rule directives**
  - Type: unit
  - Input: Inspect `src/presets/base/templates/ja/AGENTS.sdd.md` and `en/AGENTS.sdd.md`.
  - Expected: No `{{data("base.skills.rule", ...)}}` or equivalent skill-rule directive appears.

- **TC-53: `rules.json` filename is canonical everywhere**
  - Type: unit
  - Input: Search source, tests, prompts, and docs touched by the spec.
  - Expected: References use `rules.json`; stale conceptual filename references are absent except approved Issue-note context.

- **TC-54: Migration mapping table exists**
  - Type: acceptance
  - Input: Render or inspect spec/implementation notes for T-8.
  - Expected: Table includes rule id, Issue row, source location, directive placeholder, phase array, state array, and drift-prone flag for all 10 rules.
