# Test Design

### Test Design

- **TC-1: baseline 一致時の通常 cleanup 完走**
  - Type: integration
  - Input: squash route、baseline..featureBranch に追加 commit なし
  - Expected: exit code 0、finalize report 添付維持、step done 化、state 更新、worktree/branch 削除完了

- **TC-2: featureBranch ref を明示解決して orphan 検出**
  - Type: integration
  - Input: branch mode で process HEAD は baseBranch、featureBranch ref にのみ orphan commit 1 件
  - Expected: HEAD ではなく featureBranch ref を比較し、`ORPHAN_COMMITS_DETECTED` を返す

- **TC-3: ORPHAN_COMMITS_DETECTED 1 件**
  - Type: integration
  - Input: squash baseline..featureBranch に orphan commit 1 件
  - Expected: 非 0、worktree/branch 保持、step done 化なし、永続化先更新なし、削除なし

- **TC-4: orphan envelope の安定 field**
  - Type: unit
  - Input: orphan commit `{sha, subject}` を含む検出結果
  - Expected: `errors[0].code='ORPHAN_COMMITS_DETECTED'`、`data.orphanCommits`、`data.truncated`、`data.recoveryOptions=[cherry-pick, abort, force-continue]`

- **TC-5: ORPHAN_COMMITS_DETECTED 50 件超過**
  - Type: integration
  - Input: baseline..featureBranch に 51 件以上の orphan commit
  - Expected: `data.orphanCommits.length === 50`、`data.truncated === true`

- **TC-6: orphan 50 件ちょうど**
  - Type: unit
  - Input: orphan commit 50 件
  - Expected: 50 件すべて envelope に含まれ、`truncated === false`

- **TC-7: squash baseline missing**
  - Type: integration
  - Input: squash route だが flow state に baseline なし
  - Expected: 非 0、`SQUASH_BASELINE_MISSING`、silent skip しない、worktree/branch 保持

- **TC-8: baseline missing envelope の recovery 案内**
  - Type: acceptance
  - Input: baseline missing
  - Expected: archive、個別 cherry-pick、cherry-pick state 解消を案内し、blind range cherry-pick / finalize-merge 再実行を推奨しない

- **TC-9: baseline diverged**
  - Type: integration
  - Input: rebase/amend/force-update により baseline が featureBranch ancestor でない
  - Expected: 非 0、`SQUASH_BASELINE_DIVERGED`、orphan とは別経路で halt

- **TC-10: PR route は orphan 検出をスキップ**
  - Type: integration
  - Input: merge route が `pr`、baseline が null
  - Expected: orphan 検出せず cleanup 通常処理へ進む

- **TC-11: spec-only mode は早期 return 維持**
  - Type: integration
  - Input: spec-only finalize-cleanup
  - Expected: orphan 検出・worktree teardown を行わず既存の早期 return 挙動を維持

- **TC-12: merge route 不在は halt**
  - Type: integration
  - Input: cleanup retry で merge route が永続化されていない
  - Expected: 非 0 halt、silent skip しない、worktree/branch 保持

- **TC-13: merge route 不在 + --force**
  - Type: integration
  - Input: merge route missing、`--force=true`
  - Expected: exit code 0、既存 report 添付維持、強制 cleanup へ進む

- **TC-14: --auto-rescue 通常成功**
  - Type: integration
  - Input: orphan commit が baseBranch に clean cherry-pick 可能、`--auto-rescue`
  - Expected: exit code 0、baseBranch へ cherry-pick、通常 teardown 完了、report 添付維持

- **TC-15: auto-rescue 前後で worktreePath 配下ファイル hash 不変**
  - Type: integration
  - Input: dirty でない worktreePath、`git status -- worktreePath` 対象ファイルあり
  - Expected: auto-rescue 実行前後で全対象ファイル hash が一致

- **TC-16: auto-rescue は共有 repo dirty 状態を改変しない**
  - Type: integration
  - Input: main repo に unrelated uncommitted/staged 変更あり、pathspec 除外対象を含む
  - Expected: dirty 状態・staged 内容が保持され、要件外ファイルを変更しない

- **TC-17: auto-rescue baseBranch lock 時 detached fallback 成功**
  - Type: integration
  - Input: baseBranch が他 worktree で checkout 済み、orphan は clean cherry-pick 可能
  - Expected: detached worktree add、cherry-pick、update-ref、worktree remove の経路で成功

- **TC-18: auto-rescue fallback 不能で MAIN_REPO_LOCKED**
  - Type: integration
  - Input: baseBranch lock かつ detached fallback も作成/更新不可
  - Expected: 非 0、`MAIN_REPO_LOCKED`、worktree/branch 保持

- **TC-19: auto-rescue MAIN_REPO_DIRTY halt**
  - Type: integration
  - Input: auto-rescue 対象に影響する main repo dirty 状態
  - Expected: 非 0、`MAIN_REPO_DIRTY`、audit log は記録しない、worktree/branch 保持

- **TC-20: auto-rescue conflict**
  - Type: integration
  - Input: cherry-pick exit code 1、patch 非空
  - Expected: `cherry-pick --abort` 実行、非 0、`CHERRY_PICK_CONFLICT`、worktree/branch 保持、audit log 記録

- **TC-21: auto-rescue empty patch skip**
  - Type: integration
  - Input: cherry-pick exit code 1、patch 空、`nothing to commit`
  - Expected: `cherry-pick --skip` で継続し exit code 0、通常 teardown 完了

