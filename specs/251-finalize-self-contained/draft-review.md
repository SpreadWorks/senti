# Draft Review Results

9 issue(s) detected.

### 1. 関連ファイルを短く確認して、draft の Evidence が実コードと噛み合っているかを見ます。今回はレビューだけなのでコード変更はしません。指定 cwd 直下には `src/` が見えていないようです。worktree 境界内で、実際のリポジトリ配置を確認します。### 1. finalize-commit の永続化タイミングが未解決
**QA:** Q1/Q2  
**Issue:** finalize-commit が commit 作成後に registry post hook で flow.json を `done` にすると、その step 更新が feature branch の commit に含まれず、merge 前に dirty state が残る可能性がある。  
**Suggestion:** finalize-commit だけは「step 更新を commit 前に行う」「commit を amend する」「post hook が追加 commit する」のどれにするかを QA に明記し、merge 前に worktree が clean であることも検証項目に入れる。

### 2. 2. step 更新責務が Q1 と Q2 で矛盾している
**QA:** Q1/Q2  
**Issue:** Q1 は finalize-* の step 更新責務を registry.js post hook に集約するとしているが、Q2 は finalize-cleanup 本体ロジックで cleanup step を `done` にして commit するとしている。  
**Suggestion:** cleanup だけ例外にするなら理由と境界を明記する。例外にしないなら、post hook と cleanup commit の実行順を設計し、二重更新が起きない契約にする。

### 3. 3. authority 切替 signal が unsupported
**QA:** Q5  
**Issue:** 「main repo 側 specs/<id>/flow.json の存在」が merge 完了の必要十分条件だと断定しているが、prepare/worktree 作成時点で main repo に flow.json が存在しないことの根拠が不足している。  
**Suggestion:** flow prepare --worktree の実際の lifecycle を確認し、main repo に flow.json が事前存在し得るなら、明示的な metadata/sentinel/merge-result による authority 判定に変更する。

### 4. 4. main repo の中間 dirty state を許容するか未定義
**QA:** Q2/Q4  
**Issue:** Q2 の案 B では finalize-merge/sync の step 更新を cleanup まで commit しないため、main repo の flow.json が dirty なまま finalize-sync を実行する可能性がある。sync の preflight や git status 前提と衝突しないかが未確認。  
**Suggestion:** finalize-sync 実行前後に dirty flow.json を許容する契約を明記するか、step 更新を各 leaf で commit する設計にする。e2e でも中間状態を検証する。

### 5. 5. self-contained 化の「次操作」が envelope に入っていない
**QA:** NEW  
**Issue:** Q6 は「finalize-* CLI の envelope だけで次操作と report 表示を完結」と定義しているが、Q1/Q5 は実行後に別途 `flow get next-action` を叩く前提になっている。  
**Suggestion:** 各 finalize-* の envelope に `data.nextAction` または `data.nextCommand` を含めるのか、別コマンド取得を許容するのかを明確化する。Issue の「next-action と finalize-* の結果を一致」に対応する QA を追加する。

### 6. 6. report 埋め込み仕様の実装根拠が弱い
**QA:** Q3  
**Issue:** `report.json` から `data.report.text` を render する具体的な責務や既存 renderer の再利用方針が不明。`data.report = null` と `data.report.path/text` schema の関係も曖昧。  
**Suggestion:** 既存 `flow report show` の rendering 処理を共通 helper 化して reuse するのかを明記し、正常時・report missing・render failure・サイズ上限時の envelope 形を具体化する。

### 7. 7. failed merge retry 契約を決めているのにテスト対象外
**QA:** Q1/Q4  
**Issue:** Q1 は failed merge retry の詳細契約まで確定しているが、Q4 では異常分岐を out-of-scope としている。仕様化するなら回帰テストがないのは弱い。  
**Suggestion:** retry 契約を本 spec から外すか、少なくとも finalize-merge failed → skipped 後続 → retry success → sync/cleanup pending 復帰の focused test を追加する。

### 8. 8. skill template 検証が手動 grep 依存で弱い
**QA:** Q7  
**Issue:** self-contained 化の重要成果である skill template 更新が、手動 grep 検証だけになっている。テンプレート変更と `sdd-forge upgrade` 反映の回帰検知として不足。  
**Suggestion:** template render または upgrade 後の generated skill を検証する automated test を追加する。最低でも `flow set step.*finalize-`, `flow report show`, `cd <mainRepoPath>` が旧手順として残らないことをテスト化する。

### 9. 9. `skipped -> done` 正規化が広すぎる
**QA:** Q1  
**Issue:** command result の `skipped` を常に flow step `done` に正規化するとしているが、finalize-merge の skip strategy、finalize-sync の no-op、failed merge 後続 skip などで意味が異なる可能性がある。  
**Suggestion:** finalize-commit/merge/sync/cleanup ごとに result status と flow step status の対応表を作り、どの `skipped` が成功扱いで、どの `skipped` が後続抑止用なのかを分離して定義する。
