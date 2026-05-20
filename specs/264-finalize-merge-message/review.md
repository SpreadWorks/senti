# Code Review Results

### 1. 1. Drop Redundant Subject Re-Parsing
**File:** `src/flow/commands/merge.js`  
**Issue:** `collectImplementationSubjects()` already trims, filters blank lines, and returns git `%s` subjects, but `buildSquashCommitMessage()` loops through them and calls `firstNonEmptySubjectLine()` again. This adds extra parsing for data that is already normalized.  
**Suggestion:** Either make `collectImplementationSubjects()` the single normalization point and use `implementationSubjects.find(Boolean)`, or rename the input to reflect that arbitrary text is accepted. Prefer the former for simpler ownership of behavior.

### 2. 2. Make Limit Sanitization a Small Helper
**File:** `src/flow/commands/merge.js`  
**Issue:** `collectImplementationSubjects()` contains several inline steps for parsing, clamping, truncating, and defaulting `limit`. That logic is correct but noisy relative to the main purpose of the function.  
**Suggestion:** Extract a small helper such as `boundedImplementationSubjectLimit(limit)` so `collectImplementationSubjects()` reads as: resolve limit, guard inputs, run git, normalize output.

### 3. 3. Clarify Ignored Subject Naming
**File:** `src/flow/commands/merge.js`  
**Issue:** `SQUASH_MESSAGE_IGNORED_SUBJECTS` sounds like complete squash messages are ignored, but the set only contains commit subject lines used while deriving the squash commit subject.  
**Suggestion:** Rename it to something narrower, for example `IGNORED_IMPLEMENTATION_COMMIT_SUBJECTS`, and rename `isIgnoredSquashMessageSubject()` accordingly. This better matches its actual role.
