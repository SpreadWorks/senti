# Code Review Results

### [ ] 1. Make severity non-localized and centralized
**File:** `src/locale/en/messages.json`, `src/locale/ja/messages.json`  
**Issue:** `WARN:` / `ERROR:` is embedded directly in localized message text. This duplicates severity formatting across locales and mixes presentation with message content.  
**Suggestion:** Keep locale strings as pure message bodies (without `WARN:`), and prepend severity in the logger/output layer from a shared formatter.

**Verdict:** REJECTED
**Reason:** Conceptually cleaner, but high regression risk: this changes message contracts across all locales and requires logger-wide coordination (including existing strings like `[init] WARN:`). Without a full audit, it can easily cause double/missing prefixes and output/test breakage.

### [ ] 2. Rename key to match new behavior
**File:** `src/locale/en/messages.json`, `src/locale/ja/messages.json`  
**Issue:** `init.conflictsExist` was previously error-like, but now represents a warning. The key name does not clearly communicate whether it is blocking or informational.  
**Suggestion:** Rename to a neutral, behavior-aligned key such as `conflictsDetected` (or `conflictsWarning`) and update call sites for clarity and consistency.

**Verdict:** REJECTED
**Reason:** Mostly naming/cosmetic value versus migration risk. Renaming i18n keys can break call sites or fallback behavior if any reference is missed, with little functional gain over keeping `conflictsExist` and clarifying message text.

### [x] 3. Recheck `useForce` message necessity after severity downgrade
**File:** `src/locale/en/messages.json`, `src/locale/ja/messages.json`  
**Issue:** After changing conflict output from `ERROR` to `WARN`, the follow-up `useForce` guidance may be redundant or misleading depending on actual runtime behavior.  
**Suggestion:** Ensure `useForce` is only shown when overwrite is truly required/available; otherwise remove or rewrite it to describe the current non-fatal flow.

**Verdict:** APPROVED
**Reason:** This targets behavioral correctness, not cosmetics. After downgrading conflict to warning, guidance should match actual flow; showing `useForce` only when truly applicable reduces misleading output without changing core logic.
