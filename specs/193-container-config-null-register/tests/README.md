# Tests for spec 193: container config null register

## What is tested and why

Issue #175 proposes that Container initialization register `null` for a
missing config (instead of `{}`), and that config-required command checks
be unified at the common dispatch layer. These tests lock in those two
contracts so future changes cannot silently regress them.

## Test locations (formal tests — run by `npm test`)

- `tests/unit/lib/container-init.test.js`
  - Covers R1: `container.get("config")` returns `null` when
    `.sdd-forge/config.json` is missing, and returns the loaded config
    object when it is present.
- `tests/unit/lib/dispatcher-requires-config.test.js`
  - Covers R2: dispatcher emits envelope
    `{ code: "NO_CONFIG", message: "config.json not found. Run sdd-forge setup first." }`
    with a non-zero exit code when the entry declares `requiresConfig: true`
    and config is `null`. The command body is not executed.
  - Covers R6: dispatcher runs normally when the entry does not declare
    `requiresConfig`, even if config is `null` (for `help`-like commands).
  - Covers the happy path: `requiresConfig: true` + valid config executes
    the command normally.

Placement rationale: these are public-contract tests — if a future change
breaks them, that is a bug regardless of which spec introduced it.

## How to run

```
node tests/run.js --scope unit
```

or the full suite:

```
npm test
```

Filter to just these files:

```
node tests/run.js --scope unit --filter container-init
node tests/run.js --scope unit --filter dispatcher-requires-config
```

## Expected results

- Before implementation: all new assertions FAIL.
  - container test: currently `container.get("config")` returns `{}` for
    missing config, not `null`.
  - dispatcher test: currently the dispatcher has no `requiresConfig` check.
- After implementation: all assertions PASS, and `npm test` as a whole
  continues to PASS (no regression).
