# Code Review Results

### [ ] 変更差分の観点で、重複・命名・不要化の可能性を短く確認してから、提案を指定フォーマットでまとめます。まず `run-gate.js` 内と参照側で `warnGateRetryBudget` や新規ログ文言の重複有無を確認します。作業ディレクトリが `src/` を含まない場所だったため、まずこの worktree 内の実際のルート構成を確認して対象ファイルを特定します。### 1. Extract duplicated pre-check rejection logging
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `checkMissingHeadTestEvidence` と `checkNoProgressSinceLastFail` で、`process.stderr.write(...)` の「pre-check rejected ... retry budget not consumed」ログ構築が重複しています。文言変更時に差分がズレやすく、一貫性を壊しやすいです。  
**Suggestion:** `logGatePrecheckRejected(reasonCode)` のような小さなヘルパーを追加し、両関数から呼び出す形に統一してください。

**Verdict:** REJECTED
**Reason:** No verdict provided

### [ ] 2. Replace hard-coded reason/counter labels with constants
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `AI-FAIL` や `NO_HEAD_TEST_EVIDENCE` / `NO_PROGRESS_SINCE_LAST_FAIL` が文字列リテラルで散在し始めています。表記揺れ・タイプミスの温床になります。  
**Suggestion:** ファイル内定数（例: `const GATE_REASON = {...}`、`const RETRY_COUNTER_LABEL = "AI-FAIL"`）に集約し、ログとメッセージはその定数から組み立てる形にしてください。

**Verdict:** REJECTED
**Reason:** 現状の出現箇所は限定的で、主効果は見た目の整理に近いです。品質改善が小さい一方、定数化の仕方次第でログ文言・エラーコードの結合が不透明になり得るため、保守的には見送りが妥当です。

### [ ] 3. Revisit `warnGateRetryBudget` naming after behavior change
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `warnGateRetryBudget` は単なる警告より「利用状況レポート出力」に近い振る舞いになっており、`[AI-FAIL=...]` 追加後は特に責務が広く見えます。名前と責務のズレが読み手の理解コストになります。  
**Suggestion:** `reportGateRetryBudget` など、実際の振る舞いに沿った名前へ変更して意図を明確化してください（呼び出し側も同時に更新）。

**Verdict:** REJECTED
**Reason:** 実質は命名変更中心で、品質改善より変更コストと参照更新リスク（既存呼び出し・テスト影響）が先に立ちます。挙動安全性の観点でも優先度は低いです。

### [ ] 4. Keep exported API minimal (potential dead surface)
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `warnGateRetryBudget` が `export` 化されていますが、外部参照がなければ不要な公開 API になります。未使用 export は将来の互換維持コストを増やします。  
**Suggestion:** この関数を本当に他モジュールから使う必要があるか確認し、不要なら `export` を外して内部関数に戻してください。

**Verdict:** REJECTED
**Reason:** 少なくともテストから `warnGateRetryBudget` を直接参照しており、未使用と断定できません。`export` 削除は既存利用を壊す可能性があるため、保守的には不採用です。
