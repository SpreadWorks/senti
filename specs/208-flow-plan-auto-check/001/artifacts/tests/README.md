# 208 flow-plan-auto-check — tests

## What is tested
- Static gate matcher (G high-risk / H external contract / I contradiction keywords)
  — Japanese + English keyword detection, no-hit paths, composite eligible flag.
- `sdd-forge flow run auto-check` CLI
  — input routing, static-gate short-circuit, AI hard-gate, threshold logic,
    flow.json `autoCheck` persistence (both eligible:true and eligible:false).
- `sdd-forge flow set auto on` rejection path
  — eligible:false via AI low scores → non-zero exit + stderr + autoApprove stays false.
  — eligible:false via static gate hit → non-zero exit without AI call.
  — eligible:true path still updates autoApprove.

## Where tests live
- `tests/unit/flow/auto-check-static.test.js` — pure unit for the static matcher.
- `tests/unit/flow/run-auto-check.test.js` — CLI integration with stub agent.
- `tests/unit/flow/set-auto.test.js` — CLI integration for the rejection contract
  (previously an unconditional-enable test; updated per `authorized_test_modifications`).

All three live under `tests/unit/` because breakage indicates a bug in the
public CLI contract or the static matcher — never spec-local semantics.

## How to run
```
node --test tests/unit/flow/auto-check-static.test.js
node --test tests/unit/flow/run-auto-check.test.js
node --test tests/unit/flow/set-auto.test.js
# or the full suite
npm test
```

## Expected results
Before implementation: all three files fail (imports missing, CLI command
unregistered, set-auto still unconditional). After implementation: all pass
and no other test regresses.
