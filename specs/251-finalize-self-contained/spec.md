# Feature Specification: 251-finalize-self-contained

**Feature Branch**: `feature/251-finalize-self-contained`
**Created**: 2026-05-06
**Status**: Draft
**Input**: GitHub Issue #308

## Goal
finalize-* 各 leaf の成功時に CLI 自身が flow.json の step status を 'done' に遷移させ、prompt 記述と挙動を一致させる。merge 前後の state authority を main repo flow.json に切り替え、cleanup envelope に report 本文を埋め込み、AI 側の手順を 1 ステップに圧縮する。worktree finalize の e2e 回帰テストを整備する。

## Background
spec 238 で finalize は finalize-commit / finalize-merge / finalize-sync / finalize-cleanup の 4 leaf に分解されたが、registry.js の post hook で step status を 'done' に遷移させる処理が入っておらず、finalize-commit の executeCommitPost も retro/report のみで step を更新しない。結果として `flow get next-action` の promoteNextPendingLeaf が動作せず、AI/ユーザーが手動で `flow set step <id> done` を実行する必要がある。一方で prompts/impl/finalize-*.md は「the dispatcher automatically advances to <next>」と記述しており、prompt と実装が乖離している。merge 完了後は main repo に flow.json が出現するが、worktree からの CLI 呼び出しは worktree 配下の flow.json を更新するため、cleanup 直前まで state authority がどちら側にあるかが不明瞭。さらに、worktree finalize 全体を通しで検証する e2e テストが存在しない。

## Scope
- [MUST] registry.js の finalize-commit / finalize-merge / finalize-sync / finalize-cleanup post hook で flow step status を 'done' に正規化する (command result が 'done'/'completed'/'skipped' 時。'failed'/'preflight_failed' は遷移禁止)
- [MUST] finalize-commit の post hook が preflight_failed / failed の場合、step 遷移だけでなく executeCommitPost (retro/report 等の成功時 side effect) も skip する
- [MUST] merge 後の post hook が ctx.flowManager.forRoot(mainRepoPath) 経由で main repo 側 flow.json の step を更新する
- [MUST] flow get next-action も merge 後は main repo 側 flow.json を authority として読む
- [MUST] flow get status / flow get resolve-context / flow run resume も同じ authority 解決ルールを共有する (merge 後は main repo authority、cleanup 後は active:false へ確定)
- [MUST] src/flow/lib/flow-context.js の resolveFlowContext() (FlowCommand 実行と registry hook の共通入口) で authority resolver を呼ぶ。registry hook / 各 FlowCommand 個別の flow.json 読み込みではなく、ここで一元化する
- [MUST] post-cleanup の active-flow セマンティクス確定: cleanup 完了後 (last-finalized-spec が書かれた状態) では `flow get status` / `flow run resume` は active:false を返す。resolveActiveFlow() のスキャンは `.active-flow` クリア後 finalized 済み spec を再 active 化しない
- [MUST] src/templates/partials/worktree-mode.md の post-cleanup `cd <main-repository-path>` MUST 記述を envelope ベースの 1 ステップ運用に書き換える。tests/unit/templates/worktree-mode.test.js (もし旧記述を assert していれば) も更新
- [MUST] PR merge route (commands.gh enabled かつ gh available) の場合、PR 作成までで finalize 系 step は finalize-merge までを 'done' に正規化し、finalize-sync / finalize-cleanup の挙動はスコープ外として温存する。本 spec の self-contained 化は merge route (squash merge) のみを対象とする
- [MUST] src/flow/lib/run-finalize.js の buildFinalizePreflightError() のエラーメッセージ内コマンド参照 (`sdd-forge flow run finalize --help`) を `sdd-forge flow run finalize-commit --help` に更新する
- [MUST] finalize-cleanup の envelope の data に report.path と report.text を含める。report 不在時は data.report = null + Envelope.addWarning('REPORT_MISSING', ...)
- [MUST] cleanup envelope の report 生成は src/flow/lib/run-report-show.js の既存ヘルパー (resolveLatestReportPath / readReportText 相当) を共通化して flow report show と同じパスから取得する
- [MUST] finalize-cleanup 本体で flow.json の最終状態を main repo に commit する。transactional 順序: (i) ステージング → (ii) git commit が成功したら step 'done' に更新 → (iii) worktree remove + branch delete。commit 失敗時は step を据え置き再実行可能とする
- [MUST] failed merge retry 成功時に finalize-sync / finalize-cleanup の 'skipped' を 'pending' に reset する
- [MUST] skill template (src/templates/skills/) から AI 側で flow set step を打つ手順と cleanup 後の 3 ステップ手順を削除し、cleanup 後 1 ステップに圧縮
- [MUST] src/flow/prompts/impl/finalize-{commit,merge,sync,cleanup}.md の AI 向け prompt から `cd <mainRepoPath>` と `flow report show` の手動手順を削除し、cleanup prompt は envelope.data.report.text を読む手順に書き換える
- [MUST] tests/unit/flow/skill-report-show-wiring.test.js の既存 assertion (旧 SKILL.md に flow report show が含まれることを要求) を削除/書き換える。新 assertion は (a) 旧文字列が無いこと, (b) data.report.text を扱う新運用が反映されていること
- [SHOULD] tests/e2e/flow/commands/ 配下に worktree finalize 通し e2e を追加
- [SHOULD] registry レベルの単体/統合 test を 1 件追加 (failed merge retry 契約の回帰検知)
- [NICE-TO-HAVE] sdd-forge upgrade を実行して生成先 skill に手順削減が反映されていることを目視確認

