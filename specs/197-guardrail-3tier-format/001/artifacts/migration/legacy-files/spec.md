# Feature Specification: 197-guardrail-3tier-format

**Feature Branch**: `feature/197-guardrail-3tier-format`
**Created**: 2026-04-20
**Status**: Ready for Review
**Input**: GitHub Issue #184 (cac6/T3)

## Goal

guardrail 評価系を決定論化する。具体的には以下 3 点を満たす:

1. guardrail 定義に `category` フィールドを必須化し、enum 値でグルーピング可能にする。
2. AI が返す評価出力を構造化 schema `{ evaluations: [{guardrail_id, result, reason}] }` に強制し、正規表現による自由行パースを廃止する。
3. gate 結果報告に `level`（parent / task / integration）フィールドを統一付与し、旧 phase 名（pre / post / impl）を新 phase 名（draft / spec / task-spec / task-impl / integration）に置き換える。

実行ロジックは level 差分のみを差し替え可能な共通評価フローへ集約する。`judgment_rules` / `fail_examples` は導入しない。

## Why This Approach

- **決定論化の核心は「AI 出力の構造化」**: 自由行のテキストパースは改行・記号亜種でゆれる。JSON 応答をエラーで昇格させる層を設けるのが最短かつ副作用が小さい。
- **level と phase の二次元化**: issue が分離を明示。category × level の将来拡張性を確保できる。単一 enum への統合案は却下（draft 代替案 5 参照）。
- **alpha 方針に従い旧 phase 名を削除**: 互換 alias は保持しない（CLAUDE.md ルール）。代わりに後述の移行計画でユーザー影響をコントロールする。
- **共通評価フロー**: 既存の level 別分岐コード（draft / pre / impl）に類似構造が重複しており、共通化は CLAUDE.md「2 箇所以上で繰り返されたら抽出」に合致する。

## Scope

1. gate の phase enum を新語彙集合（draft / spec / task-spec / task-impl / integration）に置換し、level enum（parent / task / integration）を追加する。level × phase の許容組合せを単一箇所で検証する。
2. guardrail エントリ schema に `category` enum フィールドを必須追加（`requirements | code-quality | testing | security | process`）。ロード時に欠落・範囲外値をエラーにする。
3. AI への guardrail 評価プロンプトを構造化 schema 前提に書き換える。パース失敗・schema 不適合は PASS にせず処理を停止する。
4. gate が返す結果報告に `level` / `phase` / 構造化 evaluations を必須フィールドとして付与する。level 別の差分は「チェック観点プロンプト」「必須構造チェックの組合せ」のみに閉じる。
5. パッケージ同梱の全 preset `guardrail.json` の `meta.phase` と `category` を新語彙に一括更新する。
6. skill テンプレート（`src/templates/skills/**`）内の旧 phase 名を新 phase 名に更新する。`sdd-forge upgrade` で配布する経路はそのまま利用する。
7. 新 phase / level 検証・構造化 schema パース・preset 整合性のユニットテストを追加する。
8. gate 実行結果の記録経路（spec 配下の issue-log 成果物、gate 返却結果）を level / phase 必須で拡張する。

## Out of Scope

- `judgment_rules` / `fail_examples` の導入（issue 明示）。
- lint phase の評価方式変更（T4）。
- spec.md → spec.json 化（T1 / T8）。
- 親 spec / task の並列実行（9c3c）。
- 旧 flow.json のマイグレーションスクリプト（T11）。
- review / finalize / CLI UX の広範な改訂。
- 利用者カスタム guardrail.json の自動マイグレーション（ドキュメントで手順提示のみ）。

## Clarifications (Q&A)

- Q: category の語彙は？
  - A: enum `requirements | code-quality | testing | security | process`。将来の追加は前方互換で行う。
- Q: AI 評価出力の `result` 値の大文字/小文字は？
  - A: AI 出力は小文字 `pass | fail | skip`。既存の外部報告語彙（大文字 `PASS/FAIL/SKIP`）は normalize 層で維持する。
