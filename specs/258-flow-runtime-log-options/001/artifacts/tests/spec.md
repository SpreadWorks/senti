# Test Design

The spec-local verification uses `node:test` tests under this directory.

- R1/R3/R9: inspect `src/flow/registry.js` and dispatcher error handling to ensure `flow run` options are declared as value-taking options and missing values are surfaced as `ARGS_ERROR`.
- R2: call `resolveWorkDir` with `SDD_FORGE_WORK_DIR` set and assert it does not win over `config.agent.workDir` or `.tmp`.
- R4/R5/R6: inspect dispatcher/runtime logging code for default log path derivation, stdout envelope preservation, and human-readable diagnostic logging separated from the final JSON envelope.
- R7: inspect source templates for `--agent-work-dir` and `--log-file` guidance and reject old env-prefix or shell-redirection examples.
- R8: inspect permanent unit test files for coverage of the new runtime option contracts.