## Out of Scope
- preflight_failed / spec-only モードなど異常分岐の e2e 検証 (後続 spec で追加)
- merge 戦略 (squash/rebase/no-ff) の見直し
- retro / report 本体ロジックの変更
- finalize 以外の step (gate / review / impl-confirm 等) の self-contained 化
- finalize-* CLI の引数仕様変更 (path 引数廃止等)。本 Issue の目的 (AI 手順の単純化) から外れる

## Constraints
- 外部依存なし (Node.js 組み込みのみ)
- alpha 版ポリシー: 後方互換コードは書かない。旧フォーマット・非推奨パスは保持せず削除
- src/ 配下にプロジェクト固有情報を含めない
- テストを通すためにテストコードを修正しない
- コミットメッセージは英語
- templates/ の変更後は sdd-forge upgrade を実行する
- Impact on Existing Features (集約): [影響あり] src/flow/registry.js の finalize-* post hook / src/flow/lib/run-finalize-cleanup.js の戻り値構造と本体ロジック / src/flow/lib/flow-context.js (resolveFlowContext) / src/flow/lib/get-status.js / src/flow/lib/get-resolve-context.js / src/flow/lib/run-resume.js / src/flow/get/next-action.js / src/flow/lib/run-report-show.js の helper 抽出 / src/flow/lib/run-finalize.js の preflight error / src/lib/flow-manager.js の resolveActiveFlow / src/templates/skills/sdd-forge.flow/SKILL.md / src/templates/partials/worktree-mode.md / src/templates/partials/flow-tracking.md / src/flow/prompts/impl/finalize-{commit,merge,sync,cleanup}.md / tests/unit/flow/skill-report-show-wiring.test.js。[影響なし＝preserved] src/flow/lib/run-finalize-merge.js の merge 戦略本体 / retro / report 本体ロジック / finalize-* CLI 引数仕様 / PR merge route の post-merge 自動化 / gate / review / impl-confirm / draft / spec / test 等の他 phase。
- Exit Code Contract: flow run finalize-{commit,merge,sync,cleanup} および flow get next-action / flow get status / flow run resume はいずれも JSON envelope を stdout に出力し、ok:true なら process exit code 0 / ok:false なら 1。次の場合は ok:false (exit 1) を返す: (a) finalize-cleanup の git commit 失敗、(b) preflight_failed、(c) merge 失敗、(d) 構造的エラー (引数不正・flow 未 active 等)。warning level エントリ (例: REPORT_MISSING) は ok:true を維持し exit code 0 を返す。

