# Draft: 197-guardrail-3tier-format

**Development Type:** Enhancement（gate 評価インフラの決定論化 / cac6 分解タスク T3）

**Goal:** guardrail 評価系を「category によるグルーピング」「構造化 schema による評価出力」「level 付き gate report の統一フォーマット」の 3 点で決定論化し、旧 phase 名を新 phase 名（draft / spec / task-spec / task-impl / integration）へ置き換える。level 差分はチェック観点のみに閉じる。

## 背景

- cac6「親 spec + task 分解モデル」の評価系レイヤ（T3）。T2（spec 196 / flow-tasks-extension）で導入された task スコープ API 上に載る。
- 現状の guardrail 評価は自由テキスト行を正規表現パースしており、改行・記号ゆれで不安定。
- gate report の粒度が「spec 全体」しか無く、task / integration を区別できない。
- 旧 phase 名は親 spec 前提で、task 分解後の粒度を表現できない。

## ユーザーの意思決定ステータス

本 draft は「意思決定モード」で起票している。ブレインストーミングではなく、issue #184 の scope に沿った採否判断付きの要件整理であり、Q1 承認済み（2026-04-20, user 選択 [1]）。

## 事前調査（Explore Before Asking）

以下のコードベース・既存仕様を事前に読み、採否判断の根拠とした:

- 既存 gate 実装（gate 実行モジュール）の phase 分岐と guardrail パース動線 — 自由行パースと phase enum の具体値を確認。根拠: **既存コードパターン**。
- 既存 guardrail スキーマ（guardrail ローダと base preset guardrail 定義）の phase / merge 規則 — 新 phase 語彙・category の差し込み先を確認。根拠: **既存コードパターン**。
- 関連 issue #180 の diff-scope 制約 — task-impl / integration への継承要否を確認。根拠: **docs（issue log）**。
- T2（spec 196）仕様 — `tasks[]` / `currentTaskId` / origin 値（`plan | addition | integration`）に本 spec の level/phase が整合するかを確認。根拠: **docs（spec 196）**。
- guardrail phase 分類の原則（「Present Recommendations with Reasoning」「Explore Before Asking」等） — 採否判断の評価観点として適用。根拠: **guardrail 原則**。

## Q&A

- Q: guardrail の `category` は何に使うか？
  - A: 評価出力のグルーピング（同カテゴリの FAIL を集約表示）と、将来 level 別に有効/無効化するためのタグ。judgment_rules / fail_examples は導入しない。根拠: **issue #184 本文の明示指示**。
- Q: category の語彙は固定 enum か自由文字列か？
  - A: 固定 enum。初期セットは `requirements | code-quality | testing | security | process`。未指定 guardrail はデフォルトに `requirements` が割り当たる。根拠: **既存 preset の guardrail 分類傾向（preset 毎に同系統の観点が繰り返される）と、自由文字列化した際のブレ（既存コードパターンとの整合）**。
- Q: 評価出力の `result` 値は？
  - A: `pass | fail | skip`（小文字）。AI 出力用の語彙と、既存の報告結果用の大文字語彙（`PASS/FAIL/SKIP`）は層を分けて扱う。根拠: **既存の報告結果が大文字語彙を用いており、AI 出力と切り分ける方が層構造と整合する**。
- Q: AI の評価出力は構造化 schema に強制するか？
  - A: 強制。自由行解析は廃止。パース不能は即エラーとしサイレント PASS にしない。根拠: **issue #184 の決定論化目的 + guardrail「Unambiguous Requirements」原則**。
- Q: gate report の `level` 値は？
  - A: `parent | task | integration`。根拠: **issue #184 の明示指定**。
- Q: level と phase の対応は？
  - A: 以下 5 組のみ許容。根拠: **T2（spec 196）の task.origin enum (`plan | addition | integration`) と整合する粒度**。
    - When `level=parent`, then `phase` ∈ `{draft, spec}`
    - When `level=task`, then `phase` ∈ `{task-spec, task-impl}`
    - When `level=integration`, then `phase = integration`
