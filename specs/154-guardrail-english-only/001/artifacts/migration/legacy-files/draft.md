**Development Type:** Enhancement — Deprecate multilingual guardrail support

**Goal:** Unify all guardrail files to English only by moving them from `templates/<lang>/guardrail.json` to `<preset>/guardrail.json` and removing the multilingual loading mechanism.

## Context

Issue #106: Guardrails were originally designed as English-only AI constraints. At some point, language-specific directories (`templates/en/` and `templates/ja/`) were introduced, creating unnecessary translation overhead and potential inconsistency.

## Q&A

**Q1: What is the new file location for guardrail.json?**
A: `src/presets/<preset>/guardrail.json` — directly in the preset directory, not inside `templates/`. This is a clean separation: docs templates stay in `templates/<lang>/`, AI constraints live at the preset root.

**Q2: Which version of the content to use?**
A: The English version from `templates/en/guardrail.json`. All 17 presets have both `en/` and `ja/` versions based on `find` output, so no translation is needed.

**Q3: What changes in `src/lib/guardrail.js`?**
A: `readWithFallback()` is simplified — remove the `templates/<lang>/` path construction and the `en` fallback logic. Read from `path.join(dir, GUARDRAIL_FILENAME)` directly. `lang` parameter is no longer needed in the preset chain loader.

**Q4: Does setup/upgrade deploy guardrail files to projects?**
A: No. `src/setup.js` and `src/upgrade.js` have no guardrail references. Guardrail files are internal to the sdd-forge package only.

**Q5: Are `templates/en/` and `templates/ja/` directories deleted?**
A: No. These directories contain doc templates (overview.md, etc.) for other presets. Only `guardrail.json` is removed from them.

**Q6: What tests are affected?**
A: Existing tests in `tests/unit/specs/commands/guardrail*.test.js` use `.sdd-forge/guardrail.json` (project-level), not preset templates — so they are unaffected.

**Q7: What are the callers of `loadMergedGuardrails`?**
A: `get-guardrail.js`, `run-gate.js`, `run-lint.js`. All three call the same function signature — no change required in callers.

## Impact on Existing Features

- `sdd-forge flow get guardrail <phase>`: output becomes English-fixed. Previously, projects with `lang="ja"` would get Japanese guardrails; now they get English. This is the intended behavior.
- `sdd-forge flow run gate`: uses guardrails internally — no behavior change since it only checks presence, not language.
- Project-level `.sdd-forge/guardrail.json`: continues to work as before (no path change).
- `sdd-forge setup` / `sdd-forge upgrade`: unaffected.

## Constraints

- Alpha policy: no backward-compatible code. Delete all `templates/en/guardrail.json` and `templates/ja/guardrail.json`.
- No new dependencies.
- Do not create language-specific directories.

## Test Strategy

Spec verification tests in `specs/154-guardrail-english-only/tests/`:
- `flow get guardrail draft` returns non-empty markdown with English titles
- No `templates/*/guardrail.json` files exist in `src/presets/`
- `flow run gate --phase draft` still passes (regression)

---

- [x] User approved this draft (autoApprove)
- Approved: 2026-04-07