## Design Principles
- step 更新責務は registry.js post hook に集約 (gate/review と同形)。ただし finalize-cleanup は本体で git commit を伴うため例外的に本体内で更新
- command result status と flow step status を別概念として区別。skipped command result は flow step では 'done' に正規化
- state authority の切替 signal は循環しない設計とし、worktree 側 flow.json の状態を読まずに判定する (main repo 側 specs/<id>/flow.json の存在で判定)
- cleanup envelope は JSON envelope 規約を破壊せず、既存 Envelope.addWarning API を活用
- cwd 対応は worktree cwd (cleanup 前) と main repo cwd (cleanup 後) の 2 種に限定。任意 cwd はスコープ外

## Overview
### Modules
- src/flow/registry.js — finalize-* 4 leaf の post hook を拡張し step status 正規化と main repo authority 切替を実装
- src/flow/get/next-action.js 相当 — main repo 側 flow.json 存在チェックによる authority 解決ルールを実装
- src/flow/lib/run-finalize-cleanup.js — envelope の data.report を追加、本体ロジックで flow.json commit を実装 (transactional)
- src/flow/lib/run-report-show.js — 既存の resolveLatestReportPath / readReportText 相当ヘルパーを共通化し finalize-cleanup envelope 生成からも呼ぶ
- src/flow/lib/flow-context.js — resolveFlowContext() で authority resolver を呼ぶ単一入口。registry hook / FlowCommand / get-status / get-resolve-context / run-resume が同じ ctx.flowState を共有
- src/flow/lib/get-status.js / src/flow/lib/get-resolve-context.js / src/flow/lib/run-resume.js — flow-context.js 経由で authority 解決を継承
- src/lib/flow-manager.js: resolveActiveFlow() — post-cleanup 状態を active:false へ確定する判定を追加
- src/templates/partials/worktree-mode.md — post-cleanup `cd <main-repository-path>` MUST 記述を envelope ベース 1 ステップ運用に書き換え
- src/flow/lib/run-finalize.js: buildFinalizePreflightError() — エラーメッセージ内コマンド参照を finalize-commit に更新
- src/flow/prompts/impl/finalize-{commit,merge,sync,cleanup}.md — AI 向け prompt から手動手順 (cd / flow report show / flow set step) を削除
- tests/unit/flow/skill-report-show-wiring.test.js — 旧 assertion を削除し新運用 (data.report.text 経路) の assertion に置き換え
- src/templates/skills/sdd-forge.flow/SKILL.md — cleanup 後の 3 ステップ手順を 1 ステップに圧縮、finalize-* に手動 flow set step を要求しない
- src/templates/partials/flow-tracking.md — finalize-* を MUST 対象外とする旨を追記
- tests/e2e/flow/commands/ — worktree finalize の通し回帰 e2e を新規追加
- registry または既存 unit/integration test — failed merge retry 契約の test を新規追加

### Data Flow
- finalize-commit 実行 → worktree 側 flow.json の finalize-commit step を post hook で 'done' に正規化
- finalize-merge 実行 → forRoot(mainRepoPath) 経由で main repo 側 flow.json の finalize-merge step を post hook で 'done' に正規化、worktree 側は更新しない
- finalize-sync 実行 → 既存 docs commit (specs/ は git add 対象外) + main repo 側 flow.json の finalize-sync step を post hook で 'done' に正規化
- finalize-cleanup 実行 → 本体で main repo flow.json の finalize-cleanup step 更新 + git add + commit → worktree remove + branch delete → report.json から text を render → envelope.data.report に embed
- flow get next-action → main repo specs/<id>/flow.json の存在チェック → 存在すれば main authority、無ければ現 cwd flow.json、worktree 削除済みなら last-finalized-spec pointer fallback

