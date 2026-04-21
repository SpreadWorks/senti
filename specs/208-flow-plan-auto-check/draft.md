---
spec: 208-flow-plan-auto-check
issue: 205
---

# Draft: flow-plan 開始時の auto モード判定

**開発種別:** 機能追加（CLI 拡張 + flow skill UX 変更）

**目的:** flow-plan 開始時（branch 選択より前）に auto モード可否を判定し、可能時のみ「Auto モードで進めますか?」を提示する。可 + はい選択 → 環境選択も自動化し、真のワンショット auto 実行を実現する。

## 背景

現状の flow-plan では auto モードへの切替は `/sdd-forge.flow-auto on` を明示的に叩く必要があり、事前に auto が妥当なタスクかを判断する仕組みが無い。結果として低リスクなタスクでも人間確認が挟まる、または高リスクなタスクで安易に auto を有効化してしまう恐れがある。

## 要件（優先順位順）

### R1（必須）: auto-check CLI の新設

- When ユーザーが `sdd-forge flow run auto-check` を実行したとき, shall 新 CLI コマンドがこれを受理する。
- When auto-check が呼び出されたとき, shall 入力を flow-plan 開始時点で入手可能なテキスト（request text / Issue body）に限定する。
- When 判定が完了したとき, shall `{ eligible, score, maxScore, threshold, breakdown, staticGates, reason }` を JSON envelope で出力する。
- When 判定を行うとき, shall 静的ゲート（ハードゲート）と AI スコアリング（ソフトゲート）のハイブリッドで行う。
- If 静的ゲートに該当する or AI スコアが閾値未満, shall `eligible: false` を返す。

### R2（必須）: flow.json への結果保存

- When auto-check が完了したとき, shall 結果を flow.json の `autoCheck` フィールドに書き込む（eligible の真偽を問わず常に記録）。
- When 既存 flow.json を読み込んだとき, shall `autoCheck` フィールドが欠落していてもエラーなく読めること。
- When 結果を保存するとき, shall 判定根拠（breakdown / staticGates / reason）を欠損なく残す。

### R3（必須）: flow-plan skill の分岐追加

- When auto-check が `eligible: true` を返し、かつユーザーが「はい」を選択したとき, shall 環境選択（worktree / base-branch）を自動化して prepare-spec に進む。
- When auto-check が `eligible: true` を返し、かつユーザーが「いいえ」を選択したとき, shall 現行フロー（work-environment 質問）へ進む。
- When auto-check が `eligible: false` を返したとき, shall 新プロンプトを表示せず、現行フロー（work-environment 質問）へ進む。
- When 概要を表示するとき, shall Goal + Scope + 1–3 行の説明文フォーマットに統一する。

### R4（必須）: flow-auto skill 連携

- When ユーザーが `sdd-forge flow set auto on` を実行したとき, shall CLI 内部で auto-check を実行する。
- If auto-check が `eligible: false` を返した場合, shall `flow set auto on` は非 0 の exit code と理由メッセージを返して終了する。
- When 本機能をリリースするとき, shall 破壊的変更として移行計画（本 draft「互換性・移行」節）を併記する。

### R5（推奨）: Draft Q1 フォーマット統一

- When flow-plan の最初の確認（現行の「Issue 解釈確認」）を表示するとき, shall auto-check と同じ Goal + Scope + 説明文フォーマットを用いる。
- When Q1 の選択肢を提示するとき, shall 既存の選択肢（[1] はい / [2] 修正する / [3] その他）を維持する。

## 既存機能への影響

- `sdd-forge flow set auto on` は auto-check に通らない入力に対して失敗するように変わる。
- `/sdd-forge.flow-auto on` skill は内部で CLI を叩いているため同様に変わる。
- flow-plan skill の UX は auto 可判定時のみ追加プロンプトが増える。auto 不可時の UX は現行と完全一致。
- flow.json のスキーマに `autoCheck` フィールドが増える（省略時は従来どおり動作）。
- auto-check を飛ばして手動で flow を開始するパスは維持する（`flow prepare` 直叩き等）。

## 互換性・移行