- Q: level × phase の許容組合せは？
  - A: (parent, draft) / (parent, spec) / (task, task-spec) / (task, task-impl) / (integration, integration) の 5 組のみ。
- Q: 旧 phase 名の扱いは？
  - A: alpha 方針で後方互換なし。`pre / post / impl` は enum から削除し、受理しない。
- Q: gate report の保存先は？
  - A: 既存経路（spec 配下 issue-log 成果物 + gate 返却結果）の拡張。新規ファイルは作らない。
- Q: schema 不適合時の挙動は？
  - A: PASS を返さず、パース/検証エラーとして即停止する（`exit code != 0`）。
- Q: Issue #180 由来の diff-scope 指示の適用範囲は？
  - A: task-impl と integration の両 phase で適用する。

## Migration Plan

alpha 方針で後方互換コードは保持しないが、利用者影響をコントロールするため以下を spec 実装時に含める:

1. **変更告知**: 本 spec は破壊的変更を含む旨を変更履歴（AGENTS.md / changelog 等）に記載する。
2. **置換表**: `--phase pre|post` → `--phase spec`、`--phase impl` → `--phase task-impl`（親 spec 全体 impl 相当は integration 側）。
3. **skill テンプレート一括更新**: テンプレート側を新 phase 名に揃え、`sdd-forge upgrade` 1 回でユーザー環境に反映する手順を提示する。
4. **エラーメッセージ**: 旧 phase 名が指定された場合、エラー本文に新 phase への対応表を埋め込む（ユーザーが即置換できるようにする）。
5. **guardrail.json**: 同梱 preset は本 spec 内で一括更新。ユーザーカスタム guardrail.json は置換手順をドキュメントに記載する。

## Alternatives Considered

1. **category を自由文字列** — 却下。preset 間の表記ブレで将来 level 別フィルタが破綻する。
2. **自由行出力のまま guardrail_id を付加** — 却下。改行・記号亜種に弱く、決定論化目的に反する。
3. **gate report を新規ファイルへ分離** — 却下。記録経路を増やすと参照箇所が散る。
4. **旧 phase 名を alias として残す** — 却下。alpha 方針（CLAUDE.md）で後方互換禁止。
5. **level / phase を単一 enum に統合** — 却下。issue が分離を明示。category × level 拡張も見込めない。
6. **`judgment_rules` / `fail_examples` を併導入** — 却下。issue 明示で Out of Scope。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-20
- Notes: draft 承認 + auto mode 指示（「1 後はautoで進めてください」）に基づき spec 化。

## Requirements

本 spec の要件は優先度順（P1 = 必須基盤、P2 = 必須 API、P3 = 必須派生、P4 = 必須運用）で整理する。

### P1 — 必須基盤

- **REQ-1**: When gate コマンドが phase 値を受理するとき, phase enum は `draft | spec | task-spec | task-impl | integration` に限定され、それ以外の値は invalid phase エラーで拒否されなければならない。
- **REQ-2**: When gate が level と phase の組合せを評価するとき, 許容された 5 組（(parent,draft)/(parent,spec)/(task,task-spec)/(task,task-impl)/(integration,integration)）以外は invalid として拒否されなければならない。
- **REQ-3**: When guardrail エントリが読み込まれるとき, 各エントリは `category` を必須フィールドとして enum 値（`requirements | code-quality | testing | security | process`）で保持していなければならない。
- **REQ-4**: If guardrail エントリが `category` を欠落しているか enum 範囲外の値を持つ場合, ロード処理は PASS を返さず明示的なエラーで停止しなければならない。

### P2 — 必須 API