### Decisions
- finalize-* の step 更新は registry.js post hook に集約 (gate/review と同形)。command result が 'done'/'completed'/'skipped' なら flow step 'done' に正規化、'failed'/'preflight_failed' は据え置き。registry.js:466-467 の onError 経由 skipped 設定は別意図で温存。
- merge 後の authority 切替は ctx.flowManager.forRoot(mainRepoPath) 経由。flow.json の commit 戦略は案 B (cleanup でまとめて 1 回 commit)。finalize-sync の git add は specs/ を含まないため step 更新は docs commit に紛れない。
- cleanup envelope に data.report = { path, text } を追加し既存 nextCommand は廃止。Envelope.addWarning で report 不在時の warning エントリを errors 配列に追加 (ok:true 維持)。flow report show と render ロジックを共通ヘルパーに抽出。
- flow get next-action の authority 解決は非循環設計: (a) flow metadata は cwd flow.json から取得 (merge 前後で不変), (b) main repo specs/<id>/flow.json 存在を直接 fs check, (c) 存在すれば main authority、無ければ cwd authority, (d) worktree 削除済みなら pointer fallback。
- failed merge retry: registry.js:466-467 の既存 onError (sync/cleanup を skipped) を温存。retry 成功時の post hook で finalize-merge を 'done' に正規化しつつ、sync/cleanup の skipped を 'pending' に reset し、promoteNextPendingLeaf が次に進められるようにする。
- skill template 更新範囲: SKILL.md:163-166 の cleanup 後 MUST 3 ステップ手順を 1 ステップ運用に書き換え。:136 の manual flow set step 案内は finalize 文脈の例外を明示。partials/flow-tracking.md:1 に「finalize-* を除く」を明記。

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- B: 各 RunFinalize*Command.execute の末尾で step を更新する — gate/review との一貫性を欠き、registry レイヤが薄くなりすぎる。post hook 集約を選択 (D1)
- command result の skipped を flow step も skipped で保存 — flow.json 上の step が done/skipped 混在し、UI/AI の可読性が低下。done に正規化する設計を選択
- 案 A: 各 leaf 完了時に都度 main repo に追加 commit する — git 履歴が冗長 (3-4 個の追加 commit)。案 B (cleanup でまとめて 1 回) を選択
- 案 C: finalize-sync の docs commit に flow.json 更新を相乗りさせる — finalize-sync の git add 列挙の変更が必要で既存契約が破綻。step status と docs commit の責務が混在し可読性低下
- α: cleanup envelope に reportPath のみ追加 — AI 側 2 ステップ (cleanup → report show) が残り改善幅が小さい
- γ: cleanup stdout に fenced block を直接書き出す — JSON envelope 規約を破壊し他コマンドとの整合が崩れる
- next-action の authority 切替を未対応のまま — merge 後に worktree 側の古い flow.json を読んで誤った step を返す回帰が温存され Issue 中核要件が満たされない
- finalize-* CLI の path 引数廃止 — Issue 本文から必須要件として読み取れず、CLI 互換性影響が大きい。out-of-scope に分離
- skill template 更新を別 spec に分離 — CLI 改修と template 削減が非同期だと AI 運用上 self-contained 化が体感されない。同一 spec で扱う
- 案 2: e2e に異常分岐 (preflight_failed / spec-only / failed merge) を含める — 初期実装の負担が大きく、分岐ごとに個別シナリオが必要。後続 spec で追加

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: registry.js の finalize-commit / finalize-merge / finalize-sync の post hook で command result status を flow step status に正規化する処理を追加する。'done'/'completed'/'skipped' → 'done'、'failed'/'preflight_failed' → 据え置き。finalize-cleanup は本体内で更新するため post hook では idempotent な再 set のみ。
- R2 [must]: merge 後の post hook (finalize-merge / finalize-sync / finalize-cleanup) は ctx.flowManager.forRoot(mainRepoPath) 経由で main repo 側 flow.json を更新する。worktree 側 flow.json は finalize-commit までしか更新しない。
- R3 [must]: flow get next-action は authority 解決ルール (D4) に従う: (a) flow state metadata から worktree:true / mainRepoPath を取得、(b) main repo 側 specs/<id>/flow.json の存在をファイルシステムでチェック、(c) 存在すれば main authority、無ければ現 cwd 側 authority、(d) worktree 削除済みなら last-finalized-spec pointer fallback。
- R4 [must]: finalize-cleanup の envelope の data に { path, text } を持つ report オブジェクトを含める。既存 nextCommand フィールドは廃止する。report 不在時は data.report = null + Envelope.addWarning('REPORT_MISSING', message) を呼ぶ (ok:true 維持)。render ロジックは flow report show と共通ヘルパーから呼ぶ。
- R5 [must]: finalize-cleanup 本体ロジックは transactional 順序で実行: (i) main repo の specs/<id>/flow.json で finalize-cleanup step を 'done' に更新 (working tree dirty)、(ii) git add + git commit を試行、(iii) commit 失敗時は step を 'in_progress' に rollback + git checkout で working tree の flow.json を復元 + return failure (worktree は削除しない)、(iv) commit 成功時のみ worktree remove + branch delete を実行、(v) report.json から text を render → envelope に embed。これにより「単一 commit に最終状態 'done' が含まれる」かつ「commit 失敗時は再実行可能」の両立を達成する。
- R11 [must]: finalize-commit の post hook は command result が 'failed' / 'preflight_failed' の場合、step 遷移だけでなく executeCommitPost (retro / report 等の成功時 side effect) 全体を skip する。成功 status ('done' / 'completed' / 'skipped') の場合のみ正規パスを実行する。
- R12 [must]: flow get status / flow get resolve-context (および ctx.flowState を解決する共通レイヤ) は flow get next-action と同じ authority 解決ルール (R3 / D4) を共有する。merge 後は main repo authority を読み、cleanup 後は last-finalized-spec pointer fallback を使う。
- R13 [must]: src/flow/prompts/impl/finalize-{commit,merge,sync,cleanup}.md の AI 向け prompt から旧手順 (`cd <mainRepoPath>`, `flow report show`, finalize-* に対する手動 `flow set step`) を削除する。finalize-cleanup.md は envelope.data.report.text を読んで貼る手順に書き換える。
- R14 [must]: tests/unit/flow/skill-report-show-wiring.test.js の既存 assertion (SKILL.md に旧 'flow report show' MUST 記述が含まれることを要求) を削除し、新 assertion (a) 旧文字列が SKILL.md に含まれない、(b) cleanup 後手順が data.report.text を扱う形に置き換わっている、を追加する。
- R15 [must]: report path と text の解決ロジックは src/flow/lib/run-report-show.js にある既存ヘルパー (resolveLatestReportPath / readReportText 等) を共通化する。finalize-cleanup の envelope 生成と flow report show コマンドは同じヘルパーを呼ぶ。重複実装は禁止。
- R16 [must]: src/flow/lib/flow-context.js の resolveFlowContext() で authority resolver を呼び、ctx.flowState を統一されたソース (merge 後 main / cleanup 後 pointer / merge 前 cwd) から構成する。これにより registry hook / 各 FlowCommand / get-status / get-resolve-context / run-resume が同じ ctx.flowState を共有する。
- R17 [must]: post-cleanup active-flow セマンティクス: cleanup 完了後は flow get status が active:false を返す。src/lib/flow-manager.js の resolveActiveFlow() (もしくは同等のスキャンロジック) は `.active-flow` がクリアされ last-finalized-spec が書かれた spec を再 active 化しない。run-resume も同じく active:false を返し再開対象にしない。
- R18 [must]: src/templates/partials/worktree-mode.md の post-cleanup `cd <main-repository-path>` MUST 記述を envelope ベース 1 ステップ運用に書き換える。tests/unit/templates/ 配下に worktree-mode.md の旧記述を assert する test がある場合は更新する。
- R19 [must]: PR merge route (commands.gh enabled AND gh available) の挙動は本 spec のスコープ外。PR 作成までで finalize-merge を 'done' に正規化したあと、finalize-sync / finalize-cleanup の post-merge セマンティクスは現状仕様 (PR route では各 leaf 個別実行) を温存する。本 spec の self-contained 化は squash merge route のみを対象とする。
- R20 [must]: finalize-cleanup envelope の warning 注入: run-finalize-cleanup.js は plain object を return する既存規約から、failure-on-report-only 時のみ Envelope オブジェクトを直接 return する形に拡張する (dispatcher は plain object と Envelope の両方を受け付ける)。または run コマンドの post-execute hook で warning 付与のフックを設ける。実装方針は impl 段階で確定するが、いずれの場合も dispatcher が wrap 後の envelope に warning を含められる経路が必要。
- R21 [must]: failed merge retry 経路で finalize-merge を再実行する際、registry.js:466-467 が書き込む 'skipped' status の dirty flow.json が pre-sync dirty check を阻害しない設計とする。具体的には: (a) onError による status 書き込みを git tracked file の dirty 判定対象から除外する preflight、または (b) retry 開始前に sync/cleanup の skipped を pending に reset する pre-hook、のいずれかで実装する。impl 段階で具体策を確定。
- R22 [should]: src/flow/lib/run-finalize.js の buildFinalizePreflightError() のエラーメッセージ内コマンド参照を `sdd-forge flow run finalize --help` から `sdd-forge flow run finalize-commit --help` に更新する。対応する unit test の expectation も同時に更新する。
- R6 [must]: failed merge の retry 成功時、finalize-merge の post hook は finalize-merge を 'done' に正規化すると同時に、同一 flow.json 内の finalize-sync / finalize-cleanup の status が 'skipped' なら 'pending' に reset する。これにより promoteNextPendingLeaf が次の finalize-sync を in_progress に進められる。
- R7 [must]: src/templates/skills/sdd-forge.flow/SKILL.md の cleanup 後 MUST 手順 (cd <mainRepoPath> + flow report show + fenced block 貼り付け) を envelope 経由 1 ステップ運用に書き換える。同 SKILL.md の 'flow set step を AI が打つ' 案内のうち finalize 文脈に該当する部分を削除する。partials/flow-tracking.md は「finalize-* を除く」を明示する。
- R8 [should]: tests/e2e/flow/commands/ 配下に worktree finalize の通し e2e を 1 件追加する。検証項目: 各 leaf 完了後の step 'done' 遷移、merge 後の main repo authority、flow get next-action の expected step、cleanup envelope の data.report、main repo working tree clean、worktree/branch 削除、active flow 解消。実行 cwd は finalize-* が worktree、cleanup 後の status/report は main repo cwd。
- R9 [should]: registry レベルの単体または統合 test を 1 件追加する。検証内容: finalize-merge 失敗 → finalize-sync/cleanup の 'skipped' 設定 → finalize-merge retry 成功 → finalize-sync/cleanup が 'pending' に reset → next-action が finalize-sync を返す。
- R10 [should]: tests/unit/templates/ 配下に finalize self-contained 化の template 検証 test を追加する: src/templates/skills/sdd-forge.flow/SKILL.md および src/templates/partials/worktree-mode.md に対して `flow report show` / `cd <mainRepoPath>` / `flow set step.*finalize-` の 3 パターンを正規表現で検査し全て 0 件であることを assert する。

