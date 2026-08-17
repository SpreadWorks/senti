# Feature Specification: 251-ai-test-exec

**Feature Branch**: `feature/251-ai-test-exec`
**Created**: 2026-05-06
**Status**: Draft
**Input**: GitHub Issue #309

## Goal
テスト実行を impl phase の専用 step (test-execute) に集約し、AI agent への委託で言語非依存化する。結果の整合性検算を test-result-review に分離。retro を post-commit hook から mainline step に昇格させ、結果ファイルを読むだけの単純集計に簡素化する。test-review に header coverage の FAIL 昇格と header lie detection を追加する。

## Background
現状 retro (src/flow/lib/run-retro.js:374) が `node --test` を直接 execFileSync で呼び、`.test.js` / `.spec.js` / `.mjs` 拡張子フィルタ (line 367) で Node.js プロジェクトを前提にしている。spec 249 でヘッダー宣言ベースに移行した後も Node 前提が retro 側に残り、PHP/Python では static path が機能せず AI フォールバックに依存する。さらに retro が TAP 出力をパースして要件カバレッジを検証するのは責務の重複であり、テスト実行と判定が複数 step で散逸している。Issue #309 はこれを test-execute / test-result-review / retro 簡素化 / test-review FAIL 昇格 の 4 軸で解決する設計を提案する。

## Scope
- [must] 新規 step: test-execute (impl phase, AI agent によるテスト実行 + 結果ファイル + raw output 保存)
- [must] 新規 step: test-result-review (impl phase, raw output と実コード突合でハルシネーション検出)
- [must] retro tryStaticEvaluation 簡素化: node --test 実行・TAP パース・拡張子フィルタ削除、結果ファイル read only
- [must] retro を post-commit hook から impl phase の mainline step に昇格 (新規 prompt impl/retro.md 追加)
- [must] impl phase step 順序を implement → test-execute → test-result-review → review → gate-impl → retro に再構成 (step id は既存の `review` を維持し、Issue 用語の review-impl は同義)
- [must] implement step prompt から `npm test` / `node --test` 実行指示を削除 (単一実行点ルール)
- [must] gate-impl 改修: test-result-review.json.verdict==pass を確認した上で test-execute-result.json を読み、要件未達があれば FAIL を返す
- [must] review (impl phase) 改修: review でコード修正を適用した場合、test-execute / test-result-review を pending にリセットして再実行を強制 (stale 結果ファイル防止)
- [must] run-review.js の next 遷移ロジック更新: review 完了後の next を 'finalize' / 'apply' から definition.js の next-action に委譲
- [must] run-finalize-commit.js のコミット境界明確化: implementation commit に test-execute-result.json / raw output / test-result-review.json / retro.json を含めない (もしくは別 commit 化)
- [must] run-report.js 改修: retro.json および test-execute-result.json / test-result-review.json を入力として report に統合
- [must] test-only auto skip path 更新: production code 実装 (implement) はスキップしても test-execute / test-result-review は実行する
- [should] test-review (plan phase) の header coverage 警告を FAIL 条件に昇格 (validateTestHeaders 既存ヘルパーを再利用)
- [should] test-review に header lie detection を追加 (validateTestHeaders の uncoveredRequirements / headerNoTest / testNoHeader を deterministic に finalGaps に inject、AI gap analysis は semantic check のみ)
- [should] req-map.js の dead 関数削除 (parseTapOutput / extractReqResults / evaluateReqByResults)
- [should] 既存 step order テストの更新 (tests/unit/flow/commands/review.test.js, run-finalize-retro-invocation.test.js, e2e lifecycle whitelist 等)
- [must] skill テンプレート (src/templates/skills/sdd-forge.flow/SKILL.md) の更新 (旧 finalize post-hook retro/report 記述を削除、新 mainline step を反映) + sdd-forge upgrade 実行
- [must] src/flow/registry.js の finalize-commit.post hook 更新 (executeCommitPost が retro/report を呼ばない、help テキスト更新)
- [must] src/flow/lib/run-gate.js の PASS_NEXT / FAIL_NEXT マップを新 step 順序に合わせて更新
- [must] src/flow/commands/report.js (実 report 生成ロジック) を retro.json + test-execute-result.json + test-result-review.json から直接読み取るよう更新
- [must] src/flow/prompts/impl/review.md から既存の test 再実行指示を削除
- [must] src/flow/prompts/plan/test.md の `node --test` 実行指示を削除 (単一実行点ルール)
- [must] gate-impl の挙動を task-impl scope と integration scope で区別 (task-impl は diff/guardrail のみ、integration が test artifacts を消費)
- [must] 新 step の next-action 出力スキーマ (test-execute / test-result-review / retro) を新規追加
- [must] raw output ログ配置を specs/<spec>/tests/.raw/test-execution.log に変更 (.tmp/ から spec 内永続成果物へ移動)
- [should] src/lib/flow-store.js の setTestSummary / parent.test.summary 集計はレガシー互換で残す (本 spec の report は使わない、別 spec でクリーンアップ)

## Out of Scope
- CI 専用テスト (本番 DB / API キー必須) の agent 環境実行サポート
- agent 多様化 (低透明性 LLM 利用) 時の追加ハルシネーション対策 (canary 注入等)
- JUnit / TAP 等の既存フォーマット互換 (独自最小スキーマ採用)
- 30 分超 e2e テストの timeout 制御の本 spec での確定 (agent.timeout 既存設定流用)
- plan phase の test write step の言語非依存化 (本 spec のテストは JS で書く、別 spec で対応)