- **TC-22: --force で orphan drop 強行**
  - Type: integration
  - Input: orphan commit あり、`--force`
  - Expected: exit code 0、`FORCED_ORPHAN_DROP` warning、commit list を audit log に記録、branch 削除

- **TC-23: --auto-rescue と --force 同時指定**
  - Type: unit
  - Input: `--auto-rescue=true --force=true`
  - Expected: execute 冒頭で `ARGS_ERROR`、非 0、cleanup/検出処理へ進まない

- **TC-24: unknown flag は parseArgs で reject**
  - Type: unit
  - Input: `finalize-cleanup --unknown`
  - Expected: parseArgs の既存挙動で失敗、位置引数なし契約を維持

- **TC-25: CLI registry args 登録**
  - Type: unit
  - Input: command registry の finalize-cleanup 定義
  - Expected: user-facing boolean `--auto-rescue` / `--force` が default false で登録され、`--task-id` 等の内部引数は登録されない

- **TC-26: help text**
  - Type: acceptance
  - Input: finalize-cleanup help 表示
  - Expected: `--auto-rescue` と `--force` の説明が表示される

- **TC-27: success / halt exit code contract**
  - Type: unit
  - Input: no-op、auto-rescue 成功、force、各 halt code
  - Expected: success と `Envelope.warn(FORCED_ORPHAN_DROP)` は 0、validation/detection/conflict halt は非 0

- **TC-28: finalize report 添付維持**
  - Type: integration
  - Input: no-op、auto-rescue 成功、`--force` の各 success path
  - Expected: 既存 finalize report attachment が欠落・上書き消失しない

- **TC-29: flow-store 永続化 schema**
  - Type: unit
  - Input: route/baseline の各組み合わせ
  - Expected: squash 成功時のみ baseline 値を許可、`route='pr'` かつ baseline あり等の不整合は schema validation reject

- **TC-30: cleanup retry を跨ぐ route/baseline 保持**
  - Type: integration
  - Input: finalize-merge 後に cleanup halt、再度 cleanup 実行
  - Expected: flow state の baseline と merge route が保持され、同じ判定に使われる

- **TC-31: baseline capture は squash 直前**
  - Type: integration
  - Input: pre-sync rebase により featureBranch SHA が変化後に squash 実行
  - Expected: baseline は pre-sync 完了後・squash 適用直前の SHA で、squash 対象と一致

- **TC-32: SHA capture in worktree squash path**
  - Type: integration
  - Input: worktree squash route
  - Expected: cleanup 用 baseline SHA が flow state に保存される

- **TC-33: SHA capture in detached fallback path**
  - Type: integration
  - Input: detached fallback 経由の squash
  - Expected: fallback 経路でも同じ意味の baseline SHA が保存される

- **TC-34: SHA capture in branch mode**
  - Type: integration
  - Input: branch mode squash route
  - Expected: process HEAD ではなく featureBranch の squash 直前 SHA が保存される

- **TC-35: PR route / skip route の SHA null**
  - Type: unit
  - Input: PR route または skip route
  - Expected: baseline は null、route と baseline の値域が schema 上整合する

- **TC-36: canonical channel と stderr 重複なし**
  - Type: acceptance
  - Input: orphan halt / baseline missing / conflict
  - Expected: user-facing recovery 案内は envelope に集約され、stderr に同内容を重複出力しない

- **TC-37: audit log 保存場所**
  - Type: integration
  - Input: teardown 後に audit log が必要な force / auto-rescue conflict
  - Expected: main repo `specs/<id>/issue-log.json` に保存され、worktree 削除後も読める

- **TC-38: audit log 記録対象の限定**
  - Type: unit
  - Input: force、auto-rescue conflict、args error、baseline missing、baseline diverged、orphan halt、dirty halt
  - Expected: force と auto-rescue 中断のみ記録し、純粋な validation/detection/dirty halt は記録しない

- **TC-39: audit log append rollback snapshot**
  - Type: integration
  - Input: main-repo target append 中に書き込み失敗、並行追記あり
  - Expected: entry pop ではなく write 前 content 全置換で rollback し、並行追記下でも正確性を保つ

- **TC-40: retry dirty check は audit log を除外**
  - Type: integration
  - Input: auto-rescue 中断後、issue-log.json に audit entry が残った状態で retry
  - Expected: dirty check が log の存在だけでブロックしない

- **TC-41: finalize-cleanup prompt の 3 択**
  - Type: acceptance
  - Input: `prompts/impl/finalize-cleanup.md`
  - Expected: orphan 検出時に Choice Format で cherry-pick / abort / force-continue を user に提示する記述がある

- **TC-42: autoApprove 例外の prompt 記述**
  - Type: acceptance
  - Input: finalize-cleanup prompt と `core-principle.md`
  - Expected: autoApprove=true でも orphan recovery choice は silent bypass しない例外が明記される

- **TC-43: installed skill template 反映**
  - Type: acceptance
  - Input: `src/templates/skills/sdd-forge.flow/SKILL.md`
  - Expected: orphan 検出時の 3 択と autoApprove 例外が含まれる

- **TC-44: worktree release 条件は success 限定**
  - Type: acceptance
  - Input: installed skill template と `worktree-mode.md`
  - Expected: finalize-cleanup の worktree release は success 時のみで、orphan halt は worktree 境界維持と記述される

- **TC-45: spec tests 配置とヘッダ**
  - Type: unit
  - Input: 追加テストファイル一覧
  - Expected: `specs/253-finalize-orphan-rescue/tests/` 配下に配置され、各ファイル先頭に `// spec: R<N> ...` ヘッダがある