## Acceptance Criteria
- finalize-commit / finalize-merge / finalize-sync / finalize-cleanup のいずれかが成功した直後に flow.json の対応 step が 'done' に遷移している
- finalize-merge 完了後、main repo 側 specs/<id>/flow.json の finalize-merge step が 'done' になっており、worktree 側 flow.json は更新されていない
- flow get next-action が finalize-commit 後に finalize-merge、finalize-merge 後に finalize-sync、finalize-sync 後に finalize-cleanup、finalize-cleanup 後に NO_IN_PROGRESS_STEP を返す
- finalize-cleanup 完了後の envelope の data.report.path と data.report.text が埋まっている (report 生成成功時)。report 不在時は data.report = null かつ envelope.errors に level='warn' code='REPORT_MISSING' のエントリがある
- finalize-cleanup 完了後、main repo の working tree が clean かつ specs/<id>/flow.json が最終状態で commit 済み
- finalize-cleanup 完了後、worktree ディレクトリと feature ブランチが削除されている
- finalize-cleanup の git commit が失敗した場合、flow.json の finalize-cleanup step は 'in_progress' のまま据え置かれ、worktree も削除されない (transactional 失敗時の再実行可能性)
- finalize-cleanup 完了後、flow get status が active:false を返す
- flow get status / flow get resolve-context が merge 後は main repo の flow.json を読み、cleanup 後は last-finalized-spec pointer fallback で解決すること
- finalize-commit が preflight_failed / failed で終了した場合、retro / report 等の成功時 side effect が実行されない (executeCommitPost が skip される)
- src/flow/prompts/impl/finalize-cleanup.md に 'cd <mainRepoPath>' および 'flow report show' の手動手順が含まれない
- src/flow/prompts/impl/finalize-{commit,merge,sync}.md に finalize-* に対する手動 'flow set step' 案内が含まれない
- tests/unit/flow/skill-report-show-wiring.test.js が旧 SKILL.md の 'flow report show' MUST 記述を要求しない (新 assertion に置き換わっている)
- src/flow/lib/run-report-show.js の resolveLatestReportPath / readReportText 相当ヘルパーが finalize-cleanup の envelope 生成からも共通呼び出しされている
- finalize-merge が失敗した状態で finalize-merge を再実行し成功した場合、finalize-sync / finalize-cleanup の status が 'pending' に reset され、flow get next-action が finalize-sync を返す
- src/templates/skills/sdd-forge.flow/SKILL.md に 'flow report show' および 'cd <mainRepoPath>' の cleanup 後 MUST 記述が残っていない
- tests/e2e/flow/commands/ 配下に worktree finalize の通し e2e テストが存在し PASS する
- registry レベルの test に failed merge retry 契約のテストが存在し PASS する

