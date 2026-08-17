# Feature Specification: 208-flow-plan-auto-check

**Feature Branch**: `feature/208-flow-plan-auto-check`
**Created**: 2026-04-21
**Status**: Draft
**Input**: GitHub Issue #205

## Goal
flow-plan 開始時（branch 選択より前）に auto モード可否を静的ゲート + AI スコアリングのハイブリッドで判定し、可能時のみ「Auto モードで進めますか?」を提示する。可 + はい選択で環境選択も自動化して真のワンショット auto 実行を実現する。

## Background
現状の flow-plan では auto モードへの切替は `/sdd-forge.flow-auto on` を明示的に叩く必要があり、事前に auto が妥当なタスクかを判断する仕組みが無い。結果として低リスクタスクでも人間確認が挟まり、高リスクタスクで安易に auto が有効化されるリスクがある。Issue #205 はこれを解消するため、flow-plan 開始時点で入手可能な入力テキスト（request / Issue body）のみから判定を行うハイブリッドチェック機構を導入する。

## Scope
- 新 CLI `sdd-forge flow run auto-check`：入力テキストから静的ゲート + AI スコアリングで eligible/score/breakdown/staticGates/reason を返す
- flow.json への `autoCheck` フィールド保存（auto 可/不可に関わらず常時記録）
- `sdd-forge flow set auto on` の内部で auto-check を強制実行し、eligible:false なら非 0 exit
- flow skill の Prelude 冒頭に auto-check 呼出を追加し、eligible 時のみ「Auto モードで進めますか?」を提示する分岐を組み込む
- auto 可 + はい選択時は環境選択（work-environment / base-branch）をスキップし、worktree + 現ブランチを既定採用する
- Draft Q1 の概要表示フォーマットを Goal + Scope + 1–3 行説明文に統一する（auto-check 表示との形式一致）

## Out of Scope
- auto 実行中の「よしな」補完防止 → 別 board 項目（ログ→guardrail 学習機構）が担当
- auto-check AI プロンプトの精度向上・学習機構
- 静的ゲートのキーワード辞書の多言語化・拡張メンテ（初期セットのみ実装）
- auto-check を flow-plan 以外（review / finalize 等）から呼び出す拡張
- flow.json スキーマの version 機構導入

## Constraints
- 外部依存なし（Node.js 組み込みモジュールのみ）
- alpha ポリシー: 後方互換コードを書かない。既存の `flow set auto on`（無条件有効化）は廃止して新挙動で置換する
- AI 呼び出しは 1 回あたり最大 1 コール（agent.call の spawn コストを考慮）
- AI タイムアウトは既存 `config.agent.timeout` に従う
- 静的ゲートは同期処理で完結させ、AI 未設定環境でも staticGates 部分は動作させる
- 内部インターフェースは信頼し、バリデーションはシステム境界でのみ行う

## Design Principles
- シンプルなインターフェースに十分な実装を隠す：skill は薄く、CLI 層に判定ロジックを集約
- single-source-of-truth: 判定結果は flow.json の autoCheck フィールドのみに記録（別ファイル分散しない）
- isolation by spawn: AI 呼び出しは既存 stateless な agent.call を用い、親会話文脈を引き継がない
- 保守寄りの静的ゲート: 曖昧な場合は auto 不可側に倒す
- スコア構造は audit-friendly: 将来の学習機構が横断的に参照できるよう判定根拠を欠損なく残す

## Overview
### Modules
- src/flow/lib/run-auto-check.js — 新規。`flow run auto-check` コマンド実装。静的ゲート + AI 呼出のオーケストレーション
- src/flow/lib/auto-check-static.js — 新規。静的ゲート（G/H/I）のキーワードマッチャー。同期関数として exports
- run-auto-check.js 内に PROMPT_TEMPLATE 定数として AI スコアリング用プロンプトをインライン保持（step instruction ではないため src/flow/prompts/ 配下に置かない）
- src/flow/lib/set-auto.js — 修正。value='on' 時に run-auto-check を呼び、eligible:false なら throw
- src/flow/registry.js — 修正。run.auto-check エントリを追加（pre/post フックなし、ステップ非連動）
- src/templates/skills/sdd-forge.flow/SKILL.md — 修正。Prelude 冒頭に auto-check 分岐を挿入、Draft Q1 のフォーマット統一を追記

