# Spec Verification Tests: 160-check-freshness

These tests verify that the `sdd-forge check freshness` command satisfies the requirements in `specs/160-check-freshness/spec.md`.

## Location

`specs/160-check-freshness/tests/` — spec-scoped tests. **Not run by `npm test`.**

## How to Run

```bash
# From the repository root
node --test specs/160-check-freshness/tests/freshness.test.js
```

## What is Tested

| Requirement | Test |
|---|---|
| Req 1: `never-built` → exit 1 | exits 1 when docs/ does not exist |
| Req 1: `never-built` in text output | outputs "never-built" in text mode |
| Req 1: `never-built` in JSON output | JSON `result === "never-built"` and `ok === false` |
| Req 2: `stale` → exit 1 | exits 1 when src is newer than docs |
| Req 2: `stale` in text output | outputs "stale" in text mode |
| Req 4: JSON output for `stale` | JSON has `srcNewest`, `docsNewest` timestamps |
| Req 3: `fresh` → exit 0 | exits 0 when docs is newer than src |
| Req 3: `fresh` in text output | outputs "fresh" in text mode |
| Req 3: equal mtime → `fresh` | exits 0 when src and docs have equal mtime |
| Req 4: JSON output for `fresh` | JSON `result === "fresh"` and `ok === true` |
| Acceptance: `--help` | prints usage and exits 0 |

## Expected Results

- Before implementation: all tests **fail** (command not found / unknown subcommand)
- After implementation: all tests **pass**