## Constraints
- [must] 本 spec の verification テストは specs/251-ai-test-exec/tests/ 配下に配置する (各 task acceptance に記載済み)。既存テスト修正 (tests/unit/flow/, tests/e2e/) は project-level regression テストの更新であり、spec verification とは別カテゴリ
- [must] alpha 期間ポリシー (CLAUDE.md): 後方互換コードを書かない。旧 finalize post-hook retro 呼び出しは新 mainline step に置換、進行中 flow への影響は CHANGELOG に明記
- [must] テスト実行は impl phase の test-execute step でのみ行う。retro / review-impl / gate-impl 等の後続ステップは結果ファイルを読むだけで、テストを再実行してはならない
- [must] raw output は AI 要約禁止、生のまま保存
- [must] reviewer (test-result-review) は executor (test-execute) と別 agent session で invoke
- [must] result file 不在時は明示的エラー、AI フォールバック評価は行わない
- [must] テスト実行は spec ごとに 1 回 (キャッシュ無し、test-execute が呼ばれたら必ず実行)
- [must] downstream step (gate-impl, retro) は test-result-review.json.verdict == pass を確認した上で test-execute-result.json を読む
- [should] executor / reviewer のモデル差異化は config.agent.providers でユーザー任意 (Issue 推奨だが必須ではない)
- [must] skill テンプレート (src/templates/skills/sdd-forge.flow/SKILL.md) は本変更で更新する。sdd-forge upgrade 実行が必要 (旧 draft の『upgrade 不要』記述は誤り、本 constraint で訂正)
- [must] raw output ログは specs/<spec>/tests/.raw/test-execution.log に永続化する (.tmp/ ではない)。spec フォルダ内成果物として保持し、finalize-commit では別 commit (例: chore: add test artifacts) または .gitignore で commit 制御する

## Design Principles
- 単一実行点ルール: テスト実行は impl phase の test-execute step に集約し、retro / review-impl / gate-impl は結果ファイル read-only
- 言語非依存性: テストランナー判断を AI agent に委譲し、preset / config に framework 別の宣言的設定を持ち込まない
- 責務分離: test-execute = 実行+保存、test-result-review = 整合性検算、gate-impl = 要件カバレッジ判定、retro = 集計レポート
- 単一情報源: 結果ファイル (test-execute-result.json) を downstream の唯一の入力とし、TAP / JUnit パース機構や AI フォールバック評価を持たない
- step status 駆動の stale 防止: result file に headSha 等のメタデータを持たず、step status を single source of truth として stale 検出を構造的に保証
- 既存 retry パターン再利用: テスト失敗時の rewind は gate-impl FAIL → implement に戻る既存ループを使い、新たな retry budget を増やさない
- 三層 enforcement: prompt 改修 + コード改修 + 静的検査 (regression test) の三層で single-execution-point ルールを保証する

## Overview
### Modules
- src/flow/definition.js (FLOW_DEFINITION の impl phase children 拡張: test-execute, test-result-review, retro 追加 + 順序再構成)
- src/flow/lib/run-test-execute.js (新規, AI agent によるテスト実行と結果保存)
- src/flow/lib/run-test-result-review.js (新規, raw output と実コードの整合性検算)
- src/flow/lib/run-retro.js (TAP 系削除、結果ファイル read-only 化、partial 状態廃止)
- src/flow/lib/run-finalize.js (post-commit retro 呼び出し削除)
- src/flow/lib/run-finalize-commit.js (artifact コミット境界の見直し: 新 artifact を implementation commit に含めない)
- src/flow/lib/run-gate.js (gate-impl が test-result-review.json.verdict と test-execute-result.json を読む)
- src/flow/lib/run-review.js (review 完了後の next 遷移を definition-driven に。review で fix を適用した場合は test-execute をリセット)
- src/flow/lib/run-report.js (retro.json + test-execute-result.json + test-result-review.json を report に統合)
- src/flow/lib/test-headers.js (validateTestHeaders を test-review で再利用)
- src/flow/lib/req-map.js (parseTapOutput / extractReqResults / evaluateReqByResults 削除)
- src/flow/commands/review.js (test-review header coverage FAIL 昇格 + header lie detection 追加)
- src/flow/registry.js (run-test-execute / run-test-result-review コマンド登録)
- src/flow/lib/get-next-action.js (新 step instructionsKey マッピング)
- src/flow/prompts/impl/implement.md (test 実行指示削除、test-only skip path 更新)
- src/flow/prompts/impl/review.md (review fix 適用時の test-execute リセット責務を明記)
- src/flow/prompts/impl/test-execute.md (新規 prompt)
- src/flow/prompts/impl/test-result-review.md (新規 prompt)
- src/flow/prompts/impl/retro.md (新規 prompt: retro mainline 化に伴う AI 指示)
- src/templates/skills/sdd-forge.flow/SKILL.md (旧 finalize post-hook retro 記述を新 mainline step 記述に更新、sdd-forge upgrade で反映)
- tests/unit/flow/run-finalize-retro-invocation.test.js (post-hook retro テスト削除または書き換え)
- tests/unit/flow/commands/review.test.js (impl phase step 順序の前提を更新)