## Implementation Targets
-

## Open Questions
- [ ] flow get next-action の authority 解決層の具体的改修範囲: D4 のルールを実装する src 上の具体ファイル (resolve-context 等) と既存ロジックとの差分。実装段階で確定する

## Tasks
### Round 0
- **T-1** [pending]: Add flow step normalization to finalize post hooks
  - registry.js の finalize-commit / finalize-merge / finalize-sync の post hook に、command result status を flow step status に正規化するロジックを追加する。'done'/'completed'/'skipped' → 'done'、'failed'/'preflight_failed' → 据え置き。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Wire main repo authority via forRoot in merge-onward post hooks
  - finalize-merge / finalize-sync / finalize-cleanup の post hook が ctx.flowManager.forRoot(mainRepoPath) 経由で main repo 側 flow.json を更新するように切り替える。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Implement non-circular authority resolution in flow get next-action
  - flow get next-action が D4 の authority 解決ルール ((a)-(d)) に従って main repo 側 / worktree 側 / pointer fallback のいずれかを authority として採用するよう実装する。
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Embed report path and text in cleanup envelope data
  - finalize-cleanup の envelope の data に { path, text } を持つ report オブジェクトを追加する。既存 nextCommand は廃止。report 不在時は data.report = null + Envelope.addWarning('REPORT_MISSING', ...)。flow report show と同じ render ロジックを共通ヘルパーに抽出。
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Commit final flow.json in cleanup body
  - finalize-cleanup 本体ロジックで main repo 側 flow.json の finalize-cleanup step を 'done' に更新し、git add specs/<id>/flow.json + git commit を実行する。途中失敗時は step を in_progress のまま据え置く。
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Reset skipped sync/cleanup on merge retry success
  - failed merge の retry 成功時、finalize-merge の post hook で finalize-sync / finalize-cleanup の status が 'skipped' なら 'pending' に reset する。
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Update skill template to remove manual finalize steps
  - src/templates/skills/sdd-forge.flow/SKILL.md の cleanup 後 MUST 手順 (cd + flow report show + 貼り付け) を envelope 経由 1 ステップ運用に書き換える。flow set step の AI 案内から finalize 文脈の例外を明示。partials/flow-tracking.md に「finalize-* を除く」を追記。
  - see `tasks/T-7.md` for full spec
