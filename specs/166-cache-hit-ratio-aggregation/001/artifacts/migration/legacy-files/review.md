# Code Review Results

### [ ] 1. Centralize command metadata to remove string duplication
**File:** `src/help.js` (also impacts `src/locale/en/ui.json`, `src/locale/ja/ui.json`, `src/sdd-forge.js`)  
**Issue:** The new `"metrics token"` command name is now repeated across dispatcher registration, help layout, and two locale files. This pattern is already duplicated for other commands and will keep growing, increasing drift risk (missing help text, typo mismatch, untranslated key).  
**Suggestion:** Define a single command registry (id, namespace/independent type, section, i18n key/description key) and generate:
- namespace dispatch eligibility,
- help layout,
- locale lookup keys.  
This removes repetitive literals and keeps command behavior/docs in sync.

**Verdict:** REJECTED
**Reason:** 方向性は良いですが、`dispatch/help/i18n` を一気に統合する大規模リファクタで、設計変更の影響範囲が広すぎます。今回の差分規模に対しては挙動破壊リスク（キー解決ミス、表示漏れ、ルーティング不整合）が高く、保守改善の効果よりリスクが上回ります。

### [ ] 2. Align command naming with behavior scope
**File:** `src/locale/en/ui.json`  
**Issue:** The command key is `"metrics token"`, but the description says it aggregates token, cache, and cost metrics. The name implies token-only behavior, while actual scope is broader.  
**Suggestion:** Rename to a broader command such as `"metrics usage"` or `"metrics summary"` (and update references) so naming matches behavior and avoids future confusion.

**Verdict:** REJECTED
**Reason:** コマンド名変更は既存の呼び出しインターフェースを壊す可能性が高く、「既存挙動を壊さない」条件を満たしません。説明文の改善だけなら安全ですが、提案は実コマンド名変更を含むため却下が妥当です。

### [x] 3. Replace hard-coded namespace set with derived structure
**File:** `src/sdd-forge.js`  
**Issue:** `NAMESPACE_DISPATCHERS` is manually maintained (`"docs"`, `"flow"`, `"check"`, `"metrics"`). This is prone to omissions when adding/removing namespaces and duplicates responsibility already implied by the module map/comment.  
**Suggestion:** Build namespace dispatchers from a single source (e.g., module map object keys) and derive routing from that map. This simplifies maintenance and enforces consistent design across command namespaces.

**Verdict:** APPROVED
**Reason:** `NAMESPACE_DISPATCHERS` を単一の定義源から導出するのは重複責務を減らし、namespace追加時の漏れを防ぐ実質的改善です。導出元が現在の実ディスパッチ対象と一致する限り、挙動は維持できます。