- **REQ-5**: When AI に guardrail 評価を依頼するとき, プロンプトは構造化 schema `{ "evaluations": [{"guardrail_id": string, "result": "pass"|"fail"|"skip", "reason": string}] }` の返却を指定しなければならない。
- **REQ-6**: If AI 応答が上記 schema に適合しなかった場合, 呼び出し側は PASS を返さず明示的なエラーで停止し、non-zero exit code を返さなければならない。
- **REQ-7**: When AI 応答に未知の `guardrail_id` や重複 id が含まれる場合, 呼び出し側はそれを検知してエラー扱いで停止しなければならない（SILENT に破棄してはならない）。
- **REQ-8**: When gate が結果を返すとき, 結果には `level`, `phase`, 構造化された `evaluations`（各エントリは `guardrail_id` / `result` / `reason` / `category` を持つ）が必須フィールドとして含まれていなければならない。

### P3 — 必須派生

- **REQ-9**: When パッケージ同梱 preset の guardrail 定義が読まれるとき, 全エントリの `meta.phase` 値が新語彙集合（`draft | spec | task-spec | task-impl | integration | lint`）に含まれていなければならない。
- **REQ-10**: When パッケージ同梱 preset の guardrail 定義が読まれるとき, 全エントリの `category` 値が enum 集合に含まれていなければならない。
- **REQ-11**: When level 別のチェックが行われるとき, gate 実装は共通化された評価フローを経由し、level 差分はチェック観点と必須構造の組合せのみに限定されなければならない。
- **REQ-12**: When skill テンプレートが読まれるとき, 旧 phase 名（`pre` / `post` / `impl`）の gate 呼び出し記述が残存していてはならない。

### P4 — 必須運用

- **REQ-13**: When `npm test` が実行されるとき, 新 phase enum の検証・level/phase 組合せ検証・構造化 schema パースの失敗系を含む formal テストが含まれ、全てパスしなければならない。
- **REQ-14**: When preset 整合性テストが実行されるとき, guardrail の `phase` と `category` に対する enum 検証が含まれていなければならない。
- **REQ-15**: When gate が失敗結果を記録するとき, 既存の記録経路（spec 配下 issue-log 成果物）に level と phase が欠落なく反映されなければならない。
- **REQ-16**: When Issue #180 由来の diff-scope 制約が適用されるとき, task-impl と integration の両 phase でスコープが効かなければならない。

## Acceptance Criteria

- Gate CLI が旧 phase 名（pre/post/impl）に対して invalid phase エラー（non-zero exit）を返す。
- Gate CLI が新 phase 名で実行した結果に `level` / `phase` / 構造化 `evaluations` が欠落なく含まれる。
- 全 preset の guardrail.json が新 phase / category 語彙を満たす（preset 整合性テストで検証）。
- AI が構造化 schema を返さないケースで gate が PASS せずエラー停止する（ユニットテストで検証）。
- `grep -r "--phase pre\|--phase post\|--phase impl" src/templates/skills/` が 0 件である。
- `npm test` が全てグリーン。

## Open Questions

（現在未解決のオープンな論点はない。解決済み論点は Clarifications (Q&A) を参照。）

## User Scenarios & Testing

- **Scenario 1 (happy path)**: ユーザーが `sdd-forge flow run gate --phase spec` を実行し、AI が schema 準拠の JSON を返す。結果は level=parent, phase=spec, evaluations[] を含む。
- **Scenario 2 (invalid phase)**: ユーザーが旧 `--phase pre` を実行する。エラー出力に「use --phase spec instead」相当のヒントが表示され、non-zero で終了する。
- **Scenario 3 (malformed AI response)**: AI が自由行テキストを返す。gate は PASS を返さず、schema 検証失敗のエラーで停止する。
- **Scenario 4 (task-level gate)**: T2 の task スコープから呼ばれた gate が level=task, phase=task-impl の結果を返す。IMPL_DIFF_SCOPE_LINES 相当の diff スコープ制約が有効化される。
- **Scenario 5 (integration-level gate)**: integration-origin task から gate が呼ばれ、level=integration, phase=integration で結果が返る。
- **Scenario 6 (preset guardrail load)**: 不正な category 値を持つ guardrail.json を用意し、ロード時にエラーが出ることを確認する。
