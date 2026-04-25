# Code Review Results

### [x] 1. Extract duplicated gate-context setup
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `gitState`/`issueLog` の組み立てと `ctx: { ...ctx, issueLog, gitState }` の注入が draft/spec の両分岐で重複しています。将来の変更で片方だけ更新されるリスクがあります。  
**Suggestion:** `buildGateContext(ctx, root, specRef)` のようなヘルパーに抽出して、`gitState` 計算・issue log 読み込み・拡張済み `ctx` 生成を一箇所に集約してください。

**Verdict:** APPROVED
**Reason:** 重複除去で将来の片側修正漏れリスクを下げられます。`specRef` を明示引数で渡して現在の分岐差分（`state?.spec` vs `ctx.flowState?.spec`）を維持すれば、挙動変更リスクは低いです。

### [x] 2. Remove unused parameter in flip override
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `applyFlipOverride({ ..., phase })` で `phase` が未使用です。未使用引数は意図を曖昧にし、保守時のノイズになります。  
**Suggestion:** `phase` を関数シグネチャと呼び出し側から削除してください。将来使う予定があるなら、使うロジックを実装するまで引数を追加しない方が明確です。

**Verdict:** APPROVED
**Reason:** `phase` が未使用なら削除は妥当です。シグネチャと呼び出しを揃えるだけで機能挙動は変わりません。

### [x] 3. Normalize reason concatenation in override path
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `reason: \`${e.reason} [flip override...]\`` は `e.reason` が未定義時に `"undefined ..."` を生成します。  
**Suggestion:** `const baseReason = e.reason ? \`\${e.reason} \` : "";` のように正規化してから連結し、ログ品質を一定にしてください。

**Verdict:** APPROVED
**Reason:** `e.reason` 未定義時の `"undefined ..."` は品質劣化なので正規化は有益です。変更はメッセージ文字列品質に限定され、ロジック破壊リスクは低いです。

### [ ] 4. Clarify phase-set naming for consistency
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `RETRY_TRACKED_PHASES` は「retry 追跡」だけでなく no-progress 判定、flip override、repeated-fail 抑止にも使われ、責務名と実態がズレています。  
**Suggestion:** 目的に合わせて `GATE_RETRY_GUARD_PHASES` などへ改名し、`HEAD_TEST_EVIDENCE_PHASES` と同じ「用途ベース命名」に揃えると設計意図が明確になります。

**Verdict:** REJECTED
**Reason:** 実質リネーム中心で、改善は主に可読性です。現時点では挙動改善がなく、保守コスト（参照更新漏れ・レビュー負荷）に対して効果が弱いため、保守的には見送りが妥当です。

### [x] 5. Simplify repeated phase-guard condition checks
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `ctx && RETRY_TRACKED_PHASES.includes(phase)` が `runGateFlow` 内で複数回重複しており、読みやすさと変更容易性を下げています。  
**Suggestion:** 冒頭で `const shouldApplyRetryGuards = Boolean(ctx && RETRY_TRACKED_PHASES.includes(phase));` を1回計算し、以降はそのフラグを使って分岐を統一してください。

**Verdict:** APPROVED
**Reason:** 同一条件を一箇所で評価すると分岐の一貫性が上がり、将来変更時の不整合を防げます。`Boolean(ctx && ...includes(phase))` を使う限り挙動差分はありません。