### Data Flow
- flow skill 起動 → `sdd-forge flow run auto-check --input <text>` → 静的ゲート評価（同期） → ハードゲート非該当なら AI 呼出（agent.call） → 結果 JSON 出力 + flow.json の autoCheck に書き込み
- flow set auto on → set-auto.js 内で flow state から request/issue を取得 → run-auto-check を内部呼出 → eligible:false なら Error throw（CLI は非 0 exit + stderr）
- flow skill Prelude → auto-check 結果が eligible:true なら『Auto モードで進めますか?』を提示 → ユーザー [1] 選択 → 環境=worktree+現ブランチ で prepare-spec

### Decisions
- 判定対象は flow-plan 開始時点で入手可能なテキストのみ（request text / Issue body）。対象コードは未確定のため参照しない
- breakdown は記述名で保存（specBuildability / ambiguity / verifiability / scopeBoundedness / targetSpecificity / precedent）
- 静的ゲート（G/H/I）はキーワード検出ベースで初期実装。辞書は日英両対応で最小セット
- AI スコアリングは既存 agent.call 経由。stateless spawn で isolation を確保
- flow.json の autoCheck フィールドは auto 可/不可に関わらず常に書き込み
- `flow set auto on` は CLI 層で auto-check を強制。bypass オプションは設けない
- prelude は flow-state 作成（set init）後、prepare-spec より前に auto-check を実行する

## Clarifications (Q&A)
- Q: 判定対象は入力テキストのみでよいか（対象コードは参照しないか）
  - A: はい。flow-plan 開始時点では spec も実装対象も未確定のため、request text / Issue body のみを見る
- Q: AI isolation の実装根拠
  - A: 既存 `src/lib/agent.js` の agent.call は provider を spawn する stateless 呼出で、各呼出間に state を持たない。これで『isolated call』要件を満たせる
- Q: 判定結果の保存場所
  - A: flow.json の autoCheck フィールドに一元化。別ファイルに分散しない
- Q: breakdown のキー名
  - A: 記述名（specBuildability / ambiguity / verifiability / scopeBoundedness / targetSpecificity / precedent）。英字コードは使わない
- Q: auto 不可時もログを残すか
  - A: 残す。可/不可問わず全件 flow.json に記録。将来の学習機構の audit 素材
- Q: flow-auto skill との連携
  - A: CLI 層（set-auto.js）で auto-check を強制実行。skill は薄いまま。bypass オプションは用意しない
- Q: AI 呼出失敗時の振る舞い
  - A: eligible:false として扱い、reason に失敗理由を記録。skill は通常の auto 不可パスとして処理
- Q: 既存 `flow set auto on` 利用者への移行計画
  - A: alpha 版ポリシーに従い後方互換コードは提供しない。本変更は破壊的変更であり、リリースノート（CHANGELOG）で告知する。bypass フラグは設けない。既存フロー進行中の flow.json は autoCheck フィールド欠落を許容するため中断なく継続できる。新しい挙動に対応するため、ユーザーは `sdd-forge upgrade` を実行して `.claude/skills/` 配下の flow skill を最新化する必要がある（skill テンプレートに Prelude の auto-check 分岐が含まれるため）
- Q: 既存 flow.json に autoCheck フィールドを後付けする際の互換性
  - A: flow state は JSON オブジェクトとして緩やかに読み書きされており、未知フィールドの追加は既存コードに影響しない。`autoCheck` 未設定の flow.json は従来どおり読める。新フィールドへの参照側（get-status / audit）では `state.autoCheck ?? null` で扱う

## Alternatives Considered
- skill 側で auto-check を呼んでから flow set auto on — bypass されうる。CLI 層強制のほうが強い invariant を提供。却下
- breakdown を英字コード（B/C/D/E/F/J）のまま保存 — guardrail Unambiguous Requirements 違反。audit 時に記述名のほうが verifiable。却下
- 静的ゲートを AI 側に寄せて LLM で判定 — 低速 + 非決定的 + コスト増。保守側に倒したキーワード検出のほうが速い・決定的。却下
- auto-check 結果を flow.json とは別の log ファイル (jsonl) にも二重記録 — single-source-of-truth 破壊。flow.json の autoCheck で十分。却下

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-21
- Notes: auto mode; user explicitly enabled via "use auto mode"

