# Spec Review Results

## Proposals

### 1. コード変更はせず、spec の抜けを確認します。まず `docs/` と `src/` の更新状況、それから maxAttempts 周辺の実コードとテンプレート参照を絞って読みます。初回の検索は対象ディレクトリの一部が存在しない扱いで空になったので、作業ツリーの実体と関連ファイルを確認し直します。この `.tmp` にはソース本体がなく、レビュー用ログだけがあります。ワークツリー境界を越えない前提で、まず残っている review/gate ログから既知の指摘と関連ファイル名を拾います。ログだけでは十分に判定できないため、`.tmp` の親にある実ワークツリー内のソースを読みます。読み取りのみで、変更はしません。`src/` の更新時刻が `docs/` より新しい可能性があります。レビュー結果にはその点も前提として扱い、実コードを正として maxAttempts の全参照を追います。実コード上は `definition.js` の `maxAttempts` が直接値として複数経路に露出しています。次に、派生関数、スキーマ、prompt/skill の契約漏れがないかを絞ります。### 1. Stored Value Shape Contradiction
**File:** `src/flow/definition.js`  
**Issue:** The spec says maxAttempts should be represented as a constructor-enforced value, but Data Flow says the definition stores either a scalar or raw mode-specific object. That conflicts with the project rule against meaningful raw object shapes.  
**Suggestion:** Clarify that scalar/plain-object inputs are accepted at construction, then normalized into a dedicated maxAttempts value class with a numeric resolver.

### 2. 2. Task Review Retry Limit Is Implicit
**File:** `src/flow/definition.js`  
**Issue:** Task review currently has no explicit `maxAttempts`, so its existing scalar limit is the constructor default. The spec says task review stays scalar but does not state the resolved number.  
**Suggestion:** Add the exact task review value to the spec, likely “task review remains scalar 1 unless intentionally changed,” and require a test for it.

### 3. 3. Draft/Spec Review Command Retry Gap
**File:** `src/flow/commands/review.js`  
**Issue:** R16 says draft/spec/test review command retry resolution uses `flow.autoApprove`, but only the test review path currently uses `getReviewMaxAttempts()` and `runReviewLoop()`. Draft/spec review retries are dispatcher/prompt-driven.  
**Suggestion:** Split the requirement: test review command resolves internally, while draft/spec retry enforcement is handled by the dispatcher, or explicitly require draft/spec command paths to expose/enforce attempt state.

### 4. 4. Attempt Counting Semantics Are Ambiguous
**File:** `src/flow/commands/review.js`  
**Issue:** `runReviewLoop()` runs up to `maxRetries` iterations, then may run an extra verification detect. The spec does not define whether that extra detect counts against `maxAttempts`.  
**Suggestion:** Define whether `maxAttempts` limits verdict-producing detects, fix cycles, or total AI review calls, and add focused tests for review-test attempt counts.

### 5. 5. Non-Review Prompt Wording Still References Raw Definitions
**File:** `src/flow/prompts/impl/implement.md`  
**Issue:** The spec aligns review prompts, but other step prompts still say retry limits are bounded by “the definition’s maxAttempts,” including implementation and gate prompts. That undercuts the resolved next-action contract.  
**Suggestion:** Expand the wording requirement to every prompt that mentions maxAttempts/retry limits, or explicitly keep non-review prompt wording out of scope.
