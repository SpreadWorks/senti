# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. PostWorktree command working directory is undefined
**Target:** R2/R3 / Data Flow
**Issue:** The spec passes { CWD: worktreePath } only as placeholder context, but does not state the cwd used to execute the shell command. Existing process helpers default to the current CLI process cwd when no cwd is supplied, so a configured command such as `npm install` or `git submodule update --init --recursive` could run in the original repository instead of the newly created worktree, contradicting the stated PostWorktree setup use case.
**Required change:** State the hook shell execution cwd, preferably that PostWorktree commands execute with cwd set to context.CWD/worktreePath when CWD is provided, or explicitly require hook commands to `cd {{CWD}}` themselves and test that contract.
**Why blocking:** Without this, implementation and tests cannot determine whether worktree setup commands run against the new worktree or the caller repository, which can install dependencies or initialize submodules in the wrong checkout while prepare still reports success.


## Non-blocking Improvements

### 1. Mention top-level routing/help files explicitly
**Target:** Overview / Modules
**Improvement:** Add `src/sdd-forge.js`, `src/help.js`, and the hook subtree in `src/lib/command-registry.js` to the module targets for the new `hook` namespace.
**Why non-blocking:** The scope and tests already imply CLI routing and help work, so implementation can infer these files from existing namespace patterns, but naming them would reduce lookup time.

### 2. Clarify unknown hook keys
**Target:** R1/R4
**Improvement:** Clarify whether `flow.hooks` may contain unknown hook names and, if so, whether `sdd-forge hook list` should display ignored configured keys or only known hook definitions.
**Why non-blocking:** The current requirements are implementable by listing PostWorktree only, but the behavior for typoed or future hook keys would be easier for users to understand if stated.