- **T-8** [pending]: Add e2e regression test for worktree finalize happy path
  - tests/e2e/flow/commands/ 配下に worktree finalize の通し e2e を追加する。各 leaf 完了後の step 遷移、authority 切替、next-action、cleanup envelope、worktree/branch 消滅、active flow 解消を検証。
  - see `tasks/T-8.md` for full spec
- **T-9** [pending]: Add unit/integration test for failed merge retry contract
  - registry レベルの test に failed merge retry 契約 (T-6 で実装) の回帰検知を追加する。
  - see `tasks/T-9.md` for full spec
- **T-10** [pending]: Gate finalize-commit post hook side effects on success status
  - finalize-commit の post hook (executeCommitPost) を成功 status ('done' / 'completed' / 'skipped') の場合のみ実行する。preflight_failed / failed では retro / report 等の side effect 全体を skip する。
  - see `tasks/T-10.md` for full spec
- **T-11** [pending]: Share authority resolution across get-status and get-resolve-context
  - flow get status / flow get resolve-context が flow get next-action と同じ authority 解決ルール (D4) を共有するよう修正する。共通ヘルパーに切り出して 3 ヶ所から呼ぶ。
  - see `tasks/T-11.md` for full spec
- **T-12** [pending]: Extract shared report reader helper from run-report-show.js
  - src/flow/lib/run-report-show.js の resolveLatestReportPath / readReportText 相当を共通ヘルパーとして抽出し、flow report show コマンドと finalize-cleanup envelope 生成の両方が同じヘルパーを呼ぶようにする。
  - see `tasks/T-12.md` for full spec
