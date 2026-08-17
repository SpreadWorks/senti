# Code Review Results

### [ ] 1. `choices` 定義の重複をヘルパー化する
**File:** `src/flow/get/prompt.js`  
**Issue:** `choices` 配列で `{ id, label, description: "", recommended: false }` のような同型オブジェクトが繰り返されており、記述量が多く、今後 `recommended` や既定値の扱いを変える際に修正箇所が散らばります。  
**Suggestion:** `createChoice(id, label, description = "", recommended = false)` のような小さなヘルパーを導入し、各 prompt では `createChoice(1, "承認する")` のように記述して重複を減らしてください。

**Verdict:** REJECTED
**Reason:** The repetition is trivial — `description: ""` and `recommended: false` are two short default fields per object literal. With ~30 total choices across the file, a `createChoice()` helper saves negligible characters while adding an indirection layer. The existing `@typedef Choice` already documents the shape. This is a cosmetic change with no meaningful quality improvement and slightly hurts readability (readers must jump to the helper to understand the data shape).

### [ ] 2. 表示文言と内部状態の責務を分離する
**File:** `src/flow/get/prompt.js`  
**Issue:** `impl.review-mode` の選択肢が `"コードレビューを行い改善を自動で行う"` のようにかなり具体的な文言になっており、`id` 以外に意味を持つ識別子がありません。今後この選択肢を他箇所で参照する必要が出ると、表示用ラベルにロジックが引きずられやすくなります。  
**Suggestion:** 各 choice に `value` もしくは `key` を追加して、`auto-fix-review` / `review-only` / `skip-review` のような内部識別子を持たせてください。表示文言は `label` に閉じ込め、分岐や状態管理は識別子ベースに統一すると命名と設計の一貫性が上がります。

**Verdict:** REJECTED
**Reason:** The numeric `id` already serves as the stable internal identifier — it is the only field used for branching in the consuming skill layer. Adding a parallel string key (`"auto-fix-review"`) creates redundant identification (both `id` and `key` would need to stay in sync). Furthermore, `prompt.js` is the **single source of truth** for these definitions, and no other `src/` code references these choices by label. The risk of introducing a naming inconsistency between `id` and `key`, or requiring consumers to migrate from `id` to `key`, outweighs the speculative benefit.

### [ ] 3. 説明文の有無を prompt 間で統一する
**File:** `src/flow/get/prompt.js`  
**Issue:** `finalize.mode` では各 choice に説明文が追加された一方、`impl.review-mode` と `impl.review-confirm` は空文字のままです。同じ「選択肢提示」パターンなのに情報量が揃っておらず、UI 上の一貫性も崩れています。  
**Suggestion:** 方針として「選択肢には常に説明文を付ける」か「説明文が不要なら省略可能にする」のどちらかに寄せてください。前者なら `impl.review-mode` / `impl.review-confirm` にも短い補足説明を追加し、後者なら空文字の `description` フィールド自体を省略できる形にしてデータを簡潔にしてください。

**Verdict:** REJECTED
**Reason:** The inconsistency is intentional and appropriate. `finalize.mode` choices ("すべて実行" / "個別に選択する") are ambiguous without descriptions — users need to know what "すべて" includes. In contrast, `impl.review-mode` labels ("コードレビューを行い改善を自動で行う" / "コードレビューのみ" / "しない") are already self-explanatory. Forcing descriptions on every choice adds noise without aiding comprehension. The `description` field exists as an optional enrichment, not a mandatory contract — the current usage reflects that correctly.
