# Draft Review Results

7 issue(s) detected.

### 1. 1. Unsupported Cost Claim
**QA:** Q3  
**Issue:** “requirement あたりの diff は平均 1-4KB” and “全体 diff の 2-5%” are strong quantitative claims, but no evidence from issue data, repo logs, or measurement is provided.  
**Suggestion:** Either cite actual measured examples from Issue #303 / local specs, or rewrite as a design assumption: “削減効果は file-map の精度に依存するため、テストでは複数 requirement に diff が分配されることを確認する。”

### 2. 2. Missing Prompt Contract Coverage
**QA:** NEW  
**Issue:** The entries do not ask how the per-requirement AI prompt changes. Token reduction depends not only on diff splitting, but also on whether each call receives only one requirement or the full requirements list.  
**Suggestion:** Add QA for prompt shape: “AI 呼び出しには対象 requirement 1件とその関連 diff のみを渡す。出力は既存の reqEvaluations に集約できる最小 JSON にする。”

### 3. 3. Missing Path Matching Semantics
**QA:** NEW  
**Issue:** file-map paths and git diff paths may differ by root-relative format, deleted files, renamed files, untracked files, or path normalization. None of the QA entries define how mapped files are matched to diff entries.  
**Suggestion:** Add QA covering normalization and matching: “file-map と diff のパスは repo root 相対に正規化し、rename/delete/untracked も per-file diff として扱う。マッチしない diff は未マッピング扱いにする。”

### 4. 4. Q7 May Defeat Token Reduction
**QA:** Q7  
**Issue:** “未マッピングファイルを全 requirement に含める” is safe, but it can recreate the current full-diff behavior if many files are unmapped. The answer assumes “通常少量” without evidence.  
**Suggestion:** Clarify tradeoff and add mitigation, e.g. include unmapped diffs in every call only as fallback for correctness, but surface a warning/count so users can improve `file-map.json`; add tests for large unmapped diff behavior if relevant.

### 5. 5. Partial Fallback Interaction Is Ambiguous
**QA:** Q6 / Q7  
**Issue:** Q6 says missing requirement mappings get full diff, while Q7 says unmapped files are included in all requirement calls. The combined behavior is unclear for a requirement that has mapped files plus there are unmapped files.  
**Suggestion:** Define exact merge rule per requirement: `mapped diff for req + unmapped diff`; if the requirement has no mapping key, use full diff. State this explicitly in Q6 or Q7.

### 6. 6. Missing Zero-Diff Behavior
**QA:** NEW  
**Issue:** There is no QA entry for a mapped requirement whose mapped files have no diff. Should the gate skip, call AI with empty diff, or fail because implemented status has no evidence?  
**Suggestion:** Add QA: “関連 diff が空の requirement はどう扱うか”。Answer should match current gate semantics, e.g. call with an explicit empty diff so AI can return skip/no-evidence, or preserve existing evaluation behavior.

### 7. 7. Test Strategy Is Too High-Level
**QA:** Q8  
**Issue:** “既存テスト更新 + ユニットテスト追加” is too generic to drive implementation. It does not identify the critical cases introduced by per-requirement splitting.  
**Suggestion:** List concrete cases: complete file-map, missing file-map, partial file-map, unmapped changed files, deleted/renamed/untracked files, aggregation of mixed pass/fail results, and guardrail still receiving full diff.
