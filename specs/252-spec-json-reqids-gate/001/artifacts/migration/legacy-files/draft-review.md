# Draft Review Results

4 issue(s) detected.

### 1. 依頼内容に沿って、まず `run-gate` と該当 e2e テストの実装を確認し、Draft QA が実コードと一致しているか・重複や抜けがないかを精査します。次に、指摘点を指定フォーマットでまとめます。`run-gate` と e2e の実装差分根拠を確認するため、関連箇所を `rg` と `sed` で抽出します。これで QA の主張が裏付けられているかを判定します。パスがこの worktree では異なるようなので、まずプロジェクト内の実ファイル位置を特定してから再確認します。リポジトリ実体は `..` にあるため、以降はそこを基準に確認します。あわせて指示どおり `docs/` と `src/` の更新時刻差も先に確認します。`run-gate` の実装上、`loadSpecJson(..., { validate:false })` が `hasFileMap` 条件内にあることを確認できました。次に、その周辺ロジックと既存 e2e のシナリオ内容を読んで、Draft QA の欠点を絞り込みます。### 1. Incorrect evidence about the no-skip AI path
**QA:** Q1  
**Issue:** Q1 cites `R3` as a `--skip-guardrail`なしで AI evaluation に到達するケース, but in current e2e `R3` exits early on retry-limit (`checkRetryBelowMax`) before any AI call. The evidence is factually misaligned with the code path.  
**Suggestion:** Replace this with a real non-skip scenario that actually reaches AI evaluation (e.g., retry count below limit + valid diff), then assert `R1` accepted and `REQ-SPEC` rejected as unknown `guardrail_id`.

### 2. 2. Ambiguous fallback scope vs issue wording
**QA:** Q2  
**Issue:** Q2 expands fallback triggers to parse failure and `requirements` undefined without clearly reconciling this with the issue wording (“fallback only when spec.json is unavailable or empty”). This can hide corruption by broadening fallback semantics without explicit agreement.  
**Suggestion:** Tighten the contract text to explicitly define “unavailable” and “empty,” and state whether JSON parse errors are treated as unavailable (fallback) or as hard failures, with rationale.

### 3. 3. Missing concrete definition of “empty requirements ids”
**QA:** NEW  
**Issue:** No QA entry defines behavior when `spec.json.requirements` exists but yields invalid IDs (e.g., missing/empty `id` values). This is a direct edge of the “empty” rule and affects whether fallback should occur.  
**Suggestion:** Add a QA entry specifying that fallback decision is based on “no usable non-empty requirement IDs” (or explicitly reject malformed entries), and add a test for that case.

### 4. 4. Redundant file-map coverage entries
**QA:** Q1, Q4  
**Issue:** Q4 largely repeats Q1’s “file-map present/absent should both use spec.json reqIds” concern without adding new acceptance criteria.  
**Suggestion:** Merge Q4 into Q1 and keep one consolidated QA with explicit assertions for both fixture variants and expected guardrail-id outcomes.
