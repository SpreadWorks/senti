# Draft Question Review Results

3 advisory finding(s) recorded. ADVISORY.

### 1. 1. Stale marker storage choice
**QA:** q3  
**Issue:** Clearly asks for internal implementation details that project patterns should decide  
**Suggestion:** Rephrase to ask only whether stale state must be user-visible/auditable, not where it is stored.

### 2. 2. Draft reason plumbing
**QA:** q4  
**Issue:** Clearly asks for internal implementation details that project patterns should decide  
**Suggestion:** Rephrase to ask whether draft must have access to the reopen reason when generating questions, without specifying issue-log vs prompt/context.

### 3. 3. Test case design
**QA:** q7  
**Issue:** Clearly asks for internal implementation details that project patterns should decide  
**Suggestion:** Rephrase to ask what reset matrix behavior must be guaranteed, not which exact tests or assertions to implement.

These findings are advisory for spec writing. The draft review step may proceed; gate-draft remains the blocking validation step.

## Auto Repair
One-pass draft.json repair was applied before proceeding.
