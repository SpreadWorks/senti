# Feature Specification: 221-persist-user-approval

**Feature Branch**: `feature/221-persist-user-approval`
**Created**: 2026-04-23
**Status**: Draft
**Input**: GitHub Issue #244

## Goal
Persist SDD spec approval state in spec.json so that re-running `sdd-forge spec render` does not silently revert the user's approval marker on spec.md.

## Background
The `## User Confirmation` section in spec.md is currently authored by hand (`- [x] User approved this spec`, confirmation date, notes) but has no counterpart in spec.json. Because `spec render` regenerates spec.md from spec.json end-to-end, the hand-written approval state is overwritten on every render — observed during spec 220 work, where post-approval edits to spec.json forced manual re-entry of the approval mark each time. This erodes the auditability of when approval was granted and adds friction to legitimate post-approval spec edits. Issue #244 proposes a data-driven fix (Option A): add the approval state to spec.json and have the renderer drive the section from there.

## Scope
- Schema: add an optional `user_approval` object to spec.schema.json containing approval flag, ISO 8601 confirmation timestamp, and optional notes.
- Renderer: when rendering spec.md, derive the `## User Confirmation` section content from `spec.user_approval`. When the field is unset or `approved` is false, output the existing unapproved placeholder so that the gate's section-presence check continues to pass.
- Approval CLI: add a flow set sub-command that records approval state into the active flow's spec.json, defaulting the confirmation timestamp to the moment of invocation, and accepts an optional notes string.
- Skill / prompt update: rewrite the plan-level approval step instructions so that approval no longer asks the operator to hand-edit spec.md; it instead invokes the new approval CLI and lets `spec render` produce the section.
- i18n: keep the user-visible approval instruction text aligned with the new flow in both supported locales.
- Skeleton instruction: update the prepare-spec skeleton's reference to the post-approval action so it no longer instructs operators to edit spec.md by hand.

## Out of Scope
- Per-task spec approval (task spec files are authored manually and not regenerated, so the bug does not apply).
- Migration of historical spec.json files (alpha policy: no backwards-compat shims; pre-existing specs surface as unapproved on first re-render).
- Option B (preserve existing spec.md `## User Confirmation` section by parsing): rejected in favor of Option A.
- Withdraw / unapprove operation (deferred until a concrete need arises).

## Constraints
- alpha policy: no backwards-compatibility code for the legacy hand-edit pattern.
- No external dependencies — Node.js built-ins only.
- Renderer remains pure and deterministic (no side effects, no timestamp generation inside `renderSpecMarkdown`).
- The `## User Confirmation` section must always appear in rendered spec.md so that `flow run gate`'s section-presence check continues to pass.

## Design Principles
- Data-driven SDD artifacts: approval state lives in spec.json (the source of truth), not in a hand-edited section of a derivative artifact.
- Renderer determinism: timestamps and writes belong to the CLI mutation path, not to render.
- Single mutation entry point for approval: only the new approval CLI writes user_approval into spec.json.
- Optional schema field with safe default: unset = unapproved, so new specs and historical specs both render cleanly.

## Overview
### Modules
- spec.schema.json — declare optional `user_approval` object (approved, confirmed_at, notes).
- src/spec/commands/render.js — read `spec.user_approval` and emit the User Confirmation section accordingly.
- src/flow/set/approval.js (new) — flow set sub-command that updates active spec.json's user_approval.
- src/flow/registry.js — register the new approval set sub-command.
- src/flow/prompts/plan/approval.md — rewrite operator instructions to invoke the approval CLI.
- src/flow/lib/run-prepare-spec.js — update skeleton instruction text for the post-approval action.
- src/locale/en/messages.json, src/locale/ja/messages.json — update approvalInstruction text.

### Data Flow
- User approves spec → operator runs `sdd-forge flow set approval --approved [--notes ...] [--confirmed-at ...]` → CLI loads active flow → reads spec.json → mutates `user_approval` → writes spec.json → re-runs `spec render` → spec.md `## User Confirmation` reflects approval.
- User edits spec.json post-approval → re-runs `spec render` → renderer reads `spec.user_approval` → emits the same approved section without any manual re-entry.

### Decisions
- Option A (data-driven persistence in spec.json) over Option B (parse-and-preserve spec.md section): A aligns with the spec-as-data principle, removes parsing risk, and is the issue's recommended option.
- `user_approval` is optional in the schema so newly created specs (which exist before approval) pass schema validation.
- Default confirmation timestamp = invocation time (ISO 8601) when operator omits it; explicit override via flag remains available.
- Renderer remains pure — timestamps are produced by the approval CLI, never by the renderer.

## Clarifications (Q&A)
- Q: Why Option A (data-driven) instead of Option B (preserve spec.md section by parsing)?
  - A: A is the recommended option in issue #244, aligns with the spec-as-data design principle established in spec 220, removes parsing fragility, and lets approval data participate in audit/inspection alongside the rest of spec.json.
- Q: Why is `user_approval` optional in the schema?
  - A: Specs exist before approval; making it required would block schema validation for newly created specs and force every operator action to write the field even when irrelevant.