- **T-13** [pending]: Update finalize-* AI prompt files
  - src/flow/prompts/impl/finalize-{commit,merge,sync,cleanup}.md の AI 向け prompt から旧手順 (cd <mainRepoPath>, flow report show, finalize-* に対する手動 flow set step) を削除する。finalize-cleanup.md は envelope.data.report.text を読む手順に書き換える。
  - see `tasks/T-13.md` for full spec
- **T-15** [pending]: Centralize authority resolver in flow-context.js
  - src/flow/lib/flow-context.js の resolveFlowContext() で authority resolver を呼び、ctx.flowState を統一されたソース (merge 後 main / cleanup 後 pointer / merge 前 cwd) から構成する。registry hook / FlowCommand / get-status / get-resolve-context / run-resume は同じ ctx.flowState を共有する。
  - see `tasks/T-15.md` for full spec
- **T-16** [pending]: Confirm post-cleanup inactive semantics in resolveActiveFlow
  - post-cleanup 状態 (.active-flow クリア + last-finalized-spec 書き込み済み) で flow get status / flow run resume が active:false を返す。resolveActiveFlow() のスキャンが finalized 済み spec を再 active 化しない。
  - see `tasks/T-16.md` for full spec
- **T-17** [pending]: Update worktree-mode partial template
  - src/templates/partials/worktree-mode.md の post-cleanup `cd <main-repository-path>` MUST 記述を envelope ベース 1 ステップ運用に書き換える。
  - see `tasks/T-17.md` for full spec
- **T-18** [pending]: Scope PR merge route as out-of-scope and document
  - PR merge route (commands.gh enabled AND gh available) は本 spec のスコープ外として明示し、実装が squash merge route のみを self-contained 化対象とすることをコード上で表現する。
  - see `tasks/T-18.md` for full spec
- **T-19** [pending]: Wire warning injection into cleanup envelope path
  - finalize-cleanup の戻り値が plain object と Envelope の両方をサポートできるよう dispatcher 側を整備し、report 不在時に Envelope.addWarning('REPORT_MISSING', ...) で warning を注入できる経路を作る。
  - see `tasks/T-19.md` for full spec
- **T-20** [pending]: Make merge retry resilient to dirty flow.json from prior failure
  - failed merge retry 経路で registry.js:466-467 が書き込む 'skipped' status の dirty flow.json が pre-sync dirty check を阻害しないようにする。
  - see `tasks/T-20.md` for full spec
- **T-21** [pending]: Update finalize preflight help text to finalize-commit
  - src/flow/lib/run-finalize.js の buildFinalizePreflightError() のエラーメッセージ内コマンド参照を `sdd-forge flow run finalize --help` から `sdd-forge flow run finalize-commit --help` に更新する。
  - see `tasks/T-21.md` for full spec
- **T-14** [pending]: Update skill-report-show-wiring test to new envelope-based contract
  - tests/unit/flow/skill-report-show-wiring.test.js の既存 assertion (旧 SKILL.md に flow report show MUST が含まれることを要求) を削除し、新 assertion: (a) SKILL.md に旧文字列が無いこと、(b) cleanup 後の skill 手順が data.report.text を扱う形になっていること、を追加する。
  - see `tasks/T-14.md` for full spec
