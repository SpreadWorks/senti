**MUST: When a fix, correction, or workaround is needed for a problem owned by the current active Flow Attempt, record it on that Attempt:**

```
sennel flow set issue-log --step <current-step> --reason "<what went wrong>" --trigger "<what triggered the issue>" --resolution "<how it was fixed>" --guardrail-candidate "<principle to prevent recurrence>"
```

- Before recording, verify that an active Attempt exists and that `--step`
  identifies its current active Step. An issue-log entry is canonical Attempt
  evidence, not a repository-wide scratch log.
- Record as soon as the fix is applied within that same Attempt. Never wait for
  a later Attempt and attach an earlier pre-Attempt or unrelated event to it.
- `--reason` and `--step` are required. `--trigger`, `--resolution`, `--guardrail-candidate` are optional but recommended.
- Minimum length (enforced by the CLI): `--reason` 20 chars (trimmed), optional fields 10 chars (trimmed). Shorter inputs are rejected with a non-zero exit code.
- This creates `issue-log.json` under the active Flow's configured spec directory. The file persists with the spec.

### Do not record

Leave the following in the runtime log only. Do not retry issue-log recording
after another Attempt starts:

- A command rejected before any active Attempt exists.
- A redundant or phase-invalid operation rejected by an immutability, target,
  or lifecycle guard when no correction or workaround was applied.
- A caller or skill procedure mistake that did not change canonical state and
  does not affect the current Attempt's work.

### When to record

Record in issue-log when any of the following occur:

- A test failure reveals a production code bug that is outside the current spec's scope (the bug exists independently of this spec's changes).
- A test is adjusted to match current (incorrect) behavior because the spec prohibits production code changes — the underlying bug must not be silently lost.
- A worktree finalization or deletion operation fails during an active Attempt.
- A merge conflict occurs during rebase or merge.
- A commit fails (including pre-commit hook failures).
- A workaround is applied instead of a proper fix (e.g., retrying a command with different flags, skipping a step due to an environment issue).
- A design assumption documented in the spec turns out to be wrong during implementation.
- A gate check fails and requires spec or code correction.

**Key principle:** If a problem owned by the current active Attempt is discovered but not fixed in this spec's scope, it MUST be recorded so it is not forgotten. A rejected pre-Attempt command is already preserved by the runtime log and must not be reassigned to a later Attempt. This is especially critical in auto mode where no human is watching.

### Examples

```bash
# Test revealed a production code bug outside spec scope
sennel flow set issue-log --step test \
  --reason "fixUnescapedQuotes mishandles nested quotes — test adjusted to match current behavior" \
  --trigger "unit test for edge case with nested single quotes inside double-quoted values" \
  --resolution "adjusted test expectation to match current (incorrect) behavior per spec constraint" \
  --guardrail-candidate "when a test reveals a pre-existing bug, always record it before adjusting the test"

# Worktree merge conflict
sennel flow set issue-log --step finalize \
  --reason "merge conflict in SKILL.md due to upstream changes during implementation" \
  --trigger "git merge development into feature branch" \
  --resolution "manually resolved conflict, kept both upstream and feature changes"
```
