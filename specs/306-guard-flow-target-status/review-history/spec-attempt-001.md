# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Expected Issue has no CLI integration point
**Target:** R1, R4, T-1
**Issue:** The spec requires a CLI-side ACTIVE_FLOW_MISMATCH error for an Issue-specified flow entry, but the existing continuation commands that must be blocked (`senti flow get next-action`, `senti flow run ...`, `finalize-cleanup`) do not accept the requested Issue, and the requested Issue currently exists only in the skill-level user input parsing path. `senti flow get status` only returns the active state's issue; it has no expected-issue input to validate against.
**Required change:** Specify the exact integration point that receives the requested Issue and emits ACTIVE_FLOW_MISMATCH, such as a new explicit expected-Issue argument/check command or a required skill-level guard in `src/skills/senti.flow/SKILL.md` before entering the dispatcher loop.
**Why blocking:** Without a defined place to pass and compare the requested Issue, implementation cannot produce a machine-readable CLI mismatch error or write tests proving that next-action, flow run, and finalize-cleanup were not invoked for the wrong active flow.

### 2. RunId status guidance conflicts with preparing autoApprove status
**Target:** R2, R5, core-principle guidance
**Issue:** The spec says that once a runId is known, autoApprove checks should read `senti flow get status <runId>`. Existing code intentionally reports `autoApprove: false` for preparing states in `src/flow/lib/get-status.js`, while `src/flow/lib/set-auto.js` can set `autoApprove: true` on a preparing flow so `flow prepare` inherits it. A runId is known during prelude while the flow is still preparing, so the proposed guidance can read false from the target status even after auto mode has been enabled.
**Required change:** State whether runId-targeted status must expose preparing-flow `autoApprove`, or limit the runId-aware autoApprove check to active flow states and require prelude to use the set-auto result/preparing state semantics instead.
**Why blocking:** If left unspecified, an implementation can either preserve the current preparing-status behavior and break the new guidance, or change preparing status output and risk altering existing prelude auto-mode behavior without a clear acceptance basis.


## Non-blocking Improvements

### 1. Mention main flow skill placement
**Target:** Overview Modules / T-2
**Improvement:** Add `src/skills/senti.flow/SKILL.md` as a related implementation target because the active-flow entry branch and Issue parsing rules live there, while `core-principle.md` only supplies shared autoApprove/status guidance.
**Why non-blocking:** The correction is mostly navigational; once the mismatch integration point is specified, implementers can still discover the main skill file from the existing codebase.
