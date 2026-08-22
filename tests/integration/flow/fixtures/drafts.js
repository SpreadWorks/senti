/**
 * Shared draft fixtures for flow run draft-task tests.
 *
 * PASS_DRAFT is a task-spec-compatible draft that passes checkSpecText
 * (all required sections + approved confirmation). Tests that need the stub
 * agent to produce a gate-passing draft import this constant.
 *
 * Keep this string minimal but complete. If the spec gate's required section
 * set changes, update here — both consumer tests will stay in sync.
 */

/**
 * Raw string (with real newlines). Use this when writing the draft directly
 * to disk or passing to APIs that accept plain strings.
 */
export const PASS_DRAFT =
  "# Spec: stub\n" +
  "\n" +
  "## Goal\nstub goal.\n" +
  "\n" +
  "## Scope\nstub.\n" +
  "\n" +
  "## Requirements\nWhen x, the system shall y.\n" +
  "\n" +
  "## Acceptance Criteria\n- ok.\n" +
  "\n" +
  "## Clarifications\n- Q: x\n  - A: y\n" +
  "\n" +
  "## Open Questions\n(none)\n" +
  "\n" +
  "## User Confirmation\n- [x] User approved this spec\n" +
  "\n" +
  "## Test Strategy\nunit tests.\n";

/**
 * Escaped form for embedding inside stub scripts that are written to disk as
 * JS source and invoked via `node <stub>.mjs`. Newlines become `\\n` so the
 * stub-source JSON.stringify call produces a valid single-line literal.
 */
export const PASS_DRAFT_ESCAPED = PASS_DRAFT.replace(/\n/g, "\\n");
