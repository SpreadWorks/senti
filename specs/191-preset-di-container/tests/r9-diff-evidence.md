# R9 docs build pre/post diff verification

Test command: sdd-forge docs scan on src/presets/cakephp2/tests/acceptance/fixtures/

Baseline (main @ 0570cd7): /tmp/sdd-baseline
Feature (this branch):    current worktree

## Diff result
Total differing lines: 156

Every differing line is one of:
"analyzedAt":
"id":
"mtime":

These fields are timestamp/hash artifacts of the scan invocation itself
(analyzedAt = scan time, mtime = file mtime from checkout, id/hash = derived).

No behavioral diff detected in scan output: every analysis.json entry's
content (className, relations, methods, routes, actions, config keys,
components, auth, layouts, elements, helpers, etc.) is byte-identical.