### Data Flow
- 正常経路: implement → test-execute (AI agent が test command 発見・実行 → test-execute-result.json + raw output ログ保存) → test-result-review (raw output と実コード照合 → test-result-review.json verdict 出力) → review-impl → gate-impl → retro (要件単位 done/not_done 集計 → retro.json) → finalize
- FAIL 経路 (本物のテスト失敗): gate-impl が要件未達を検出 → skill が implement を in_progress に戻し下流 step を pending リセット → 再 cycle (gate-impl maxAttempts=5)
- ハルシネーション経路: test-result-review が verdict='fail' (lowercase) → test-execute-result.json が信頼できない = 実質テスト failure 扱い → gate-impl が FAIL を伝搬 → 上記 FAIL 経路と同じループ

### Decisions
- Issue #309 の設計を 1 spec で全面採用する。dcb2-A / dcb2-B 分割案は責務分離の過渡状態を避けるため不採用
- テスト失敗時の rewind は既存 implement → gate-impl → FAIL → rewind パターンを再利用する。test-execute 自体は実行+保存のみで verdict を持たない
- test-result-review FAIL (ハルシネーション疑い) は本物のテスト失敗と同じ rewind ルートに乗せる。別ルートを設けない
- result file (test-execute-result.json) と raw output ログは固定パスで無条件上書き、stale 検出は step status を single source of truth として運用する
- TASK_DEFINITION には test-execute / test-result-review を追加しない。テスト実行は spec 単位で 1 回
- test-execute / test-result-review は既存 src/lib/agent.js を流用 (ensureAgent パターン)。新規 agent class は作らない
- single-execution-point の enforcement は prompt 改修 + コード改修 + 静的検査 (regression test) の三層で行う。child_process 全面禁止ではなく known non-test step ファイルに限定して false positive を避ける

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- dcb2-A (test-execute + test-result-review) と dcb2-B (retro 簡素化 + test-review 強化 + req-map.js cleanup) に分割 — 実装規模軽減できるが、A 完了後 B 完了までの過渡期間で retro が post-commit hook と新 step の二重実装になる。Issue 設計の責務分離が崩れる
- test-execute 自体に verdict 機構を持たせて短絡 rewind — レビュー系 (test-result-review, review-impl) をスキップして implement に戻れるが、テスト失敗時にコード品質チェックが 1 度も走らないリスクがある
- gate-impl に自動 rewind sideEffect を持たせて engine 側で制御 — engine 側制御を複雑化し、現行の skill 駆動の retry パターンから逸脱する
- test-result-review FAIL を専用 ESCALATE 経路で人間判断にする — 本物のテスト失敗とハルシネーションを別ルートで処理することで flow 制御が二重化し、責務分離設計が崩れる。判定の意味 (信頼できない結果 = 失敗扱い) を素直に flow に反映する方が一貫する
- result file に headSha 等のメタデータを持たせて downstream で stale 検出 — step status による既存設計と二重管理になり複雑化する
- test-execute / test-result-review を task subflow にも追加 — AI invocation コストが task 数倍に膨らみ、要件 ID が task をまたいで分散する場合の集計が複雑化する
- JUnit / TAP 等の既存フォーマット互換の result file — 言語非依存性を損なう。Issue で明示的に却下
- child_process / spawn 全面禁止の static check — flow code は一般的な subprocess 用途で child_process を正当に使用するため false positive が出る。検査範囲を known non-test step ファイルに限定

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: definition.js の FLOW_DEFINITION の impl phase children に test-execute / test-result-review / retro の各 FlowNode が追加され、順序が implement → test-execute → test-result-review → review-impl → gate-impl → retro になっている
- R2 [must]: test-execute step が実行された時、AI agent が任意のテストランナー (node --test, jest, pytest, phpunit 等) を Bash tool で invoke し、結果を specs/<spec>/test-execute-result.json と specs/<spec>/tests/.raw/test-execution.log に保存する。schema は { version: '1', raw_output_path, summary: [{ id, result, error?, evidence: { test_file, test_name, command, raw_output_lines } }] }。raw output は spec 内永続成果物として保持される (.tmp/ ではない)
- R3 [must]: test-result-review step が実行された時、test-execute-result.json と raw output ログ・実コードを照合し、5 検算項目 (file path 存在、req ID 出現、test 件数整合、stack trace 妥当性、duration 整合) を検証して specs/<spec>/test-result-review.json (verdict, checked_items[]) と test-result-review.md に保存する
- R4 [must]: test-result-review が summary 完備性 (spec.json.requirements の testable 要件 ID が summary に全て存在、重複なし、未知 ID なし) を検証し、欠落・重複・未知があれば verdict=FAIL とする
- R5 [must]: retro が test-execute-result.json を読んで要件単位の done/not_done を集計するだけの実装になり、execFileSync('node --test') / parseTapOutput / extractReqResults / evaluateReqByResults への依存が無くなる。partial 状態は廃止 (pass→done, fail→not_done のみ)。result file 不在 / JSON 不正は明示的エラー
- R6 [must]: src/flow/lib/run-finalize.js の post-commit hook から retro 呼び出しが削除され、retro が finalize 内部から実行されない
- R7 [must]: src/flow/prompts/impl/implement.md から `npm test` / `node --test` 実行指示が削除され、implement step prompt が「コードを書くだけでテスト実行はしない」を明示する
- R8 [should]: test-review (review.js) の header coverage 警告 (review.js:893-912) が FAIL 条件に昇格し、testable 要件のうち header 宣言が無いものが 1 件以上あれば finalGaps に { type: 'missing-header', reqId, desc, suggestion } を inject して verdict=FAIL を出す
- R9 [should]: test-review の buildGapAnalysisPrompt に header-lie detection が追加され、ヘッダー宣言した要件 ID をテスト内容で実際に verify していない場合 finalGaps に { type: 'header-lie', reqId, file, content_excerpt } を inject して verdict=FAIL を出す
- R10 [should]: src/flow/lib/req-map.js から parseTapOutput / extractReqResults / evaluateReqByResults が削除される。これらの関数を呼ぶ consumer は本変更後存在しない
- R11 [must]: src/flow/registry.js に run-test-execute / run-test-result-review が登録され、src/flow/lib/get-next-action.js が新 step の instructionsKey マッピングを認識する
- R12 [must]: test-execute / test-result-review の各 step prompt (src/flow/prompts/impl/test-execute.md, test-result-review.md) が新規作成される。test-execute prompt は (1) package.json scripts.test や設定ファイルから test command を発見、(2) verbose mode 強制、(3) 結果を最小スキーマで保存、(4) raw output 要約禁止、を AI agent に指示する
- R13 [must]: TASK_DEFINITION (task subflow) には test-execute / test-result-review が追加されない。task 単位ではテスト実行を行わず、spec 単位の最終検証で 1 回だけ実行される
- R14 [should]: regression test として、src/flow/lib/run-retro.js / run-gate.js / src/flow/commands/review.js が node --test / npm test / jest / pytest / phpunit を直接 invoke していないことを grep ベースで verify する単体テストが追加される (false positive を避けるため対象は known non-test step ファイルに限定)
- R15 [must]: test-execute / test-result-review は src/lib/agent.js の既存抽象 (ensureAgent パターン) を流用して invoke される。session 分離 = 別 agent.call() 呼び出しで context を共有しない、を operational 定義として満たす
- R16 [must]: review (impl phase) step が fix を適用してコードを変更した場合、後続の test-execute / test-result-review / gate-impl / retro を pending にリセットして再実行を強制する。stale な test-execute-result.json での gate-impl 通過を防ぐ
- R17 [must]: gate-impl が test-result-review.json.verdict == pass を確認し、test-execute-result.json を読んで要件単位の pass/fail を集計する。verdict != pass / test-result-review.json 不在 / test-execute-result.json 不在 / 要件未達のいずれかで FAIL を返す
- R18 [must]: src/flow/lib/run-review.js の review 完了後の next 遷移を 'finalize' / 'apply' から削除し、definition.js の next-action 駆動に委譲する。review が gate-impl の前段に来る新順序を反映
- R19 [must]: src/flow/lib/run-finalize-commit.js のコミット境界を見直し、test-execute-result.json / specs/<spec>/tests/.raw/test-execution.log / test-result-review.json / retro.json を implementation commit に含めない。これら test artifact は別 commit (例: chore: add test artifacts) として finalize-commit の post-hook で commit する (.gitignore による除外は採用しない、artifact は spec フォルダ内に永続化)
- R20 [must]: src/flow/lib/run-report.js が retro.json (要件集計) + test-execute-result.json (要件単位 pass/fail + evidence) + test-result-review.json (verdict + checked items) を入力として report.md / report.json を生成する。state.test.summary 経由のテスト情報取得を廃止
- R21 [must]: test-only auto skip path (現状 implement / gate-impl をスキップする経路) が、production code 実装 (implement) はスキップしても test-execute / test-result-review は必ず実行するよう更新される。スキップ判定ロジックは新 step を考慮する
- R22 [should]: src/templates/skills/sdd-forge.flow/SKILL.md の hardcoded 旧 flow 記述 (finalize post-hook で retro/report、command reference の retro 配置等) が新 mainline step 記述に更新される。sdd-forge upgrade で反映確認
- R23 [should]: 既存テストが新 step 順序に合わせて更新される: tests/unit/flow/run-finalize-retro-invocation.test.js (post-hook retro 想定の削除/書き換え)、tests/unit/flow/commands/review.test.js (impl phase step 順序の前提)、e2e lifecycle whitelist (flow step 一覧)
- R24 [should]: test-review (review.js) の header coverage / header-lie 検出は src/flow/lib/test-headers.js の validateTestHeaders 既存ヘルパー (uncoveredRequirements / headerNoTest / testNoHeader) を再利用して deterministic な検出結果を finalGaps に inject する。AI gap analysis は semantic check (ヘッダー宣言と内容の意味的な不整合) のみに使う
- R25 [must]: retro が impl phase mainline step として動作するための prompt (src/flow/prompts/impl/retro.md) が新規作成され、AI agent への指示 (sdd-forge flow run retro 呼び出し、結果ファイル read-only、step 完了処理) を含む
- R26 [must]: src/flow/registry.js の finalize-commit.post hook (executeCommitPost) が retro 呼び出しのみ削除し、report 生成 / issue comment / artifact commit は維持する。help テキストも『post-hook runs report, and issue comment』に修正 (R37 と整合)
- R27 [must]: src/flow/lib/run-gate.js の PASS_NEXT / FAIL_NEXT ハードコードマップが新 step 順序に合わせて更新される。task-impl PASS は review、integration / gate-impl PASS は retro へ遷移するよう変更
- R28 [must]: src/flow/commands/report.js (実 report 生成) が state.test.summary 経由のテスト情報取得を撤廃し、retro.json + test-execute-result.json + test-result-review.json を直接読む。R20 は run-report.js に加えて report.js も対象とする
- R29 [must]: src/flow/prompts/impl/review.md から既存の『Re-run tests to confirm no regressions』指示が削除される。review fix 後のテスト再実行は test-execute step リセット (R16) で行う
- R30 [must]: src/flow/prompts/plan/test.md の `node --test specs/<spec>/tests/*.test.js` 実行指示が削除される。plan phase で red/green を確認したい場合は header validation や試走を別途指示するか、削除のみで対応 (本 spec では削除のみ)
- R31 [must]: gate-impl の挙動が task-impl scope と integration scope で区別される: task-impl gate (TASK_DEFINITION 内) は diff/guardrail のみ評価 (現状維持)、integration gate (FLOW_DEFINITION 内 mainline) は test-result-review.json + test-execute-result.json を消費 (R17)
- R32 [must]: 新 step の next-action 出力スキーマが追加される: src/flow/schemas/next-action/test-execute.schema.json, test-result-review.schema.json, retro.schema.json。definition.js の対応 FlowNode で outputSchemaRef として参照する
- R33 [must]: raw output ログが specs/<spec>/tests/.raw/test-execution.log に保存される (.tmp/ から移動)。.gitignore で除外しないことで spec 内成果物として保持される。finalize-commit でのコミット境界は R19 で扱う
- R34 [should]: src/lib/flow-store.js の setTestSummary および parent.test.summary 集計ロジックは本 spec ではレガシー互換のため残す。新 report は使わないが、既存テスト (test-summary-aggregate.test.js 等) は変更しない。クリーンアップは別 spec で扱う
- R35 [must]: src/flow/prompts/task/impl.md および task/review.md から test 実行指示を削除。task subflow は production code 実装と code review のみで、テスト実行は spec 単位の test-execute step に集約する (R13 と整合)
- R36 [must]: src/presets/base/guardrail.json の spec-test-coverage guardrail から phase 'task-impl' を削除、もしくは task-impl 用には『テスト宣言 (header) のみ要求、pass/fail 検証は integration の test-execute に委ねる』に書き換える。task-impl gate がテスト実行を期待する状態を解消
- R37 [must]: report lifecycle の確定: report 生成は finalize-commit の post-hook から retro 呼び出しのみ削除し、report 生成は post-hook に残す。これにより retro が mainline 化されても report.json は finalize 時に生成され、`sdd-forge flow report show` が動作する。post-hook 更新は『retro 呼び出し削除』『report 呼び出し維持』
- R38 [must]: src/flow/prompts/impl/finalize-commit.md の post-hook 説明から retro 呼び出しを削除。report / issue comment / artifact commit は維持。test artifact のコミット境界 (R19) も明記
- R39 [must]: src/flow/prompts/impl/finalize-cleanup.md の `sdd-forge flow report show` 指示は維持される (R37 で report 生成は post-hook に残るため)。ただし retro.json 生成タイミングが mainline 化に伴って変わる点を明記
- R40 [must]: src/flow/lib/get-prompt.js の finalize.steps 定義から『Retrospective (retro)』を finalize choice として表示している箇所を削除し、新 lifecycle (implement → test-execute → test-result-review → review → gate-impl → retro → finalize-commit → finalize-merge → finalize-sync → finalize-cleanup) を反映
- R41 [must]: test-execute-result.json / test-result-review.json / retro.json の persisted artifact JSON schema を src/flow/schemas/ に新規追加 (test-execute-result.schema.json, test-result-review.schema.json, retro.schema.json)。run-test-execute / run-test-result-review / run-gate / run-retro / run-report / commands/report.js は consume 前にスキーマ validation を行う
- R42 [should]: src/flow/lib/get-status.js の step progress 集計を flatten nested steps に対応させる。現状 state.steps.filter(...) は top-level のみカウントするため、nested impl phase children (test-execute / test-result-review / retro 含む) を正確に反映する集計ロジックに更新
- R43 [must]: src/flow/prompts/impl/gate-impl.md の `sdd-forge flow run gate --phase task-impl` ハードコードを更新し、flow-level gate-impl は `--phase integration` (もしくは省略して state inference) を使うように修正。task subflow gate-impl は `--phase task-impl` を維持
- R44 [must]: src/flow/lib/gate-step.js の gate phase resolver を更新し、in-progress flow-level `gate-impl` と task-level `gate-impl` を区別する。tests/unit/flow/gate-phase-inference.test.js (もしくは同等) にテスト追加
- R45 [must]: src/presets/*/guardrail.json の guardrail で phase に 'task-impl' を含むテスト関連エントリを全 preset で audit。runtime PASS/FAIL 期待がある guardrail は integration phase に移動し、task-impl は diff/header のみとする
- R46 [must]: 新 step (test-execute, test-result-review, retro) の registry エントリに post hook を定義し、command 実行成功時に `flow set step <id> done` を自動実行する (既存の review/gate post-hook パターンと整合)。prompt 内で手動 `flow set step done` を要求しない
- R47 [must]: test-execute / test-result-review / retro / report の各 step が再実行された場合の artifact 上書きポリシー: 各 step は呼ばれるたびに自身の artifact を無条件上書きする (test-execute は test-execute-result.json と raw output、test-result-review は test-result-review.json、retro は retro.json、report は report.json)。retro の `--force` フラグは mainline 化に伴って必須化する (もしくは内部的に常に force=true 扱い)
- R48 [must]: verdict 値は全て小文字 ('pass', 'fail') に統一。test-result-review.schema.json の enum を lowercase に固定し、関連 prompt / requirement / data flow 記述も lowercase に揃える
- R49 [must]: src/templates/skills/sdd-forge.flow/SKILL.md から `flow run tests` 関連記述 (baseline test capture) を削除。新 lifecycle (implement → test-execute → test-result-review → review → gate-impl → retro → finalize-*) を反映 (R22 の対象範囲を拡張)
- R50 [should]: e2e lifecycle whitelist 更新対象ファイルを明示: tests/e2e/231-task-e2e-full-lifecycle.test.js, tests/e2e/227-forest-e2e.test.js, tests/e2e/flow/gate-impl-integration.test.js (R23 の対象を具体化)
- R51 [should]: tests/unit/flow/run-finalize-retro-commit-scope.test.js (もしくは同等の commit-scope regression test) を更新し、新 artifact (test-execute-result.json, raw output, test-result-review.json, retro.json) のコミット境界 (R19) を verify する
- R52 [must]: 本 spec の verification テストは specs/251-ai-test-exec/tests/ 配下に配置し、各テストファイル先頭に `// spec: R<N>` ヘッダーを記載する (各 task の acceptance に明記済み)。既存テスト更新 (tests/unit/flow/*.test.js, tests/e2e/*.test.js) は本 spec の影響範囲としての修正で、これらは spec verification テストではなく project-level regression テスト
- R53 [must]: 本 spec の変更は alpha 期間ポリシー (CLAUDE.md: 後方互換コードを書かない) に基づき、後方互換性を維持しない。マイグレーション計画: (1) 旧 finalize post-hook retro 呼び出しは新 mainline retro step に置換、進行中 flow が本変更マージ後に finalize-commit 段階に到達した場合は手動で `sdd-forge flow set step retro done` を実行する手順を CHANGELOG に明記。(2) `sdd-forge flow run retro` コマンド自体は引数互換 (--force, --dry-run) を維持。(3) test-execute-result.json / test-result-review.json は新規ファイルなので既存に影響なし。これらの破壊的変更は alpha 版での仕様変更として CHANGELOG に明記する
- R54 [must]: 新コマンド (sdd-forge flow run test-execute, test-result-review) および既存コマンド (flow run retro) の exit code contract: (1) 成功時 = 0、(2) ユーザー起因エラー (前提条件未達 = 結果ファイル不在、test command 発見不能、artifact 不正) = 1 (EXIT_ERROR)、(3) 内部エラー (agent invocation 失敗、JSON parse 失敗) = 1 (EXIT_ERROR)、(4) gate / review FAIL verdict は exit 0 で envelope.ok=false を返す (既存 gate/review のパターンと整合)
- R55 [must]: 新コマンド (sdd-forge flow run test-execute, test-result-review) は AI agent / skill 駆動の internal automation コマンドであり、user-facing CLI 引数を持たない (引数なし、もしくは既存 flow run の共通オプションのみ)。registry.js のエントリには args: { flags: [], options: [] } を明示し、ユーザー入力のバリデーションは flow state の前提条件チェック (test-execute step が in_progress であること等) で行う

## Acceptance Criteria
- 本 spec のテスト実行が test-execute step (= AI agent invocation) 経由で行われ、retro が結果ファイルを読むだけになっている (現行の execFileSync 経路が無くなっている)
- definition.js の impl phase children が implement → test-execute → test-result-review → review-impl → gate-impl → retro の順になっている
- implement step / review-impl / gate-impl / retro の各 prompt にテスト実行指示が含まれていない
- test-execute-result.json と test-result-review.json のスキーマが requirements.R2 / R3 通り
- req-map.js から TAP 系 3 関数が削除され、tests/unit/flow/req-map*.test.js もこれら関数のテストが削除されている
- test-review が header 宣言欠落および header lie を finalGaps に inject して verdict=FAIL を出す
- regression test (R14) が test-execute 以外の step ファイルでテストランナー呼び出しが無いことを verify する
- test-execute step が呼ばれた時、result file が無条件上書きされる (キャッシュ無し)
- 本変更後の sdd-forge 自身の `npm test` が PASS する (本 spec のテストファイルも新ヘッダー規約 + test-execute 経由で実行できる)

## Implementation Targets
-

## Open Questions
- [ ] test-execute の AI agent profile / session 分離の実装詳細 (executor / reviewer の config 設計、別モデル切替メカニズム)
- [ ] raw output ログのライフサイクル (1 spec 完了後の保管方針、サイズ上限)
- [ ] 既存テストのうち header 宣言が無いものへのマイグレーション戦略 (本 spec では新規/進行中 spec のみ対象、既存 finalize 済みは触らない方針)

## Tasks
### Round 0
- **T-1** [pending]: Add test-execute FlowNode to definition.js
  - FLOW_DEFINITION の impl phase children に test-execute step (新規 FlowNode) を追加する
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Add test-result-review FlowNode to definition.js
  - FLOW_DEFINITION の impl phase children に test-result-review step (新規 FlowNode) を追加する
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Promote retro to mainline impl phase step in definition.js
  - 現状 finalize の post-commit hook で実行される retro を FLOW_DEFINITION の impl phase children の leaf step として追加する
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Reorder impl phase steps in definition.js
  - definition.js の impl phase children の順序を implement → test-execute → test-result-review → review-impl → gate-impl → retro に再構成する
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Implement test-execute command and prompt
  - src/flow/lib/run-test-execute.js を新規作成し、AI agent が test command を発見して実行、結果を test-execute-result.json と raw output ログに保存する
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Implement test-result-review command and prompt
  - src/flow/lib/run-test-result-review.js を新規作成し、test-execute-result.json と raw output を実コードと突合してハルシネーション検出 + summary 完備性検証を行う
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Simplify retro tryStaticEvaluation to result file reader
  - src/flow/lib/run-retro.js から execFileSync('node --test') と TAP パース関連を削除し、test-execute-result.json を読んで要件単位の done/not_done を集計するだけにする
  - see `tasks/T-7.md` for full spec
- **T-8** [pending]: Remove retro post-commit hook from run-finalize.js
  - src/flow/lib/run-finalize.js:151-159 の post-commit retro 呼び出しを削除する
  - see `tasks/T-8.md` for full spec
- **T-9** [pending]: Remove TAP helpers from req-map.js
  - src/flow/lib/req-map.js から parseTapOutput / extractReqResults / evaluateReqByResults を削除する
  - see `tasks/T-9.md` for full spec
- **T-10** [pending]: Remove test execution instructions from implement prompt
  - src/flow/prompts/impl/implement.md から `npm test` / `node --test` 実行指示を削除し、implement step が test 実行をしないことを明示する
  - see `tasks/T-10.md` for full spec
- **T-11** [pending]: Inject deterministic header gaps via validateTestHeaders helper
  - src/flow/commands/review.js を更新し、src/flow/lib/test-headers.js の validateTestHeaders ヘルパー (uncoveredRequirements / headerNoTest / testNoHeader) を呼んで結果を finalGaps に deterministic に inject する
  - see `tasks/T-11.md` for full spec
- **T-12** [pending]: Add semantic header-lie detection to AI gap analysis
  - src/flow/commands/review.js の buildGapAnalysisPrompt に semantic header-lie 検出指示を追加し、AI が宣言と内容の意味的な不整合を検出した場合 finalGaps に inject する
  - see `tasks/T-12.md` for full spec
- **T-13** [pending]: Register new commands in flow registry and next-action mapping
  - src/flow/registry.js に run-test-execute / run-test-result-review コマンドを登録し、src/flow/lib/get-next-action.js が新 step の instructionsKey マッピングを認識するよう更新する
  - see `tasks/T-13.md` for full spec
- **T-14** [pending]: Add static enforcement test for single-execution-point rule
  - regression test を追加し、test-execute 以外の step ファイル (run-retro.js, run-gate.js, review.js) が node --test / npm test / jest / pytest / phpunit を直接 invoke していないことを grep で verify する
  - see `tasks/T-14.md` for full spec
- **T-15** [pending]: Add retro prompt for mainline impl step
  - src/flow/prompts/impl/retro.md を新規作成し、retro が mainline step として動作するための AI agent 指示を提供する
  - see `tasks/T-15.md` for full spec
- **T-16** [pending]: Update gate-impl to consume reviewed test artifacts
  - src/flow/lib/run-gate.js の gate-impl phase ロジックを更新し、test-result-review.json.verdict と test-execute-result.json を入力として要件カバレッジ判定する
  - see `tasks/T-16.md` for full spec
- **T-17** [pending]: Reset downstream steps when review applies fixes
  - src/flow/lib/run-review.js (および関連 prompt) を更新し、review (impl phase) で fix を適用してコードが変更された場合、test-execute / test-result-review / gate-impl / retro を pending にリセットして再実行を強制する
  - see `tasks/T-17.md` for full spec
- **T-18** [pending]: Remove finalize routing from review next transition
  - src/flow/lib/run-review.js の review 完了後の next 値から 'finalize' / 'apply' を削除し、definition.js の next-action 駆動に完全委譲する
  - see `tasks/T-18.md` for full spec
- **T-19** [pending]: Adjust finalize-commit artifact boundary
  - src/flow/lib/run-finalize-commit.js のコミット境界を見直し、test-execute-result.json / raw output ログ / test-result-review.json / retro.json を implementation commit に含めない
  - see `tasks/T-19.md` for full spec
- **T-20** [pending]: Integrate new test artifacts into report generation
  - src/flow/lib/run-report.js を改修し、retro.json + test-execute-result.json + test-result-review.json を入力として report に統合する
  - see `tasks/T-20.md` for full spec
- **T-21** [pending]: Update test-only auto skip path to run new test steps
  - test-only auto skip path (production code 実装をスキップする経路) を更新し、test-execute / test-result-review は必ず実行するようにする
  - see `tasks/T-21.md` for full spec
- **T-22** [pending]: Update sdd-forge.flow skill template
  - src/templates/skills/sdd-forge.flow/SKILL.md の hardcoded 旧 flow 記述を新 mainline step 記述に更新する
  - see `tasks/T-22.md` for full spec
- **T-23** [pending]: Update existing finalize-retro invocation tests
  - tests/unit/flow/run-finalize-retro-invocation.test.js を新仕様 (retro が finalize post-hook では呼ばれない) に合わせて削除または書き換える
  - see `tasks/T-23.md` for full spec
- **T-24** [pending]: Update step order assumptions in existing tests
  - tests/unit/flow/commands/review.test.js および関連 e2e lifecycle whitelist が impl phase 新 step 順序 (implement → test-execute → test-result-review → review → gate-impl → retro) を前提とするよう更新する
  - see `tasks/T-24.md` for full spec
- **T-25** [pending]: Remove retro/report from finalize-commit post hook in registry.js
  - src/flow/registry.js の finalize-commit.post hook (executeCommitPost) を更新し、retro / report 呼び出しを削除する。help テキストも整合する
  - see `tasks/T-25.md` for full spec
- **T-26** [pending]: Update gate next-step maps for new step order
  - src/flow/lib/run-gate.js の PASS_NEXT / FAIL_NEXT マップを新 step 順序に合わせて更新する
  - see `tasks/T-26.md` for full spec
- **T-27** [pending]: Migrate commands/report.js to read new test artifacts
  - src/flow/commands/report.js (実 report 生成) を retro.json + test-execute-result.json + test-result-review.json から直接読み取るよう更新する
  - see `tasks/T-27.md` for full spec
- **T-28** [pending]: Remove test re-run instructions from impl review prompt
  - src/flow/prompts/impl/review.md から既存の『Re-run tests to confirm no regressions』指示を削除する
  - see `tasks/T-28.md` for full spec
- **T-29** [pending]: Remove test execution instruction from plan test prompt
  - src/flow/prompts/plan/test.md の `node --test specs/<spec>/tests/*.test.js` 実行指示を削除する
  - see `tasks/T-29.md` for full spec
- **T-30** [pending]: Distinguish task-impl gate from integration gate
  - gate-impl の挙動を task-impl scope と integration scope で区別する: task-impl は diff/guardrail のみ、integration が test-result-review.json + test-execute-result.json を消費する
  - see `tasks/T-30.md` for full spec
- **T-31** [pending]: Add next-action schemas for new steps
  - src/flow/schemas/next-action/ に test-execute.schema.json, test-result-review.schema.json, retro.schema.json を新規追加し、definition.js の対応 FlowNode で outputSchemaRef として参照する
  - see `tasks/T-31.md` for full spec
- **T-32** [pending]: Move raw output log into spec directory
  - raw output ログの配置を .tmp/test-execution-<spec>.log から specs/<spec>/tests/.raw/test-execution.log に変更する
  - see `tasks/T-32.md` for full spec
- **T-33** [pending]: Remove test instructions from task subflow prompts
  - src/flow/prompts/task/impl.md および task/review.md から test 実行指示を削除し、task subflow がテスト実行をしないようにする
  - see `tasks/T-33.md` for full spec
- **T-34** [pending]: Update spec-test-coverage guardrail to exclude task-impl test execution
  - src/presets/base/guardrail.json の spec-test-coverage guardrail を更新し、task-impl phase ではテスト pass を要求しないようにする
  - see `tasks/T-34.md` for full spec
- **T-35** [pending]: Keep report generation in finalize-commit post-hook
  - src/flow/lib/run-finalize.js の finalize-commit post-hook から retro 呼び出しのみ削除し、report 生成 / issue comment / artifact commit は維持する。report.json が finalize 時に生成され、sdd-forge flow report show が動作することを保証
  - see `tasks/T-35.md` for full spec
- **T-36** [pending]: Update finalize-commit prompt to reflect new post-hook scope
  - src/flow/prompts/impl/finalize-commit.md の post-hook 説明から retro 呼び出しを削除し、report / issue comment / artifact commit を維持する旨と test artifact の commit 境界を明記する
  - see `tasks/T-36.md` for full spec
- **T-37** [pending]: Update get-prompt.js finalize choices to reflect new lifecycle
  - src/flow/lib/get-prompt.js の finalize.steps 定義から『Retrospective (retro)』を finalize choice として表示する箇所を削除し、新 lifecycle を反映する
  - see `tasks/T-37.md` for full spec
- **T-38** [pending]: Add persisted artifact JSON schemas
  - src/flow/schemas/ に test-execute-result.schema.json, test-result-review.schema.json, retro.schema.json を新規追加し、各 consumer (run-test-execute / run-test-result-review / run-gate / run-retro / run-report / commands/report.js) で consume 前にスキーマ validation を行う
  - see `tasks/T-38.md` for full spec
- **T-39** [pending]: Flatten nested steps in status progress aggregation
  - src/flow/lib/get-status.js の step progress 集計を flatten nested steps に対応させ、impl phase の nested children (test-execute / test-result-review / retro 等) を正確にカウントする
  - see `tasks/T-39.md` for full spec
- **T-40** [pending]: Update gate-impl prompt phase reference
  - src/flow/prompts/impl/gate-impl.md のハードコード `--phase task-impl` を更新し、flow-level gate-impl は `--phase integration` (or 省略) を使うようにする
  - see `tasks/T-40.md` for full spec
- **T-41** [pending]: Update gate-step phase resolver for new flow context
  - src/flow/lib/gate-step.js の resolveGateStepId / resolveGatePhaseFromState を更新し、flow-level (integration) と task-level の gate-impl phase を正しく区別する
  - see `tasks/T-41.md` for full spec
- **T-42** [pending]: Audit and update preset guardrails for task-impl test expectations
  - src/presets/*/guardrail.json の guardrail で phase に 'task-impl' を含むテスト関連エントリを全 preset で audit し、runtime PASS/FAIL 期待を持つものは integration phase に移動する
  - see `tasks/T-42.md` for full spec
- **T-43** [pending]: Wire post hooks to mark new steps done on success
  - src/flow/registry.js の test-execute / test-result-review / retro エントリに post hook を定義し、command 実行成功時に対応 step を done にマークする (既存 review/gate パターンと整合)
  - see `tasks/T-43.md` for full spec
- **T-44** [pending]: Standardize verdict casing to lowercase
  - test-result-review.json の verdict および関連 prompt / requirement / data flow 記述を全て lowercase ('pass', 'fail') に統一する
  - see `tasks/T-44.md` for full spec