- Q: 旧 phase 名はどう扱うか？
  - A: 旧 `pre / post / impl` は enum から削除し、呼び出し側を新名に追従する。根拠: **CLAUDE.md のプロジェクトルール「alpha 版ポリシー: 後方互換コードは書かない」**。
- Q: guardrail.json の `meta.phase` の語彙は？
  - A: 新 phase 名に揃える。既存 preset の `phase: ["impl"]` は task-impl に書き換える。根拠: **既存コードパターン（`meta.phase` 配列の語彙が preset 毎に統一されている）**。
- Q: 実行ロジック共通化の方針は？
  - A: level ごとの重複処理を共通化し、level 別の差分は「チェック観点」と「必須構造チェックの組合せ」のみに限定する。根拠: **CLAUDE.md「同じパターンが2箇所以上で繰り返される場合、共通ヘルパーに抽出」の原則**。
- Q: gate 結果の保存先は？
  - A: 既存の gate 結果格納経路（spec 配下の issue-log 成果物、gate 実行の返却成果物）を拡張する。新規ファイルは作らない。根拠: **既存コードパターンが現状の保存責務を担っており、責務を分散させないため**。

## 依存関係

- **T2 (spec 196 / flow-tasks-extension)**: 本 worktree の base に既マージ済。task スコープ API を前提に利用する。
- **T4 (評価 lint 除外系)**: 並列可。本 spec は lint phase を変更しない。

## 既存機能への影響

- When gate コマンドが新 phase 名で呼ばれたとき, gate は level フィールドを含む gate report を返し、旧 phase 名は invalid phase として拒否する。
- When guardrail.json が読み込まれるとき, 全エントリは新 phase 語彙と category enum を満たしていなければならず、満たさなければロード時にエラーとなる。
- When preset が旧 `meta.phase: ["impl"]` を保持しているとき, 一括書き換えの対象となり、更新後は新 phase 語彙で解釈される。
- When skill テンプレートが gate を呼び出すとき, 新 phase 名に更新された記述で呼ばれ、`sdd-forge upgrade` によって配布される。
- When Issue #180 由来の diff-scope 制約が適用されるとき, task-impl と integration の両 phase でスコープが効く。
- If AI が構造化 schema を返さない場合, gate は PASS を返さずエラー扱いで停止する。

## 移行計画（Backward-Compatible CLI Interface）

本プロジェクトは alpha 版で後方互換コードを保持しない方針だが、以下の移行手順を spec に明記することで利用者への影響をコントロールする:

1. **リリース範囲の告知**: 本変更は破壊的変更であり、旧 `--phase pre|post|impl` は削除される旨を changelog / AGENTS.md（本 spec の finalize で更新）に記載する。
2. **利用者向け置換表**:
   - `--phase pre` および `--phase post` → `--phase spec`
   - `--phase impl` → `--phase task-impl`（親 spec の全体 impl 相当は integration で表現）
3. **skill テンプレートの一括更新**: skill テンプレート内の `--phase` 記述を新名に揃え、`sdd-forge upgrade` の 1 回実行でユーザー環境に反映する手順を README 相当に記載する。
4. **エラーメッセージ**: 旧 phase 名が指定された場合、エラーメッセージに新 phase 名の対応表を埋め込み、利用者が即座に置換できるようにする。
5. **guardrail.json の一括更新**: パッケージ同梱 preset の `meta.phase` は本 spec 内で全件新語彙に更新する。ユーザーカスタム guardrail.json はドキュメントで置換手順を案内する。

## Out of Scope（明示）

- judgment_rules / fail_examples の導入（issue 明示）。
- lint phase の評価変更（T4）。
- spec.md → spec.json 化（T1 / T8）。
- 親 spec / task の並列実行対応（9c3c）。
- 旧 flow.json マイグレーションスクリプト（T11）。
- CLI / skill UX の大規模改訂（本 spec は phase 名追従のみ）。