- alpha 版ポリシーに従い、旧 `flow set auto on`（無条件有効化）の互換パスは提供しない。
- 新しい挙動は alpha リリースノートで告知する。
- auto-check を強制的にスキップしたい場合の隠しオプションは設けない（bypass 不可）。
- 既存の flow.json は `autoCheck` 欠落を許容するため、進行中フローは中断なく継続できる。

## Out of Scope

- auto 実行中の「よしな」補完防止 → 既存の「ログ → guardrail 学習」機構（別 board 項目）が担当する。
- auto-check 用 AI プロンプトの精度向上・学習機構 → 将来 spec。
- 静的ゲート判定に用いるキーワード辞書の拡張・多言語化 → 将来 spec（本 spec は初期セットのみ）。
- auto-check を flow-plan 以外（review / finalize 等）から呼び出す拡張 → 将来 spec。

## 制約 / 非機能要件

- 外部依存を増やさない（Node.js 組み込みのみ）。
- AI 呼び出しは 1 コマンド実行あたり最大 1 回。
- AI 呼び出しのタイムアウトは既存 `config.agent.timeout` に従う。
- 静的ゲートは同期処理で完結し、AI 未設定環境でも `staticGates` 部分は動作すること。

## テスト戦略

- **静的ゲート単体テスト**: 各カテゴリ (G/H/I) について hit / no-hit ケースをカバー。日本語・英語の両方。
- **auto-check CLI テスト**: AI 応答をスタブ化し、入力テキスト → eligible / score / breakdown の変換を検証。ハードゲート発火（特定スコアが 0）時に閾値を超えていても `eligible: false` になることを確認。
- **flow set auto on の拒否**: `eligible: false` 時に exit code 非 0 と理由メッセージが出ることを検証。
- **flow.json 書き込み**: auto 可/不可両方で `autoCheck` が保存されることを検証。
- **flow-plan skill 統合**: 手動検証で確認（skill は AI が実行するため自動化困難）。CLI の契約を固めることで担保する。

## Open Questions

なし（draft 段階で決定すべき論点は Q&A にてすべて解決）。

## Q&A

### Q1: Issue 解釈確認
**A:** ユーザー [1] はい。Goal / Scope / Out of Scope の解釈一致を確認。
**根拠:** Issue #205 本文の記載をそのまま踏襲。

### Q2: AI スコアリングの isolation 要件をどう満たすか
**A:** 既存の stateless な AI 呼び出し機構を使う（親会話を引き継がない呼び出し）。具体的な関数選定は spec で決定する。
**根拠:** 既存コードパターン（`src/lib/agent.js` はすでに stateless spawn で各呼び出しを隔離している）。加えてプロジェクトルール「外部依存なし」。

### Q3: 静的ゲートの検出対象
**A:** flow-plan 開始時点で入手可能な入力テキスト（request / Issue body）のみ。対象コードは未確定のため参照しない。検出は保守側（auto 不可側）に倒す。
**根拠:** Issue #205 の仕様（flow-plan 開始時＝branch 選択より前の判定）から、参照可能な情報が入力テキストに限られる。

### Q4: auto-check 結果の保存場所
**A:** flow.json の `autoCheck` フィールド。
**根拠:** 既存コードパターン（flow.json が flow state の single-source-of-truth）。別ファイルへの分散は CLAUDE.md「シンプルなインターフェースに十分な実装を隠す」方針に反する。

### Q5: breakdown のキー名
**A:** 記述名（例: specBuildability / ambiguity / verifiability / scopeBoundedness / targetSpecificity / precedent）を採用。
**根拠:** guardrail「Unambiguous Requirements」— 記述名のほうが audit 時に verifiable。英字コードは可読性を損なう。

### Q6: auto 不可時のログ記録
**A:** auto 可/不可に関わらず常に flow.json に記録する。
**根拠:** Issue #205 の「将来の guardrail 学習機構が参照」要件。学習データは全件残さないと傾向分析できない。

### Q7: flow-auto skill 連携方式
**A:** `sdd-forge flow set auto on` の CLI 内部で auto-check を強制実行。skill は薄いまま。bypass 不可。
**根拠:** CLAUDE.md「シンプルなインターフェースに十分な実装を隠す」。skill 側に判定責務を置くと bypass されうる。

## 承認

- [x] User approved this draft (2026-04-21)