- Q: What format is `confirmed_at`?
  - A: ISO 8601 string. The approval CLI defaults it to `new Date().toISOString()` at invocation time when the operator does not pass `--confirmed-at`.
- Q: Should there be an `unapprove` / withdraw operation?
  - A: Out of scope for this bugfix. Alpha policy: add only when a concrete need is identified. Operators can still edit spec.json directly if a corner case demands it.

## Alternatives Considered
- Option B — parse existing `## User Confirmation` section from spec.md and preserve it during render. — Rejected. Adds parser complexity, depends on spec.md formatting stability, and contradicts the spec-as-data principle. Issue #244 also recommends Option A.
- Make `user_approval` a required schema field. — Rejected. Would block schema validation for newly created specs that exist before approval, and would force every spec edit to write a possibly-meaningless approval block.
- Generate `confirmed_at` inside `renderSpecMarkdown` when missing. — Rejected. Renderer must remain pure/deterministic. Timestamp generation belongs to the mutation path (the approval CLI).

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-23T10:25:57.582Z
- Notes: spec 221 self-test: data-driven approval

## Requirements
- R1 [must]: When `sdd-forge spec render` runs, the renderer shall derive the `## User Confirmation` section from `spec.user_approval` in spec.json instead of preserving any prior hand-edited content on spec.md.
- R2 [must]: If `spec.user_approval` is absent or `approved` is false, the renderer shall emit the unapproved placeholder (`- [ ] User approved this spec`, empty `Confirmed at:`, empty `Notes:`) so that subsequent renders remain idempotent and the gate's section-presence check passes.
- R3 [must]: If `spec.user_approval.approved` is true, the renderer shall emit a checked marker (`- [x] User approved this spec`), the `Confirmed at:` line populated from `confirmed_at`, and a `Notes:` line populated from `notes` (empty string when notes is unset).
- R4 [must]: When the schema is loaded for spec validation (e.g., during `spec render` or schema-validated tooling), the schema shall accept an optional `user_approval` object whose properties are `approved` (boolean), `confirmed_at` (string), and `notes` (string), and shall reject any spec.json that contains unknown sub-properties under `user_approval` (additionalProperties: false).
- R5 [must]: When the operator runs `sdd-forge flow set approval --approved`, the CLI shall locate the active flow's spec.json, set `user_approval.approved` to true, set `confirmed_at` to either the value of `--confirmed-at` (when provided) or the current time as ISO 8601, set `notes` to the value of `--notes` (when provided), and write the file back. The command shall fail with a non-zero exit code when no active flow is present.
- R6 [should]: When an operator reads the plan-level approval step's operator instructions (skill prompt, prepare-spec skeleton text, locale `approvalInstruction` messages), the instructions shall direct them to invoke `flow set approval` rather than to hand-edit spec.md, so that future contributors do not re-introduce the manual edit pattern.
- R7 [should]: When the operator invokes `sdd-forge flow set approval` without `--approved`, the CLI shall print a usage error and exit non-zero rather than silently inferring or defaulting an approval state.

## Acceptance Criteria
- Given a spec.json with `user_approval.approved = true` and a confirmed_at timestamp, when `sdd-forge spec render` runs, the resulting spec.md `## User Confirmation` section contains `- [x] User approved this spec` and the timestamp.
- Given a spec.json with no `user_approval` field, when `sdd-forge spec render` runs, the resulting spec.md `## User Confirmation` section contains `- [ ] User approved this spec` and empty `Confirmed at:` / `Notes:` lines.
- Given a spec.json with `user_approval.approved = true`, after running `sdd-forge spec render` twice in a row, the rendered `## User Confirmation` section is byte-identical between runs (no drift, no re-entry needed).
- Given an active flow whose spec.json has no `user_approval` set, when the operator runs `sdd-forge flow set approval --approved --notes "reviewed"`, spec.json is updated with `user_approval.approved = true`, an ISO 8601 `confirmed_at`, and `notes = "reviewed"`.
- Given a spec.json that contains a `user_approval` field with an unknown sub-property, schema validation in `sdd-forge spec render` rejects the spec.
- Given no active flow, when the operator runs `sdd-forge flow set approval --approved`, the command exits non-zero with an error message and does not modify any file.
- Given a spec where `flow set approval` has been invoked, the existing `flow run gate` continues to pass with respect to the `## User Confirmation` section presence check.

## Implementation Targets
- src/flow/schemas/spec.schema.json
- src/spec/commands/render.js
- src/flow/lib/set-approval.js
- src/flow/registry.js
- src/flow/prompts/plan/approval.md
- src/flow/lib/run-prepare-spec.js
- src/locale/en/messages.json
- src/locale/ja/messages.json

## Authorized Existing Test Modifications
- **tests/unit/spec/schema.test.js** — This test enumerates the agreed top-level keys of spec.schema.json. Adding the new optional `user_approval` field (R4) requires extending the enumerated list and the test description. The test is updated to reflect the new agreed schema, not to hide a bug.

## Open Questions
- [ ]
