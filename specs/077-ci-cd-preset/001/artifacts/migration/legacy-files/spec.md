# Feature Specification: 077-ci-cd-preset

**Feature Branch**: `feature/077-ci-cd-preset`
**Created**: 2026-03-20
**Status**: Draft
**Input**: I4 from build-issues-2026-03-19.md — CI/CD configurations (.github/workflows/) are not reflected in documentation

## Goal

Create a new `ci` preset that scans GitHub Actions workflow files and generates structured CI/CD documentation as a `ci_cd.md` chapter.

## Scope

- New preset `src/presets/ci/` with `base` as parent
- DataSource `pipelines` with scan + resolve methods (`list`, `jobs`, `env`)
- Simple YAML parser for GitHub Actions workflow files (regex + indent-based, no external deps)
- Chapter template `ci_cd.md` (en + ja)
- Platform-agnostic data structure for future CI platform expansion

## Out of Scope

- GitLab CI, CircleCI, Jenkins support (future expansion)
- Docker Compose / Makefile (not CI/CD scope)
- Batch processing logic documentation (belongs in framework presets)
- YAML anchors/aliases, full matrix expansion, reusable workflow recursion
- Build/deploy tool integration (Makefile, Docker)

## Clarifications (Q&A)

- Q: Should Makefile and Docker Compose be in CI/CD scope?
  - A: No. They are build/dev environment tools, not CI/CD.
- Q: Should we support all CI platforms initially?
  - A: No. GitHub Actions only, expand later based on demand.
- Q: Should CI be a preset or a base chapter?
  - A: Preset. The `type` array declaration signals CI/CD usage. Cross-cutting but opt-in.
- Q: Where does batch processing triggered by GitHub Actions belong?
  - A: Framework presets (e.g. Symfony batch_and_shell). CI preset documents pipeline structure, not execution logic.
- Q: Should naming be platform-specific?
  - A: No. Use generic terms: `pipelines`, `runner`, `dependencies` to support future platforms.

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-20
- Notes: Approved after draft Q&A

## Requirements

1. Create `src/presets/ci/preset.json` with parent `base`, chapter `ci_cd.md`
2. Create `src/presets/ci/scan/workflows.js` — regex-based GitHub Actions YAML parser
   - Extract: workflow name, triggers (`on:`), jobs (id, runs-on, steps count, uses), secrets/env refs
   - Output `pipelines` category in analysis.json
3. Create `src/presets/ci/data/pipelines.js` — Scannable DataSource
   - `list(analysis, labels)`: pipeline summary table (Name, File, Triggers, Jobs count)
   - `jobs(analysis, labels)`: job detail table (Pipeline, Job, Runner, Steps, Dependencies)
   - `env(analysis, labels)`: secrets & env vars table (Pipeline, Secrets, Env Vars)
4. Create chapter templates `src/presets/ci/templates/{en,ja}/ci_cd.md`
   - `{{text}}` for Description section only
   - `{{data: pipelines.list/jobs/env}}` for structured data
5. Data structure uses platform-agnostic naming:
   - `workflows` → `pipelines`
   - `runs-on` → `runner`
   - `uses` → `dependencies`
   - Include `platform` field ("github-actions")

## Acceptance Criteria

- `sdd-forge scan` with `type: "ci"` produces `pipelines` category in analysis.json
- `sdd-forge data` resolves `pipelines.list`, `pipelines.jobs`, `pipelines.env` directives
- `sdd-forge init` generates `ci_cd.md` from template
- Parser correctly handles: simple triggers, matrix triggers, multiple jobs, secret/env references
- No external dependencies used in YAML parsing
- Tests cover the YAML parser with representative GitHub Actions workflow files

## Open Questions

(none)
