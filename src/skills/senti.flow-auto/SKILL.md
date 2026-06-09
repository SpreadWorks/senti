---
name: senti.flow-auto
description: Toggle autoApprove mode for the current Spec-Driven Development flow. Use "on" to enable (default) or "off" to disable.
---

# Spec-Driven Development Flow Auto

Toggle autoApprove mode for the current Spec-Driven Development flow.

**Usage:** `/senti.flow-auto [on|off]`
- No argument → treated as `on`
- `on` → enable autoApprove and continue the flow automatically
- `off` → disable autoApprove
- Any other argument → show error and stop

## Procedure

### If argument is `off`

1. Disable autoApprove.
   - Run `senti flow set auto off`.
   - If it fails (e.g. no active flow), display the error message and STOP.

2. Confirm.
   - Display: "autoApprove mode has been disabled. The AI will ask for confirmation at each step."

### If argument is `on` or no argument

1. Check flow state.
   - Run `senti flow get status`.
   - If `data.active` is `false` (or the command fails), display: "No active flow. Start a flow first with `/senti.flow`." and STOP.

2. Verify requirements exist.
   - Check the status response for `request` and `issue` fields.
   - If BOTH `request` is null AND `issue` is null, display: "No request or issue is set. Set one with `senti flow set request \"...\"` or `senti flow set issue <number>` before enabling auto mode." and STOP.

3. Enable autoApprove.
   - Run `senti flow set auto on`.
   - If it fails (`ok: false` or command error), display the error message and STOP.
   - All command failures in this procedure should display the error content and STOP (never swallow errors).

4. Resume the flow.
   - If all steps in the status response are `done` → display "All steps are already complete." and STOP.
   - Otherwise, invoke `/senti.flow` using the Skill tool. The consolidated flow skill inspects flow state and resumes from the correct step automatically.

### If argument is anything else

- Display: "Unknown argument: '<argument>'. Usage: /senti.flow-auto [on|off]" and STOP.
