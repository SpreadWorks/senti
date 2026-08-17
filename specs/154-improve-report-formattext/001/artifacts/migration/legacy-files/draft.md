# Draft: Improve Report formatText() output

**Development Type:** Enhancement
**Goal:** Improve `formatText()` in `src/flow/commands/report.js` to remove meaningless sections, clarify labels, and ensure consistent section presence.

---

## Q&A

### 1. Goal & Scope

**Q:** Is the goal clear and scope bounded?
**A:** Yes. Scope is `formatText()` in `src/flow/commands/report.js` only. 4 concrete improvements are specified in the issue. No changes to data structure or other functions are needed.

**Priority order (all in the same single-function scope):**
1. **(P1) Remove Documents section** — eliminates always-skipped content; highest noise reduction
2. **(P2) Clarify Metrics labels** — fixes misleading labels; low risk, high clarity gain
3. **(P3) Issue Log summary display** — reduces clutter for multi-entry logs
4. **(P4) Always show Tests section** — guarantees section presence; smallest change

### 2. Impact on existing

**Q:** What existing features/code/tests are affected?
**A:**
- `formatText()` is only called from `generateReport()` in the same file (line 100). No other callers.
- The text output format changes, but `report.json` structure (`data` field) is unaffected.
- Existing spec test at `specs/122-auto-generate-spec-work-report-on-finalize/tests/report.test.js` tests `generateReport()` with outdated field names (`redolog`, `redo`, `Sync`). This test already fails against current code due to prior renames. It is a spec test (not in `tests/`), so not run by `npm test`. No formal tests test `formatText()` output directly.
- For change 4 (Tests always shown): `formatText()` currently guards on `if (data.tests)`. The `data.tests` value is derived in `generateReport()` — it's `null` when no test summary exists. We handle the null case in `formatText()` only, no changes to `generateReport()` needed.

### 3. Constraints

**Q:** Non-functional requirements, guardrails, project rules?
**A:**
- Alpha policy: no backwards compatibility needed.
- No external dependencies.
- `generateReport()` public interface (what it returns) must not change.
- `data` object structure used by callers (finalize, issue comment) must stay the same.

### 4. Edge cases

**Q:** Boundary conditions, error cases?
**A:**
- Issue Log with 0 entries: currently not shown (guarded by `if count > 0`). Keep this behavior.
- Tests with `data.tests === null`: show `- ` placeholder.
- Metrics all zeros: show `docs read 0  src read 0  Q&A 0  issue-log 0`.
- Issue Log with many entries: only reason shown, resolution omitted.

### 5. Test strategy

**Q:** What to test and how?
**A:** Unit tests for `formatText()` via `generateReport()` in `specs/154-improve-report-formattext/tests/`. Decision: these are spec-verification tests (verify this spec's 4 requirements). Future changes breaking these tests would only indicate that this spec's behavior was intentionally changed, not an unconditional bug — so `specs/` placement is appropriate, not `tests/`.

Test cases:
1. Documents section is absent from text output
2. Metrics line uses `docs read`, `src read`, `issue-log` labels
3. Issue Log shows only reason (no `->` resolution)
4. Tests section always appears, even when `data.tests` is null

### 6. Alternatives considered

**Q:** What other approaches were evaluated?
**A:**
- Documents section: Could show "n/a" instead of removing. Rejected — always-skipped content adds noise.
- Issue Log: Could add `--verbose` flag for full output. Rejected — `report.json` already provides full data; text output is for human scan.

### 7. Future extensibility

**Q:** How does this change affect future modifications?
**A:**
- If sync step is executed before report in future, Documents section can be re-added.
- Issue Log summary approach is consistent with `report.json` as the source of truth for details.

---

- [x] User approved this draft (autoApprove)
