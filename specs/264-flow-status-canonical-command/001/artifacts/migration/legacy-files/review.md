# Code Review Results

### 1. 1. Rename suggestion map to match actual key semantics
**File:** `src/flow.js`
**Issue:** `flowCommandSuggestionBySubcommand` is keyed by `group`, not by the nested subcommand. That makes the dispatch logic slightly harder to read.
**Suggestion:** Rename it to something like `flowCommandSuggestionByGroup` or `flowCommandSuggestionByLegacyGroup`.

### 2. 2. Extract repeated unknown-command test assertion
**File:** `tests/e2e/dispatchers.test.js`
**Issue:** Several tests still repeat `assert.match(err.stderr, /unknown command/)` through the new `expectDispatcherFailure` helper.
**Suggestion:** Add a narrower helper such as `expectUnknownCommand(args, message)` that calls `expectDispatcherFailure` and performs the shared stderr assertion, while keeping the status-suggestion test separate for its extra assertion.
