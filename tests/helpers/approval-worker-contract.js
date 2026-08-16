/**
 * The approval worker instruction bytes that predate artifact views.
 *
 * Issue 514 adds a dispatcher-owned human review scene, but explicitly keeps
 * normal Flow agent input unchanged. Tests import this independent baseline so
 * they do not derive the expected worker contract from the code under test.
 */
export const APPROVAL_WORKER_INSTRUCTIONS = Object.freeze([
  "   - **Do NOT re-run gate.** The gate already passed in step 8.",
  "   - Run `sennel flow get prompt plan.approval <targetGuardArgs>`. This renders `spec.md` from the gate-passed `spec.json` for human reading.",
  "   - Present the FULL rendered `spec.md` from the active Flow's configured spec directory to the user.",
  "   - The user reads the gate-passed final spec and approves.",
  "   - Wait for approval before any implementation.",
  "   - Persist the approval to spec.json (do NOT hand-edit `## User Confirmation` — `spec render` regenerates that section from spec.json):",
  "     - Run `sennel flow set approval --approved [--notes \"<text>\"] <targetGuardArgs>`.",
  "     - This command re-renders `spec.md` from `spec.json` after persisting approval.",
  "   - **On complete**: Mark step done. Requirements already live in spec.json (the single source of truth) from the gate step — no manual transfer is needed.",
  "     - `sennel flow set step approval done <targetGuardArgs>`",
  "",
].join("\n"));