## 代替案と採否

1. **category を自由文字列** — 却下。preset 間の表記ブレで level 別フィルタが破綻する。
2. **AI 出力を従来の自由行のまま guardrail_id を増やす** — 却下。改行・記号亜種に弱く、決定論化の目的に反する。
3. **gate report を新規ファイルに分離** — 却下。既存の記録経路と重複情報が発生し、参照箇所が増える。
4. **旧 phase 名を alias として残す** — 却下。alpha 方針で後方互換禁止。
5. **level / phase を単一 enum に統合** — 却下。issue が分離を明示。将来 category × level の拡張性も確保しやすい。

## 将来の拡張性への影響

- category enum 追記のみで前方互換の拡張が可能。
- level / phase 二次元化により task 細分化・integration 多段化は phase 側の追加で吸収。
- 評価出力への optional フィールド追加（evidence / 行番号など）を後方互換で行える。

## 優先度付き要件概要

要件は以下の優先度で整理する（spec フェーズで詳細化）。各要件は「When/If + shall」形式で記述する:

**P1（必須基盤）**

- When gate が phase 値を受理するとき, phase enum が新語彙集合（draft / spec / task-spec / task-impl / integration）に限定されていなければならない。
- When level と phase の組合せが評価されるとき, 許容された 5 組以外は invalid として拒否されなければならない。
- When guardrail エントリがロードされるとき, 各エントリが `category` フィールドを enum 値で保持していなければならない。

**P2（必須 API）**

- When AI に評価を依頼するとき, 返却は構造化 schema (`evaluations[{guardrail_id, result, reason}]`) に従っていなければならない。
- If 返却が schema に適合しなかった場合, 処理は PASS を返さず明示的なエラーで停止しなければならない。
- When gate が結果を返すとき, 結果には `level` と `phase` が必須フィールドとして含まれていなければならない。

**P3（必須派生）**

- When パッケージ同梱 preset の guardrail 定義が読まれるとき, 全エントリの phase 語彙と category 語彙が新語彙集合に含まれていなければならない。
- When level 別のチェックが行われるとき, 共通化された評価フローを経由し、level 差分はチェック観点と必須構造の組合せのみに限定されなければならない。
- When skill テンプレートが配布されるとき, 旧 phase 名（pre / post / impl）の呼び出しが残存していてはならない。

**P4（必須運用）**

- When 既存の自動テスト群が実行されるとき, 新 phase enum / 組合せ検証 / schema 検証に関するテストが含まれ、グリーンでなければならない。
- When preset 整合性テストが実行されるとき, guardrail の phase / category 値に対する enum 検証が含まれていなければならない。
- When gate が失敗結果を記録するとき, 既存の記録経路へ level と phase が欠落なく反映されなければならない。

## 受け入れ条件

- [ ] When gate が旧 phase 名で呼ばれたとき, gate は invalid phase としてエラーを返す。
- [ ] When guardrail.json が読まれたとき, 全エントリが category enum 値と新 phase 語彙を満たしている。
- [ ] When gate が実行されたとき, 返却される gate 結果報告に `level`, `phase`, および構造化 evaluations（guardrail_id, result, reason, category）が含まれる。
- [ ] If AI 応答が構造化 schema に合致しない場合, gate は PASS を返さずエラーで停止する。
- [ ] When `npm test` が実行されたとき, 既存・新規テストともパスする。
- [ ] When skill テンプレート群が検索されたとき, 旧 phase 名（pre / post / impl）の文字列が残存しない。

## ユーザー承認

- [x] User approved this draft
- Confirmed at: 2026-04-20
- Notes: 「承認して spec フェーズへ」+「後は auto で進めてください」（autoApprove mode 有効化）