## Requirements
- R1 [must]: When ユーザーが `sdd-forge flow run auto-check` を実行したとき、CLI は入力テキスト（`--input <text>` または flow.json の request/issue）を受理して判定を行い、`{ eligible, score, maxScore, threshold, breakdown, staticGates, reason }` の JSON envelope を出力する
- R2 [must]: When 静的ゲート（G=高リスク語 / H=外部契約語 / I=矛盾表現）のいずれかに該当したとき、auto-check は AI 呼出をスキップし `eligible: false` と該当カテゴリを `staticGates` に記録する
- R3 [must]: When 静的ゲートを通過し AI 呼出が可能なとき、auto-check は既存 agent.call を stateless に 1 回呼び出し、specBuildability / ambiguity / verifiability / scopeBoundedness / targetSpecificity / precedent の整数スコアと reason を取得する
- R4 [must]: When AI スコアリングで specBuildability / ambiguity / verifiability のいずれかが 0 のとき、総スコアが閾値以上でも `eligible: false` を返す（ハードゲート）
- R5 [must]: When AI スコアリング総合点が閾値 18/24（75%）以上かつハードゲートをすべて通過したとき、`eligible: true` を返す
- R6 [must]: When auto-check が完了したとき、判定結果（eligible / score / maxScore / threshold / breakdown / staticGates / reason）を flow.json の `autoCheck` フィールドに書き込む。auto 可/不可に関わらず常に記録する
- R7 [must]: When 既存 flow.json を読み込んだとき、`autoCheck` フィールドが欠落していてもエラーなく読めること
- R8 [must]: When ユーザーが `sdd-forge flow set auto on` を実行したとき、set-auto は内部で auto-check を呼び出す
- R9 [must]: If auto-check が `eligible: false` を返した場合、`flow set auto on` は autoApprove を更新せず、非 0 の exit code と理由メッセージを stderr に出力して終了する
- R10 [must]: When flow skill の Prelude が開始したとき、set init の直後・prepare-spec の直前に auto-check を呼び出し、結果に応じて分岐する（可+はい→環境選択スキップ / 可+いいえ→現行フロー / 不可→現行フロー、新プロンプト表示なし）
- R11 [must]: When auto-check が eligible:true を返しユーザーが「はい」を選択したとき、flow skill は work-environment / base-branch 選択をスキップし、worktree=true + base-branch=現ブランチ で prepare-spec を実行する
- R12 [should]: When Draft Q1（Issue 解釈確認）を表示するとき、flow skill は Goal + Scope + 1–3 行説明文のフォーマットを用いる（auto-check プロンプトと同じ形式）
- R13 [must]: When auto-check 用の AI 呼出がタイムアウト・失敗したとき、CLI は `eligible: false` と失敗理由を reason に含めて返す（skill 側は通常の auto 不可分岐として扱える）
- R14 [should]: When 静的ゲートの判定を行うとき、キーワード辞書は日英両対応で構成され、最低限 G（security/auth/password/token/credential/migration/delete/drop/destructive/npm publish/release）、H（CLI signature/breaking change/API contract/public interface）、I（反転語×2 以上の共起）を検出する

## Acceptance Criteria
- `sdd-forge flow run auto-check --input "<text>"` が `{ eligible, score, maxScore, threshold, breakdown, staticGates, reason }` JSON envelope を返す
- 静的ゲート該当入力（例: 本文に『password migration』含む）では AI 呼出をスキップして `eligible: false` + `staticGates.G: true` を返す
- AI スコア合計が 18 未満 または specBuildability/ambiguity/verifiability が 0 の入力で `eligible: false` を返す
- auto-check 実行後、flow.json の `autoCheck` フィールドに結果一式が永続化される（auto 可/不可問わず）
- `sdd-forge flow set auto on` が eligible:false な状況で非 0 exit code と stderr メッセージを出して終了する（autoApprove は false のまま）
- `sdd-forge flow set auto on` が eligible:true な状況で従来どおり autoApprove を true に更新する
- flow skill SKILL.md に Prelude 冒頭の auto-check ステップと『Auto モードで進めますか?』分岐が記述され、`sdd-forge upgrade` でユーザーの `.claude/skills/` に反映される
- 既存 flow.json（autoCheck フィールド無し）を `flow get status` で読み込んでもエラーにならない
- 既存テストスイート（npm test）が regression なく PASS する
- 新規テスト: 静的ゲート単体（G/H/I の hit/no-hit）、auto-check CLI（AI スタブ経由で eligible 判定分岐）、`flow set auto on` の拒否動作

## Implementation Targets
- src/flow/lib/run-auto-check.js
- src/flow/lib/auto-check-static.js
- src/flow/lib/set-auto.js
- src/flow/registry.js
- src/templates/skills/sdd-forge.flow/SKILL.md

## Open Questions
- [ ]
