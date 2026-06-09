**MUST: When a fix, correction, or workaround is needed (e.g., a command fails, a gate check reveals an issue, a test reveals a bug, a design assumption turns out wrong), record it immediately:**

```
senti flow set issue-log --step <current-step> --reason "<what went wrong>" --trigger "<what triggered the issue>" --resolution "<how it was fixed>" --guardrail-candidate "<principle to prevent recurrence>"
```

- Do not defer recording — record as soon as the fix is applied.
- `--reason` and `--step` are required. `--trigger`, `--resolution`, `--guardrail-candidate` are optional but recommended.
- Minimum length (enforced by the CLI): `--reason` 20 chars (trimmed), optional fields 10 chars (trimmed). Shorter inputs are rejected with a non-zero exit code.
- This creates `specs/<spec>/issue-log.json`. The file persists with the spec.

### When to record

Record in issue-log when any of the following occur:

- A test failure reveals a production code bug that is outside the current spec's scope (the bug exists independently of this spec's changes).
- A test is adjusted to match current (incorrect) behavior because the spec prohibits production code changes — the underlying bug must not be silently lost.
- A worktree creation or deletion operation fails (e.g., path conflict, branch already exists).
- A merge conflict occurs during rebase or merge.
- A commit fails (including pre-commit hook failures).
- A workaround is applied instead of a proper fix (e.g., retrying a command with different flags, skipping a step due to an environment issue).
- A design assumption documented in the spec turns out to be wrong during implementation.
- A gate check fails and requires spec or code correction.

**Key principle:** If a problem is discovered but not fixed in this spec's scope, it MUST be recorded so it is not forgotten. This is especially critical in auto mode where no human is watching.

### Examples

```bash
# Test revealed a production code bug outside spec scope
senti flow set issue-log --step test \
  --reason "fixUnescapedQuotes mishandles nested quotes — test adjusted to match current behavior" \
  --trigger "unit test for edge case with nested single quotes inside double-quoted values" \
  --resolution "adjusted test expectation to match current (incorrect) behavior per spec constraint" \
  --guardrail-candidate "when a test reveals a pre-existing bug, always record it before adjusting the test"

# Worktree merge conflict
senti flow set issue-log --step finalize \
  --reason "merge conflict in SKILL.md due to upstream changes during implementation" \
  --trigger "git merge development into feature branch" \
  --resolution "manually resolved conflict, kept both upstream and feature changes"
```
